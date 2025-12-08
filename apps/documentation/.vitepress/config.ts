import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Jeju',
  description: 'High-performance OP-Stack settling on Base with Flashblocks, EigenDA, and full DeFi stack',
  base: '/jeju/',
  ignoreDeadLinks: [
    // Ignore localhost URLs (development examples)
    /^http:\/\/localhost/,
    // Ignore missing operator docs (TODO)
    /\/operators\//,
    // Ignore TypeDoc API links (auto-generated, may not exist yet)
    /\/api\/.*\/README/,
  ],
  
  vite: {
    server: {
      port: parseInt(process.env.DOCUMENTATION_PORT || '4004')
    }
  },
  
  head: [
    ['link', { rel: 'icon', href: '/jeju/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Jeju' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get Started', link: '/getting-started/introduction' },
      { text: 'Developers', link: '/developers/quick-start' },
      { text: 'Network Info', link: '/network/testnet' },
      {
        text: 'Applications',
        items: [
          { text: 'Overview', link: '/applications/overview' },
          { text: 'Bazaar', link: '/applications/bazaar' },
          { text: 'Gateway', link: '/applications/gateway' },
          { text: 'Crucible', link: '/applications/crucible' },
          { text: 'Indexer', link: '/applications/indexer' },
          { text: 'Monitoring', link: '/applications/monitoring' },
          { text: 'IPFS', link: '/applications/ipfs' },
          { text: 'eHorse', link: '/applications/ehorse' },
          { text: 'Leaderboard', link: '/applications/leaderboard' },
        ],
      },
      {
        text: 'Resources',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Deployment', link: '/deployment/overview' },
          { text: 'Contract Addresses', link: '/contracts' },
          { text: 'API Reference', link: '/api/' },
          { text: 'Registry (ERC-8004)', link: '/registry' },
          { text: 'Support', link: '/support' },
        ],
      },
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/introduction' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
            { text: 'Installation', link: '/getting-started/installation' },
          ],
        },
      ],
      
      '/developers/': [
        {
          text: 'Developers',
          items: [
            { text: 'Quick Start', link: '/developers/quick-start' },
            { text: 'Local Development', link: '/developers/local-development' },
            { text: 'Deploy Contracts', link: '/developers/deploy-contracts' },
            { text: 'DeFi Protocols', link: '/developers/defi-protocols' },
            { text: 'RPC Methods', link: '/developers/rpc-methods' },
            { text: 'Run RPC Node', link: '/developers/run-rpc-node' },
          ],
        },
      ],
      
      '/network/': [
        {
          text: 'Network Information',
          items: [
            { text: 'Testnet', link: '/network/testnet' },
            { text: 'Mainnet', link: '/network/mainnet' },
            { text: 'Wallet Setup', link: '/network/wallet-setup' },
            { text: 'Bridge Assets', link: '/network/bridge' },
          ],
        },
      ],
      
      '/applications/': [
        {
          text: 'Applications',
          items: [
            { text: 'Overview', link: '/applications/overview' },
            { text: 'Bazaar', link: '/applications/bazaar' },
            { text: 'Gateway', link: '/applications/gateway' },
            { text: 'Crucible', link: '/applications/crucible' },
            { text: 'Indexer', link: '/applications/indexer' },
            { text: 'Monitoring', link: '/applications/monitoring' },
            { text: 'IPFS', link: '/applications/ipfs' },
            { text: 'eHorse', link: '/applications/ehorse' },
            { text: 'Leaderboard', link: '/applications/leaderboard' },
          ],
        },
      ],
      
      '/deployment/': [
        {
          text: 'Chain Deployment',
          items: [
            { text: 'Overview', link: '/deployment/overview' },
            { text: 'Prerequisites', link: '/deployment/prerequisites' },
            { text: 'Testnet Deployment', link: '/deployment/testnet' },
            { text: 'Mainnet Deployment', link: '/deployment/mainnet' },
            { text: 'Infrastructure', link: '/deployment/infrastructure' },
          ],
        },
        {
          text: 'Operations',
          items: [
            { text: 'Monitoring', link: '/deployment/monitoring' },
            { text: 'Runbooks', link: '/deployment/runbooks' },
          ],
        },
      ],
      
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
          ],
        },
        {
          text: 'Bazaar',
          items: [
            { text: 'Configuration', link: '/api/bazaar/config/README' },
            { text: 'Libraries', link: '/api/bazaar/lib/README' },
            { text: 'Hooks', link: '/api/bazaar/hooks/README' },
            { text: 'LMSR Pricing', link: '/api/bazaar/lib/markets/lmsrPricing/README' },
          ],
        },
        {
          text: 'Crucible',
          items: [
            { text: 'Plugin', link: '/api/crucible/src/README' },
            { text: 'Paymaster', link: '/api/crucible/src/lib/paymaster/README' },
            { text: 'x402', link: '/api/crucible/src/lib/x402/README' },
          ],
        },
        {
          text: 'eHorse',
          items: [
            { text: 'Game Engine', link: '/api/ehorse/src/game/README' },
            { text: 'Oracle', link: '/api/ehorse/src/oracle/README' },
            { text: 'A2A Server', link: '/api/ehorse/src/a2a/README' },
          ],
        },
        {
          text: 'Gateway',
          items: [
            { text: 'Libraries', link: '/api/gateway/src/lib/README' },
            { text: 'Hooks', link: '/api/gateway/src/hooks/README' },
            { text: 'Tokens', link: '/api/gateway/src/lib/tokens/README' },
            { text: 'Node Staking', link: '/api/gateway/lib/nodeStaking/README' },
          ],
        },
        {
          text: 'Indexer',
          items: [
            { text: 'Main Processor', link: '/api/indexer/src/main/README' },
            { text: 'Market Processor', link: '/api/indexer/src/market-processor/README' },
            { text: 'Game Feed', link: '/api/indexer/src/game-feed-processor/README' },
          ],
        },
        {
          text: 'IPFS',
          items: [
            { text: 'Pinning API', link: '/api/ipfs/pinning-api/src/README' },
            { text: 'Database', link: '/api/ipfs/pinning-api/src/database/README' },
            { text: 'x402 Middleware', link: '/api/ipfs/pinning-api/src/middleware/x402/README' },
          ],
        },
        {
          text: 'Leaderboard',
          items: [
            { text: 'Libraries', link: '/api/leaderboard/src/lib/README' },
            { text: 'Pipelines', link: '/api/leaderboard/src/lib/pipelines/README' },
            { text: 'Scoring', link: '/api/leaderboard/src/lib/scoring/README' },
            { text: 'GitHub Client', link: '/api/leaderboard/src/lib/data/github/README' },
          ],
        },
        {
          text: 'Monitoring',
          items: [
            { text: 'A2A Server', link: '/api/monitoring/server/a2a/README' },
          ],
        },
        {
          text: 'Common Modules',
          items: [
            { text: 'Paymaster', link: '/api/paymaster/README' },
            { text: 'Ban Check', link: '/api/banCheck/README' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/elizaos/jeju' },
      { icon: 'discord', link: 'https://discord.gg/jeju' },
      { icon: 'twitter', link: 'https://twitter.com/jejunetwork' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present Jeju',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/elizaos/jeju/edit/main/apps/documentation/:path',
      text: 'Edit this page on GitHub',
    },
  },
});

