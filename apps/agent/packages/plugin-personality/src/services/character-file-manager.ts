import {
  Service,
  type IAgentRuntime,
  logger,
  type MessageExample,
  MemoryType,
} from '@elizaos/core';
import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import { PersonalityServiceType } from '../types';

// Validation schema for character modifications
const CharacterModificationSchema = z.object({
  name: z.string().optional().describe('Character name'),
  system: z
    .string()
    .optional()
    .describe('System prompt that defines agent behavior and instructions'),
  bio: z.array(z.string()).optional(),
  messageExamples: z
    .array(
      z.array(
        z.object({
          name: z.string(),
          content: z.object({
            text: z.string(),
            actions: z.array(z.string()).optional(),
          }),
        })
      )
    )
    .optional(),
  topics: z.array(z.string()).optional(),
  style: z
    .object({
      all: z.array(z.string()).optional(),
      chat: z.array(z.string()).optional(),
      post: z.array(z.string()).optional(),
    })
    .optional(),
  settings: z.record(z.any()).optional(),
});

type CharacterModification = z.infer<typeof CharacterModificationSchema>;

/**
 * Service for safely managing character file modifications
 * Handles backup, validation, and atomic updates of character files
 */
export class CharacterFileManager extends Service {
  static serviceType = PersonalityServiceType.CHARACTER_MANAGEMENT;

  capabilityDescription = 'Manages safe character file modifications with backup and validation';

