import { useState } from 'react';
import { Activity, Route, Users, BarChart3, Zap, Search, Wallet } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { IntentsView } from './pages/IntentsView';
import { RoutesView } from './pages/RoutesView';
import { SolversView } from './pages/SolversView';
import { StatsView } from './pages/StatsView';
import { CreateIntent } from './components/CreateIntent';
import { useOIFStats } from './hooks/useOIF';

type View = 'intents' | 'routes' | 'solvers' | 'stats';

export default function App() {
  const [activeView, setActiveView] = useState<View>('intents');
  const [showCreate, setShowCreate] = useState(false);
  const { data: stats } = useOIFStats();
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={22} color="#0a0a0f" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Intent Explorer
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Open Intents Framework
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Stats Summary */}
          <div style={{ display: 'flex', gap: '24px', marginRight: '16px' }}>
            <StatBadge label="Intents" value={stats?.totalIntents || 0} />
            <StatBadge label="Solvers" value={stats?.activeSolvers || 0} />
            <StatBadge label="Success" value={`${stats?.successRate?.toFixed(1) || 0}%`} />
          </div>

          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search intents..."
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '200px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Create Button */}
          <button
            onClick={() => setShowCreate(true)}
            disabled={!isConnected}
            style={{
              padding: '10px 20px',
              background: isConnected 
                ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))'
                : 'var(--bg-tertiary)',
              border: isConnected ? 'none' : '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: isConnected ? '#0a0a0f' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
            }}
          >
            <Zap size={16} />
            Create Intent
          </button>

          {/* Wallet Connect */}
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <div
                  {...(!mounted && {
                    'aria-hidden': true,
                    style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                  })}
                >
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      style={{
                        padding: '10px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '8px',
                        color: 'var(--text-accent)',
                        fontWeight: 500,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Wallet size={16} />
                      Connect
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={openChainModal}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {chain.name}
                      </button>
                      <button
                        onClick={openAccountModal}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: 'var(--text-accent)',
                          fontSize: '13px',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                        }}
                      >
                        {account.displayName}
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 24px',
        display: 'flex',
        gap: '4px',
      }}>
        <NavTab
          icon={<Activity size={18} />}
          label="Intents"
          active={activeView === 'intents'}
          onClick={() => setActiveView('intents')}
        />
        <NavTab
          icon={<Route size={18} />}
          label="Routes"
          active={activeView === 'routes'}
          onClick={() => setActiveView('routes')}
        />
        <NavTab
          icon={<Users size={18} />}
          label="Solvers"
          active={activeView === 'solvers'}
          onClick={() => setActiveView('solvers')}
        />
        <NavTab
          icon={<BarChart3 size={18} />}
          label="Analytics"
          active={activeView === 'stats'}
          onClick={() => setActiveView('stats')}
        />
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {activeView === 'intents' && <IntentsView />}
        {activeView === 'routes' && <RoutesView />}
        {activeView === 'solvers' && <SolversView />}
        {activeView === 'stats' && <StatsView />}
      </main>

      {/* Create Intent Modal */}
      {showCreate && <CreateIntent onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function NavTab({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--accent-cyan)' : 'transparent'}`,
        color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

