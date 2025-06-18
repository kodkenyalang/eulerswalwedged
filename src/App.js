import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './styles/App.css';
import PoolDashboard from './components/PoolDashboard';
import PoolList from './components/PoolList';
import DepositForm from './components/DepositForm';
import RiskChart from './components/RiskChart';
import VaultDashboard from './components/VaultDashboard';
import CrossVaultDashboard from './components/CrossVaultDashboard';
import useWeb3 from './hooks/useWeb3';
import { contractService } from './services/contractService';
import { riskService } from './services/riskService';

function App() {
  const {
    account,
    provider,
    signer,
    chainId,
    connect,
    disconnect,
    loading: web3Loading
  } = useWeb3();

  const [currentView, setCurrentView] = useState('dashboard');

  // Debug function to track navigation clicks
  const handleNavigation = (view) => {
    console.log('Navigation clicked:', view);
    console.log('Current view before:', currentView);
    setCurrentView(view);
    console.log('Current view after:', view);
    // Clear any messages when navigating
    setError('');
    setSuccess('');
  };
  const [pools, setPools] = useState([]);
  const [userPools, setUserPools] = useState([]);
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Initialize contract service when provider changes
  useEffect(() => {
    if (provider && signer) {
      contractService.initialize(provider, signer);
    }
  }, [provider, signer]);

  // Load pools when account changes
  useEffect(() => {
    if (account) {
      loadPools();
      loadUserPools();
    }
  }, [account]);

  const loadPools = async () => {
    try {
      setLoading(true);
      const poolsData = await contractService.getAllPools();
      setPools(poolsData);
    } catch (err) {
      console.error('Error loading pools:', err);
      setError('Failed to load pools: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPools = async () => {
    if (!account) return;
    
    try {
      const userPoolsData = await contractService.getUserPools(account);
      const userPoolsWithDetails = await Promise.all(
        userPoolsData.map(async (poolId) => {
          const pool = await contractService.getPoolInfo(poolId);
          const userDeposit = await contractService.getUserDeposit(poolId, account);
          const userRewards = await contractService.getUserRewards(poolId, account);
          return {
            ...pool,
            userDeposit: ethers.formatEther(userDeposit),
            userRewards: ethers.formatEther(userRewards)
          };
        })
      );
      setUserPools(userPoolsWithDetails);
    } catch (err) {
      console.error('Error loading user pools:', err);
      setError('Failed to load user pools: ' + err.message);
    }
  };

  const handleDeposit = async (poolId, amount, tokenAddress) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const tx = await contractService.deposit(poolId, amount, tokenAddress);
      await tx.wait();
      
      setSuccess('Deposit successful!');
      await loadPools();
      await loadUserPools();
    } catch (err) {
      console.error('Deposit error:', err);
      setError('Deposit failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (poolId, amount) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const tx = await contractService.withdraw(poolId, amount);
      await tx.wait();
      
      setSuccess('Withdrawal successful!');
      await loadPools();
      await loadUserPools();
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError('Withdrawal failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    setCurrentView('pool-detail');
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleWalletConnect = async () => {
    const success = await connect();
    if (success) {
      setShowWalletModal(false);
      setSuccess('Wallet connected successfully!');
    }
  };

  const handleCancelConnection = () => {
    setShowWalletModal(false);
    setError('');
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId) => {
    const networks = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      31337: 'Hardhat Local',
      137: 'Polygon',
      42161: 'Arbitrum One',
      10: 'Optimism'
    };
    return networks[chainId] || `Chain ID ${chainId}`;
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <h1 className="logo">
              <span className="logo-icon">⚡</span>
              Wedged
            </h1>
            <nav className="nav">
              <button
                className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => handleNavigation('dashboard')}
                type="button"
              >
                <span className="nav-icon">📊</span>
                <span className="nav-label">Dashboard</span>
              </button>
              <button
                className={`nav-item ${currentView === 'pools' ? 'active' : ''}`}
                onClick={() => handleNavigation('pools')}
                type="button"
              >
                <span className="nav-icon">🏊</span>
                <span className="nav-label">Liquidity Pools</span>
              </button>
              <button
                className={`nav-item ${currentView === 'deposit' ? 'active' : ''}`}
                onClick={() => handleNavigation('deposit')}
                type="button"
              >
                <span className="nav-icon">💰</span>
                <span className="nav-label">Deposit & Hedge</span>
              </button>
              <button
                className={`nav-item ${currentView === 'analytics' ? 'active' : ''}`}
                onClick={() => handleNavigation('analytics')}
                type="button"
              >
                <span className="nav-icon">📈</span>
                <span className="nav-label">Risk Analytics</span>
              </button>
              <button
                className={`nav-item ${currentView === 'vaults' ? 'active' : ''}`}
                onClick={() => handleNavigation('vaults')}
                type="button"
              >
                <span className="nav-icon">🏦</span>
                <span className="nav-label">Euler Vaults</span>
              </button>
              <button
                className={`nav-item ${currentView === 'cross-vault' ? 'active' : ''}`}
                onClick={() => handleNavigation('cross-vault')}
                type="button"
              >
                <span className="nav-icon">🔗</span>
                <span className="nav-label">Cross-Vault</span>
              </button>
            </nav>
            <div className="wallet-section">
              {account ? (
                <div className="wallet-info">
                  <div className="network-badge">
                    {getNetworkName(chainId)}
                  </div>
                  <div className="account-info">
                    <span className="account-address">{formatAddress(account)}</span>
                    <button onClick={disconnect} className="disconnect-btn">
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowWalletModal(true)}
                  disabled={web3Loading}
                  className="connect-btn"
                >
                  {web3Loading ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {/* Status Messages */}
          {error && (
            <div className="alert alert-error">
              <span>⚠️ {error}</span>
              <button onClick={clearMessages} className="close-btn">×</button>
            </div>
          )}
          
          {success && (
            <div className="alert alert-success">
              <span>✅ {success}</span>
              <button onClick={clearMessages} className="close-btn">×</button>
            </div>
          )}

          {/* Debug indicator */}
          <div style={{ padding: '10px', background: '#333', color: '#fff', textAlign: 'center', fontSize: '14px' }}>
            Current View: {currentView} | Account: {account ? 'Connected' : 'Not Connected'}
          </div>

          {!account ? (
            <div className="welcome-section">
              <div className="welcome-content">
                <h2>Welcome to Wedged</h2>
                <p>
                  Risk-managed liquidity hedging pools integrated with EulerSwap protocol.
                  Protect your liquidity positions from impermanent loss with automated hedging strategies.
                </p>
                <div className="features">
                  <div className="feature">
                    <h3>🛡️ Risk Protection</h3>
                    <p>Automated hedging against impermanent loss</p>
                  </div>
                  <div className="feature">
                    <h3>📊 Real-time Analytics</h3>
                    <p>Advanced risk calculation and monitoring</p>
                  </div>
                  <div className="feature">
                    <h3>⚡ EulerSwap Integration</h3>
                    <p>Seamless integration with EulerSwap protocol</p>
                  </div>
                </div>
                <button onClick={() => setShowWalletModal(true)} className="cta-button">
                  Connect Wallet to Get Started
                </button>
              </div>
            </div>
          ) : (
            <div className="app-content">
              {loading && (
                <div className="loading-overlay">
                  <div className="loading-spinner"></div>
                  <p>Loading...</p>
                </div>
              )}

              {currentView === 'dashboard' && (
                <PoolDashboard
                  userPools={userPools}
                  totalPools={pools.length}
                  onPoolSelect={handlePoolSelect}
                  onWithdraw={handleWithdraw}
                  loading={loading}
                />
              )}

              {currentView === 'pools' && (
                <PoolList
                  pools={pools}
                  userPools={userPools}
                  onPoolSelect={handlePoolSelect}
                  loading={loading}
                />
              )}

              {currentView === 'deposit' && (
                <DepositForm
                  pools={pools}
                  onDeposit={handleDeposit}
                  loading={loading}
                />
              )}

              {currentView === 'vaults' && (
                <VaultDashboard />
              )}

              {currentView === 'cross-vault' && (
                <CrossVaultDashboard />
              )}

              {currentView === 'analytics' && (
                <div className="analytics-view">
                  <div className="analytics-header">
                    <h2>Risk Analytics Dashboard</h2>
                    <p>Comprehensive risk analysis and market insights for your hedging strategies</p>
                  </div>
                  
                  <div className="analytics-grid">
                    <div className="analytics-card">
                      <h3>Market Overview</h3>
                      <div className="market-stats">
                        <div className="stat-item">
                          <label>Total Value Locked</label>
                          <span className="stat-value">
                            {pools.reduce((total, pool) => total + parseFloat(ethers.formatEther(pool.totalDeposits || 0)), 0).toFixed(2)} ETH
                          </span>
                        </div>
                        <div className="stat-item">
                          <label>Active Pools</label>
                          <span className="stat-value">{pools.length}</span>
                        </div>
                        <div className="stat-item">
                          <label>Total Hedged</label>
                          <span className="stat-value">
                            {pools.reduce((total, pool) => total + parseFloat(ethers.formatEther(pool.hedgedAmount || 0)), 0).toFixed(2)} ETH
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="analytics-card">
                      <h3>Risk Distribution</h3>
                      <div className="risk-breakdown">
                        {pools.map((pool, index) => (
                          <div key={index} className="risk-item">
                            <div className="risk-label">Pool {pool.id}</div>
                            <div className="risk-bar">
                              <div 
                                className={`risk-fill risk-${pool.riskScore > 5000 ? 'high' : pool.riskScore > 3000 ? 'medium' : 'low'}`}
                                style={{ width: `${Math.min((pool.riskScore / 100), 100)}%` }}
                              ></div>
                            </div>
                            <div className="risk-value">{(pool.riskScore / 100).toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="analytics-card full-width">
                      <h3>Portfolio Performance</h3>
                      <RiskChart poolId="overview" />
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'pool-detail' && selectedPool && (
                <div className="pool-detail">
                  <div className="pool-detail-header">
                    <button
                      onClick={() => setCurrentView('dashboard')}
                      className="back-btn"
                    >
                      ← Back
                    </button>
                    <h2>Pool Details</h2>
                  </div>
                  
                  <div className="pool-detail-content">
                    <div className="pool-info-section">
                      <h3>Pool Information</h3>
                      <div className="info-grid">
                        <div className="info-item">
                          <label>Pool ID</label>
                          <span>{selectedPool.id}</span>
                        </div>
                        <div className="info-item">
                          <label>Token Pair</label>
                          <span>
                            {formatAddress(selectedPool.token0)} / {formatAddress(selectedPool.token1)}
                          </span>
                        </div>
                        <div className="info-item">
                          <label>Total Deposits</label>
                          <span>{ethers.formatEther(selectedPool.totalDeposits)} ETH</span>
                        </div>
                        <div className="info-item">
                          <label>Available Liquidity</label>
                          <span>{ethers.formatEther(selectedPool.availableLiquidity)} ETH</span>
                        </div>
                        <div className="info-item">
                          <label>Hedged Amount</label>
                          <span>{ethers.formatEther(selectedPool.hedgedAmount)} ETH</span>
                        </div>
                        <div className="info-item">
                          <label>Risk Score</label>
                          <span className={`risk-score risk-${selectedPool.riskScore > 5000 ? 'high' : selectedPool.riskScore > 3000 ? 'medium' : 'low'}`}>
                            {(selectedPool.riskScore / 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="risk-chart-section">
                      <RiskChart poolId={selectedPool.id} />
                    </div>

                    {selectedPool.userDeposit && parseFloat(selectedPool.userDeposit) > 0 && (
                      <div className="user-position-section">
                        <h3>Your Position</h3>
                        <div className="position-info">
                          <div className="position-item">
                            <label>Your Deposit</label>
                            <span>{selectedPool.userDeposit} ETH</span>
                          </div>
                          <div className="position-item">
                            <label>Pending Rewards</label>
                            <span>{selectedPool.userRewards} ETH</span>
                          </div>
                        </div>
                        <div className="position-actions">
                          <button
                            onClick={() => {
                              const amount = prompt('Enter withdrawal amount (ETH):');
                              if (amount && parseFloat(amount) > 0) {
                                handleWithdraw(selectedPool.id, ethers.parseEther(amount));
                              }
                            }}
                            className="withdraw-btn"
                          >
                            Withdraw
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>&copy; 2023 Wedged. Risk-managed DeFi liquidity hedging.</p>
        </div>
      </footer>

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Connect Your Wallet</h3>
              <button 
                className="modal-close"
                onClick={() => setShowWalletModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="wallet-info-section">
                <h4>Wallet Status</h4>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">MetaMask Detected:</span>
                    <span className={`status-value ${typeof window !== 'undefined' && window.ethereum ? 'success' : 'error'}`}>
                      {typeof window !== 'undefined' && window.ethereum ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Connection Status:</span>
                    <span className={`status-value ${account ? 'success' : 'warning'}`}>
                      {account ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {chainId && (
                    <div className="status-item">
                      <span className="status-label">Network:</span>
                      <span className="status-value">{getNetworkName(chainId)}</span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="error-section">
                  <h4>Connection Error</h4>
                  <p className="error-message">{error}</p>
                  <div className="error-help">
                    <h5>Troubleshooting Tips:</h5>
                    <ul>
                      <li>Make sure MetaMask is installed and unlocked</li>
                      <li>Check that you're on the correct network</li>
                      <li>Try refreshing the page and connecting again</li>
                      <li>Disable other wallet extensions temporarily</li>
                    </ul>
                  </div>
                </div>
              )}

              {web3Loading && (
                <div className="connection-progress">
                  <div className="progress-header">
                    <span className="loading-spinner-small"></span>
                    <strong>Connecting to MetaMask...</strong>
                  </div>
                  <div className="progress-steps">
                    <p>1. Check your MetaMask extension</p>
                    <p>2. Click "Connect" in the MetaMask popup</p>
                    <p>3. Select the account you want to connect</p>
                  </div>
                  <div className="progress-note">
                    If no popup appears, click the MetaMask extension icon in your browser toolbar.
                  </div>
                </div>
              )}

              <div className="wallet-actions">
                <button
                  onClick={handleWalletConnect}
                  disabled={web3Loading}
                  className="connect-wallet-btn"
                >
                  {web3Loading ? 'Connecting...' : 'Connect MetaMask'}
                </button>
                
                {web3Loading && (
                  <button
                    onClick={handleCancelConnection}
                    className="cancel-connection-btn"
                  >
                    Cancel Connection
                  </button>
                )}
                
                {typeof window !== 'undefined' && !window.ethereum && (
                  <a 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="install-metamask-btn"
                  >
                    Install MetaMask
                  </a>
                )}
              </div>

              <div className="help-section">
                <h4>Need Help?</h4>
                <p>If you're having trouble connecting, make sure:</p>
                <ul>
                  <li>MetaMask is installed and set up</li>
                  <li>Your wallet is unlocked</li>
                  <li>You approve the connection request</li>
                  <li>You're on a supported network</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
