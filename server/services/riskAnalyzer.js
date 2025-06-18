const { ethers } = require('ethers');
const { EventEmitter } = require('events');

class RiskAnalyzer extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.contracts = {};
    this.priceFeeds = new Map();
    this.volatilityCache = new Map();
    this.correlationCache = new Map();
    this.riskCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize blockchain connection
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Initialize contracts
      await this.initializeContracts();
      
      // Start periodic risk analysis
      this.startPeriodicAnalysis();
      
      this.isInitialized = true;
      console.log('RiskAnalyzer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RiskAnalyzer:', error);
      throw error;
    }
  }

  async initializeContracts() {
    if (!this.provider) throw new Error('Provider not initialized');

    const contractAddresses = {
      wedgedPool: process.env.WEDGED_POOL_ADDRESS,
      riskCalculator: process.env.RISK_CALCULATOR_ADDRESS,
      eulerSwapIntegration: process.env.EULER_SWAP_INTEGRATION_ADDRESS
    };

    const abis = {
      wedgedPool: [
        'function getPoolInfo(uint256 poolId) external view returns (tuple(uint256 id, address token0, address token1, uint256 totalDeposits, uint256 availableLiquidity, uint256 hedgedAmount, uint256 riskScore, bool active))',
        'function totalPools() external view returns (uint256)'
      ],
      riskCalculator: [
        'function calculatePoolRisk(uint256 poolId) external returns (uint256)',
        'function getPoolRiskMetrics(uint256 poolId) external view returns (tuple(uint256 volatility, uint256 impermanentLoss, uint256 correlationRisk, uint256 liquidityRisk, uint256 compositeRisk))',
        'function calculateVolatility(address token) external returns (uint256)',
        'function calculateCorrelation(address token0, address token1) external view returns (uint256)',
        'function calculateImpermanentLoss(address token0, address token1, uint256 amount) external view returns (uint256)'
      ],
      eulerSwapIntegration: [
        'function getPrice(address token0, address token1) external view returns (uint256)',
        'function getPoolInfo(address token0, address token1) external view returns (tuple(address pool, address token0, address token1, uint24 fee, uint256 reserve0, uint256 reserve1, uint256 totalSupply))'
      ]
    };

    for (const [name, address] of Object.entries(contractAddresses)) {
      if (address && abis[name]) {
        this.contracts[name] = new ethers.Contract(address, abis[name], this.provider);
      }
    }
  }

  startPeriodicAnalysis() {
    // Update risk metrics every 2 minutes
    setInterval(async () => {
      try {
        await this.updateAllPoolRisks();
      } catch (error) {
        console.error('Error in periodic risk analysis:', error);
      }
    }, 2 * 60 * 1000);

    // Update volatility metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.updateVolatilityMetrics();
      } catch (error) {
        console.error('Error updating volatility metrics:', error);
      }
    }, 5 * 60 * 1000);

    console.log('Started periodic risk analysis');
  }

  async updateAllPoolRisks() {
    if (!this.contracts.wedgedPool) return;

    try {
      const totalPools = await this.contracts.wedgedPool.totalPools();
      
      for (let i = 1; i <= totalPools.toNumber(); i++) {
        try {
          const poolInfo = await this.contracts.wedgedPool.getPoolInfo(i);
          if (poolInfo.active) {
            await this.analyzePoolRisk(i);
          }
        } catch (error) {
          console.warn(`Error analyzing pool ${i}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error updating all pool risks:', error);
    }
  }

  async analyzePoolRisk(poolId) {
    try {
      const cacheKey = `pool-risk-${poolId}`;
      const cached = this.riskCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const [poolInfo, riskMetrics] = await Promise.all([
        this.contracts.wedgedPool.getPoolInfo(poolId),
        this.getRiskMetrics(poolId)
      ]);

      const analysis = {
        poolId,
        timestamp: Date.now(),
        currentRiskScore: poolInfo.riskScore.toNumber(),
        riskLevel: this.getRiskLevel(poolInfo.riskScore.toNumber()),
        components: riskMetrics,
        utilization: this.calculateUtilization(poolInfo),
        hedgeRatio: this.calculateHedgeRatio(poolInfo),
        liquidityDepth: this.calculateLiquidityDepth(poolInfo),
        concentrationRisk: await this.calculateConcentrationRisk(poolInfo),
        recommendations: await this.generateRiskRecommendations(poolInfo, riskMetrics)
      };

      // Cache the analysis
      this.riskCache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      // Emit risk update event
      this.emit('risk-analysis-update', analysis);

      return analysis;
    } catch (error) {
      console.error(`Error analyzing pool ${poolId} risk:`, error);
      throw new Error(`Failed to analyze pool ${poolId} risk: ${error.message}`);
    }
  }

  async getRiskMetrics(poolId) {
    try {
      if (!this.contracts.riskCalculator) {
        throw new Error('Risk calculator contract not available');
      }

      const metrics = await this.contracts.riskCalculator.getPoolRiskMetrics(poolId);
      
      return {
        volatility: metrics.volatility.toNumber(),
        impermanentLoss: metrics.impermanentLoss.toNumber(),
        correlationRisk: metrics.correlationRisk.toNumber(),
        liquidityRisk: metrics.liquidityRisk.toNumber(),
        compositeRisk: metrics.compositeRisk.toNumber()
      };
    } catch (error) {
      console.error(`Error getting risk metrics for pool ${poolId}:`, error);
      // Return default metrics if contract call fails
      return {
        volatility: 0,
        impermanentLoss: 0,
        correlationRisk: 0,
        liquidityRisk: 0,
        compositeRisk: 0
      };
    }
  }

  async calculateVolatility(tokenAddress) {
    try {
      const cacheKey = `volatility-${tokenAddress}`;
      const cached = this.volatilityCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      let volatility = 0;
      
      if (this.contracts.riskCalculator) {
        try {
          const vol = await this.contracts.riskCalculator.calculateVolatility(tokenAddress);
          volatility = vol.toNumber();
        } catch (error) {
          console.warn(`Contract volatility calculation failed for ${tokenAddress}:`, error.message);
          volatility = await this.calculateHistoricalVolatility(tokenAddress);
        }
      } else {
        volatility = await this.calculateHistoricalVolatility(tokenAddress);
      }

      this.volatilityCache.set(cacheKey, {
        data: volatility,
        timestamp: Date.now()
      });

      return volatility;
    } catch (error) {
      console.error(`Error calculating volatility for ${tokenAddress}:`, error);
      return 0;
    }
  }

  async calculateHistoricalVolatility(tokenAddress) {
    try {
      // This would typically fetch historical price data from an external API
      // For now, we'll use a simplified calculation based on recent price movements
      
      if (!this.contracts.eulerSwapIntegration) {
        return 0;
      }

      // Get current price against a reference token (e.g., WETH)
      const referenceToken = process.env.REFERENCE_TOKEN || '0xC02aaA39b223FE8dCcE9d7b542fFC25BeF35a6f8';
      
      try {
        const currentPrice = await this.contracts.eulerSwapIntegration.getPrice(tokenAddress, referenceToken);
        
        // Store price for historical comparison
        const priceKey = `price-${tokenAddress}`;
        const historicalPrices = this.priceFeeds.get(priceKey) || [];
        
        historicalPrices.push({
          price: currentPrice.toString(),
          timestamp: Date.now()
        });

        // Keep only last 30 data points
        if (historicalPrices.length > 30) {
          historicalPrices.shift();
        }

        this.priceFeeds.set(priceKey, historicalPrices);

        // Calculate volatility from price returns
        if (historicalPrices.length < 2) return 0;

        const returns = [];
        for (let i = 1; i < historicalPrices.length; i++) {
          const current = parseFloat(historicalPrices[i].price);
          const previous = parseFloat(historicalPrices[i - 1].price);
          
          if (previous > 0) {
            returns.push(Math.log(current / previous));
          }
        }

        if (returns.length === 0) return 0;

        // Calculate standard deviation of returns
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility in %

        return Math.min(volatility * 100, 10000); // Convert to basis points, cap at 100%
      } catch (error) {
        console.warn(`Price fetch failed for ${tokenAddress}:`, error.message);
        return 0;
      }
    } catch (error) {
      console.error(`Error calculating historical volatility for ${tokenAddress}:`, error);
      return 0;
    }
  }

  async calculateCorrelation(token0, token1) {
    try {
      const cacheKey = `correlation-${token0}-${token1}`;
      const cached = this.correlationCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      let correlation = 5000; // Default 50% correlation

      if (this.contracts.riskCalculator) {
        try {
          const corr = await this.contracts.riskCalculator.calculateCorrelation(token0, token1);
          correlation = corr.toNumber();
        } catch (error) {
          console.warn(`Contract correlation calculation failed:`, error.message);
          correlation = await this.calculateHistoricalCorrelation(token0, token1);
        }
      } else {
        correlation = await this.calculateHistoricalCorrelation(token0, token1);
      }

      this.correlationCache.set(cacheKey, {
        data: correlation,
        timestamp: Date.now()
      });

      return correlation;
    } catch (error) {
      console.error(`Error calculating correlation between ${token0} and ${token1}:`, error);
      return 5000; // Default correlation
    }
  }

  async calculateHistoricalCorrelation(token0, token1) {
    try {
      const priceKey0 = `price-${token0}`;
      const priceKey1 = `price-${token1}`;
      
      const prices0 = this.priceFeeds.get(priceKey0) || [];
      const prices1 = this.priceFeeds.get(priceKey1) || [];

      if (prices0.length < 10 || prices1.length < 10) {
        return 5000; // Default correlation if insufficient data
      }

      // Calculate returns for both tokens
      const returns0 = this.calculateReturns(prices0);
      const returns1 = this.calculateReturns(prices1);

      if (returns0.length === 0 || returns1.length === 0) {
        return 5000;
      }

      // Calculate correlation coefficient
      const correlation = this.pearsonCorrelation(returns0, returns1);
      
      // Convert to basis points (0-10000)
      return Math.max(0, Math.min(10000, (correlation + 1) * 5000));
    } catch (error) {
      console.error('Error calculating historical correlation:', error);
      return 5000;
    }
  }

  calculateReturns(priceHistory) {
    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const current = parseFloat(priceHistory[i].price);
      const previous = parseFloat(priceHistory[i - 1].price);
      
      if (previous > 0) {
        returns.push(Math.log(current / previous));
      }
    }
    return returns;
  }

  pearsonCorrelation(x, y) {
    const minLength = Math.min(x.length, y.length);
    if (minLength < 2) return 0;

    const xSlice = x.slice(-minLength);
    const ySlice = y.slice(-minLength);

    const sumX = xSlice.reduce((sum, val) => sum + val, 0);
    const sumY = ySlice.reduce((sum, val) => sum + val, 0);
    const sumXY = xSlice.reduce((sum, val, i) => sum + val * ySlice[i], 0);
    const sumX2 = xSlice.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = ySlice.reduce((sum, val) => sum + val * val, 0);

    const n = minLength;
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  async calculateImpermanentLoss(poolInfo, priceChangePercent = 0) {
    try {
      if (!this.contracts.riskCalculator) {
        return this.estimateImpermanentLoss(priceChangePercent);
      }

      const amount = ethers.utils.parseEther('1'); // Calculate for 1 ETH
      const il = await this.contracts.riskCalculator.calculateImpermanentLoss(
        poolInfo.token0,
        poolInfo.token1,
        amount
      );

      return il.toNumber();
    } catch (error) {
      console.error('Error calculating impermanent loss:', error);
      return this.estimateImpermanentLoss(priceChangePercent);
    }
  }

  estimateImpermanentLoss(priceChangePercent) {
    // Simplified IL calculation: IL = 2 * sqrt(ratio) / (1 + ratio) - 1
    const ratio = (100 + priceChangePercent) / 100;
    const il = 2 * Math.sqrt(ratio) / (1 + ratio) - 1;
    return Math.max(0, il * 10000); // Convert to basis points
  }

  calculateUtilization(poolInfo) {
    const total = parseFloat(ethers.utils.formatEther(poolInfo.totalDeposits || 0));
    const available = parseFloat(ethers.utils.formatEther(poolInfo.availableLiquidity || 0));
    if (total === 0) return 0;
    return ((total - available) / total) * 100;
  }

  calculateHedgeRatio(poolInfo) {
    const hedged = parseFloat(ethers.utils.formatEther(poolInfo.hedgedAmount || 0));
    const total = parseFloat(ethers.utils.formatEther(poolInfo.totalDeposits || 0));
    if (total === 0) return 0;
    return (hedged / total) * 100;
  }

  calculateLiquidityDepth(poolInfo) {
    const available = parseFloat(ethers.utils.formatEther(poolInfo.availableLiquidity || 0));
    const total = parseFloat(ethers.utils.formatEther(poolInfo.totalDeposits || 0));
    
    if (total === 0) return 0;
    return (available / total) * 100;
  }

  async calculateConcentrationRisk(poolInfo) {
    try {
      // Calculate concentration risk based on pool size relative to total protocol TVL
      if (!this.contracts.wedgedPool) return 0;

      const totalPools = await this.contracts.wedgedPool.totalPools();
      let totalTVL = ethers.BigNumber.from(0);

      for (let i = 1; i <= totalPools.toNumber(); i++) {
        try {
          const pool = await this.contracts.wedgedPool.getPoolInfo(i);
          if (pool.active) {
            totalTVL = totalTVL.add(pool.totalDeposits);
          }
        } catch (error) {
          // Skip failed pool queries
        }
      }

      if (totalTVL.isZero()) return 0;

      const poolShare = poolInfo.totalDeposits.mul(10000).div(totalTVL).toNumber();
      
      // Higher concentration = higher risk
      if (poolShare > 5000) return 8000; // Very high concentration
      if (poolShare > 2000) return 5000; // High concentration
      if (poolShare > 1000) return 3000; // Medium concentration
      return 1000; // Low concentration
    } catch (error) {
      console.error('Error calculating concentration risk:', error);
      return 0;
    }
  }

  async generateRiskRecommendations(poolInfo, riskMetrics) {
    const recommendations = [];
    const riskScore = poolInfo.riskScore.toNumber();
    const utilization = this.calculateUtilization(poolInfo);
    const hedgeRatio = this.calculateHedgeRatio(poolInfo);

    // High risk recommendations
    if (riskScore > 7000) {
      recommendations.push({
        type: 'critical',
        priority: 'high',
        message: 'Pool risk is critically high - immediate action required',
        actions: ['Reduce position sizes', 'Increase hedging', 'Monitor closely']
      });
    } else if (riskScore > 5000) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        message: 'Pool risk is elevated - consider risk mitigation',
        actions: ['Review hedging strategy', 'Consider position adjustment']
      });
    }

    // Utilization recommendations
    if (utilization > 90) {
      recommendations.push({
        type: 'liquidity',
        priority: 'high',
        message: 'Pool utilization is very high - withdrawal capacity limited',
        actions: ['Monitor liquidity closely', 'Prepare for potential liquidity constraints']
      });
    }

    // Hedging recommendations
    if (hedgeRatio < 30 && riskScore > 4000) {
      recommendations.push({
        type: 'hedging',
        priority: 'medium',
        message: 'Low hedge ratio for medium-high risk environment',
        actions: ['Consider increasing hedge position', 'Evaluate hedging strategies']
      });
    }

    // Volatility recommendations
    if (riskMetrics.volatility > 6000) {
      recommendations.push({
        type: 'volatility',
        priority: 'medium',
        message: 'High volatility detected in underlying assets',
        actions: ['Monitor price movements', 'Consider volatility-based hedging']
      });
    }

    // Correlation recommendations
    if (riskMetrics.correlationRisk > 7000) {
      recommendations.push({
        type: 'correlation',
        priority: 'low',
        message: 'High correlation between pool tokens reduces diversification',
        actions: ['Consider diversifying into uncorrelated assets']
      });
    }

    return recommendations;
  }

  getRiskLevel(riskScore) {
    if (riskScore > 7000) return 'Critical';
    if (riskScore > 5000) return 'High';
    if (riskScore > 3000) return 'Medium';
    return 'Low';
  }

  async updateVolatilityMetrics() {
    try {
      // Update volatility for commonly traded tokens
      const commonTokens = [
        process.env.WETH_ADDRESS || '0xC02aaA39b223FE8dCcE9d7b542fFC25BeF35a6f8',
        process.env.USDC_ADDRESS || '0xA0b86a33E6417C8a7B2E7c5A0d4c45f2a0C0c0C0',
        process.env.USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        process.env.DAI_ADDRESS || '0x6B175474E89094C44Da98b954EedeAC495271d0F'
      ];

      for (const token of commonTokens) {
        if (token && ethers.utils.isAddress(token)) {
          await this.calculateVolatility(token);
        }
      }
    } catch (error) {
      console.error('Error updating volatility metrics:', error);
    }
  }

  async getMarketConditions() {
    try {
      // Analyze overall market conditions based on volatility and correlation data
      const volatilities = Array.from(this.volatilityCache.values()).map(v => v.data);
      const correlations = Array.from(this.correlationCache.values()).map(c => c.data);

      const avgVolatility = volatilities.length > 0 
        ? volatilities.reduce((sum, vol) => sum + vol, 0) / volatilities.length 
        : 0;

      const avgCorrelation = correlations.length > 0
        ? correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length
        : 5000;

      let sentiment = 'neutral';
      if (avgVolatility > 6000) sentiment = 'high_volatility';
      else if (avgVolatility < 2000) sentiment = 'low_volatility';

      return {
        volatilityIndex: avgVolatility / 100, // Convert to percentage
        correlationIndex: avgCorrelation / 100,
        sentiment,
        timestamp: Date.now(),
        recommendation: this.getMarketRecommendation(avgVolatility, avgCorrelation)
      };
    } catch (error) {
      console.error('Error getting market conditions:', error);
      return {
        volatilityIndex: 0,
        correlationIndex: 50,
        sentiment: 'unknown',
        timestamp: Date.now(),
        recommendation: 'Monitor markets closely'
      };
    }
  }

  getMarketRecommendation(volatility, correlation) {
    if (volatility > 6000 && correlation > 7000) {
      return 'High volatility and correlation - reduce risk exposure';
    } else if (volatility > 6000) {
      return 'High volatility environment - increase hedging';
    } else if (correlation > 7000) {
      return 'High correlation - diversify holdings';
    } else if (volatility < 2000) {
      return 'Low volatility - consider increasing position sizes';
    }
    return 'Market conditions are normal - maintain current strategy';
  }

  // Cache management
  clearCache() {
    this.riskCache.clear();
    this.volatilityCache.clear();
    this.correlationCache.clear();
    this.priceFeeds.clear();
  }

  getCacheStats() {
    return {
      riskCacheSize: this.riskCache.size,
      volatilityCacheSize: this.volatilityCache.size,
      correlationCacheSize: this.correlationCache.size,
      priceFeedsSize: this.priceFeeds.size
    };
  }
}

const riskAnalyzer = new RiskAnalyzer();

module.exports = { riskAnalyzer, RiskAnalyzer };
