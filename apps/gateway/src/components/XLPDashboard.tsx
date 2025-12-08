import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';
import { useXLPLiquidity, useXLPStake, useEILConfig } from '../hooks/useEIL';
import { useProtocolTokens } from '../hooks/useProtocolTokens';
import TokenSelector from './TokenSelector';
import type { TokenOption } from './TokenSelector';

type TabType = 'overview' | 'liquidity' | 'stake' | 'history';

const SUPPORTED_CHAINS = [
  { id: 420691, name: 'Jeju Mainnet' },
  { id: 420690, name: 'Jeju Testnet' },
  { id: 8453, name: 'Base' },
  { id: 42161, name: 'Arbitrum' },
  { id: 10, name: 'Optimism' },
] as const;

export default function XLPDashboard() {
  const { isConnected } = useAccount();
  const { crossChainPaymaster, l1StakeManager } = useEILConfig();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [ethAmount, setEthAmount] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [selectedChains, setSelectedChains] = useState<number[]>([420691, 8453]);

  const { tokens } = useProtocolTokens();
  const tokenOptions = tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    address: t.address,
    decimals: t.decimals,
    priceUSD: t.priceUSD,
    logoUrl: t.logoUrl,
  }));

  const {
    xlpETH,
    depositETH,
    withdrawETH,
    depositToken,
    isLoading: isLiquidityLoading,
    isSuccess: isLiquiditySuccess,
  } = useXLPLiquidity(crossChainPaymaster);

  const {
    stake,
    supportedChains,
    unbondingTimeRemaining,
    register,
    addStake,
    startUnbonding,
    completeUnbonding,
    isLoading: isStakeLoading,
    isSuccess: isStakeSuccess,
  } = useXLPStake(l1StakeManager);

  const isLoading = isLiquidityLoading || isStakeLoading;

  const handleDepositETH = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseEther(ethAmount);
    await depositETH(amount);
    setEthAmount('');
  };

  const handleWithdrawETH = async () => {
    if (!xlpETH) return;
    await withdrawETH(xlpETH);
  };

  const handleDepositToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken) return;
    const amount = parseEther(tokenAmount);
    await depositToken(selectedToken.address as Address, amount);
    setTokenAmount('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseEther(stakeAmount);
    await register(selectedChains, amount);
    setStakeAmount('');
  };

  const handleAddStake = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseEther(stakeAmount);
    await addStake(amount);
    setStakeAmount('');
  };

  const toggleChain = (chainId: number) => {
    if (selectedChains.includes(chainId)) {
      setSelectedChains(selectedChains.filter(c => c !== chainId));
    } else {
      setSelectedChains([...selectedChains, chainId]);
    }
  };

  if (!isConnected) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🌊 XLP Dashboard</h2>
        <p style={{ color: '#64748b' }}>Connect your wallet to manage XLP liquidity</p>
      </div>
    );
  }

  if (!crossChainPaymaster || !l1StakeManager) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🌊 XLP Dashboard</h2>
        <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
          <p style={{ color: '#92400e', margin: 0 }}>
            EIL contracts not configured. Please deploy EIL first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '2rem' }}>🌊</span>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>XLP Dashboard</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
              Provide cross-chain liquidity, earn fees
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div style={{ 
          padding: '1rem', 
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
          borderRadius: '12px', 
          marginBottom: '1.5rem',
          border: '1px solid #fbbf24'
        }}>
          <p style={{ fontSize: '0.875rem', margin: 0, color: '#92400e' }}>
            <strong>💡 How XLP works:</strong> Stake ETH on L1 for security, deposit liquidity on L2s, 
            fulfill cross-chain transfers, earn fees. Your stake protects users – malicious behavior gets slashed.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '1rem'
        }}>
          {(['overview', 'liquidity', 'stake', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab ? '#3b82f6' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ 
                padding: '1.5rem', 
                background: '#f8fafc', 
                borderRadius: '12px',
                textAlign: 'center' 
              }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>L1 Stake</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.5rem 0' }}>
                  {stake ? formatEther(stake.stakedAmount) : '0'} ETH
                </p>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: stake?.isActive ? '#16a34a' : '#dc2626',
                  fontWeight: '600'
                }}>
                  {stake?.isActive ? '● Active' : '○ Inactive'}
                </p>
              </div>
              
              <div style={{ 
                padding: '1.5rem', 
                background: '#f8fafc', 
                borderRadius: '12px',
                textAlign: 'center' 
              }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>L2 ETH Liquidity</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.5rem 0' }}>
                  {xlpETH ? formatEther(xlpETH) : '0'} ETH
                </p>
                <p style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Available for gas</p>
              </div>
            </div>

            <div style={{ 
              padding: '1rem', 
              background: '#f0fdf4', 
              borderRadius: '12px',
              border: '1px solid #86efac'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Supported Chains</span>
                <span style={{ fontWeight: '600' }}>
                  {supportedChains?.length || 0}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {supportedChains?.map((chainId) => {
                  const chain = SUPPORTED_CHAINS.find(c => BigInt(c.id) === chainId);
                  return chain ? (
                    <span 
                      key={chain.id}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#16a34a'
                      }}
                    >
                      {chain.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Liquidity Tab */}
        {activeTab === 'liquidity' && (
          <div>
            {/* ETH Deposit */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>ETH Liquidity (Gas Sponsorship)</h3>
              
              <div style={{ 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Current Balance</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                    {xlpETH ? formatEther(xlpETH) : '0'} ETH
                  </span>
                </div>
              </div>

              <form onSubmit={handleDepositETH}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    disabled={isLoading}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="button"
                    disabled={isLoading || !ethAmount}
                  >
                    Deposit ETH
                  </button>
                </div>
              </form>

              {xlpETH && xlpETH > 0n && (
                <button
                  className="button button-secondary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={handleWithdrawETH}
                  disabled={isLoading}
                >
                  Withdraw All ETH
                </button>
              )}
            </div>

            {/* Token Deposit */}
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Token Liquidity</h3>
              
              <TokenSelector
                tokens={tokenOptions}
                selectedToken={selectedToken?.symbol}
                onSelect={setSelectedToken}
                label="Select Token"
                placeholder="Choose token..."
                disabled={isLoading}
              />

              {selectedToken && (
                <form onSubmit={handleDepositToken} style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      placeholder="0.0"
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(e.target.value)}
                      disabled={isLoading}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="button"
                      disabled={isLoading || !tokenAmount}
                    >
                      Deposit {selectedToken.symbol}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Stake Tab */}
        {activeTab === 'stake' && (
          <div>
            {!stake?.isActive ? (
              /* Registration Form */
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Register as XLP</h3>
                
                <div style={{ 
                  padding: '1rem', 
                  background: '#dbeafe', 
                  borderRadius: '12px',
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ fontSize: '0.875rem', margin: 0, color: '#1e40af' }}>
                    <strong>Requirements:</strong> Minimum 1 ETH stake, 8-day unbonding period
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Supported Chains
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {SUPPORTED_CHAINS.map((chain) => (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => toggleChain(chain.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: selectedChains.includes(chain.id) 
                            ? '2px solid #3b82f6' 
                            : '2px solid #e2e8f0',
                          background: selectedChains.includes(chain.id) 
                            ? '#eff6ff' 
                            : 'white',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        {chain.name}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleRegister}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Initial Stake (min 1 ETH)
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="1.0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isLoading}
                    style={{ marginBottom: '1rem' }}
                  />
                  <button
                    type="submit"
                    className="button"
                    style={{ width: '100%' }}
                    disabled={isLoading || !stakeAmount || selectedChains.length === 0}
                  >
                    Register as XLP
                  </button>
                </form>
              </div>
            ) : (
              /* Stake Management */
              <div>
                <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ 
                    padding: '1.5rem', 
                    background: '#f0fdf4', 
                    borderRadius: '12px',
                    textAlign: 'center' 
                  }}>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Active Stake</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.5rem 0', color: '#16a34a' }}>
                      {formatEther(stake.stakedAmount)} ETH
                    </p>
                  </div>
                  
                  {stake.unbondingAmount > 0n && (
                    <div style={{ 
                      padding: '1.5rem', 
                      background: '#fef3c7', 
                      borderRadius: '12px',
                      textAlign: 'center' 
                    }}>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Unbonding</p>
                      <p style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0.5rem 0', color: '#92400e' }}>
                        {formatEther(stake.unbondingAmount)} ETH
                      </p>
                      {unbondingTimeRemaining && unbondingTimeRemaining > 0n && (
                        <p style={{ fontSize: '0.75rem', color: '#92400e' }}>
                          {Math.ceil(Number(unbondingTimeRemaining) / 86400)} days remaining
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddStake} style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Add Stake
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      disabled={isLoading}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="button"
                      disabled={isLoading || !stakeAmount}
                    >
                      Add Stake
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="button button-secondary"
                    style={{ flex: 1 }}
                    onClick={() => stake && startUnbonding(stake.stakedAmount)}
                    disabled={isLoading || stake.unbondingAmount > 0n}
                  >
                    Start Unbonding
                  </button>
                  {stake.unbondingAmount > 0n && unbondingTimeRemaining === 0n && (
                    <button
                      className="button"
                      style={{ flex: 1 }}
                      onClick={() => completeUnbonding()}
                      disabled={isLoading}
                    >
                      Complete Unbonding
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
              Voucher history coming soon...
            </p>
          </div>
        )}
      </div>

      {(isLiquiditySuccess || isStakeSuccess) && (
        <div style={{ 
          padding: '1rem', 
          background: '#dcfce7', 
          borderRadius: '8px',
          marginTop: '1rem'
        }}>
          <p style={{ color: '#16a34a', margin: 0, fontWeight: '600' }}>
            ✓ Transaction successful!
          </p>
        </div>
      )}
    </div>
  );
}

