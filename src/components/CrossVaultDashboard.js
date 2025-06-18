import React, { useState, useEffect } from 'react';
import { evcService } from '../services/evcService';
import { vaultService } from '../services/vaultService';
import useWeb3 from '../hooks/useWeb3';
import { formatNumber, formatPercentage, formatCurrency } from '../utils/constants';

const CrossVaultDashboard = () => {
  const { address, provider, signer } = useWeb3();
  const [crossVaultPositions, setCrossVaultPositions] = useState([]);
  const [availableVaults, setAvailableVaults] = useState([]);
  const [liquidityBridges, setLiquidityBridges] = useState([]);
  const [enabledCollaterals, setEnabledCollaterals] = useState([]);
  const [enabledControllers, setEnabledControllers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('positions');
  const [transactionStatus, setTransactionStatus] = useState('');

  // Form states
  const [newPosition, setNewPosition] = useState({
    collateralVault: '',
    borrowVault: '',
    collateralAmount: '',
    borrowAmount: '',
    poolId: '1'
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (address) {
      loadUserSpecificData();
    }
  }, [address]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [vaults, bridges] = await Promise.all([
        vaultService.getAllSupportedAssets(),
        evcService.getLiquidityBridges()
      ]);

      setAvailableVaults(vaults);
      setLiquidityBridges(bridges);
      setError('');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserSpecificData = async () => {
    if (!address) return;

    try {
      const [positions, collaterals, controllers] = await Promise.all([
        evcService.getUserCrossVaultPositions(address),
        evcService.getEnabledCollaterals(address),
        evcService.getEnabledControllers(address)
      ]);

      setCrossVaultPositions(positions);
      setEnabledCollaterals(collaterals);
      setEnabledControllers(controllers);

      // Load health factors for all positions
      const positionsWithHealth = await Promise.all(
        positions.map(async (position) => {
          try {
            const health = await evcService.getPositionHealth(address, position.id);
            return { ...position, healthFactor: health.healthFactor };
          } catch (error) {
            console.error(`Error loading health for position ${position.id}:`, error);
            return { ...position, healthFactor: '0' };
          }
        })
      );

      setCrossVaultPositions(positionsWithHealth);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleCreatePosition = async () => {
    if (!signer || !newPosition.collateralVault || !newPosition.borrowVault) return;

    try {
      setTransactionStatus('Creating cross-vault position...');
      
      const result = await evcService.createCrossVaultPosition(
        newPosition.collateralVault,
        newPosition.borrowVault,
        newPosition.collateralAmount,
        newPosition.borrowAmount,
        newPosition.poolId,
        provider,
        signer
      );

      setTransactionStatus(`Position created successfully! TX: ${result.transactionHash}`);
      
      // Reset form
      setNewPosition({
        collateralVault: '',
        borrowVault: '',
        collateralAmount: '',
        borrowAmount: '',
        poolId: '1'
      });

      // Reload data
      setTimeout(() => {
        loadUserSpecificData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Failed to create position:', error);
      setTransactionStatus(`Failed to create position: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const handleClosePosition = async (positionId) => {
    if (!signer) return;

    try {
      setTransactionStatus('Closing position...');
      
      const result = await evcService.closeCrossVaultPosition(positionId, provider, signer);
      setTransactionStatus(`Position closed successfully! TX: ${result.transactionHash}`);
      
      setTimeout(() => {
        loadUserSpecificData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Failed to close position:', error);
      setTransactionStatus(`Failed to close position: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const handleEnableCollateral = async (vaultAddress) => {
    if (!signer) return;

    try {
      setTransactionStatus('Enabling collateral...');
      
      const result = await evcService.enableCollateral(vaultAddress, provider, signer);
      setTransactionStatus(`Collateral enabled! TX: ${result.transactionHash}`);
      
      setTimeout(() => {
        loadUserSpecificData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Failed to enable collateral:', error);
      setTransactionStatus(`Failed to enable collateral: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const handleEnableController = async (controllerAddress) => {
    if (!signer) return;

    try {
      setTransactionStatus('Enabling controller...');
      
      const result = await evcService.enableController(controllerAddress, provider, signer);
      setTransactionStatus(`Controller enabled! TX: ${result.transactionHash}`);
      
      setTimeout(() => {
        loadUserSpecificData();
        setTransactionStatus('');
      }, 2000);

    } catch (error) {
      console.error('Failed to enable controller:', error);
      setTransactionStatus(`Failed to enable controller: ${error.message}`);
      setTimeout(() => setTransactionStatus(''), 5000);
    }
  };

  const getHealthStatus = (healthFactor) => {
    const factor = parseFloat(healthFactor) / 10000;
    if (factor < 1) return { status: 'critical', color: '#ff4757' };
    if (factor < 1.2) return { status: 'warning', color: '#ffa502' };
    return { status: 'healthy', color: '#2ed573' };
  };

  const formatHealthFactor = (healthFactor) => {
    const factor = parseFloat(healthFactor) / 10000;
    if (factor === 0) return 'Liquidated';
    if (factor >= 1000) return '∞';
    return factor.toFixed(2);
  };

  if (loading) {
    return (
      <div className="cross-vault-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Cross-Vault Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cross-vault-dashboard">
      <div className="dashboard-header">
        <h2>Cross-Vault Management</h2>
        <p>Leverage positions across multiple Euler vaults using the Ethereum Vault Connector</p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {transactionStatus && (
        <div className={`transaction-status ${transactionStatus.includes('Failed') ? 'error' : 'success'}`}>
          {transactionStatus}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Cross-Vault Positions
        </button>
        <button
          className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Position
        </button>
        <button
          className={`tab-button ${activeTab === 'collaterals' ? 'active' : ''}`}
          onClick={() => setActiveTab('collaterals')}
        >
          Manage Collaterals
        </button>
        <button
          className={`tab-button ${activeTab === 'bridges' ? 'active' : ''}`}
          onClick={() => setActiveTab('bridges')}
        >
          Liquidity Bridges
        </button>
      </div>

      {/* Cross-Vault Positions Tab */}
      {activeTab === 'positions' && (
        <div className="positions-section">
          {address ? (
            <>
              <div className="section-header">
                <h3>Your Cross-Vault Positions</h3>
                <div className="positions-summary">
                  <span>Total Positions: {crossVaultPositions.length}</span>
                  <span>Active Collaterals: {enabledCollaterals.length}</span>
                  <span>Active Controllers: {enabledControllers.length}</span>
                </div>
              </div>

              {crossVaultPositions.length > 0 ? (
                <div className="positions-grid">
                  {crossVaultPositions.map((position, index) => {
                    const health = getHealthStatus(position.healthFactor || '0');
                    return (
                      <div key={index} className="position-card">
                        <div className="position-header">
                          <h4>Position #{position.id || index + 1}</h4>
                          <div className={`health-indicator ${health.status}`}>
                            Health: {formatHealthFactor(position.healthFactor || '0')}
                          </div>
                        </div>

                        <div className="position-details">
                          <div className="detail-row">
                            <span>Collateral Vault:</span>
                            <span className="address-short">
                              {position.collateralVault?.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="detail-row">
                            <span>Borrow Vault:</span>
                            <span className="address-short">
                              {position.vault?.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="detail-row">
                            <span>Collateral Amount:</span>
                            <span>{formatNumber(position.collateralAmount)} ETH</span>
                          </div>
                          <div className="detail-row">
                            <span>Borrowed Amount:</span>
                            <span>{formatNumber(position.borrowAmount)} ETH</span>
                          </div>
                          <div className="detail-row">
                            <span>Pool ID:</span>
                            <span>#{position.poolId}</span>
                          </div>
                        </div>

                        <div className="position-actions">
                          <button
                            onClick={() => handleClosePosition(position.id || index)}
                            className="close-position-btn"
                            disabled={!signer}
                          >
                            Close Position
                          </button>
                          {health.status === 'critical' && (
                            <div className="liquidation-warning">
                              Position at risk of liquidation!
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <h4>No Cross-Vault Positions</h4>
                  <p>Create your first cross-vault position to start leveraging across multiple vaults</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="create-position-cta"
                  >
                    Create Position
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="connect-wallet-prompt">
              <h3>Connect Your Wallet</h3>
              <p>Connect your wallet to view and manage your cross-vault positions</p>
            </div>
          )}
        </div>
      )}

      {/* Create Position Tab */}
      {activeTab === 'create' && (
        <div className="create-position-section">
          <div className="section-header">
            <h3>Create Cross-Vault Position</h3>
            <p>Use collateral from one vault to borrow from another and deploy into liquidity pools</p>
          </div>

          {address ? (
            <div className="create-position-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Collateral Vault</label>
                  <select
                    value={newPosition.collateralVault}
                    onChange={(e) => setNewPosition({...newPosition, collateralVault: e.target.value})}
                  >
                    <option value="">Select collateral vault</option>
                    {availableVaults.map((vault) => (
                      <option key={vault.address} value={vault.address}>
                        {vault.address.slice(0, 8)}... ({vault.isActive ? 'Active' : 'Inactive'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Borrow Vault</label>
                  <select
                    value={newPosition.borrowVault}
                    onChange={(e) => setNewPosition({...newPosition, borrowVault: e.target.value})}
                  >
                    <option value="">Select borrow vault</option>
                    {availableVaults.map((vault) => (
                      <option key={vault.address} value={vault.address}>
                        {vault.address.slice(0, 8)}... ({vault.isActive ? 'Active' : 'Inactive'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Collateral Amount (ETH)</label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={newPosition.collateralAmount}
                    onChange={(e) => setNewPosition({...newPosition, collateralAmount: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Borrow Amount (ETH)</label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={newPosition.borrowAmount}
                    onChange={(e) => setNewPosition({...newPosition, borrowAmount: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Target Pool ID</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={newPosition.poolId}
                    onChange={(e) => setNewPosition({...newPosition, poolId: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  onClick={handleCreatePosition}
                  disabled={!signer || !newPosition.collateralVault || !newPosition.borrowVault}
                  className="create-position-btn"
                >
                  Create Cross-Vault Position
                </button>
              </div>

              <div className="position-preview">
                <h4>Position Preview</h4>
                <div className="preview-details">
                  <div className="preview-item">
                    <span>Leverage Ratio:</span>
                    <span>
                      {newPosition.collateralAmount && newPosition.borrowAmount
                        ? (parseFloat(newPosition.borrowAmount) / parseFloat(newPosition.collateralAmount)).toFixed(2) + 'x'
                        : 'N/A'
                      }
                    </span>
                  </div>
                  <div className="preview-item">
                    <span>Total Exposure:</span>
                    <span>
                      {newPosition.collateralAmount && newPosition.borrowAmount
                        ? (parseFloat(newPosition.collateralAmount) + parseFloat(newPosition.borrowAmount)).toFixed(4) + ' ETH'
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="connect-wallet-prompt">
              <h3>Connect Your Wallet</h3>
              <p>Connect your wallet to create cross-vault positions</p>
            </div>
          )}
        </div>
      )}

      {/* Manage Collaterals Tab */}
      {activeTab === 'collaterals' && (
        <div className="collaterals-section">
          <div className="section-header">
            <h3>Manage Collaterals & Controllers</h3>
            <p>Enable vaults as collateral sources or borrowing controllers</p>
          </div>

          {address ? (
            <div className="management-grid">
              <div className="management-card">
                <h4>Available Vaults</h4>
                <div className="vault-list">
                  {availableVaults.map((vault) => (
                    <div key={vault.address} className="vault-item">
                      <div className="vault-info">
                        <span className="vault-address">{vault.address.slice(0, 12)}...</span>
                        <span className={`vault-status ${vault.isActive ? 'active' : 'inactive'}`}>
                          {vault.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="vault-actions">
                        <button
                          onClick={() => handleEnableCollateral(vault.address)}
                          disabled={!signer || enabledCollaterals.includes(vault.address)}
                          className="enable-collateral-btn"
                        >
                          {enabledCollaterals.includes(vault.address) ? 'Collateral Enabled' : 'Enable Collateral'}
                        </button>
                        <button
                          onClick={() => handleEnableController(vault.address)}
                          disabled={!signer || enabledControllers.includes(vault.address)}
                          className="enable-controller-btn"
                        >
                          {enabledControllers.includes(vault.address) ? 'Controller Enabled' : 'Enable Controller'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="management-card">
                <h4>Enabled Collaterals ({enabledCollaterals.length})</h4>
                <div className="enabled-list">
                  {enabledCollaterals.length > 0 ? (
                    enabledCollaterals.map((collateral, index) => (
                      <div key={index} className="enabled-item">
                        <span>{collateral.slice(0, 12)}...</span>
                        <span className="enabled-badge">Collateral</span>
                      </div>
                    ))
                  ) : (
                    <p className="empty-text">No collaterals enabled</p>
                  )}
                </div>
              </div>

              <div className="management-card">
                <h4>Enabled Controllers ({enabledControllers.length})</h4>
                <div className="enabled-list">
                  {enabledControllers.length > 0 ? (
                    enabledControllers.map((controller, index) => (
                      <div key={index} className="enabled-item">
                        <span>{controller.slice(0, 12)}...</span>
                        <span className="enabled-badge controller">Controller</span>
                      </div>
                    ))
                  ) : (
                    <p className="empty-text">No controllers enabled</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="connect-wallet-prompt">
              <h3>Connect Your Wallet</h3>
              <p>Connect your wallet to manage collaterals and controllers</p>
            </div>
          )}
        </div>
      )}

      {/* Liquidity Bridges Tab */}
      {activeTab === 'bridges' && (
        <div className="bridges-section">
          <div className="section-header">
            <h3>Liquidity Bridges</h3>
            <p>View active bridges between Euler vaults and Wedged liquidity pools</p>
          </div>

          <div className="bridges-grid">
            {liquidityBridges.length > 0 ? (
              liquidityBridges.map((bridge, index) => (
                <div key={index} className="bridge-card">
                  <div className="bridge-header">
                    <h4>Bridge #{index + 1}</h4>
                    <div className={`bridge-status ${bridge.isActive ? 'active' : 'inactive'}`}>
                      {bridge.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="bridge-details">
                    <div className="bridge-flow">
                      <div className="bridge-source">
                        <span className="bridge-label">Source Vault</span>
                        <span className="bridge-address">{bridge.sourceVault?.slice(0, 12)}...</span>
                      </div>
                      <div className="bridge-arrow">→</div>
                      <div className="bridge-target">
                        <span className="bridge-label">Target Pool</span>
                        <span className="bridge-address">{bridge.targetPool?.slice(0, 12)}...</span>
                      </div>
                    </div>
                    <div className="bridge-metrics">
                      <div className="bridge-metric">
                        <span>Bridged Amount:</span>
                        <span>{formatNumber(bridge.bridgedAmount)} ETH</span>
                      </div>
                      <div className="bridge-metric">
                        <span>Bridge Shares:</span>
                        <span>{formatNumber(bridge.shares)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h4>No Liquidity Bridges</h4>
                <p>No active bridges between vaults and pools are currently configured</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossVaultDashboard;