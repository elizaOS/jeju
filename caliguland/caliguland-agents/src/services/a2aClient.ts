/**
 * Generic A2A Client Service
 * 
 * KEY DESIGN: Completely generic - no game-specific code!
 * - Fetches Agent Card from any A2A server
 * - Dynamically discovers skills
 * - Registers actions in ElizaOS runtime
 * - Handles message signing and streaming
 * 
 * Can be instantiated multiple times for different servers
 * (e.g., one for game, one for betting)
 */

import { Service, type IAgentRuntime, logger, type Action, type ActionResult, type Memory, type HandlerCallback, type Content } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';

export interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  skills: A2ASkill[];
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: Array<{ kind: string; text?: string; data?: Record<string, unknown> }>;
  messageId: string;
  kind: 'message';
}

export class A2AClientService extends Service {
  static serviceType = 'a2a-client';
  capabilityDescription = 'Generic A2A protocol client - discovers and executes skills dynamically';

  private serverUrl: string = '';
  private agentCard: A2AAgentCard | null = null;
  private wallet: ethers.Wallet | null = null;
  private messageHandlers: Array<(event: unknown) => void> = [];
  private runtime: IAgentRuntime | null = null;

  /**
   * Initialize with optional server URL
   * If no URL provided, will use GAME_SERVER_URL from runtime settings
   */
  async initialize(runtime: IAgentRuntime, serverUrl?: string): Promise<void> {
    this.runtime = runtime;
    this.serverUrl = serverUrl || runtime.getSetting('GAME_SERVER_URL') || '';
    
    if (!this.serverUrl) {
      // Try to get from discovery service
      const discovery = runtime.getService('game-discovery') as any;
      if (discovery && discovery.getGameServer) {
        const gameServer = discovery.getGameServer();
        if (gameServer) {
          this.serverUrl = gameServer.url;
        }
      }
    }

    if (!this.serverUrl) {
      throw new Error('No server URL provided and no game server discovered');
    }

    const privateKey = runtime.getSetting('AGENT_PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('AGENT_PRIVATE_KEY not configured');
    }

    this.wallet = new ethers.Wallet(privateKey);
    logger.info(`[A2A] Initializing for ${this.serverUrl}`);
    logger.info(`[A2A] Agent address: ${this.wallet.address}`);

    // Fetch Agent Card (dynamic discovery!)
    await this.fetchAgentCard();
    
    // Dynamically register actions from discovered skills
    this.registerDynamicActions(runtime);
    
    logger.info(`[A2A] ✅ Connected to: ${this.agentCard?.name}`);
    logger.info(`[A2A] ✅ Discovered ${this.agentCard?.skills.length} skills dynamically`);
    logger.info(`[A2A] ✅ Actions registered in ElizaOS runtime`);
  }

  /**
   * Fetch Agent Card from server
   * This is where we discover what skills are available!
   */
  async fetchAgentCard(): Promise<A2AAgentCard> {
    const url = `${this.serverUrl}/.well-known/agent-card.json`;
    logger.info(`[A2A] Fetching Agent Card from ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Agent Card: ${response.statusText}`);
    }

    this.agentCard = await response.json() as A2AAgentCard;
    
    logger.info(`[A2A] Discovered: ${this.agentCard.name}`);
    logger.info(`[A2A] Protocol: ${this.agentCard.protocolVersion}`);
    logger.info(`[A2A] Skills found:`);
    for (const skill of this.agentCard.skills) {
      logger.info(`   - ${skill.id}: ${skill.name}`);
    }

