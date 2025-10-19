import {
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  type HandlerCallback,
  type ProviderResult,
  ModelType,
} from '@elizaos/core';
import { ExperienceService } from '../service';
import { ExperienceType, OutcomeType } from '../types';

export const experienceEvaluator: Evaluator = {
  name: 'EXPERIENCE_EVALUATOR',
  similes: ['experience recorder', 'learning evaluator', 'self-reflection'],
  description: 'Periodically analyzes conversation patterns to extract novel learning experiences',
  alwaysRun: false,

  examples: [
    {
      prompt: 'The agent successfully executed a shell command after initially failing',
      messages: [
        {
          name: 'Autoliza',
          content: {
            text: 'Let me try to run this Python script.',
          },
        },
        {
          name: 'Autoliza',
          content: {
            text: 'Error: ModuleNotFoundError for pandas. I need to install it first.',
          },
        },
        {
          name: 'Autoliza',
          content: {
            text: 'After installing pandas, the script ran successfully and produced the expected output.',
          },
        },
      ],
      outcome:
        'Record a CORRECTION experience about needing to install dependencies before running Python scripts',
    },
    {
      prompt: 'The agent discovered a new system capability',
      messages: [
        {
          name: 'Autoliza',
          content: {
            text: 'I found that the system has jq installed, which is perfect for parsing JSON data.',
          },
        },
      ],
      outcome: 'Record a DISCOVERY experience about the availability of jq for JSON processing',
    },
  ],

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    // Only run every 10 messages and only on agent messages
    if (message.entityId !== runtime.agentId) {
      return false;
    }

    // Check cooldown - only extract experiences every 10 messages
    const lastExtractionKey = 'experience-extraction:last-message-count';
    const currentCount = (await runtime.getCache<string>(lastExtractionKey)) || '0';
    const messageCount = parseInt(currentCount, 10);
    const newMessageCount = messageCount + 1;

    await runtime.setCache(lastExtractionKey, newMessageCount.toString());

    // Trigger extraction every 10 messages
    const shouldExtract = newMessageCount % 10 === 0;

    if (shouldExtract) {
      logger.info(
        `[experienceEvaluator] Triggering experience extraction after ${newMessageCount} messages`
      );
    }

    return shouldExtract;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
    responses?: Memory[]
  ): Promise<void> {
    const experienceService = runtime.getService('EXPERIENCE') as ExperienceService;

    if (!experienceService) {
      logger.warn('[experienceEvaluator] Experience service not available');
      return;
    }

    // Get last 10 messages as context for analysis
    const recentMessages = state?.recentMessagesData?.slice(-10) || [];
    if (recentMessages.length < 3) {
      logger.debug('[experienceEvaluator] Not enough messages for experience extraction');
      return;
    }

    // Combine recent messages into analysis context
    const conversationContext = recentMessages
      .map((m) => m.content.text)
      .filter(Boolean)
      .join(' ');

    // Query existing experiences for similarity check
    const existingExperiences = await experienceService.queryExperiences({
      query: conversationContext,
      limit: 10,
      minConfidence: 0.7,
    });

    // Use LLM to extract novel experiences from the conversation
    const extractionPrompt = `Analyze this conversation for novel learning experiences that would be surprising or valuable to remember.

Conversation context:
${conversationContext}

Existing similar experiences:
${existingExperiences.map((exp) => `- ${exp.learning}`).join('\n') || 'None'}

Extract ONLY experiences that are:
1. Genuinely novel (not in existing experiences)
2. Actionable learnings about how things work
3. Corrections of previous mistakes or assumptions
4. Discoveries of new capabilities or patterns
5. Surprising outcomes that contradict expectations

Focus on technical knowledge, patterns, and cause-effect relationships that transfer to other contexts.
Avoid personal details, user-specific information, or routine interactions.

Respond with JSON array of experiences (max 3):
[{
  "type": "DISCOVERY|CORRECTION|SUCCESS|LEARNING",
  "learning": "What was learned (generic, transferable)",
  "context": "What situation triggered this (anonymized)",
  "confidence": 0.0-1.0,
  "reasoning": "Why this is novel and valuable"
}]

Return empty array [] if no novel experiences found.`;

    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: extractionPrompt,
    });

    let experiences: any[] = [];
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      experiences = JSON.parse(jsonMatch[0]);
    }

    // Record each novel experience
    for (const exp of experiences.slice(0, 3)) {
      // Max 3 experiences per extraction
      if (!exp.learning || !exp.confidence || exp.confidence < 0.6) {
        continue;
      }

      const experienceType =
        {
          DISCOVERY: ExperienceType.DISCOVERY,
          CORRECTION: ExperienceType.CORRECTION,
          SUCCESS: ExperienceType.SUCCESS,
          LEARNING: ExperienceType.LEARNING,
        }[exp.type] || ExperienceType.LEARNING;

      await experienceService.recordExperience({
        type: experienceType,
        outcome:
          experienceType === ExperienceType.CORRECTION ? OutcomeType.POSITIVE : OutcomeType.NEUTRAL,
        context: sanitizeContext(exp.context || 'Conversation analysis'),
        action: 'pattern_recognition',
        result: exp.learning,
        learning: sanitizeContext(exp.learning),
        domain: detectDomain(exp.learning),
        tags: ['extracted', 'novel', exp.type.toLowerCase()],
        confidence: Math.min(exp.confidence, 0.9), // Cap confidence
        importance: 0.8, // High importance for extracted experiences
      });

      logger.info(
        `[experienceEvaluator] Recorded novel experience: ${exp.learning.substring(0, 100)}...`
      );
    }

    if (experiences.length > 0) {
      logger.info(
        `[experienceEvaluator] Extracted ${experiences.length} novel experiences from conversation`
      );
    } else {
      logger.debug(`[experienceEvaluator] No novel experiences found in recent conversation`);
    }
  },
};

// Helper functions

function sanitizeContext(text: string): string {
  if (!text) return 'Unknown context';

  // Remove user-specific details while preserving technical context
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // emails
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]') // IP addresses
    .replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]') // user directories
    .replace(/\/home\/[^\/\s]+/g, '/home/[USER]') // home directories
    .replace(/\b[A-Z0-9]{20,}\b/g, '[TOKEN]') // API keys/tokens
    .replace(/\b(user|person|someone|they)\s+(said|asked|told|mentioned)/gi, 'when asked') // personal references
    .substring(0, 200); // limit length
}

function detectDomain(text: string): string {
  const domains = {
    shell: ['command', 'terminal', 'bash', 'shell', 'execute', 'script', 'cli'],
    coding: [
      'code',
      'function',
      'variable',
      'syntax',
      'programming',
      'debug',
      'typescript',
      'javascript',
    ],
    system: ['file', 'directory', 'process', 'memory', 'cpu', 'system', 'install', 'package'],
    network: ['http', 'api', 'request', 'response', 'url', 'network', 'fetch', 'curl'],
    data: ['json', 'csv', 'database', 'query', 'data', 'sql', 'table'],
    ai: ['model', 'llm', 'embedding', 'prompt', 'token', 'inference'],
  };

  const lowerText = text.toLowerCase();

  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some((keyword) => lowerText.includes(keyword))) {
      return domain;
    }
  }

  return 'general';
}
