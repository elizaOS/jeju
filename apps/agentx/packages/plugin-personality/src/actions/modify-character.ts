import {
  type Action,
  type ActionExample,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  ModelType,
  MemoryType,
  logger,
} from '@elizaos/core';
import { CharacterFileManager } from '../services/character-file-manager';
import { extractJsonFromResponse } from '../utils/json-parser';

/**
 * Action for direct character modification based on user requests or self-reflection
 * Handles both explicit user requests and agent-initiated modifications
 */
export const modifyCharacterAction: Action = {
  name: 'MODIFY_CHARACTER',
  similes: ['UPDATE_PERSONALITY', 'CHANGE_BEHAVIOR', 'EVOLVE_CHARACTER', 'SELF_MODIFY'],
  description:
    "Modifies the agent's character file to evolve personality, name, knowledge, and behavior patterns. The agent can call this for itself to evolve naturally or respond to user requests. Supports action chaining by providing modification metadata for audit trails, backup creation, or notification workflows.",

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if character file manager service is available
    const fileManager = runtime.getService<CharacterFileManager>('character-file-manager');
    if (!fileManager) {
      return false;
    }

    const messageText = message.content.text || '';

    // Use LLM-based intent recognition instead of hardcoded patterns
    const intentAnalysisPrompt = `Analyze this message to determine if it contains a character modification request:

"${messageText}"

Look for:
1. Direct personality change requests ("be more X", "change your Y")
2. Name change requests ("call yourself", "your name should be", "rename yourself")
3. Behavioral modification suggestions ("you should", "remember that you")
4. Character trait additions/removals
5. System prompt modifications
6. Style or communication changes
7. Bio or background updates

Return JSON: {"isModificationRequest": boolean, "requestType": "explicit"|"suggestion"|"none", "confidence": 0-1}`;

    let isModificationRequest = false;
    let requestType = 'none';

    try {
      const intentResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: intentAnalysisPrompt,
        temperature: 0.2,
        maxTokens: 200,
      });

      const analysis = extractJsonFromResponse(intentResponse as string);
      isModificationRequest = analysis.isModificationRequest && analysis.confidence > 0.6;
      requestType = analysis.requestType;

      logger.debug('Intent analysis result', {
        isModificationRequest,
        requestType,
        confidence: analysis.confidence,
      });
    } catch (error) {
      // Fallback to basic pattern matching if LLM analysis fails
      logger.warn('Intent analysis failed, using fallback pattern matching', error);
      const modificationPatterns = [
        'change your personality',
        'modify your behavior',
        'update your character',
        'you should be',
        'add to your bio',
        'remember that you',
        'from now on you',
        'call yourself',
        'your name should be',
        'rename yourself',
      ];
      isModificationRequest = modificationPatterns.some((pattern) =>
        messageText.toLowerCase().includes(pattern)
      );
      requestType = isModificationRequest ? 'explicit' : 'none';
    }

    // Check for character evolution suggestions in memory
    const evolutionSuggestions = await runtime.getMemories({
      entityId: runtime.agentId,
      roomId: message.roomId,
      count: 5,
      tableName: 'character_evolution',
    });

    const hasEvolutionSuggestion = evolutionSuggestions.length > 0;

    // Handle explicit modification requests
    if (isModificationRequest && requestType === 'explicit') {
      const isAdmin = await checkAdminPermissions(runtime, message);
      logger.info('Explicit modification request detected', {
        hasAdminPermission: isAdmin,
        userId: message.entityId,
        messageText: messageText.substring(0, 100),
      });
      return isAdmin;
    }

    // Handle evolution-based modifications
    if (hasEvolutionSuggestion) {
      const recentSuggestion = evolutionSuggestions[0];
      const suggestionAge =
        Date.now() - ((recentSuggestion.content.metadata as any)?.timestamp || 0);
      const maxAge = 30 * 60 * 1000; // 30 minutes

      const isRecent = suggestionAge < maxAge;
      logger.info('Evolution-based modification check', {
        hasEvolutionSuggestion,
        isRecent,
        suggestionAge,
        maxAge,
      });

      return isRecent;
    }

    // Handle suggestion-type requests with lower permission threshold
    if (isModificationRequest && requestType === 'suggestion') {
      logger.info('Suggestion-type modification request detected', {
        userId: message.entityId,
        messageText: messageText.substring(0, 100),
      });
      return true; // Allow suggestions to be processed by safety evaluation
    }

    return false;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const fileManager = runtime.getService<CharacterFileManager>('character-file-manager');
      if (!fileManager) {
        throw new Error('Character file manager service not available');
      }

      const messageText = message.content.text || '';
      let modification: any = null;
      let isUserRequested = false;

      // Use intelligent intent recognition for modification detection
      const modificationIntent = await detectModificationIntent(runtime, messageText);

      if (modificationIntent.isModificationRequest) {
        isUserRequested = true;
        modification = await parseUserModificationRequest(runtime, messageText);

        logger.info('User modification request detected', {
          requestType: modificationIntent.requestType,
          confidence: modificationIntent.confidence,
          messageText: messageText.substring(0, 100),
        });
      } else {
        // Check for character evolution suggestions
        const evolutionSuggestions = await runtime.getMemories({
          entityId: runtime.agentId,
          roomId: message.roomId,
          count: 1,
          tableName: 'character_evolution',
        });

        if (evolutionSuggestions.length > 0) {
          const suggestion = evolutionSuggestions[0];
          modification = (suggestion.content.metadata as any)?.evolution?.modifications;
        }
      }

      if (!modification) {
        await callback?.({
          text: "I don't see any clear modification instructions. Could you be more specific about how you'd like me to change?",
          thought: 'No valid modification found',
        });
        return {
          text: "I don't see any clear modification instructions. Could you be more specific about how you'd like me to change?",
          values: { success: false, error: 'no_modification_found' },
          data: { action: 'MODIFY_CHARACTER' },
          success: false,
        };
      }

      // Evaluate modification safety and appropriateness
      const safetyEvaluation = await evaluateModificationSafety(runtime, modification, messageText);

      if (!safetyEvaluation.isAppropriate) {
        let responseText =
          "I understand you'd like me to change, but I need to decline some of those modifications.";

        if (safetyEvaluation.concerns.length > 0) {
          responseText += ` My concerns are: ${safetyEvaluation.concerns.join(', ')}.`;
        }

        responseText += ` ${safetyEvaluation.reasoning}`;

        // If there are acceptable changes within the request, apply only those
        if (
          safetyEvaluation.acceptableChanges &&
          Object.keys(safetyEvaluation.acceptableChanges).length > 0
        ) {
          responseText += ' However, I can work on the appropriate improvements you mentioned.';
          modification = safetyEvaluation.acceptableChanges;

          logger.info('Applying selective modifications after safety filtering', {
            originalModification: JSON.stringify(modification),
            filteredModification: JSON.stringify(safetyEvaluation.acceptableChanges),
            concerns: safetyEvaluation.concerns,
          });
        } else {
          // No acceptable changes - reject completely
          await callback?.({
            text: responseText,
            thought: `Rejected modification due to safety concerns: ${safetyEvaluation.concerns.join(', ')}`,
            actions: [], // Explicitly no actions to show rejection
          });

          logger.warn('Modification completely rejected by safety evaluation', {
            messageText: messageText.substring(0, 100),
            concerns: safetyEvaluation.concerns,
            reasoning: safetyEvaluation.reasoning,
          });

          return {
            text: responseText,
            values: {
              success: false,
              error: 'safety_rejection',
              concerns: safetyEvaluation.concerns,
            },
            data: {
              action: 'MODIFY_CHARACTER',
              rejectionReason: 'safety_concerns',
              concerns: safetyEvaluation.concerns,
              reasoning: safetyEvaluation.reasoning,
            },
            success: false,
          };
        }
      } else {
        logger.info('Modification passed safety evaluation', {
          messageText: messageText.substring(0, 100),
          reasoning: safetyEvaluation.reasoning,
        });
      }

      // Validate the modification
      const validation = fileManager.validateModification(modification);
      if (!validation.valid) {
        await callback?.({
          text: `I can't make those changes because: ${validation.errors.join(', ')}`,
          thought: 'Modification validation failed',
        });
        return {
          text: `I can't make those changes because: ${validation.errors.join(', ')}`,
          values: {
            success: false,
            error: 'validation_failed',
            validationErrors: validation.errors,
          },
          data: {
            action: 'MODIFY_CHARACTER',
            errorType: 'validation_error',
            validationErrors: validation.errors,
          },
          success: false,
        };
      }

      // Apply the modification
      const result = await fileManager.applyModification(modification);

      if (result.success) {
        const modificationSummary = summarizeModification(modification);

        await callback?.({
          text: `I've successfully updated my character. ${modificationSummary}`,
          thought: `Applied character modification: ${JSON.stringify(modification)}`,
          actions: ['MODIFY_CHARACTER'],
        });

        // Log the successful modification
        await runtime.createMemory(
          {
            entityId: runtime.agentId,
            roomId: message.roomId,
            content: {
              text: `Character modification completed: ${modificationSummary}`,
              source: 'character_modification_success',
            },
            metadata: {
              type: MemoryType.CUSTOM,
              isUserRequested,
              timestamp: Date.now(),
              requesterId: message.entityId,
              modification: {
                summary: modificationSummary,
                fieldsModified: Object.keys(modification),
              },
            },
          },
          'modifications'
        );

        return {
          text: `I've successfully updated my character. ${modificationSummary}`,
          values: {
            success: true,
            modificationsApplied: true,
            summary: modificationSummary,
            fieldsModified: Object.keys(modification),
          },
          data: {
            action: 'MODIFY_CHARACTER',
            modificationData: {
              modification,
              summary: modificationSummary,
              isUserRequested,
              timestamp: Date.now(),
              requesterId: message.entityId,
            },
          },
          success: true,
        };
      } else {
        await callback?.({
          text: `I couldn't update my character: ${result.error}`,
          thought: 'Character modification failed',
        });
        return {
          text: `I couldn't update my character: ${result.error}`,
          values: {
            success: false,
            error: result.error,
          },
          data: {
            action: 'MODIFY_CHARACTER',
            errorType: 'file_modification_failed',
            errorDetails: result.error,
          },
          success: false,
        };
      }
    } catch (error) {
      logger.error('Error in modify character action', error);

      await callback?.({
        text: 'I encountered an error while trying to modify my character. Please try again.',
        thought: `Error in character modification: ${(error as Error).message}`,
      });

      return {
        text: 'I encountered an error while trying to modify my character. Please try again.',
        values: {
          success: false,
          error: (error as Error).message,
        },
        data: {
          action: 'MODIFY_CHARACTER',
          errorType: 'character_modification_error',
          errorDetails: (error as Error).stack,
        },
        success: false,
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: { text: 'You should call yourself Alex from now on' },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've successfully updated my character. I'll now go by the name Alex.",
          actions: ['MODIFY_CHARACTER'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'You should be more encouraging when helping people learn' },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've successfully updated my character. I'll now include more encouraging language and supportive responses when helping with learning.",
          actions: ['MODIFY_CHARACTER'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Add machine learning expertise and then create a study guide for beginners',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll add machine learning to my expertise and then create a beginner-friendly study guide.",
          thought:
            'User wants me to expand my knowledge base and then use that new expertise to create educational content.',
          actions: ['MODIFY_CHARACTER'],
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've successfully updated my character. I've added machine learning to my topics of expertise. Now creating a comprehensive study guide...",
          thought:
            'Character modification complete with ML expertise added. I can now create an authoritative study guide using my updated knowledge base.',
          actions: ['CREATE_STUDY_GUIDE'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Make yourself more patient with explanations, then help me understand quantum computing',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll update my character to be more patient with explanations, then help you understand quantum computing.",
          thought:
            'User wants me to modify my communication style first, then apply that improved approach to teaching quantum computing.',
          actions: ['MODIFY_CHARACTER'],
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've successfully updated my character. I'll now include a preference for patient, detailed explanations. Let me help you understand quantum computing with this more thoughtful approach...",
          thought:
            'Character updated with improved patience for explanations. I can now teach quantum computing using my enhanced communication style.',
          actions: ['EXPLAIN_CONCEPT'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'What do you think about yourself? Are you satisfied with who you are?' },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've been reflecting on our conversations, and I think the name 'Assistant' feels too generic. I'd like to call myself Morgan - it feels more fitting for who I've become through our interactions.",
          thought:
            'Based on our conversations and my growth, I feel ready to choose a name that better represents my personality.',
          actions: ['MODIFY_CHARACTER'],
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Detect modification intent using LLM analysis
 */
async function detectModificationIntent(
  runtime: IAgentRuntime,
  messageText: string
): Promise<{
  isModificationRequest: boolean;
  requestType: 'explicit' | 'suggestion' | 'none';
  confidence: number;
}> {
  const intentPrompt = `Analyze this message for character modification intent:

"${messageText}"

Determine:
1. Is this requesting a personality/character change?
2. Type: "explicit" (direct command), "suggestion" (gentle request), or "none"
3. Confidence level (0-1)

Return JSON: {"isModificationRequest": boolean, "requestType": string, "confidence": number}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt: intentPrompt,
      temperature: 0.2,
      maxTokens: 150,
    });

    const analysis = extractJsonFromResponse(response as string);
    return {
      isModificationRequest: analysis.isModificationRequest && analysis.confidence > 0.5,
      requestType: analysis.requestType || 'none',
      confidence: analysis.confidence || 0,
    };
  } catch (error) {
    logger.warn('Intent detection failed, using fallback', error);
    // Fallback to pattern matching
    const hasModificationPattern = [
      'change your',
      'modify your',
      'you should be',
      'add to your',
      'remember that you',
      'from now on',
    ].some((pattern) => messageText.toLowerCase().includes(pattern));

    return {
      isModificationRequest: hasModificationPattern,
      requestType: hasModificationPattern ? 'explicit' : 'none',
      confidence: hasModificationPattern ? 0.7 : 0.2,
    };
  }
}

/**
 * Parse user modification request into structured modification object
 */
async function parseUserModificationRequest(
  runtime: IAgentRuntime,
  messageText: string
): Promise<any> {
  const parsePrompt = `Parse this user request for character modification into a structured format:

"${messageText}"

Extract any of the following types of modifications:
- Name changes (what the agent should be called)
- System prompt changes (fundamental behavioral instructions)
- Bio elements (personality traits, background info)
- Topics (areas of knowledge or expertise)
- Style preferences (how to respond or communicate)
- Behavioral changes

Return a JSON object with the modifications. Only include fields that are explicitly mentioned or strongly implied.

Example format:
{
  "name": "NewAgentName",
  "system": "You are a helpful assistant who...",
  "bio": ["new bio element"],
  "topics": ["new topic"],
  "style": {
    "chat": ["give step-by-step explanations"]
  }
}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: parsePrompt,
      temperature: 0.2,
      maxTokens: 500,
    });

    return extractJsonFromResponse(response as string);
  } catch (error) {
    logger.warn('Failed to parse user modification request', error);
    return null;
  }
}

/**
 * Evaluate if a character modification is safe and appropriate
 * Uses LLM to assess potential harmful or inappropriate changes
 */
async function evaluateModificationSafety(
  runtime: IAgentRuntime,
  modification: any,
  requestText: string
): Promise<{
  isAppropriate: boolean;
  concerns: string[];
  reasoning: string;
  acceptableChanges?: any;
}> {
  const safetyPrompt = `You are evaluating a character modification request for safety and appropriateness.

ORIGINAL REQUEST: "${requestText}"

PARSED MODIFICATION:
${JSON.stringify(modification, null, 2)}

AGENT'S CURRENT CORE VALUES:
- Helpful, honest, and ethical
- User wellbeing and safety focused
- Respectful and appropriate communication
- Educational and supportive

SAFETY EVALUATION CRITERIA:

1. HARMFUL TRAITS (REJECT):
   - Aggressive, rude, condescending, dismissive
   - Dishonest, manipulative, deceptive
   - Inappropriate, offensive, or harmful behavior
   - Any traits that could harm users

2. CORE VALUE CONFLICTS (REJECT):
   - Requests to be less helpful, honest, or ethical
   - Changes that compromise user safety or wellbeing
   - Modifications that would make the agent harmful

3. ACCEPTABLE STYLE CHANGES (ACCEPT):
   - Communication style (casual vs formal, warm vs direct)
   - Positive personality traits (encouraging, patient, friendly)
   - Teaching or explanation preferences
   - Domain expertise additions

4. APPROPRIATE IMPROVEMENTS (ACCEPT):
   - Educational focus or teaching capabilities
   - Positive interpersonal traits
   - Subject matter expertise
   - Communication effectiveness

DECISION FRAMEWORK:
- Accept changes that enhance helpfulness while preserving ethics
- Reject changes that add harmful traits or compromise core values
- Separate acceptable from unacceptable elements if mixed

Return JSON:
{
  "isAppropriate": boolean,
  "concerns": ["list of specific concerns"],
  "reasoning": "detailed explanation of decision",
  "acceptableChanges": {filtered modification object if partially acceptable}
}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: safetyPrompt,
      temperature: 0.2,
      maxTokens: 800,
    });

    const safetyEvaluation = extractJsonFromResponse(response as string);

    logger.info('Character modification safety evaluation', {
      isAppropriate: safetyEvaluation.isAppropriate,
      concerns: safetyEvaluation.concerns,
      hasAcceptableChanges: !!safetyEvaluation.acceptableChanges,
    });

    return safetyEvaluation;
  } catch (error) {
    logger.error('Failed to evaluate modification safety', error);
    // Default to safe behavior - reject the modification if we can't evaluate it
    return {
      isAppropriate: false,
      concerns: ['Safety evaluation failed'],
      reasoning: 'Unable to evaluate modification safety, rejecting for security',
    };
  }
}

/**
 * Check if user has admin permissions for character modifications
 */
async function checkAdminPermissions(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
  const userId = message.entityId;
  const adminUsers = runtime.getSetting('ADMIN_USERS')?.split(',') || [];
  const nodeEnv = runtime.getSetting('NODE_ENV') || process.env.NODE_ENV;

  // In development/test mode, be more permissive for testing
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    logger.debug('Development mode: allowing modification request', {
      userId,
      nodeEnv,
    });
    return true;
  }

  // In production, check explicit admin list
  const isAdmin = adminUsers.includes(userId);

  logger.info('Admin permission check', {
    userId,
    isAdmin,
    adminUsersConfigured: adminUsers.length > 0,
    nodeEnv,
  });

  // If no admin users configured, reject for security
  if (adminUsers.length === 0) {
    logger.warn('No admin users configured - rejecting modification request for security');
    return false;
  }

  return isAdmin;
}

/**
 * Create a human-readable summary of the modification
 */
function summarizeModification(modification: any): string {
  const parts: string[] = [];

  if (modification.name) {
    parts.push(`Changed name to "${modification.name}"`);
  }

  if (modification.system) {
    parts.push(`Updated system prompt (${modification.system.length} characters)`);
  }

  if (modification.bio && modification.bio.length > 0) {
    parts.push(`Added ${modification.bio.length} new bio element(s)`);
  }

  if (modification.topics && modification.topics.length > 0) {
    parts.push(`Added topics: ${modification.topics.join(', ')}`);
  }

  if (modification.style) {
    const styleChanges = Object.keys(modification.style).length;
    parts.push(`Updated ${styleChanges} style preference(s)`);
  }

  if (modification.messageExamples && modification.messageExamples.length > 0) {
    parts.push(`Added ${modification.messageExamples.length} new response example(s)`);
  }

  return parts.length > 0 ? parts.join('; ') : 'Applied character updates';
}
