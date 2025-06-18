import { ethers } from 'ethers';

// Contract addresses - these should be updated after deployment
export const CONTRACT_ADDRESSES = {
  WEDGED_POOL: process.env.REACT_APP_WEDGED_POOL_ADDRESS || '0x0000000000000000000000000000000000000000',
  HEDGING_MANAGER: process.env.REACT_APP_HEDGING_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000',
  RISK_CALCULATOR: process.env.REACT_APP_RISK_CALCULATOR_ADDRESS || '0x0000000000000000000000000000000000000000',
  EULER_SWAP_INTEGRATION: process.env.REACT_APP_EULER_SWAP_INTEGRATION_ADDRESS || '0x0000000000000000000000000000000000000000',
  EULER_VAULT_MANAGER: process.env.REACT_APP_VAULT_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000',
  EULER_VAULT_FACTORY: process.env.REACT_APP_VAULT_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000'
};

// Network configurations
export const NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  5: {
    name: 'Goerli Testnet',
    chainId: 5,
    rpcUrl: 'https://goerli.infura.io/v3/',
    blockExplorer: 'https://goerli.etherscan.io',
    currency: { name: 'Goerli Ether', symbol: 'GoerliETH', decimals: 18 }
  },
  11155111: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    currency: { name: 'Sepolia Ether', symbol: 'SepoliaETH', decimals: 18 }
  },
  31337: {
    name: 'Hardhat Local',
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: '',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  137: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    currency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  42161: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  10: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  }
};

// Common token addresses (update for each network)
export const TOKEN_ADDRESSES = {
  WETH: '0xC02aaA39b223FE8dCcE9d7b542fFC25BeF35a6f8',
  USDC: '0xA0b86a33E6417C8a7B2E7c5A0d4c45f2a0C0c0C0',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
};

// Contract ABIs - Simplified for essential functions
export const ABIS = {
  WEDGED_POOL: [
    'function createPool(address token0, address token1) external returns (uint256)',
    'function deposit(uint256 poolId, uint256 amount) external',
    'function withdraw(uint256 poolId, uint256 amount) external',
    'function emergencyWithdraw(uint256 poolId) external',
    'function getPoolInfo(uint256 poolId) external view returns (tuple(uint256 id, address token0, address token1, uint256 totalDeposits, uint256 availableLiquidity, uint256 hedgedAmount, uint256 riskScore, bool active))',
    'function getUserDeposit(uint256 poolId, address user) external view returns (uint256)',
    'function getUserRewards(uint256 poolId, address user) external view returns (uint256)',
    'function getUserPools(address user) external view returns (uint256[])',
    'function totalPools() external view returns (uint256)',
    'function setProtocolFee(uint256 fee) external',
    'function distributeRewards(uint256 poolId, uint256 totalRewards) external',
    'function deactivatePool(uint256 poolId) external',
    'event PoolCreated(uint256 indexed poolId, address token0, address token1)',
    'event Deposit(uint256 indexed poolId, address indexed user, uint256 amount)',
    'event Withdrawal(uint256 indexed poolId, address indexed user, uint256 amount)',
    'event HedgingExecuted(uint256 indexed poolId, uint256 amount, uint256 cost)',
    'event RewardsDistributed(uint256 indexed poolId, uint256 totalRewards)'
  ],

  HEDGING_MANAGER: [
    'function executeHedging(uint256 poolId, uint256 amount) external returns (bool)',
    'function calculateHedgingCost(uint256 poolId, uint256 amount) external view returns (uint256)',
    'function createStrategy(string memory name, uint256 riskThreshold, uint256 hedgeRatio) external returns (uint256)',
    'function updateStrategy(uint256 strategyId, uint256 riskThreshold, uint256 hedgeRatio) external',
    'function assignStrategyToPool(uint256 poolId, uint256 strategyId) external',
    'function getStrategy(uint256 strategyId) external view returns (tuple(uint256 id, string name, uint256 riskThreshold, uint256 hedgeRatio, bool active))',
    'function getHedgePosition(uint256 positionId) external view returns (tuple(uint256 poolId, address token0, address token1, uint256 originalAmount, uint256 hedgedAmount, uint256 timestamp, bool active))',
    'function closeHedgePosition(uint256 positionId) external',
    'function setOperator(address operator) external',
    'function setHedgingFee(uint256 fee) external',
    'event HedgePositionCreated(uint256 indexed positionId, uint256 indexed poolId, uint256 amount)',
    'event HedgeExecuted(uint256 indexed positionId, uint256 hedgedAmount, uint256 cost)',
    'event StrategyCreated(uint256 indexed strategyId, string name, uint256 riskThreshold)'
  ],

  RISK_CALCULATOR: [
    'function calculatePoolRisk(uint256 poolId) external returns (uint256)',
    'function calculateImpermanentLoss(address token0, address token1, uint256 amount) external view returns (uint256)',
    'function calculateVolatility(address token) external returns (uint256)',
    'function calculateCorrelation(address token0, address token1) external view returns (uint256)',
    'function getPoolRiskMetrics(uint256 poolId) external view returns (tuple(uint256 volatility, uint256 impermanentLoss, uint256 correlationRisk, uint256 liquidityRisk, uint256 compositeRisk))',
    'function updateRiskWeights(uint256 volatilityWeight, uint256 impermanentLossWeight, uint256 correlationWeight, uint256 liquidityWeight) external',
    'function setPriceOracle(address priceOracle) external',
    'function setPoolRisk(uint256 poolId, uint256 riskScore) external',
    'event RiskScoreUpdated(uint256 indexed poolId, uint256 riskScore)',
    'event VolatilityCalculated(address indexed token, uint256 volatility)'
  ],

  EULER_SWAP_INTEGRATION: [
    'function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut)',
    'function addLiquidity(address token0, address token1, uint256 amount0, uint256 amount1) external returns (uint256 liquidity)',
    'function removeLiquidity(address token0, address token1, uint256 liquidity) external returns (uint256 amount0, uint256 amount1)',
    'function getPrice(address token0, address token1) external view returns (uint256)',
    'function getSwapQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
    'function getPoolInfo(address token0, address token1) external view returns (tuple(address pool, address token0, address token1, uint24 fee, uint256 reserve0, uint256 reserve1, uint256 totalSupply))',
    'function createPool(address token0, address token1) external returns (address pool)',
    'function setAuthorizedCaller(address caller, bool authorized) external',
    'function setDefaultSlippage(uint256 slippage) external',
    'event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address recipient)',
    'event LiquidityAdded(address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity)',
    'event PoolRegistered(address indexed token0, address indexed token1, address pool)'
  ],

  ERC20: [
    'function name() external view returns (string)',
    'function symbol() external view returns (string)',
    'function decimals() external view returns (uint8)',
    'function totalSupply() external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
  ]
};

