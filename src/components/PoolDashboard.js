import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { riskService } from '../services/riskService';

const PoolDashboard = ({ userPools, totalPools, onPoolSelect, onWithdraw, loading }) => {
  const [dashboardStats, setDashboardStats] = useState({
    totalDeposited: '0',
    totalRewards: '0',
    totalHedged: '0',
    averageRisk: 0
  });

  useEffect(() => {
    calculateDashboardStats();
  }, [userPools]);

  const calculateDashboardStats = () => {
    if (!userPools || userPools.length === 0) {
      setDashboardStats({
        totalDeposited: '0',
        totalRewards: '0',
        totalHedged: '0',
        averageRisk: 0
      });
      return;
    }

    let totalDeposited = 0n;
    let totalRewards = 0n;
    let totalHedged = 0n;
    let totalRisk = 0;

    userPools.forEach(pool => {
      if (pool.userDeposit) {
        totalDeposited = totalDeposited + ethers.parseEther(pool.userDeposit.toString());
      }
      if (pool.userRewards) {
        totalRewards = totalRewards + ethers.parseEther(pool.userRewards.toString());
      }
      if (pool.hedgedAmount) {
        totalHedged = totalHedged + BigInt(pool.hedgedAmount);
      }
      totalRisk += pool.riskScore || 0;
    });

    const averageRisk = userPools.length > 0 ? totalRisk / userPools.length : 0;

    setDashboardStats({
      totalDeposited: ethers.formatEther(totalDeposited),
      totalRewards: ethers.formatEther(totalRewards),
      totalHedged: ethers.formatEther(totalHedged),
      averageRisk
    });
  };

  const getRiskColor = (riskScore) => {
    if (riskScore > 5000) return '#ff4757'; // High risk - red
    if (riskScore > 3000) return '#ffa502'; // Medium risk - orange
    return '#2ed573'; // Low risk - green
  };

  const getHealthLevel = (riskScore) => {
    if (riskScore > 5000) return 'high';
    if (riskScore > 3000) return 'medium';
    return 'low';
  };

  const formatNumber = (value, decimals = 4) => {
    const num = parseFloat(value);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(decimals);
  };

  const formatCurrency = (ethValue) => {
    const usdValue = parseFloat(ethValue) * 2450; // ETH price approximation
    return usdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h2>Dashboard</h2>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Portfolio Dashboard</h2>
        <p>Monitor your risk-managed liquidity positions and hedging performance</p>
        <div className="dashboard-metrics">
          <div className="metric-badge">
            <span className="metric-label">Active Positions</span>
            <span className="metric-value">{userPools.length}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Total Pools</span>
            <span className="metric-value">{totalPools}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Portfolio Health</span>
            <span className={`metric-value health-${getHealthLevel(dashboardStats.averageRisk)}`}>
              {getHealthLevel(dashboardStats.averageRisk).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Deposited</h3>
            <p className="stat-value">{formatNumber(dashboardStats.totalDeposited)} ETH</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎁</div>
          <div className="stat-content">
            <h3>Total Rewards</h3>
            <p className="stat-value">{formatNumber(dashboardStats.totalRewards)} ETH</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🛡️</div>
          <div className="stat-content">
            <h3>Total Hedged</h3>
            <p className="stat-value">{formatNumber(dashboardStats.totalHedged)} ETH</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Average Risk</h3>
            <p 
              className="stat-value"
              style={{ color: getRiskColor(dashboardStats.averageRisk) }}
            >
              {(dashboardStats.averageRisk / 100).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="portfolio-section">
        <div className="section-header">
          <h3>Your Positions ({userPools.length})</h3>
          <div className="portfolio-stats">
            <span>Total Pools Available: {totalPools}</span>
          </div>
        </div>

        {userPools.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h4>No positions yet</h4>
            <p>Start by depositing into a hedging pool to protect your liquidity from impermanent loss.</p>
            <button 
              onClick={() => window.location.hash = '#deposit'} 
              className="cta-button"
            >
              Make Your First Deposit
            </button>
          </div>
        ) : (
          <div className="positions-grid">
            {userPools.map((pool, index) => (
              <div key={pool.id || index} className="position-card">
                <div className="position-header">
                  <div className="pool-info">
                    <h4>Pool #{pool.id}</h4>
                    <div className="token-pair">
                      <span className="token">
                        {pool.token0 ? `${pool.token0.slice(0, 6)}...${pool.token0.slice(-4)}` : 'N/A'}
                      </span>
                      <span className="separator">/</span>
                      <span className="token">
                        {pool.token1 ? `${pool.token1.slice(0, 6)}...${pool.token1.slice(-4)}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div 
                    className="risk-indicator"
                    style={{ backgroundColor: getRiskColor(pool.riskScore || 0) }}
                  >
                    {((pool.riskScore || 0) / 100).toFixed(1)}%
                  </div>
                </div>

                <div className="position-metrics">
                  <div className="metric">
                    <label>Your Deposit</label>
                    <span>{formatNumber(pool.userDeposit || 0)} ETH</span>
                  </div>
                  <div className="metric">
                    <label>Pending Rewards</label>
                    <span className="rewards">{formatNumber(pool.userRewards || 0)} ETH</span>
                  </div>
                  <div className="metric">
                    <label>Pool Liquidity</label>
                    <span>{formatNumber(ethers.formatEther(pool.availableLiquidity || 0))} ETH</span>
                  </div>
                  <div className="metric">
                    <label>Hedged Amount</label>
                    <span>{formatNumber(ethers.formatEther(pool.hedgedAmount || 0))} ETH</span>
                  </div>
                </div>

                <div className="position-actions">
                  <button
                    onClick={() => onPoolSelect(pool)}
                    className="view-btn"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      const amount = prompt('Enter withdrawal amount (ETH):');
                      if (amount && parseFloat(amount) > 0) {
                        onWithdraw(pool.id, ethers.parseEther(amount));
                      }
                    }}
                    className="withdraw-btn"
                    disabled={!pool.userDeposit || parseFloat(pool.userDeposit) === 0}
                  >
                    Withdraw
                  </button>
                </div>

                {pool.active === false && (
                  <div className="inactive-badge">
                    ⚠️ Pool Inactive
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <div className="action-card">
            <div className="action-icon">➕</div>
            <h4>Deposit Funds</h4>
            <p>Add funds to existing pools or create new positions</p>
            <button onClick={() => window.location.hash = '#deposit'}>
              Deposit Now
            </button>
          </div>
          
          <div className="action-card">
            <div className="action-icon">🔍</div>
            <h4>Explore Pools</h4>
            <p>Browse available hedging pools and their strategies</p>
            <button onClick={() => window.location.hash = '#pools'}>
              View Pools
            </button>
          </div>
          
          <div className="action-card">
            <div className="action-icon">📈</div>
            <h4>Risk Analysis</h4>
            <p>Analyze portfolio risk and hedging effectiveness</p>
            <button 
              onClick={() => {
                if (userPools.length > 0) {
                  onPoolSelect(userPools[0]);
                } else {
                  alert('No positions available for analysis');
                }
              }}
            >
              Analyze Risk
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Health */}
      {userPools.length > 0 && (
        <div className="portfolio-health-section">
          <h3>Portfolio Health</h3>
          <div className="health-metrics">
            <div className="health-metric">
              <label>Diversification</label>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${Math.min(userPools.length * 20, 100)}%`,
                    backgroundColor: userPools.length >= 3 ? '#2ed573' : '#ffa502'
                  }}
                ></div>
              </div>
              <span>{userPools.length} pools</span>
            </div>
            
            <div className="health-metric">
              <label>Risk Level</label>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${dashboardStats.averageRisk / 100}%`,
                    backgroundColor: getRiskColor(dashboardStats.averageRisk)
                  }}
                ></div>
              </div>
              <span>{(dashboardStats.averageRisk / 100).toFixed(2)}%</span>
            </div>
            
            <div className="health-metric">
              <label>Hedge Coverage</label>
              <div className="metric-bar">
                <div 
                  className="metric-fill"
                  style={{ 
                    width: `${Math.min((parseFloat(dashboardStats.totalHedged) / parseFloat(dashboardStats.totalDeposited)) * 100, 100)}%`,
                    backgroundColor: '#5352ed'
                  }}
                ></div>
              </div>
              <span>
                {parseFloat(dashboardStats.totalDeposited) > 0 
                  ? ((parseFloat(dashboardStats.totalHedged) / parseFloat(dashboardStats.totalDeposited)) * 100).toFixed(1)
                  : 0
                }%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolDashboard;
