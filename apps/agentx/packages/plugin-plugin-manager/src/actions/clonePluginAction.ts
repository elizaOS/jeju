import { Action, HandlerCallback, IAgentRuntime, Memory, State, elizaLogger } from '@elizaos/core';
import * as path from 'node:path';
import { PluginManagerService } from '../services/pluginManagerService';
import { clonePlugin } from '../services/pluginRegistryService.js';

export const clonePluginAction: Action = {
  name: 'CLONE_PLUGIN',
  similes: ['clone plugin', 'download plugin', 'get plugin source', 'fetch plugin code'],

  description: 'Clone a plugin repository for local development and modification',

  examples: [
    [
      {
        name: '{{user1}}',
        content: {
          text: 'Clone the weather plugin so I can modify it',
          actions: ['CLONE_PLUGIN'],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: "I'll clone the weather plugin for you to modify locally.",
          actions: ['CLONE_PLUGIN'],
        },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Successfully cloned @elizaos/plugin-weather to ./cloned-plugins/plugin-weather\n\nYou can now:\n- Edit the plugin code\n- Run tests with `npm test`\n- Build with `npm run build`\n- Use the plugin-autocoder to make modifications',
          actions: ['CLONE_PLUGIN'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return text.includes('clone') && text.includes('plugin');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void> => {
    elizaLogger.info('[clonePluginAction] Starting plugin clone');

    const pluginManager = runtime.getService('plugin_manager') as PluginManagerService;

    if (!pluginManager) {
      if (callback) {
        await callback({
          text: 'Required services are not available.',
          actions: ['CLONE_PLUGIN'],
        });
      }
      return;
    }

    // Extract plugin name from message
    const text = message.content?.text || '';
    const pluginName = extractPluginName(text);

    if (!pluginName) {
      if (callback) {
        await callback({
          text: 'Please specify which plugin you want to clone. For example: "clone the weather plugin" or "clone @elizaos/plugin-weather"',
          actions: ['CLONE_PLUGIN'],
        });
      }
      return;
    }

    if (callback) {
      await callback({
        text: `Cloning ${pluginName}...`,
        actions: ['CLONE_PLUGIN'],
      });
    }

    // Clone the plugin using API-based registry service
    const result = await clonePlugin(pluginName);

    if (!result.success) {
      if (callback) {
        await callback({
          text: `Failed to clone plugin: ${result.error}`,
          actions: ['CLONE_PLUGIN'],
        });
      }
      return;
    }

    // Prepare response with helpful information
    let responseText = `Successfully cloned **${result.pluginName}** to \`${result.localPath}\`\n\n`;
    responseText += 'You can now:\n';
    responseText += '- Edit the plugin code in your preferred editor\n';
    responseText += '- Run tests with `npm test` or `pnpm test`\n';
    responseText += '- Build with `npm run build` or `pnpm build`\n';
    responseText += '- Use the plugin-autocoder to make AI-assisted modifications\n';

    if (result.hasTests) {
      responseText +=
        '\n**Note:** This plugin has existing tests. Run them to ensure everything works before making changes.';
    }

    if (result.dependencies && Object.keys(result.dependencies).length > 0) {
      responseText += '\n\n**Dependencies to install:**\n';
      responseText += '```bash\ncd ' + result.localPath + '\nnpm install\n```';
    }

    if (callback) {
      await callback({
        text: responseText,
        actions: ['CLONE_PLUGIN'],
      });
    }

    // Optionally register the cloned plugin for development
    if (result.localPath) {
      const absolutePath = path.resolve(result.localPath);
      try {
        const plugin = await import(absolutePath);
        if (plugin.default) {
          const pluginId = await pluginManager.registerPlugin(plugin.default);
          elizaLogger.info(`[clonePluginAction] Registered cloned plugin with ID: ${pluginId}`);
        }
      } catch (error) {
        elizaLogger.warn('[clonePluginAction] Could not register cloned plugin:', error);
      }
    }

    return;
  },
};

function extractPluginName(text: string): string | null {
  // Look for explicit plugin names
  const patterns = [/@elizaos\/plugin-[\w-]+/g, /plugin-[\w-]+/g];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Try to extract plugin name from natural language
  const words = text.toLowerCase().split(/\s+/);
  const cloneIndex = words.findIndex((w) => w === 'clone');

  if (cloneIndex !== -1) {
    // Look for plugin name after 'clone'
    for (let i = cloneIndex + 1; i < words.length; i++) {
      if (words[i] === 'plugin' && i + 1 < words.length) {
        // Handle "clone the X plugin"
        const pluginType = words[i - 1] === 'the' ? words[i + 1] : words[i - 1];
        if (pluginType && pluginType !== 'the') {
          return `@elizaos/plugin-${pluginType}`;
        }
      } else if (words[i].includes('plugin')) {
        return words[i];
      }
    }
  }

  return null;
}