// Application constants
export const APP_CONFIG = {
  // Pagination
  POOLS_PER_PAGE: 20,
  TRANSACTIONS_PER_PAGE: 10,
  
  // Refresh intervals (milliseconds)
  POOL_DATA_REFRESH: 30000, // 30 seconds
  BALANCE_REFRESH: 10000,   // 10 seconds
  PRICE_REFRESH: 15000,     // 15 seconds
  
  // Risk thresholds
  RISK_THRESHOLDS: {
    LOW: 3000,    // 30%
    MEDIUM: 5000, // 50%
    HIGH: 7000    // 70%
  },
  
  // Default values
  DEFAULT_SLIPPAGE: 500,     // 5%
  DEFAULT_GAS_LIMIT: 300000,
  MIN_DEPOSIT_AMOUNT: '0.001', // ETH
  
  // UI settings
  DECIMAL_PLACES: 4,
  PERCENTAGE_DECIMAL_PLACES: 2,
  
  // Cache settings
  CACHE_DURATION: 300000, // 5 minutes
  
  // API endpoints
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  
  // Feature flags
  FEATURES: {
    ADVANCED_CHARTS: true,
    PORTFOLIO_ANALYTICS: true,
    AUTOMATED_HEDGING: true,
    NOTIFICATIONS: false
  }
};

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
  NETWORK_NOT_SUPPORTED: 'This network is not supported',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  POOL_NOT_FOUND: 'Pool not found or inactive',
  INVALID_AMOUNT: 'Please enter a valid amount',
  APPROVAL_REQUIRED: 'Token approval required before proceeding',
  HIGH_SLIPPAGE: 'Price impact is high. Consider reducing amount',
  POOL_UTILIZATION_HIGH: 'Pool utilization is high. Withdrawal may be limited',
  RISK_TOO_HIGH: 'Risk level is too high for this operation'
};

