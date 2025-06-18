import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { contractService } from '../services/contractService';

const DepositForm = ({ pools, onDeposit, loading }) => {
  const [formData, setFormData] = useState({
    poolId: '',
    amount: '',
    tokenAddress: ''
  });
  const [selectedPool, setSelectedPool] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [estimatedGas, setEstimatedGas] = useState('0');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Common token addresses (these would typically come from a config)
  const commonTokens = [
    { symbol: 'WETH', address: '0xC02aaA39b223FE8dCcE9d7b542fFC25BeF35a6f8', decimals: 18 },
    { symbol: 'USDC', address: '0xA0b86a33E6417C8a7B2E7c5A0d4c45f2a0C0c0C0', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 }
  ];

  useEffect(() => {
    if (formData.poolId) {
      const pool = pools.find(p => p.id.toString() === formData.poolId);
      setSelectedPool(pool);
      if (pool && !formData.tokenAddress) {
        setFormData(prev => ({
          ...prev,
          tokenAddress: pool.token0
        }));
      }
    }
  }, [formData.poolId, pools]);

  useEffect(() => {
    if (formData.tokenAddress) {
      checkTokenBalance();
      checkApprovalNeeded();
    }
  }, [formData.tokenAddress, formData.amount]);

  const checkTokenBalance = async () => {
    if (!formData.tokenAddress || !contractService.signer) return;
    
    try {
      const balance = await contractService.getTokenBalance(
        formData.tokenAddress,
        contractService.signer.getAddress()
      );
      setTokenBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error checking token balance:', error);
      setTokenBalance('0');
    }
  };

  const checkApprovalNeeded = async () => {
    if (!formData.tokenAddress || !formData.amount || !contractService.signer) {
      setNeedsApproval(false);
      return;
    }

    try {
      const amount = ethers.parseEther(formData.amount);
      const allowance = await contractService.getTokenAllowance(
        formData.tokenAddress,
        await contractService.signer.getAddress(),
        contractService.getWedgedPoolAddress()
      );
      
      setNeedsApproval(allowance < amount);
    } catch (error) {
      console.error('Error checking approval:', error);
      setNeedsApproval(true);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.poolId) {
      errors.poolId = 'Please select a pool';
    }

    if (!formData.amount) {
      errors.amount = 'Please enter an amount';
    } else {
      const amount = parseFloat(formData.amount);
      if (amount <= 0) {
        errors.amount = 'Amount must be greater than 0';
      } else if (amount > parseFloat(tokenBalance)) {
        errors.amount = 'Insufficient balance';
      }
    }

    if (!formData.tokenAddress) {
      errors.tokenAddress = 'Please select a token';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleApprove = async () => {
    if (!formData.tokenAddress || !formData.amount) return;

    try {
      setApproving(true);
      const amount = ethers.parseEther(formData.amount);
      const tx = await contractService.approveToken(
        formData.tokenAddress,
        contractService.getWedgedPoolAddress(),
        amount
      );
      await tx.wait();
      setNeedsApproval(false);
    } catch (error) {
      console.error('Approval error:', error);
      alert('Approval failed: ' + error.message);
    } finally {
      setApproving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (needsApproval) {
      alert('Please approve token spending first');
      return;
    }

    try {
      const amount = ethers.parseEther(formData.amount);
      await onDeposit(formData.poolId, amount, formData.tokenAddress);
      
      // Reset form on success
      setFormData({
        poolId: '',
        amount: '',
        tokenAddress: ''
      });
      setSelectedPool(null);
    } catch (error) {
      console.error('Deposit error:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear specific error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const setMaxAmount = () => {
    handleInputChange('amount', tokenBalance);
  };

  const getTokenSymbol = (address) => {
    const token = commonTokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    return token ? token.symbol : `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRiskColor = (riskScore) => {
    if (riskScore > 5000) return '#ff4757';
    if (riskScore > 3000) return '#ffa502';
    return '#2ed573';
  };

  return (
    <div className="deposit-form-container">
      <div className="form-header">
        <h2>Deposit Funds</h2>
        <p>Deposit funds into hedging pools to protect against impermanent loss</p>
      </div>

      <div className="deposit-form-content">
        <form onSubmit={handleSubmit} className="deposit-form">
          {/* Pool Selection */}
          <div className="form-group">
            <label htmlFor="poolId">Select Pool</label>
            <select
              id="poolId"
              value={formData.poolId}
              onChange={(e) => handleInputChange('poolId', e.target.value)}
              className={`form-control ${formErrors.poolId ? 'error' : ''}`}
            >
              <option value="">Choose a hedging pool...</option>
              {pools.filter(pool => pool.active).map(pool => (
                <option key={pool.id} value={pool.id}>
                  Pool #{pool.id} - {getTokenSymbol(pool.token0)}/{getTokenSymbol(pool.token1)} 
                  (Risk: {((pool.riskScore || 0) / 100).toFixed(1)}%)
                </option>
              ))}
            </select>
            {formErrors.poolId && <span className="error-text">{formErrors.poolId}</span>}
          </div>

          {/* Token Selection */}
          <div className="form-group">
            <label htmlFor="tokenAddress">Deposit Token</label>
            <select
              id="tokenAddress"
              value={formData.tokenAddress}
              onChange={(e) => handleInputChange('tokenAddress', e.target.value)}
              className={`form-control ${formErrors.tokenAddress ? 'error' : ''}`}
              disabled={!selectedPool}
            >
              <option value="">Select token...</option>
              {selectedPool && (
                <>
                  <option value={selectedPool.token0}>
                    {getTokenSymbol(selectedPool.token0)} (Token 0)
                  </option>
                  <option value={selectedPool.token1}>
                    {getTokenSymbol(selectedPool.token1)} (Token 1)
                  </option>
                </>
              )}
              {commonTokens.map(token => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
            {formErrors.tokenAddress && <span className="error-text">{formErrors.tokenAddress}</span>}
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label htmlFor="amount">Deposit Amount</label>
            <div className="amount-input-group">
              <input
                type="number"
                id="amount"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.0"
                step="0.000001"
                min="0"
                className={`form-control ${formErrors.amount ? 'error' : ''}`}
              />
              <button
                type="button"
                onClick={setMaxAmount}
                className="max-btn"
                disabled={!tokenBalance || parseFloat(tokenBalance) === 0}
              >
                MAX
              </button>
            </div>
            {formData.tokenAddress && (
              <div className="balance-info">
                Balance: {parseFloat(tokenBalance).toFixed(6)} {getTokenSymbol(formData.tokenAddress)}
              </div>
            )}
            {formErrors.amount && <span className="error-text">{formErrors.amount}</span>}
          </div>

          {/* Pool Information */}
          {selectedPool && (
            <div className="pool-info-card">
              <h4>Pool Information</h4>
              <div className="pool-details">
                <div className="detail-row">
                  <span>Pool ID:</span>
                  <span>#{selectedPool.id}</span>
                </div>
                <div className="detail-row">
                  <span>Token Pair:</span>
                  <span>
                    {getTokenSymbol(selectedPool.token0)} / {getTokenSymbol(selectedPool.token1)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Total Deposits:</span>
                  <span>{ethers.formatEther(selectedPool.totalDeposits || 0)} ETH</span>
                </div>
                <div className="detail-row">
                  <span>Available Liquidity:</span>
                  <span>{ethers.formatEther(selectedPool.availableLiquidity || 0)} ETH</span>
                </div>
                <div className="detail-row">
                  <span>Risk Score:</span>
                  <span 
                    style={{ color: getRiskColor(selectedPool.riskScore || 0) }}
                    className="risk-score"
                  >
                    {((selectedPool.riskScore || 0) / 100).toFixed(2)}%
                  </span>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className={`status ${selectedPool.active ? 'active' : 'inactive'}`}>
                    {selectedPool.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Summary */}
          {formData.amount && formData.tokenAddress && selectedPool && (
            <div className="transaction-summary">
              <h4>Transaction Summary</h4>
              <div className="summary-details">
                <div className="summary-row">
                  <span>Deposit Amount:</span>
                  <span>{formData.amount} {getTokenSymbol(formData.tokenAddress)}</span>
                </div>
                <div className="summary-row">
                  <span>Estimated Gas:</span>
                  <span>{estimatedGas} ETH</span>
                </div>
                {needsApproval && (
                  <div className="summary-row warning">
                    <span>⚠️ Token Approval Required</span>
                    <span>Additional transaction needed</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-actions">
            {needsApproval ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !formData.amount || !formData.tokenAddress}
                className="approve-btn"
              >
                {approving ? 'Approving...' : `Approve ${getTokenSymbol(formData.tokenAddress)}`}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !validateForm()}
                className="deposit-btn"
              >
                {loading ? 'Depositing...' : 'Deposit Funds'}
              </button>
            )}
          </div>
        </form>

        {/* Help Section */}
        <div className="help-section">
          <h4>💡 How it works</h4>
          <ul>
            <li>Select a hedging pool that matches your risk tolerance</li>
            <li>Choose which token from the pair you want to deposit</li>
            <li>Your funds will be used to hedge against impermanent loss</li>
            <li>Earn rewards from successful hedging strategies</li>
            <li>Withdraw your funds anytime (subject to pool liquidity)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DepositForm;
