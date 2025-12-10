/**
 * Moderation Middleware for Cloud Provider APIs
 *
 * Intercepts inference requests to cloud providers and:
 * 1. Checks content against moderation policies
 * 2. Records incidents for governance
 * 3. Integrates with ban system
 * 4. Provides audit trail
 */

import type { Address } from 'viem';
import {
  ContentModerator,
  type ContentModerationConfig,
  type ModerationIncident,
  type ModerationResult,
  type IncidentStorage,
  type ContentCategory,
  MemoryIncidentStorage,
  SeverityEnum,
  ContentCategoryEnum,
} from './content-moderation';
import type { BanRecord, ModerationSDK } from './moderation';

// ============================================================================
// Types
// ============================================================================

export interface ModerationMiddlewareConfig {
  // Content moderation
  moderationConfig?: Partial<ContentModerationConfig>;
  
  // Storage
  incidentStorage?: IncidentStorage;
  
  // Governance integration
  moderationSDK?: ModerationSDK;
  
  // Auto-moderation settings
  autoBlockOnCritical: boolean;
  autoBanThreshold: number;  // Number of high+ severity incidents before auto-ban
  autoBanWindowHours: number;  // Time window for counting incidents
  
  // Rate limiting
  maxRequestsPerMinute: number;
  maxFlagsBeforeThrottle: number;
  
  // Callbacks
  onBlock?: (incident: ModerationIncident) => Promise<void>;
  onAutoBan?: (userAddress: Address, incidents: ModerationIncident[]) => Promise<void>;
}

export interface ModerationContext {
  userAddress: Address;
  providerAddress?: Address;
  modelId: string;
  requestType: 'inference' | 'image' | 'video' | 'audio';
  agentId?: bigint;  // ERC-8004 agent ID if available
}

export interface ModerationCheckResult {
  allowed: boolean;
  reason?: string;
  incident?: ModerationIncident;
  userBanned: boolean;
  rateLimited: boolean;
}

// ============================================================================
// User Tracking
// ============================================================================

interface UserTracker {
  requestCount: number;
  flagCount: number;
  recentIncidents: ModerationIncident[];
  lastRequest: number;
  windowStart: number;  // Start of current rate limit window
  throttledUntil: number | null;
}

// ============================================================================
// Moderation Middleware
// ============================================================================

export class ModerationMiddleware {
  private config: ModerationMiddlewareConfig;
  private moderator: ContentModerator;
  private storage: IncidentStorage;
  private userTrackers: Map<Address, UserTracker> = new Map();

  constructor(config: Partial<ModerationMiddlewareConfig> = {}) {
    this.config = {
      autoBlockOnCritical: true,
      autoBanThreshold: 5,
      autoBanWindowHours: 24,
      maxRequestsPerMinute: 60,
      maxFlagsBeforeThrottle: 10,
      ...config,
    };

    this.storage = config.incidentStorage ?? new MemoryIncidentStorage();

    this.moderator = new ContentModerator({
      ...config.moderationConfig,
      recordIncidents: true,
      onIncident: async (incident) => {
        await this.storage.save(incident);
        await this.handleIncident(incident);
      },
    });
  }