// Success messages
export const SUCCESS_MESSAGES = {
  DEPOSIT_SUCCESS: 'Deposit successful! Your funds are now in the hedging pool',
  WITHDRAWAL_SUCCESS: 'Withdrawal successful! Funds have been returned to your wallet',
  APPROVAL_SUCCESS: 'Token approval successful! You can now proceed with the transaction',
  STRATEGY_CREATED: 'Hedging strategy created successfully',
  POOL_CREATED: 'New pool created successfully',
  SETTINGS_UPDATED: 'Settings updated successfully'
};

// Risk level colors
export const RISK_COLORS = {
  LOW: '#2ed573',
  MEDIUM: '#ffa502',
  HIGH: '#ff4757',
  VERY_HIGH: '#ff3742'
};

// Chart colors
export const CHART_COLORS = {
  PRIMARY: '#5352ed',
  SECONDARY: '#40407a',
  SUCCESS: '#2ed573',
  WARNING: '#ffa502',
  DANGER: '#ff4757',
  INFO: '#3742fa',
  GRADIENT: ['#5352ed', '#40407a', '#2f3542']
};

// Gas price settings (in gwei)
export const GAS_PRICES = {
  SLOW: 20,
  STANDARD: 25,
  FAST: 35,
  INSTANT: 50
};

// Token metadata
export const TOKEN_METADATA = {
  [TOKEN_ADDRESSES.WETH]: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    logo: 'https://tokens.1inch.io/0xc02aaa39b223fe8dcce9dbc5f542ffc25bef35a6f8.png'
  },
  [TOKEN_ADDRESSES.USDC]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logo: 'https://tokens.1inch.io/0xa0b86a33e6417c8a7b2e7c5a0d4c45f2a0c0c0c0.png'
  },
  [TOKEN_ADDRESSES.USDT]: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logo: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png'
  },
  [TOKEN_ADDRESSES.DAI]: {
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    decimals: 18,
    logo: 'https://tokens.1inch.io/0x6b175474e89094c44da98b954eedeac495271d0f.png'
  }
};

// Utility functions
export const formatAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const formatNumber = (value, decimals = APP_CONFIG.DECIMAL_PLACES) => {
  const num = parseFloat(value);
  if (num === 0) return '0';
  if (num < Math.pow(10, -decimals)) return `< ${Math.pow(10, -decimals)}`;
  return num.toFixed(decimals);
};

export const formatPercentage = (value, decimals = APP_CONFIG.PERCENTAGE_DECIMAL_PLACES) => {
  return `${formatNumber(value, decimals)}%`;
};

export const formatCurrency = (value, symbol = 'ETH', decimals = APP_CONFIG.DECIMAL_PLACES) => {
  return `${formatNumber(value, decimals)} ${symbol}`;
};

export const getRiskColor = (riskScore) => {
  if (riskScore > APP_CONFIG.RISK_THRESHOLDS.HIGH) return RISK_COLORS.HIGH;
  if (riskScore > APP_CONFIG.RISK_THRESHOLDS.MEDIUM) return RISK_COLORS.MEDIUM;
  return RISK_COLORS.LOW;
};

export const getRiskLevel = (riskScore) => {
  if (riskScore > APP_CONFIG.RISK_THRESHOLDS.HIGH) return 'High';
  if (riskScore > APP_CONFIG.RISK_THRESHOLDS.MEDIUM) return 'Medium';
  return 'Low';
};

// Validation functions
export const isValidAddress = (address) => {
  return ethers.isAddress(address);
};

export const isValidAmount = (amount) => {
  try {
    const parsed = ethers.parseEther(amount.toString());
    return parsed > 0n;
  } catch {
    return false;
  }
};

export const isValidNetwork = (chainId) => {
  return Object.keys(NETWORKS).includes(chainId.toString());
};

export default {
  CONTRACT_ADDRESSES,
  NETWORKS,
  TOKEN_ADDRESSES,
  ABIS,
  APP_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  RISK_COLORS,
  CHART_COLORS,
  GAS_PRICES,
  TOKEN_METADATA,
  formatAddress,
  formatNumber,
  formatPercentage,
  formatCurrency,
  getRiskColor,
  getRiskLevel,
  isValidAddress,
  isValidAmount,
  isValidNetwork
};
