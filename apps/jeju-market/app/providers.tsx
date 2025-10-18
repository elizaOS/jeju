'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const jejuChain = {
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '42069'),
  name: 'Jeju Network',
  network: 'jeju',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'] },
  },
  blockExplorers: {
    default: { name: 'JejuScan', url: 'https://scan.jeju.network' },
  },
  testnet: true,
};

const config = getDefaultConfig({
  appName: 'JejuMarket',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'jeju-market',
  chains: [jejuChain as any],
  transports: {
    [jejuChain.id]: http(jejuChain.rpcUrls.default.http[0]),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