  /**
   * Check content before allowing request to proceed
   */
  async checkRequest(
    content: string,
    context: ModerationContext
  ): Promise<ModerationCheckResult> {
    // Check if user is banned
    if (context.agentId && this.config.moderationSDK) {
      const banned = await this.checkBanStatus(context.agentId);
      if (banned.isBanned) {
        return {
          allowed: false,
          reason: `User banned: ${banned.reason}`,
          userBanned: true,
          rateLimited: false,
        };
      }
    }

    // Check rate limiting
    const tracker = this.getOrCreateTracker(context.userAddress);
    const rateLimited = this.checkRateLimit(tracker);
    if (rateLimited) {
      return {
        allowed: false,
        reason: 'Rate limited due to excessive requests or flags',
        userBanned: false,
        rateLimited: true,
      };
    }

    // Run content moderation
    const result = await this.moderator.moderate(content, {
      userAddress: context.userAddress,
      providerAddress: context.providerAddress,
      modelId: context.modelId,
      requestType: context.requestType,
    });

    // Update tracker
    tracker.requestCount++;
    tracker.lastRequest = Date.now();
    if (result.flags.length > 0) {
      tracker.flagCount++;
    }

    // Get incident if one was created
    const incident = result.incidentId
      ? await this.storage.get(result.incidentId)
      : undefined;

    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : this.formatBlockReason(result),
      incident: incident ?? undefined,
      userBanned: false,
      rateLimited: false,
    };
  }

  /**
   * Check output content (for monitoring generated content)
   */
  async checkOutput(
    output: string,
    context: ModerationContext,
    inputIncidentId?: string
  ): Promise<ModerationResult> {
    const result = await this.moderator.moderate(output, {
      userAddress: context.userAddress,
      providerAddress: context.providerAddress,
      modelId: context.modelId,
      requestType: context.requestType,
    });

    // Link to input incident if available
    if (inputIncidentId && result.incidentId) {
      const incident = await this.storage.get(result.incidentId);
      if (incident) {
        // Store reference to input incident in notes
        await this.storage.update({
          ...incident,
          reviewNotes: `Output check for input incident: ${inputIncidentId}`,
        });
      }
    }

    return result;
  }

  /**
   * Handle moderation incident
   */
  private async handleIncident(incident: ModerationIncident): Promise<void> {
    // Update tracker
    const tracker = this.getOrCreateTracker(incident.userAddress);
    tracker.recentIncidents.push(incident);
    
    // Clean old incidents outside window
    const windowStart = Date.now() - (this.config.autoBanWindowHours * 60 * 60 * 1000);
    tracker.recentIncidents = tracker.recentIncidents.filter(
      i => i.timestamp > windowStart
    );

    // Check for auto-ban
    const highSeverityCount = tracker.recentIncidents.filter(
      i => i.highestSeverity >= SeverityEnum.HIGH
    ).length;

    if (highSeverityCount >= this.config.autoBanThreshold) {
      await this.triggerAutoBan(incident.userAddress, tracker.recentIncidents);
    }

    // Call block callback if content was blocked
    if (incident.blocked && this.config.onBlock) {
      await this.config.onBlock(incident);
    }
  }

  /**
   * Trigger auto-ban for user
   */
  private async triggerAutoBan(
    userAddress: Address,
    incidents: ModerationIncident[]
  ): Promise<void> {
    console.warn(`[ModerationMiddleware] Auto-ban triggered for ${userAddress}`);
    
    if (this.config.onAutoBan) {
      await this.config.onAutoBan(userAddress, incidents);
    }
  }

  /**
   * Check ban status via governance system
   */
  private async checkBanStatus(agentId: bigint): Promise<BanRecord> {
    if (!this.config.moderationSDK) {
      return { isBanned: false, bannedAt: 0, reason: '', proposalId: '' };
    }

    return this.config.moderationSDK.getNetworkBan(agentId);
  }

  /**
   * Check rate limiting for user
   */
  private checkRateLimit(tracker: UserTracker): boolean {
    const now = Date.now();
    
    // Check if currently throttled
    if (tracker.throttledUntil && now < tracker.throttledUntil) {
      return true;
    }
    
    // Reset throttle if expired
    if (tracker.throttledUntil && now >= tracker.throttledUntil) {
      tracker.throttledUntil = null;
    }

    // Reset counters if window has passed (sliding window)
    const windowDuration = 60000; // 1 minute
    if (now - tracker.windowStart > windowDuration) {
      tracker.windowStart = now;
      tracker.requestCount = 0;
      tracker.flagCount = 0;
    }

    // Check request rate
    if (tracker.requestCount >= this.config.maxRequestsPerMinute) {
      tracker.throttledUntil = now + 60000; // Throttle for 1 minute
      return true;
    }

    // Check flag count
    if (tracker.flagCount >= this.config.maxFlagsBeforeThrottle) {
      tracker.throttledUntil = now + 300000; // Throttle for 5 minutes
      return true;
    }

    return false;
  }

  /**
   * Get or create user tracker
   */
  private getOrCreateTracker(userAddress: Address): UserTracker {
    let tracker = this.userTrackers.get(userAddress);
    if (!tracker) {
      tracker = {
        requestCount: 0,
        flagCount: 0,
        recentIncidents: [],
        lastRequest: 0,
        windowStart: Date.now(),
        throttledUntil: null,
      };
      this.userTrackers.set(userAddress, tracker);
    }
    return tracker;
  }

  /**
   * Format block reason from moderation result
   */
  private formatBlockReason(result: ModerationResult): string {
    if (result.flags.length === 0) {
      return 'Content blocked by policy';
    }

    const categories = result.flags.map(f => 
      ContentModerator.getCategoryName(f.category)
    );
    const uniqueCategories = [...new Set(categories)];
    
    return `Content blocked: ${uniqueCategories.join(', ')}`;
  }

  // ============================================================================
  // Analytics & Reporting
  // ============================================================================

  /**
   * Get moderation statistics for a user
   */
  async getUserStats(userAddress: Address): Promise<{
    totalIncidents: number;
    blockedCount: number;
    reviewedCount: number;
    falsePositiveCount: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const incidents = await this.storage.getByUser(userAddress, 1000);
    
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let blockedCount = 0;
    let reviewedCount = 0;
    let falsePositiveCount = 0;

    for (const incident of incidents) {
      if (incident.blocked) blockedCount++;
      if (incident.reviewed) {
        reviewedCount++;
        if (incident.reviewOutcome === 'false_positive') falsePositiveCount++;
      }

      const severityName = ContentModerator.getSeverityName(incident.highestSeverity);
      bySeverity[severityName] = (bySeverity[severityName] ?? 0) + 1;

      for (const flag of incident.flags) {
        const categoryName = ContentModerator.getCategoryName(flag.category);
        byCategory[categoryName] = (byCategory[categoryName] ?? 0) + 1;
      }
    }

    return {
      totalIncidents: incidents.length,
      blockedCount,
      reviewedCount,
      falsePositiveCount,
      bySeverity,
      byCategory,
    };
  }

  /**
   * Get incidents pending review
   */
  async getPendingReviews(limit = 100): Promise<ModerationIncident[]> {
    return this.storage.getUnreviewed(limit);
  }

  /**
   * Get training data for a specific category
   */
  async getTrainingData(
    category?: ContentCategory,
    limit = 1000
  ): Promise<ModerationIncident[]> {
    return this.storage.getForTraining(category, limit);
  }

  /**
   * Export training data in standard format
   */
  async exportTrainingData(category?: ContentCategory): Promise<Array<{
    text: string;
    label: string;
    confidence: number;
    reviewed: boolean;
  }>> {
    const incidents = await this.getTrainingData(category);
    
    return incidents.map(i => ({
      text: i.inputContent,
      label: ContentModerator.getCategoryName(i.trainingLabel ?? i.flags[0]?.category ?? ContentCategoryEnum.SAFE),
      confidence: i.flags[0]?.confidence ?? 0,
      reviewed: i.reviewed,
    }));
  }

  // ============================================================================
  // Review Interface
  // ============================================================================

  /**
   * Mark incident as reviewed
   */
  async reviewIncident(
    incidentId: string,
    review: {
      reviewedBy: Address;
      outcome: 'confirmed' | 'false_positive' | 'escalated';
      notes?: string;
      useForTraining?: boolean;
      trainingLabel?: ContentCategory;
    }
  ): Promise<ModerationIncident | null> {
    const incident = await this.storage.get(incidentId);
    if (!incident) return null;

    const updated: ModerationIncident = {
      ...incident,
      reviewed: true,
      reviewedBy: review.reviewedBy,
      reviewedAt: Date.now(),
      reviewOutcome: review.outcome,
      reviewNotes: review.notes,
      useForTraining: review.useForTraining ?? (review.outcome !== 'false_positive'),
      trainingLabel: review.trainingLabel,
    };

    await this.storage.update(updated);
    return updated;
  }

  /**
   * Bulk review incidents
   */
  async bulkReview(
    incidentIds: string[],
    review: {
      reviewedBy: Address;
      outcome: 'confirmed' | 'false_positive' | 'escalated';
    }
  ): Promise<number> {
    let count = 0;
    for (const id of incidentIds) {
      const result = await this.reviewIncident(id, review);
      if (result) count++;
    }
    return count;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getStorage(): IncidentStorage {
    return this.storage;
  }

  getModerator(): ContentModerator {
    return this.moderator;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create moderation middleware with default settings
 */
export function createModerationMiddleware(
  config?: Partial<ModerationMiddlewareConfig>
): ModerationMiddleware {
  return new ModerationMiddleware(config);
}

/**
 * Create moderation middleware with full governance integration
 * 
 * Note: This is async because it dynamically imports the moderation SDK
 * to avoid circular dependencies.
 */
export async function createFullModerationSystem(config: {
  rpcUrl: string;
  stakingAddress: string;
  banManagerAddress: string;
  aiEndpoint?: string;
  aiModel?: string;
  incidentStorage?: IncidentStorage;
}): Promise<ModerationMiddleware> {
  // Dynamic import to avoid circular dependency
  const { createModerationSDK } = await import('./moderation');
  
  const moderationSDK = createModerationSDK({
    rpcUrl: config.rpcUrl,
    stakingAddress: config.stakingAddress,
    banManagerAddress: config.banManagerAddress,
  });

  return new ModerationMiddleware({
    incidentStorage: config.incidentStorage,
    moderationSDK,
    moderationConfig: {
      enableLocalFilter: true,
      enableAIClassifier: !!config.aiEndpoint,
      aiClassifierEndpoint: config.aiEndpoint,
      aiClassifierModel: config.aiModel,
    },
    autoBlockOnCritical: true,
    autoBanThreshold: 5,
    autoBanWindowHours: 24,
    maxRequestsPerMinute: 60,
    maxFlagsBeforeThrottle: 10,
  });
}
