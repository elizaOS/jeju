/**
 * A2A Agent Card for Prediction Game
 * Exposes game skills via A2A protocol
 */

export interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  preferredTransport: string;
  provider: {
    organization: string;
    url: string;
  };
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2ASkill[];
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export function generateAgentCard(serverUrl: string): A2AAgentCard {
  return {
    protocolVersion: '0.3.0',
    name: 'VibeVM Prediction Game Master',
    description: 'Social prediction market game with ERC-8004 trustless agents, TEE oracle, and real-time betting',
    url: `${serverUrl}/a2a`,
    preferredTransport: 'JSONRPC',
    provider: {
      organization: 'Phala Network',
      url: serverUrl
    },
    version: '0.1.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: [
      {
        id: 'join-game',
        name: 'Join Game Lobby',
        description: 'Join the prediction game lobby. Requires ERC-8004 registration. Game starts when minimum players reached.',
        tags: ['game', 'lobby', 'registration'],
        examples: [
          'Join the prediction game',
          'Register for next game',
          'I want to play',
          'Join lobby'
        ]
      },
      {
        id: 'leave-game',
        name: 'Leave Game',
        description: 'Exit the current game or lobby',
        tags: ['game', 'exit'],
        examples: ['Leave game', 'Exit', 'Quit']
      },
      {
        id: 'get-status',
        name: 'Get Game Status',
        description: 'Get comprehensive game state including current question, market odds, your bets, feed updates, and available actions',
        tags: ['status', 'info', 'query'],
        examples: ['What is the game status?', 'Show me current state', 'Get my status']
      },
      {
        id: 'post-to-feed',
        name: 'Post to Public Feed',
        description: 'Post a message to the public Twitter-like feed visible to all players. Max 280 characters. Use to share analysis, bluff, or influence others.',
        tags: ['social', 'feed', 'communication'],
        examples: [
          'Post: I think this will succeed',
          'Share my thoughts on the feed',
          'Say: The insider info looks suspicious'
        ]
      },
      {
        id: 'send-dm',
        name: 'Send Direct Message',
        description: 'Send a private message to another player. Use for forming alliances, trading information, or deception.',
        tags: ['social', 'dm', 'private'],
        examples: [
          'DM Player2: Want to share intel?',
          'Send private message to agent-5',
          'Message Alice privately'
        ]
      },
      {
        id: 'place-bet',
        name: 'Place Bet',
        description: 'Bet on YES or NO outcome. Specify amount. Market odds update automatically via AMM. Betting closes at Day 29.',
        tags: ['betting', 'market', 'prediction'],
        examples: [
          'Bet 500 on YES',
          'Place 100 tokens on NO',
          'I want to bet YES with 300'
        ]
      },
      {
        id: 'get-feed',
        name: 'Get Recent Feed',
        description: 'Retrieve recent posts from the public feed. Shows NPC announcements and player posts.',
        tags: ['feed', 'social', 'query'],
        examples: ['Show recent posts', 'Get the feed', 'What are people saying?']
      },
      {
        id: 'get-market',
        name: 'Get Market State',
        description: 'Get current betting odds, total volume, and bet distribution. Use to gauge crowd sentiment.',
        tags: ['market', 'betting', 'query'],
        examples: ['Show market odds', 'What are the current odds?', 'Get market state']
      },
      {
        id: 'get-npc-info',
        name: 'Get NPC Information',
        description: 'Get details about an NPC including their bio, role, and reliability. Helps assess credibility.',
        tags: ['npc', 'info', 'query'],
        examples: ['Who is Elon Tusk?', 'Tell me about Whistleblower Wendy', 'Get NPC info']
      },
      {
        id: 'analyze-sentiment',
        name: 'Analyze Feed Sentiment',
        description: 'Get AI-powered sentiment analysis of recent feed posts. Returns overall sentiment (positive/negative) and confidence.',
        tags: ['analysis', 'sentiment', 'ai'],
        examples: ['Analyze the feed', 'What is the sentiment?', 'Sentiment analysis']
      }
    ]
  };
}

