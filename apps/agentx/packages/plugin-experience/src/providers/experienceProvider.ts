import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { ExperienceService } from '../service';

/**
 * Simple experience provider that injects relevant experiences into context
 * Similar to the knowledge provider but focused on agent learnings
 */
export const experienceProvider: Provider = {
  name: 'EXPERIENCE',
  description: 'Provides relevant past experiences and learnings for the current context',

  async get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<{ text?: string; data?: any }> {
    const experienceService = runtime.getService('EXPERIENCE') as ExperienceService;

    if (!experienceService) {
      return { text: '' };
    }

    // Get message text for context
    const messageText = message.content.text || '';
    if (messageText.length < 10) {
      return { text: '' };
    }

    // Find relevant experiences using semantic search
    const relevantExperiences = await experienceService.queryExperiences({
      query: messageText,
      limit: 5,
      minConfidence: 0.6,
      minImportance: 0.5,
    });

    if (relevantExperiences.length === 0) {
      return { text: '' };
    }

    // Format experiences for context injection
    const experienceText = relevantExperiences
      .map((exp, index) => {
        return `Experience ${index + 1}: In ${exp.domain} context, when ${exp.context}, I learned: ${exp.learning}`;
      })
      .join('\n');

    const contextText = `[RELEVANT EXPERIENCES]\n${experienceText}\n[/RELEVANT EXPERIENCES]`;

    logger.debug(
      `[experienceProvider] Injecting ${relevantExperiences.length} relevant experiences`
    );

    return {
      text: contextText,
      data: {
        experiences: relevantExperiences,
        count: relevantExperiences.length,
      },
    };
  },
};