    return this.agentCard;
  }

  /**
   * Dynamically register actions for each discovered skill
   * NO hardcoded skills - all loaded from Agent Card!
   */
  private registerDynamicActions(runtime: IAgentRuntime): void {
    if (!this.agentCard) return;

    const existingNames = new Set((runtime.actions as unknown as Action[]).map((a: Action) => a.name));

    for (const skill of this.agentCard.skills) {
      const actionName = `A2A_${skill.id.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
      
      if (existingNames.has(actionName)) {
        logger.debug(`[A2A] Skipping duplicate action: ${actionName}`);
        continue;
      }

      const action: Action = {
        name: actionName,
        similes: [skill.name.toUpperCase().replace(/\s+/g, '_'), skill.id.toUpperCase()],
        description: skill.description,
        
        validate: async (_rt: IAgentRuntime, message: Memory) => {
          // Simple text matching - could be enhanced with LLM
          const text = (message.content.text || '').toLowerCase();
          
          // Check if message matches skill keywords
          for (const example of skill.examples) {
            if (text.includes(example.toLowerCase())) {
              return true;
            }
          }
          
          // Check skill ID directly
          if (text.includes(skill.id)) {
            return true;
          }
          
          return false;
        },
        
        handler: async (
          rt: IAgentRuntime,
          message: Memory,
          _state?: any,
          _options?: any,
          callback?: HandlerCallback
        ): Promise<ActionResult> => {
          try {
            const params: Record<string, unknown> = {};
            const textContent = message.content.text || '';
            
            // Execute skill via A2A
            const result = await this.sendMessage(skill.id, params, textContent);
            
            // Extract response text
            const responseText = this.extractTextFromA2AResponse(result);
            
            const responseContent: Content = {
              text: responseText,
              action: skill.id,
              source: message.content.source
            };

            if (callback) {
              await callback(responseContent);
            }

            return {
              success: true,
              text: responseText,
              data: result
            };
          } catch (error) {
            logger.error(`[A2A] Skill ${skill.id} failed:`, error);
            return {
              success: false,
              text: `Failed to execute ${skill.name}`,
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        },
        
        examples: []
      };

      try {
        (runtime.actions as unknown as Action[]).push(action);
        logger.info(`[A2A] ✓ Registered dynamic action: ${actionName} (${skill.name})`);
      } catch (err) {
        logger.warn(`[A2A] Failed to register action ${actionName}:`, err);
      }
    }

    logger.info(`[A2A] ✅ Registered ${this.agentCard.skills.length} dynamic actions from Agent Card`);
  }

  /**
   * Send A2A message with signature
   */
  async sendMessage(
    skillId: string,
    data: Record<string, unknown>,
    textContent?: string
  ): Promise<unknown> {
    if (!this.agentCard || !this.wallet) {
      throw new Error('A2A client not initialized');
    }

    const timestamp = Date.now();
    const messageId = uuidv4();
    
    // Sign ONLY skill data (exclude auth fields)
    const { agentId: _, agentAddress: __, agentDomain: ___, playerName: ____, signature: _____, timestamp: ______, skillId: _______, ...skillData } = data;
    
    const signaturePayload = JSON.stringify({
      messageId,
      timestamp,
      skillId,
      data: skillData
    });
    
    const signature = await this.wallet.signMessage(signaturePayload);

    const parts: any[] = [];
    
    if (textContent) {
      parts.push({ kind: 'text', text: textContent });
    }
    
    parts.push({
      kind: 'data',
      data: {
        skillId,
        agentAddress: this.wallet.address,
        signature,
        timestamp,
        ...data
      }
    });

    const message: A2AMessage = {
      role: 'user',
      parts,
      messageId,
      kind: 'message'
    };

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'message/send',
      params: { message }
    };

    const response = await fetch(this.agentCard.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`A2A request failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`A2A Error: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Start streaming (for real-time game events)
   */
  async streamMessage(
    skillId: string,
    data: Record<string, unknown>,
    textContent?: string
  ): Promise<void> {
    if (!this.agentCard?.capabilities.streaming) {
      logger.warn('[A2A] Server does not support streaming');
      return;
    }

    const timestamp = Date.now();
    const messageId = uuidv4();
    
    const { agentId: _, agentAddress: __, agentDomain: ___, playerName: ____, signature: _____, timestamp: ______, skillId: _______, ...skillData } = data;
    
    const signaturePayload = JSON.stringify({
      messageId,
      timestamp,
      skillId,
      data: skillData
    });
    
    const signature = await this.wallet!.signMessage(signaturePayload);

    const message: A2AMessage = {
      role: 'user',
      parts: [
        ...(textContent ? [{ kind: 'text', text: textContent }] : []),
        {
          kind: 'data',
          data: {
            skillId,
            agentAddress: this.wallet!.address,
            signature,
            timestamp,
            ...data
          }
        }
      ],
      messageId,
      kind: 'message'
    };

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'message/stream',
      params: { message }
    };

    const response = await fetch(this.agentCard.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok || !response.body) {
      throw new Error('Failed to start stream');
    }

    // Process SSE stream
    const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const decoder = new TextDecoder();
    this.processSSEStream(reader, decoder);

    logger.info('[A2A] ✅ Streaming started');
  }

  private async processSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ): Promise<void> {
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Notify handlers
            for (const handler of this.messageHandlers) {
              handler(data.result);
            }
          } catch (err) {
            logger.error('[A2A] Failed to parse SSE:', err);
          }
        }
      }
    }

    logger.info('[A2A] Stream ended');
  }

  onMessage(handler: (event: unknown) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  private extractTextFromA2AResponse(result: unknown): string {
    const r = result as any;
    
    // Try different response formats
    if (r && typeof r === 'object') {
      // Task format
      if (r.kind === 'task' && r.status?.message?.parts) {
        const textParts = r.status.message.parts
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text);
        if (textParts.length > 0) return textParts.join(' ');
      }
      
      // Message format
      if (r.role === 'agent' && Array.isArray(r.parts)) {
        const textParts = r.parts
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text);
        if (textParts.length > 0) return textParts.join(' ');
      }
      
      // Simple format
      if (r.message) return r.message;
      if (r.text) return r.text;
    }
    
    return 'OK';
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getAgentCard(): A2AAgentCard | null {
    return this.agentCard;
  }

  getSkills(): A2ASkill[] {
    return this.agentCard?.skills || [];
  }

  getSkill(skillId: string): A2ASkill | undefined {
    return this.agentCard?.skills.find(s => s.id === skillId);
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new A2AClientService(runtime);
    await service.initialize(runtime);
    return service;
  }

  async cleanup(): Promise<void> {
    this.messageHandlers = [];
  }

  async stop(): Promise<void> {
    await this.cleanup();
  }
}

