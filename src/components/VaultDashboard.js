import React, { useState, useEffect } from 'react';
import { vaultService } from '../services/vaultService';
import useWeb3 from '../hooks/useWeb3';
import { formatNumber, formatPercentage, formatCurrency, getRiskColor } from '../utils/constants';

const VaultDashboard = () => {
  const { address, provider, signer } = useWeb3();
  const [vaults, setVaults] = useState([]);
  const [userPortfolio, setUserPortfolio] = useState(null);
  const [selectedVault, setSelectedVault] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [transactionStatus, setTransactionStatus] = useState('');

  useEffect(() => {
    loadVaultData();
  }, []);

  useEffect(() => {
    if (address) {
      loadUserPortfolio();
    }
  }, [address]);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const supportedAssets = await vaultService.getAllSupportedAssets();
      
      const vaultData = await Promise.all(
        supportedAssets.map(async (asset) => {
          try {
            const vaultInfo = await vaultService.getVaultInfo(asset.address);
            const analytics = await vaultService.getVaultAnalytics(asset.address, '7d');
            
            return {
              ...asset,
              ...vaultInfo,
              analytics
            };
          } catch (error) {
            console.error(`Error loading vault data for ${asset.address}:`, error);
            return {
              ...asset,
              error: error.message
            };
          }
        })
      );

      setVaults(vaultData.filter(v => !v.error));
      setError('');
    } catch (error) {
      console.error('Error loading vault data:', error);
      setError('Failed to load vault data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPortfolio = async () => {
    if (!address) return;

    try {
      const portfolio = await vaultService.getUserPortfolio(address);
      setUserPortfolio(portfolio);
    } catch (error) {
      console.error('Error loading user portfolio:', error);
    }
  };

  const handleDeposit = async () => {
    if (!selectedVault || !depositAmount || !signer) return;

    try {
      setTransactionStatus('Depositing...');
      
      // Get gas estimate first
      const gasEstimate = await vaultService.getDepositGasEstimate(
        selectedVault.address, 
        depositAmount
      );
      
      const result = await vaultService.depositToVault(
        selectedVault.address,
        depositAmount,
        provider,
        signer
      );

      setTransactionStatus(`Deposit successful! TX: ${result.transactionHash}`);
      setDepositAmount('');
      
      // Reload data
      setTimeout(() => {
        loadVaultData();
        loadUserPortfolio();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Deposit failed:', error);
      setTransactionStatus(`Deposit failed: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedVault || !withdrawShares || !signer) return;

    try {
      setTransactionStatus('Withdrawing...');
      
      const result = await vaultService.withdrawFromVault(
        selectedVault.address,
        withdrawShares,
        provider,
        signer
      );

      setTransactionStatus(`Withdrawal successful! TX: ${result.transactionHash}`);
      setWithdrawShares('');
      
      // Reload data
      setTimeout(() => {
        loadVaultData();
        loadUserPortfolio();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Withdrawal failed:', error);
      setTransactionStatus(`Withdrawal failed: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const handleEnableCollateral = async (assetAddress) => {
    if (!signer) return;

    try {
      setTransactionStatus('Enabling collateral...');
      
      const result = await vaultService.enableCollateral(assetAddress, provider, signer);
      setTransactionStatus(`Collateral enabled! TX: ${result.transactionHash}`);
      
      setTimeout(() => {
        loadUserPortfolio();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Enable collateral failed:', error);
      setTransactionStatus(`Failed to enable collateral: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const formatAPY = (apy) => {
    return formatPercentage(parseFloat(apy) || 0);
  };

  const formatTVL = (tvl) => {
    const value = parseFloat(tvl) || 0;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="vault-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Euler Vaults...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-dashboard">
      <div className="vault-header">
        <h2>Euler Vault Management</h2>
        <p>Manage your positions in Euler lending vaults for optimized yield generation</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {transactionStatus && (
        <div className={`transaction-status ${transactionStatus.includes('failed') ? 'error' : 'success'}`}>
          {transactionStatus}
        </div>
      )}

      {/* User Portfolio Overview */}
      {address && userPortfolio && (
        <div className="portfolio-overview">
          <h3>Your Portfolio</h3>
          <div className="portfolio-stats">
            <div className="stat-card">
              <div className="stat-value">{formatTVL(userPortfolio.totalValue)}</div>
              <div className="stat-label">Total Value</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userPortfolio.positionCount}</div>
              <div className="stat-label">Active Positions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {userPortfolio.positions.reduce((sum, pos) => sum + parseFloat(pos.currentYield || 0), 0).toFixed(4)} ETH
              </div>
              <div className="stat-label">Total Yield</div>
            </div>
          </div>
        </div>
      )}

      {/* Vault Navigation */}
      <div className="vault-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Vault Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage Positions
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      {/* Vault Overview Tab */}
      {activeTab === 'overview' && (
        <div className="vault-overview">
          <div className="vault-grid">
            {vaults.map((vault) => (
              <div
                key={vault.address}
                className={`vault-card ${selectedVault?.address === vault.address ? 'selected' : ''}`}
                onClick={() => setSelectedVault(vault)}
              >
                <div className="vault-header-info">
                  <h4>{vault.name || `Vault ${vault.address.slice(0, 8)}...`}</h4>
                  <div className={`vault-status ${vault.isActive ? 'active' : 'inactive'}`}>
                    {vault.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
                
                <div className="vault-metrics">
                  <div className="metric">
                    <span className="metric-label">APY</span>
                    <span className="metric-value apy">{formatAPY(vault.apy)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">TVL</span>
                    <span className="metric-value">{formatTVL(vault.tvl)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Utilization</span>
                    <span className="metric-value">{formatPercentage(vault.utilization)}</span>
                  </div>
                </div>

                <div className="vault-actions">
                  <button
                    className="deposit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVault(vault);
                      setActiveTab('manage');
                    }}
                    disabled={!vault.isActive}
                  >
                    Deposit
                  </button>
                  {address && (
                    <button
                      className="collateral-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnableCollateral(vault.address);
                      }}
                    >
                      Enable Collateral
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Positions Tab */}
      {activeTab === 'manage' && selectedVault && (
        <div className="vault-management">
          <div className="selected-vault-info">
            <h3>Managing: {selectedVault.name || `Vault ${selectedVault.address.slice(0, 8)}...`}</h3>
            <div className="vault-details">
              <div className="detail-item">
                <span>Asset:</span>
                <span>{selectedVault.address}</span>
              </div>
              <div className="detail-item">
                <span>Current APY:</span>
                <span className="apy-value">{formatAPY(selectedVault.apy)}</span>
              </div>
              <div className="detail-item">
                <span>Total Deposited:</span>
                <span>{formatTVL(selectedVault.totalDeposited)}</span>
              </div>
            </div>
          </div>

          <div className="management-actions">
            <div className="action-section">
              <h4>Deposit Assets</h4>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Amount to deposit"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={!address}
                />
                <button
                  onClick={handleDeposit}
                  disabled={!address || !depositAmount || !selectedVault.isActive}
                  className="action-button deposit"
                >
                  Deposit
                </button>
              </div>
            </div>

            <div className="action-section">
              <h4>Withdraw Assets</h4>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Shares to withdraw"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  disabled={!address}
                />
                <button
                  onClick={handleWithdraw}
                  disabled={!address || !withdrawShares}
                  className="action-button withdraw"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {address && userPortfolio && (
            <div className="user-position">
              <h4>Your Position</h4>
              {userPortfolio.positions
                .filter(pos => pos.asset.toLowerCase() === selectedVault.address.toLowerCase())
                .map((position, index) => (
                  <div key={index} className="position-details">
                    <div className="position-item">
                      <span>Shares:</span>
                      <span>{formatNumber(position.shares)}</span>
                    </div>
                    <div className="position-item">
                      <span>Deposited Amount:</span>
                      <span>{formatNumber(position.depositedAmount)} ETH</span>
                    </div>
                    <div className="position-item">
                      <span>Current Yield:</span>
                      <span className="yield-value">+{formatNumber(position.currentYield)} ETH</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && selectedVault && (
        <div className="vault-analytics">
          <div className="analytics-header">
            <h3>Vault Analytics: {selectedVault.name || `Vault ${selectedVault.address.slice(0, 8)}...`}</h3>
          </div>
          
          <div className="analytics-grid">
            <div className="analytics-card">
              <h4>Performance Metrics</h4>
              <div className="metrics-list">
                <div className="metric-row">
                  <span>Current APY:</span>
                  <span className="apy-value">{formatAPY(selectedVault.apy)}</span>
                </div>
                <div className="metric-row">
                  <span>Total Value Locked:</span>
                  <span>{formatTVL(selectedVault.tvl)}</span>
                </div>
                <div className="metric-row">
                  <span>Utilization Rate:</span>
                  <span>{formatPercentage(selectedVault.utilization)}</span>
                </div>
                <div className="metric-row">
                  <span>Total Shares:</span>
                  <span>{formatNumber(selectedVault.totalShares)}</span>
                </div>
              </div>
            </div>

            <div className="analytics-card">
              <h4>Risk Assessment</h4>
              <div className="risk-indicators">
                <div className="risk-item">
                  <span>Liquidity Risk:</span>
                  <span className={`risk-badge ${getRiskColor(25)}`}>Low</span>
                </div>
                <div className="risk-item">
                  <span>Smart Contract Risk:</span>
                  <span className={`risk-badge ${getRiskColor(15)}`}>Very Low</span>
                </div>
                <div className="risk-item">
                  <span>Market Risk:</span>
                  <span className={`risk-badge ${getRiskColor(45)}`}>Medium</span>
                </div>
              </div>
            </div>
          </div>

          {selectedVault.analytics && selectedVault.analytics.historical && (
            <div className="historical-chart">
              <h4>7-Day Performance</h4>
              <div className="chart-placeholder">
                <p>Historical performance chart would be displayed here</p>
                <div className="chart-data">
                  {selectedVault.analytics.historical.slice(-7).map((point, index) => (
                    <div key={index} className="data-point">
                      <span>Day {index + 1}:</span>
                      <span>APY {formatPercentage(point.apy)}</span>
                      <span>TVL {formatTVL(point.tvl)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!address && (
        <div className="connect-wallet-prompt">
          <h3>Connect Your Wallet</h3>
          <p>Connect your wallet to view your positions and interact with Euler Vaults</p>
        </div>
      )}
    </div>
  );
};

export default VaultDashboard;