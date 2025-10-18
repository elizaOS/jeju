# JejuMarket Frontend Deployment Guide

This guide covers building and deploying the JejuMarket Next.js frontend application.

## Overview

The JejuMarket frontend is a Next.js application that provides:
- Market discovery and browsing
- Real-time betting interface
- Portfolio management
- Wallet integration (RainbowKit)
- GraphQL data fetching (Subsquid indexer)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Web3**: Wagmi + RainbowKit
- **Data**: GraphQL (graphql-request)
- **Charts**: Recharts
- **State**: Zustand

## Prerequisites

### System Requirements

- **Node.js**: v18+ (v20 recommended)
- **Bun**: Latest version (preferred) or npm
- **Git**: For deployment workflows

### Required Information

Before deployment, gather:

1. **Contract Addresses** (from deployment script)
   - JejuMarket contract address
   - ElizaOS token address
   - PredictionOracle address (if applicable)

2. **Network Configuration**
   - RPC URL
   - Chain ID
   - Block explorer URL

3. **Indexer Endpoint**
   - GraphQL API URL from indexer deployment

4. **WalletConnect Project ID** (optional but recommended)
   - Create at: https://cloud.walletconnect.com/

## Configuration

### 1. Environment Variables

The deployment script should have created `.env.local`, `.env.testnet`, or `.env.mainnet` files. Verify or create:

```bash
cd apps/jeju-market
```

#### For Local Development (`.env.local`):

```bash
# Network Configuration
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=42069

# Contract Addresses
NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ELIZA_OS_ADDRESS=0x...
NEXT_PUBLIC_PREDICTION_ORACLE_ADDRESS=0x...

# Indexer
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4350/graphql

# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Analytics (optional)
NEXT_PUBLIC_GA_ID=
```

#### For Testnet (`.env.testnet`):

```bash
# Network Configuration
NEXT_PUBLIC_RPC_URL=https://testnet-rpc.jeju.network
NEXT_PUBLIC_CHAIN_ID=420690

# Contract Addresses (from deployment)
NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ELIZA_OS_ADDRESS=0x...
NEXT_PUBLIC_PREDICTION_ORACLE_ADDRESS=0x...

# Indexer
NEXT_PUBLIC_GRAPHQL_URL=https://indexer-testnet.jeju.network/graphql

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Block Explorer
NEXT_PUBLIC_EXPLORER_URL=https://testnet-explorer.jeju.network
```

#### For Mainnet (`.env.production`):

```bash
# Network Configuration
NEXT_PUBLIC_RPC_URL=https://rpc.jeju.network
NEXT_PUBLIC_CHAIN_ID=420691

# Contract Addresses (from deployment)
NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ELIZA_OS_ADDRESS=0x...
NEXT_PUBLIC_PREDICTION_ORACLE_ADDRESS=0x...

# Indexer
NEXT_PUBLIC_GRAPHQL_URL=https://indexer.jeju.network/graphql

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Block Explorer
NEXT_PUBLIC_EXPLORER_URL=https://explorer.jeju.network

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry (error tracking)
SENTRY_DSN=https://...
```

### 2. Verify Configuration

```bash
# Check if all required variables are set
bun run scripts/check-env.ts

# Or manually:
grep NEXT_PUBLIC .env.local
```

### 3. Update Chain Configuration

Edit `app/providers.tsx` to ensure Jeju chain is configured:

```typescript
import { createConfig, http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Jeju Mainnet configuration
const jejuMainnet = {
  id: 420691,
  name: 'Jeju',
  network: 'jeju',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL!] },
  },
  blockExplorers: {
    default: {
      name: 'Jeju Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL!
    },
  },
};

const config = getDefaultConfig({
  appName: 'JejuMarket',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [jejuMainnet],
  transports: {
    [jejuMainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});
```

## Build Process

### Local Development

```bash
cd apps/jeju-market

# Install dependencies
bun install

# Start development server
bun run dev

# Access at http://localhost:3003
```

The dev server includes:
- Hot reloading
- Error overlay
- Fast refresh

### Production Build

```bash
cd apps/jeju-market

# Build for production
bun run build

# Test production build locally
bun run start

# Access at http://localhost:3003
```

Build output:
- Static files in `.next/static/`
- Server components in `.next/server/`
- Optimized images and assets

### Build Verification

After building, verify:

```bash
# Check build size
du -sh .next

# Check for build errors
cat .next/build-manifest.json

# Test critical pages
curl http://localhost:3003
curl http://localhost:3003/api/health
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the best Next.js hosting with zero configuration.

#### A. Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (from apps/jeju-market directory)
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set environment variables
# - Choose production or preview

# Deploy to production
vercel --prod
```

#### B. Deploy via GitHub

1. Push code to GitHub
2. Connect repository to Vercel:
   - Go to https://vercel.com/new
   - Import your repository
   - Select `apps/jeju-market` as root directory
   - Add environment variables
   - Deploy

**Vercel Configuration** (`vercel.json`):

```json
{
  "buildCommand": "cd ../.. && bun install && cd apps/jeju-market && bun run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_RPC_URL": "@jeju-rpc-url",
    "NEXT_PUBLIC_CHAIN_ID": "@jeju-chain-id",
    "NEXT_PUBLIC_JEJU_MARKET_ADDRESS": "@jeju-market-address",
    "NEXT_PUBLIC_GRAPHQL_URL": "@jeju-graphql-url"
  }
}
```

**Benefits**:
- Automatic deployments on git push
- Preview deployments for PRs
- Edge network CDN
- Built-in analytics
- Zero configuration

### Option 2: Netlify

Similar to Vercel, optimized for Next.js.

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

**Netlify Configuration** (`netlify.toml`):

```toml
[build]
  base = "apps/jeju-market"
  command = "bun run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Option 3: Self-Hosted (VPS/Cloud)

For more control, deploy to your own server.

#### Using PM2 (Recommended for Node.js apps)

```bash
# On your server
cd /var/www/jeju-market

# Install dependencies
bun install --production

# Build
bun run build

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "jeju-market" -- start

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Using Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

Build and run:

```bash
# Build image
docker build -t jeju-market .

# Run container
docker run -p 3003:3000 \
  -e NEXT_PUBLIC_RPC_URL=https://rpc.jeju.network \
  -e NEXT_PUBLIC_CHAIN_ID=420691 \
  -e NEXT_PUBLIC_JEJU_MARKET_ADDRESS=0x... \
  jeju-market
```

#### Using Nginx

Set up reverse proxy:

```nginx
server {
    listen 80;
    server_name market.jeju.network;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable SSL with Let's Encrypt:

```bash
sudo certbot --nginx -d market.jeju.network
```

### Option 4: Static Export (Advanced)

For pure static hosting (S3, CloudFront, etc.):

```bash
# Update next.config.ts
export default {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

# Build
bun run build

# Output in 'out' directory
aws s3 sync out/ s3://your-bucket/ --delete
```

**Note**: Static export has limitations:
- No API routes
- No server-side rendering
- No dynamic routes (must be pre-generated)

## Domain and DNS Setup

### 1. Domain Configuration

Point your domain to the deployment:

#### For Vercel/Netlify:
- Add custom domain in dashboard
- Update DNS records (provided by platform)

#### For Self-Hosted:
```
Type: A
Name: market (or @)
Value: YOUR_SERVER_IP
TTL: 3600
```

#### For Subdomain:
```
Type: CNAME
Name: market
Value: your-deployment.vercel.app
TTL: 3600
```

### 2. SSL Certificate

#### Vercel/Netlify:
- Automatic SSL (Let's Encrypt)
- Configured automatically

#### Self-Hosted:
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d market.jeju.network

# Auto-renewal
sudo certbot renew --dry-run
```

### 3. Verify Domain

```bash
# Check DNS propagation
dig market.jeju.network

# Check SSL
curl -I https://market.jeju.network

# Verify site loads
curl https://market.jeju.network
```

## CDN Configuration

### Vercel (Built-in)
- Automatic edge network
- Assets served from nearest location
- No configuration needed

### Cloudflare (Recommended for Self-Hosted)

1. Add site to Cloudflare
2. Update nameservers
3. Configure:
   - Cache: Standard
   - Always Use HTTPS: On
   - Auto Minify: HTML, CSS, JS
   - Brotli: On
   - HTTP/2: On
   - HTTP/3 (QUIC): On

4. Page Rules:
   ```
   market.jeju.network/_next/static/*
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 year
   ```

### AWS CloudFront

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name your-origin.com \
  --default-root-object index.html

# Invalidate cache on deploy
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

## Monitoring and Analytics

### 1. Next.js Analytics

For Vercel deployments:

```typescript
// next.config.ts
export default {
  analytics: {
    provider: 'vercel',
  },
};
```

### 2. Google Analytics

Add to `app/layout.tsx`:

```typescript
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 3. Error Tracking (Sentry)

```bash
bun add @sentry/nextjs
```

Configure `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### 4. Uptime Monitoring

Use services like:
- UptimeRobot (free)
- Pingdom
- Better Uptime
- Datadog

Configure alerts for:
- Site down
- Slow response time
- SSL certificate expiry

### 5. Web Vitals Monitoring

```typescript
// app/layout.tsx
export function reportWebVitals(metric: any) {
  console.log(metric);
  // Send to analytics service
}
```

## Performance Optimization

### 1. Image Optimization

```typescript
// next.config.ts
export default {
  images: {
    domains: ['your-cdn.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

### 2. Bundle Analysis

```bash
# Install analyzer
bun add -D @next/bundle-analyzer

# Configure next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  // ... config
});

# Analyze
ANALYZE=true bun run build
```

### 3. Caching Strategy

```typescript
// app/api/markets/route.ts
export const revalidate = 60; // Revalidate every 60 seconds

// app/markets/[id]/page.tsx
export const dynamic = 'force-static';
export const revalidate = 300; // 5 minutes
```

### 4. Loading States

Implement skeleton screens and suspense:

```typescript
import { Suspense } from 'react';

<Suspense fallback={<MarketListSkeleton />}>
  <MarketList />
</Suspense>
```

## Testing Before Go-Live

### Pre-Launch Checklist

```bash
# 1. Test wallet connection
# - MetaMask
# - WalletConnect
# - Coinbase Wallet

# 2. Test core functionality
# - Browse markets
# - Place bet
# - View portfolio
# - Claim winnings

# 3. Test on multiple devices
# - Desktop (Chrome, Firefox, Safari)
# - Mobile (iOS Safari, Android Chrome)
# - Tablet

# 4. Performance tests
# - Lighthouse audit (should be 90+)
# - PageSpeed Insights
# - WebPageTest

# 5. Security checks
# - HTTPS working
# - No exposed secrets
# - CSP headers configured
# - CORS configured properly

# 6. Analytics verification
# - Google Analytics firing
# - Error tracking working
# - Custom events logging
```

### Load Testing

```bash
# Install k6
brew install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.get('https://market.jeju.network');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

## Rollback Procedures

### Vercel
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote DEPLOYMENT_URL
```

### Self-Hosted with PM2
```bash
# Backup current version
cp -r /var/www/jeju-market /var/www/jeju-market.backup

# Restore previous version
rm -rf /var/www/jeju-market
mv /var/www/jeju-market.previous /var/www/jeju-market

# Restart
pm2 restart jeju-market
```

### Docker
```bash
# Tag builds with version
docker build -t jeju-market:v1.2.3 .

# Roll back
docker stop jeju-market
docker run -d --name jeju-market jeju-market:v1.2.2
```

## Troubleshooting

### Build Failures

```bash
# Clear cache
rm -rf .next node_modules
bun install
bun run build

# Check for TypeScript errors
bun run tsc --noEmit

# Check for linting errors
bun run lint
```

### Runtime Errors

```bash
# Check browser console
# Check server logs
pm2 logs jeju-market

# Check environment variables
env | grep NEXT_PUBLIC
```

### Connection Issues

```bash
# Test RPC
curl -X POST $NEXT_PUBLIC_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Test GraphQL
curl $NEXT_PUBLIC_GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } }"}'

# Test contract
cast call $NEXT_PUBLIC_JEJU_MARKET_ADDRESS "totalMarkets()(uint256)" \
  --rpc-url $NEXT_PUBLIC_RPC_URL
```

## Next Steps

After deploying the frontend:

1. **End-to-End Testing**: Test complete user flows
2. **Performance Monitoring**: Set up alerts and dashboards
3. **User Documentation**: Create user guides and FAQs
4. **Marketing**: Announce launch, social media, etc.
5. **Feedback Loop**: Monitor user feedback and iterate

See:
- [Complete Deployment Checklist](./jeju-market-complete-deployment.md)
- [Monitoring and Operations](./monitoring.md)
- [Runbooks](./runbooks.md)

## Support

For deployment issues:
- Check Next.js docs: https://nextjs.org/docs
- Check Vercel docs: https://vercel.com/docs
- Review logs and error messages
- Test locally first: `bun run dev`