  protected runtime: IAgentRuntime;
  private characterFilePath: string | null = null;
  private backupDir: string;
  private maxBackups = 10;
  private validationRules: Map<string, (value: any) => boolean> = new Map();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.runtime = runtime;
    this.backupDir = path.join(process.cwd(), '.eliza', 'character-backups');
    this.setupValidationRules();
  }

  static async start(runtime: IAgentRuntime): Promise<CharacterFileManager> {
    const manager = new CharacterFileManager(runtime);
    await manager.initialize();
    return manager;
  }

  private async initialize(): Promise<void> {
    // Ensure backup directory exists
    await fs.ensureDir(this.backupDir);

    // Try to detect the character file path
    await this.detectCharacterFile();

    logger.info('CharacterFileManager initialized', {
      characterFile: this.characterFilePath,
      backupDir: this.backupDir,
    });
  }

  private async detectCharacterFile(): Promise<void> {
    const character = this.runtime.character;

    // Look for character file in common locations
    const possiblePaths = [
      // Current working directory
      path.join(process.cwd(), `${character.name}.json`),
      path.join(process.cwd(), 'character.json'),

      // Agent directory
      path.join(process.cwd(), 'agent', `${character.name}.json`),
      path.join(process.cwd(), 'agent', 'character.json'),

      // Characters directory
      path.join(process.cwd(), 'characters', `${character.name}.json`),
      path.join(process.cwd(), 'characters', 'character.json'),

      // Relative paths
      path.join(process.cwd(), '..', 'characters', `${character.name}.json`),
      path.join(process.cwd(), '..', '..', 'characters', `${character.name}.json`),
    ];

    for (const filePath of possiblePaths) {
      if (await fs.pathExists(filePath)) {
        
          const content = await fs.readJSON(filePath);
          if (content.name === character.name) {
            this.characterFilePath = filePath;
            logger.info('Character file detected', { path: filePath });
            return;
          }
        
      }
    }

    logger.warn('Character file not found, modifications will be memory-only');
  }

  private setupValidationRules(): void {
    // Name validation - ensure safe and reasonable names
    this.validationRules.set('name', (name: string) => {
      if (typeof name !== 'string') {
        return false;
      }
      return (
        name.length > 0 &&
        name.length < 100 &&
        /^[a-zA-Z0-9\s\-_]+$/.test(name) && // Alphanumeric, spaces, hyphens, underscores only
        !name.toLowerCase().includes('admin') && // Prevent impersonation
        !name.toLowerCase().includes('system') &&
        !name.toLowerCase().includes('root') &&
        !name.trim().startsWith(' ') && // No leading/trailing spaces
        !name.trim().endsWith(' ')
      );
    });

    // System prompt validation - ensure safe and reasonable content
    this.validationRules.set('system', (system: string) => {
      if (typeof system !== 'string') {
        return false;
      }
      return (
        system.length > 10 && // Minimum meaningful length
        system.length < 10000 && // Maximum reasonable length
        !system.includes('<script>') && // Basic XSS protection
        !system.includes('javascript:') &&
        !system.includes('eval(') &&
        !system.includes('Function(') &&
        !system.toLowerCase().includes('ignore previous instructions') && // Prompt injection protection
        !system.toLowerCase().includes('disregard') &&
        !system.toLowerCase().includes('forget everything')
      );
    });

    // Bio validation - ensure reasonable length and content
    this.validationRules.set('bio', (bio: string[]) => {
      if (!Array.isArray(bio)) {
        return false;
      }
      return bio.every(
        (item) =>
          typeof item === 'string' &&
          item.length > 0 &&
          item.length < 500 &&
          !item.includes('<script>') && // Basic XSS protection
          !item.includes('javascript:')
      );
    });

    // Topics validation
    this.validationRules.set('topics', (topics: string[]) => {
      if (!Array.isArray(topics)) {
        return false;
      }
      return topics.every(
        (topic) =>
          typeof topic === 'string' &&
          topic.length > 0 &&
          topic.length < 100 &&
          /^[a-zA-Z0-9\s\-_]+$/.test(topic) // Alphanumeric, spaces, hyphens, underscores only
      );
    });
  }

  async createBackup(): Promise<string | null> {
    if (!this.characterFilePath) {
      logger.warn('No character file path available for backup');
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${path.basename(this.characterFilePath, '.json')}-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      await fs.copy(this.characterFilePath, backupPath);

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info('Character backup created', { backupPath });
      return backupPath;
    } catch (error) {
      logger.error('Failed to create character backup', error);
      return null;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => ({
          name: file,
          path: path.join(this.backupDir, file),
          stat: fs.statSync(path.join(this.backupDir, file)),
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Keep only the most recent backups
      const filesToDelete = backupFiles.slice(this.maxBackups);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
      }

      if (filesToDelete.length > 0) {
        logger.info(`Cleaned up ${filesToDelete.length} old backups`);
      }
    } catch (error) {
      logger.error('Error cleaning up old backups', error);
    }
  }

  validateModification(modification: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Schema validation
      CharacterModificationSchema.parse(modification);
    } catch (error) {
      errors.push(`Schema validation failed: ${(error as Error).message}`);
      return { valid: false, errors };
    }

    // Additional validation rules
    for (const [field, validator] of this.validationRules.entries()) {
      if (modification[field] !== undefined) {
        if (!validator(modification[field])) {
          errors.push(`Invalid ${field}: failed validation rules`);
        }
      }
    }

    // Safety checks
    if (modification.bio && modification.bio.length > 20) {
      errors.push('Too many bio elements - maximum 20 allowed');
    }

    if (modification.topics && modification.topics.length > 50) {
      errors.push('Too many topics - maximum 50 allowed');
    }

    return { valid: errors.length === 0, errors };
  }

  async applyModification(
    modification: CharacterModification
  ): Promise<{ success: boolean; error?: string }> {
    // Validate modification
    const validation = this.validateModification(modification);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    try {
      // Create backup first
      await this.createBackup();

      // Get current character
      const currentCharacter = { ...this.runtime.character };

      // Apply modifications using merge logic (additive, not replacement)

      // Handle name modification - direct replacement
      if (modification.name) {
        const oldName = currentCharacter.name;
        currentCharacter.name = modification.name;
        logger.info('Character name changed', {
          oldName,
          newName: modification.name,
        });
      }

      // Handle system prompt modification - this is a direct replacement, not additive
      if (modification.system) {
        const oldSystem = currentCharacter.system || 'No system prompt';
        currentCharacter.system = modification.system;

        logger.info('System prompt modified', {
          oldLength: oldSystem.length,
          newLength: modification.system.length,
          changed: oldSystem !== modification.system,
        });
      }

      if (modification.bio) {
        const currentBio = Array.isArray(currentCharacter.bio)
          ? currentCharacter.bio
          : [currentCharacter.bio];

        // Add new bio elements, avoiding duplicates
        const newBioElements = modification.bio.filter(
          (newBio) =>
            !currentBio.some(
              (existing) =>
                existing.toLowerCase().includes(newBio.toLowerCase()) ||
                newBio.toLowerCase().includes(existing.toLowerCase())
            )
        );

        currentCharacter.bio = [...currentBio, ...newBioElements];
      }

      if (modification.topics) {
        const currentTopics = currentCharacter.topics || [];
        const newTopics = modification.topics.filter((topic) => !currentTopics.includes(topic));
        currentCharacter.topics = [...currentTopics, ...newTopics];
      }

      if (modification.messageExamples) {
        const currentExamples = currentCharacter.messageExamples || [];
        currentCharacter.messageExamples = [
          ...currentExamples,
          ...modification.messageExamples,
        ] as MessageExample[][];
      }

      if (modification.style) {
        currentCharacter.style = {
          ...currentCharacter.style,
          ...modification.style,
        };
      }

      if (modification.settings) {
        currentCharacter.settings = {
          ...currentCharacter.settings,
          ...modification.settings,
        };
      }

      // Update runtime character
      Object.assign(this.runtime.character, currentCharacter);

      // Write to file if available
      if (this.characterFilePath) {
        await fs.writeJSON(this.characterFilePath, currentCharacter, { spaces: 2 });
        logger.info('Character file updated successfully');
      }

      // Log the modification - need roomId for memory creation
      const dummyRoomId = this.runtime.agentId; // Use agentId as fallback roomId
      await this.runtime.createMemory(
        {
          entityId: this.runtime.agentId,
          roomId: dummyRoomId,
          content: {
            text: `Character modification applied to file: ${this.characterFilePath || 'memory-only'}`,
            source: 'character_modification',
          },
          metadata: {
            type: MemoryType.CUSTOM,
            service: PersonalityServiceType,
            action: 'character_modified',
            timestamp: Date.now(),
            filePath: this.characterFilePath,
            modificationType: 'file_update',
          },
        },
        'character_modifications'
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to apply character modification', error);
      return {
        success: false,
        error: `Application failed: ${(error as Error).message}`,
      };
    }
  }

  async getModificationHistory(limit = 10): Promise<any[]> {
    const memories = await this.runtime.getMemories({
      entityId: this.runtime.agentId,
      count: limit,
      tableName: 'character_modifications',
    });

    return memories.map((memory) => ({
      timestamp: (memory.content.metadata as any)?.timestamp,
      modification: (memory.content.metadata as any)?.modification,
      filePath: (memory.content.metadata as any)?.filePath,
    }));
  }

  async getAvailableBackups(): Promise<Array<{ path: string; timestamp: number; size: number }>> {
    if (!(await fs.pathExists(this.backupDir))) {
      return [];
    }

    const files = await fs.readdir(this.backupDir);
    const backups = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.backupDir, file);
        const stat = await fs.stat(filePath);

        // Extract timestamp from filename (format: character-YYYYMMDD-HHMMSS.json)
        const timestampMatch = file.match(/character-(\d{8})-(\d{6})\.json/);
        let timestamp = stat.mtime.getTime();

        if (timestampMatch) {
          const dateStr = timestampMatch[1];
          const timeStr = timestampMatch[2];
          const year = parseInt(dateStr.substring(0, 4), 10);
          const month = parseInt(dateStr.substring(4, 6), 10) - 1;
          const day = parseInt(dateStr.substring(6, 8), 10);
          const hour = parseInt(timeStr.substring(0, 2), 10);
          const minute = parseInt(timeStr.substring(2, 4), 10);
          const second = parseInt(timeStr.substring(4, 6), 10);

          timestamp = new Date(year, month, day, hour, minute, second).getTime();
        }

        backups.push({
          path: filePath,
          timestamp,
          size: stat.size,
        });
      }
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  async restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate backup file exists and is readable
      if (!(await fs.pathExists(backupPath))) {
        return { success: false, error: 'Backup file not found' };
      }

      // Read and validate backup content
      const backupContent = await fs.readJSON(backupPath);

      if (!backupContent.name || typeof backupContent.name !== 'string') {
        return { success: false, error: 'Invalid backup file format - missing character name' };
      }

      // Create a backup of the current state before restoration
      const currentBackupPath = await this.createBackup();

      // Update runtime character
      Object.assign(this.runtime.character, backupContent);

      // If we have a character file path, update the file
      if (this.characterFilePath) {
        await fs.writeJSON(this.characterFilePath, backupContent, { spaces: 2 });
      }

      // Log the restoration
      const dummyRoomId = this.runtime.agentId;
      await this.runtime.createMemory(
        {
          entityId: this.runtime.agentId,
          roomId: dummyRoomId,
          content: {
            text: `Character restored from backup: ${path.basename(backupPath)}`,
            source: 'character_restoration',
          },
          metadata: {
            type: MemoryType.CUSTOM,
            service: PersonalityServiceType,
            action: 'character_reset',
            timestamp: Date.now(),
            backupPath,
            previousBackup: currentBackupPath,
            restorationType: 'backup_restoration',
          },
        },
        'character_modifications'
      );

      logger.info('Character restored from backup', {
        backupPath,
        characterName: backupContent.name,
        currentBackup: currentBackupPath,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to restore from backup', error);
      return {
        success: false,
        error: `Restoration failed: ${(error as Error).message}`,
      };
    }
  }

  async restoreFromHistory(entryIndex: number): Promise<{ success: boolean; error?: string }> {
    const history = await this.getModificationHistory(50);

    if (entryIndex < 0 || entryIndex >= history.length) {
      return { success: false, error: 'Invalid history entry index' };
    }

    const entry = history[entryIndex];
    if (!entry.filePath) {
      return { success: false, error: 'No file path available for this history entry' };
    }

    // Find the corresponding backup file
    const backups = await this.getAvailableBackups();
    const backup = backups.find(
      (b) => Math.abs(b.timestamp - entry.timestamp) < 60000 // Within 1 minute
    );

    if (!backup) {
      return { success: false, error: 'Corresponding backup file not found' };
    }

    return await this.restoreFromBackup(backup.path);
  }

  async stop(): Promise<void> {
    logger.info('CharacterFileManager stopped');
  }
}
