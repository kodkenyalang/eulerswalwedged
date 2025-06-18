import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../services/contractService';

const PoolList = ({ pools, userPools, onPoolSelect, loading }) => {
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterActive, setFilterActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPools, setFilteredPools] = useState([]);

  useEffect(() => {
    filterAndSortPools();
  }, [pools, sortBy, sortOrder, filterActive, searchTerm]);

  const filterAndSortPools = () => {
    let filtered = [...pools];

    // Filter by active status
    if (filterActive) {
      filtered = filtered.filter(pool => pool.active);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(pool => 
        pool.id.toString().includes(searchTerm) ||
        pool.token0.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pool.token1.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort pools
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'id':
          aValue = parseInt(a.id);
          bValue = parseInt(b.id);
          break;
        case 'deposits':
          aValue = parseFloat(ethers.formatEther(a.totalDeposits || 0));
          bValue = parseFloat(ethers.formatEther(b.totalDeposits || 0));
          break;
        case 'liquidity':
          aValue = parseFloat(ethers.formatEther(a.availableLiquidity || 0));
          bValue = parseFloat(ethers.formatEther(b.availableLiquidity || 0));
          break;
        case 'risk':
          aValue = a.riskScore || 0;
          bValue = b.riskScore || 0;
          break;
        case 'hedged':
          aValue = parseFloat(ethers.formatEther(a.hedgedAmount || 0));
          bValue = parseFloat(ethers.formatEther(b.hedgedAmount || 0));
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPools(filtered);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRiskColor = (riskScore) => {
    if (riskScore > 5000) return '#ff4757';
    if (riskScore > 3000) return '#ffa502';
    return '#2ed573';
  };

  const getRiskLevel = (riskScore) => {
    if (riskScore > 5000) return 'High';
    if (riskScore > 3000) return 'Medium';
    return 'Low';
  };

  const isUserParticipating = (poolId) => {
    return userPools.some(userPool => userPool.id === poolId);
  };

  const getUserDeposit = (poolId) => {
    const userPool = userPools.find(p => p.id === poolId);
    return userPool ? parseFloat(userPool.userDeposit || 0) : 0;
  };

  const calculateUtilization = (pool) => {
    const total = parseFloat(ethers.formatEther(pool.totalDeposits || 0));
    const available = parseFloat(ethers.formatEther(pool.availableLiquidity || 0));
    if (total === 0) return 0;
    return ((total - available) / total) * 100;
  };

  if (loading) {
    return (
      <div className="pools-container">
        <div className="pools-header">
          <h2>Available Pools</h2>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading pools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pools-container">
      <div className="pools-header">
        <h2>Available Hedging Pools</h2>
        <p>Browse and analyze risk-managed liquidity pools</p>
      </div>

      {/* Controls */}
      <div className="pools-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search pools by ID or token address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filterActive}
              onChange={(e) => setFilterActive(e.target.checked)}
            />
            <span>Show only active pools</span>
          </label>
        </div>

        <div className="sort-section">
          <span>Sort by:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(order);
            }}
            className="sort-select"
          >
            <option value="id-asc">Pool ID (Low to High)</option>
            <option value="id-desc">Pool ID (High to Low)</option>
            <option value="deposits-desc">Total Deposits (High to Low)</option>
            <option value="deposits-asc">Total Deposits (Low to High)</option>
            <option value="liquidity-desc">Available Liquidity (High to Low)</option>
            <option value="liquidity-asc">Available Liquidity (Low to High)</option>
            <option value="risk-asc">Risk Score (Low to High)</option>
            <option value="risk-desc">Risk Score (High to Low)</option>
            <option value="hedged-desc">Hedged Amount (High to Low)</option>
            <option value="hedged-asc">Hedged Amount (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="pool-stats">
        <div className="stat-item">
          <span className="stat-label">Total Pools:</span>
          <span className="stat-value">{pools.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Active Pools:</span>
          <span className="stat-value">{pools.filter(p => p.active).length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Your Positions:</span>
          <span className="stat-value">{userPools.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Filtered Results:</span>
          <span className="stat-value">{filteredPools.length}</span>
        </div>
      </div>

      {filteredPools.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h4>No pools found</h4>
          <p>
            {searchTerm 
              ? 'Try adjusting your search criteria or clearing the search term.'
              : 'No pools match the current filters. Try adjusting your filter settings.'
            }
          </p>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="clear-search-btn">
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="pools-grid">
          {filteredPools.map((pool) => {
            const isParticipating = isUserParticipating(pool.id);
            const userDeposit = getUserDeposit(pool.id);
            const utilization = calculateUtilization(pool);

            return (
              <div 
                key={pool.id} 
                className={`pool-card ${!pool.active ? 'inactive' : ''} ${isParticipating ? 'participating' : ''}`}
              >
                <div className="pool-card-header">
                  <div className="pool-id">
                    <h3>Pool #{pool.id}</h3>
                    {isParticipating && (
                      <span className="participation-badge">Your Position</span>
                    )}
                  </div>
                  <div className="pool-status">
                    <span className={`status-badge ${pool.active ? 'active' : 'inactive'}`}>
                      {pool.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="token-pair-section">
                  <h4>Token Pair</h4>
                  <div className="token-pair">
                    <div className="token">
                      <span className="token-label">Token 0:</span>
                      <span className="token-address">{formatAddress(pool.token0)}</span>
                    </div>
                    <div className="pair-divider">⟷</div>
                    <div className="token">
                      <span className="token-label">Token 1:</span>
                      <span className="token-address">{formatAddress(pool.token1)}</span>
                    </div>
                  </div>
                </div>

                <div className="pool-metrics">
                  <div className="metric-row">
                    <div className="metric">
                      <label>Total Deposits</label>
                      <span className="value">
                        {parseFloat(ethers.formatEther(pool.totalDeposits || 0)).toFixed(4)} ETH
                      </span>
                    </div>
                    <div className="metric">
                      <label>Available Liquidity</label>
                      <span className="value">
                        {parseFloat(ethers.formatEther(pool.availableLiquidity || 0)).toFixed(4)} ETH
                      </span>
                    </div>
                  </div>

                  <div className="metric-row">
                    <div className="metric">
                      <label>Hedged Amount</label>
                      <span className="value">
                        {parseFloat(ethers.formatEther(pool.hedgedAmount || 0)).toFixed(4)} ETH
                      </span>
                    </div>
                    <div className="metric">
                      <label>Utilization</label>
                      <span className="value">{utilization.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="risk-section">
                    <div className="risk-header">
                      <label>Risk Score</label>
                      <span 
                        className="risk-value"
                        style={{ color: getRiskColor(pool.riskScore || 0) }}
                      >
                        {getRiskLevel(pool.riskScore || 0)} ({((pool.riskScore || 0) / 100).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="risk-bar">
                      <div 
                        className="risk-fill"
                        style={{ 
                          width: `${Math.min((pool.riskScore || 0) / 100, 100)}%`,
                          backgroundColor: getRiskColor(pool.riskScore || 0)
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="utilization-section">
                    <div className="utilization-header">
                      <label>Pool Utilization</label>
                      <span className="utilization-value">{utilization.toFixed(1)}%</span>
                    </div>
                    <div className="utilization-bar">
                      <div 
                        className="utilization-fill"
                        style={{ 
                          width: `${Math.min(utilization, 100)}%`,
                          backgroundColor: utilization > 80 ? '#ff4757' : utilization > 60 ? '#ffa502' : '#2ed573'
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {isParticipating && (
                  <div className="user-position">
                    <h5>Your Position</h5>
                    <div className="position-details">
                      <span>Deposited: {userDeposit.toFixed(4)} ETH</span>
                      <span>Share: {pool.totalDeposits && parseFloat(ethers.formatEther(pool.totalDeposits)) > 0 
                        ? ((userDeposit / parseFloat(ethers.formatEther(pool.totalDeposits))) * 100).toFixed(2)
                        : 0}%</span>
                    </div>
                  </div>
                )}

                <div className="pool-actions">
                  <button
                    onClick={() => onPoolSelect(pool)}
                    className="view-details-btn"
                  >
                    View Details
                  </button>
                  
                  {pool.active && (
                    <button
                      onClick={() => {
                        // Navigate to deposit form with this pool pre-selected
                        window.location.hash = '#deposit';
                        // You could also use a callback to pre-select this pool
                      }}
                      className="deposit-btn"
                    >
                      {isParticipating ? 'Add More' : 'Deposit'}
                    </button>
                  )}
                </div>

                {/* Pool Insights */}
                <div className="pool-insights">
                  {utilization > 90 && (
                    <div className="insight warning">
                      ⚠️ High utilization - limited liquidity available
                    </div>
                  )}
                  {pool.riskScore > 7000 && (
                    <div className="insight danger">
                      🔴 High risk pool - proceed with caution
                    </div>
                  )}
                  {pool.riskScore < 2000 && (
                    <div className="insight success">
                      🟢 Low risk environment - good for larger positions
                    </div>
                  )}
                  {parseFloat(ethers.formatEther(pool.hedgedAmount || 0)) > 
                   parseFloat(ethers.formatEther(pool.totalDeposits || 0)) * 0.8 && (
                    <div className="insight info">
                      🛡️ Well hedged - high protection ratio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination could be added here for large numbers of pools */}
      {filteredPools.length > 20 && (
        <div className="pagination-info">
          <p>Showing {filteredPools.length} pools. Consider using search or filters to narrow results.</p>
        </div>
      )}
    </div>
  );
};

export default PoolList;
