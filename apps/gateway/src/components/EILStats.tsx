import { useState, useEffect } from 'react';
import { formatEther } from 'viem';

interface EILStatsData {
  totalVolumeEth: string;
  totalTransactions: number;
  activeXLPs: number;
  totalStakedEth: string;
  successRate: number;
  avgTimeSeconds: number;
  last24hVolume: string;
  last24hTransactions: number;
}

interface EILChainStats {
  chainId: number;
  chainName: string;
  totalVolume: string;
  totalTransfers: number;
  activeXLPs: number;
}

const CHAIN_ICONS: Record<number, string> = {
  1: '⚫',
  8453: '🔵',
  42161: '🟠',
  10: '🔴',
  420691: '🏝️',
  420690: '🏝️',
};

export default function EILStats() {
  const [stats, setStats] = useState<EILStatsData | null>(null);
  const [chainStats, setChainStats] = useState<EILChainStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      
      // In production, fetch from GraphQL indexer
      // For now, use mock data
      const mockStats: EILStatsData = {
        totalVolumeEth: '1234.56',
        totalTransactions: 5678,
        activeXLPs: 12,
        totalStakedEth: '500.00',
        successRate: 99.2,
        avgTimeSeconds: 8.5,
        last24hVolume: '123.45',
        last24hTransactions: 456,
      };

      const mockChainStats: EILChainStats[] = [
        { chainId: 420691, chainName: 'Jeju', totalVolume: '500.00', totalTransfers: 2000, activeXLPs: 10 },
        { chainId: 8453, chainName: 'Base', totalVolume: '400.00', totalTransfers: 1500, activeXLPs: 8 },
        { chainId: 42161, chainName: 'Arbitrum', totalVolume: '200.00', totalTransfers: 1000, activeXLPs: 6 },
        { chainId: 10, chainName: 'Optimism', totalVolume: '134.56', totalTransfers: 1178, activeXLPs: 5 },
      ];

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStats(mockStats);
      setChainStats(mockChainStats);
      setIsLoading(false);
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <p style={{ color: '#64748b', marginTop: '1rem' }}>Loading EIL stats...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        marginBottom: '1rem' 
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚡</span>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>EIL Protocol Stats</h2>
        <span style={{ 
          padding: '0.25rem 0.5rem', 
          background: '#dcfce7', 
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#16a34a',
          fontWeight: '600'
        }}>
          Live
        </span>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard
          label="24h Volume"
          value={`${stats.last24hVolume} ETH`}
          subtext={`${stats.last24hTransactions} transfers`}
          color="#3b82f6"
          icon="📊"
        />
        <StatCard
          label="Active XLPs"
          value={stats.activeXLPs.toString()}
          subtext={`${stats.totalStakedEth} ETH staked`}
          color="#10b981"
          icon="🌊"
        />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate}%`}
          subtext={`${stats.totalTransactions.toLocaleString()} total txns`}
          color="#8b5cf6"
          icon="✓"
        />
        <StatCard
          label="Avg Time"
          value={`${stats.avgTimeSeconds}s`}
          subtext="Trustless & instant"
          color="#f59e0b"
          icon="⚡"
        />
      </div>

      {/* Chain Stats */}
      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#475569' }}>
          Cross-Chain Activity
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {chainStats.map((chain) => (
            <div 
              key={chain.chainId}
              style={{
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                {CHAIN_ICONS[chain.chainId] || '🔗'}
              </div>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                {chain.chainName}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: '600' }}>
                {chain.totalVolume} ETH
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {chain.totalTransfers.toLocaleString()} transfers
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subtext, 
  color, 
  icon 
}: { 
  label: string; 
  value: string; 
  subtext: string; 
  color: string;
  icon: string;
}) {
  return (
    <div className="card" style={{ 
      padding: '1rem', 
      borderTop: `3px solid ${color}`,
      background: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{label}</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.25rem 0', color: color }}>
            {value}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{subtext}</p>
        </div>
        <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>{icon}</span>
      </div>
    </div>
  );
}

