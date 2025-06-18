import { ethers } from 'ethers';
import { contractService } from './contractService';

class RiskService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get cached data or fetch new data
  async getCachedData(key, fetchFunction) {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const data = await fetchFunction();
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      // Return cached data if available, even if expired
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  }

  // Calculate comprehensive risk metrics for a pool
  async calculatePoolRisk(poolId) {
    const cacheKey = `pool-risk-${poolId}`;
    
    return this.getCachedData(cacheKey, async () => {
      try {
        const poolInfo = await contractService.getPoolInfo(poolId);
        const riskMetrics = await contractService.getPoolRiskMetrics(poolId);
        
        const analysis = {
          poolId,
          currentRiskScore: poolInfo.riskScore,
          riskLevel: this.getRiskLevel(poolInfo.riskScore),
          components: {
            volatility: riskMetrics.volatility,
            impermanentLoss: riskMetrics.impermanentLoss,
            correlationRisk: riskMetrics.correlationRisk,
            liquidityRisk: riskMetrics.liquidityRisk
          },
          utilization: this.calculateUtilization(poolInfo),
          hedgeRatio: this.calculateHedgeRatio(poolInfo),
          recommendations: this.generateRecommendations(poolInfo, riskMetrics)
        };

        return analysis;
      } catch (error) {
        console.error('Error calculating pool risk:', error);
        throw new Error('Failed to calculate pool risk: ' + error.message);
      }
    });
  }

  // Get historical risk data for a pool
  async getPoolRiskHistory(poolId, timeframe = '7d') {
    const cacheKey = `pool-history-${poolId}-${timeframe}`;
    
    return this.getCachedData(cacheKey, async () => {
      try {
        // In a real implementation, this would fetch from a backend API
        // For now, we'll generate realistic mock data based on current metrics
        const currentMetrics = await contractService.getPoolRiskMetrics(poolId);
        return this.generateHistoricalData(poolId, timeframe, currentMetrics);
      } catch (error) {
        console.error('Error getting pool risk history:', error);
        // Generate fallback data
        return this.generateFallbackHistoricalData(timeframe);
      }
    });
  }

  // Calculate impermanent loss for given parameters
  async calculateImpermanentLoss(token0, token1, amount, priceChangePercent) {
    try {
      // Get current price ratio
      const currentPrice = await contractService.getPrice(token0, token1);
      
      // Calculate new price after change
      const newPrice = currentPrice.mul(100 + priceChangePercent).div(100);
      
      // Calculate impermanent loss using the standard formula
      const oneEther = ethers.parseEther('1');
      const priceRatio = (newPrice * oneEther) / currentPrice;
      const sqrt = this.sqrt(priceRatio);
      
      // IL = 2 * sqrt(ratio) / (1 + ratio) - 1
      const numerator = sqrt * 2n;
      const denominator = oneEther + priceRatio;
      const ilFactor = (numerator * oneEther) / denominator;
      
      if (ilFactor > oneEther) {
        return ((ilFactor - oneEther) * amount) / oneEther;
      }
      
      return 0n;
    } catch (error) {
      console.error('Error calculating impermanent loss:', error);
      return 0n;
    }
  }

  // Portfolio-level risk analysis
  async analyzePortfolioRisk(userPools) {
    try {
      if (!userPools || userPools.length === 0) {
        return {
          overallRisk: 0,
          diversificationScore: 0,
          totalExposure: '0',
          riskDistribution: {},
          recommendations: []
        };
      }

      let totalRisk = 0;
      let totalExposure = 0n;
      const riskDistribution = { low: 0, medium: 0, high: 0 };
      const tokenExposure = new Map();

      for (const pool of userPools) {
        const deposit = ethers.parseEther(pool.userDeposit || '0');
        totalExposure = totalExposure + deposit;
        totalRisk += pool.riskScore || 0;

        // Track risk distribution
        const riskLevel = this.getRiskLevel(pool.riskScore || 0);
        riskDistribution[riskLevel.toLowerCase()]++;

        // Track token exposure for diversification
        if (pool.token0) {
          tokenExposure.set(pool.token0, (tokenExposure.get(pool.token0) || 0) + 1);
        }
        if (pool.token1) {
          tokenExposure.set(pool.token1, (tokenExposure.get(pool.token1) || 0) + 1);
        }
      }

      const avgRisk = userPools.length > 0 ? totalRisk / userPools.length : 0;
      const diversificationScore = this.calculateDiversificationScore(userPools.length, tokenExposure.size);

      return {
        overallRisk: avgRisk,
        riskLevel: this.getRiskLevel(avgRisk),
        diversificationScore,
        totalExposure: ethers.formatEther(totalExposure),
        riskDistribution,
        uniqueTokens: tokenExposure.size,
        recommendations: this.generatePortfolioRecommendations(avgRisk, diversificationScore, riskDistribution)
      };
    } catch (error) {
      console.error('Error analyzing portfolio risk:', error);
      throw new Error('Failed to analyze portfolio risk: ' + error.message);
    }
  }

  // Hedging effectiveness analysis
  async analyzeHedgingEffectiveness(poolId, timeframe = '30d') {
    const cacheKey = `hedging-effectiveness-${poolId}-${timeframe}`;
    
    return this.getCachedData(cacheKey, async () => {
      try {
        const poolInfo = await contractService.getPoolInfo(poolId);
        const hedgeRatio = this.calculateHedgeRatio(poolInfo);
        
        // Mock analysis - in production, this would use historical data
        const effectiveness = {
          hedgeRatio,
          protectionLevel: this.calculateProtectionLevel(hedgeRatio),
          costEfficiency: Math.random() * 0.3 + 0.7, // 70-100%
          riskReduction: Math.min(hedgeRatio * 0.8, 0.9), // Max 90% risk reduction
          recommendations: []
        };

        if (hedgeRatio < 0.3) {
          effectiveness.recommendations.push('Consider increasing hedge ratio for better protection');
        }
        if (effectiveness.costEfficiency < 0.8) {
          effectiveness.recommendations.push('Hedging costs are high relative to protection gained');
        }

        return effectiveness;
      } catch (error) {
        console.error('Error analyzing hedging effectiveness:', error);
        throw error;
      }
    });
  }

  // Market condition analysis
  async analyzeMarketConditions() {
    const cacheKey = 'market-conditions';
    
    return this.getCachedData(cacheKey, async () => {
      try {
        // In production, this would fetch real market data
        return {
          volatilityIndex: Math.random() * 50 + 25, // 25-75
          liquidityIndex: Math.random() * 30 + 70, // 70-100
          correlationIndex: Math.random() * 40 + 30, // 30-70
          sentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)],
          recommendations: [
            'Market volatility is elevated - consider reducing position sizes',
            'Good liquidity conditions for entering/exiting positions',
            'Token correlations are moderate - diversification benefits available'
          ]
        };
      } catch (error) {
        console.error('Error analyzing market conditions:', error);
        throw error;
      }
    });
  }

  // Utility functions
  getRiskLevel(riskScore) {
    if (riskScore > 5000) return 'High';
    if (riskScore > 3000) return 'Medium';
    return 'Low';
  }

  calculateUtilization(poolInfo) {
    const total = parseFloat(ethers.formatEther(poolInfo.totalDeposits || 0));
    const available = parseFloat(ethers.formatEther(poolInfo.availableLiquidity || 0));
    if (total === 0) return 0;
    return ((total - available) / total) * 100;
  }

  calculateHedgeRatio(poolInfo) {
    const hedged = parseFloat(ethers.formatEther(poolInfo.hedgedAmount || 0));
    const total = parseFloat(ethers.formatEther(poolInfo.totalDeposits || 0));
    if (total === 0) return 0;
    return hedged / total;
  }

  calculateProtectionLevel(hedgeRatio) {
    // Protection level is not linear with hedge ratio
    return Math.min(hedgeRatio * 0.85, 0.95); // Max 95% protection
  }

  calculateDiversificationScore(poolCount, uniqueTokens) {
    const poolScore = Math.min(poolCount / 5, 1) * 50; // Max 50 points for 5+ pools
    const tokenScore = Math.min(uniqueTokens / 10, 1) * 50; // Max 50 points for 10+ unique tokens
    return poolScore + tokenScore;
  }

  generateRecommendations(poolInfo, riskMetrics) {
    const recommendations = [];
    const riskScore = poolInfo.riskScore;
    const utilization = this.calculateUtilization(poolInfo);
    const hedgeRatio = this.calculateHedgeRatio(poolInfo);

    if (riskScore > 7000) {
      recommendations.push({
        type: 'warning',
        message: 'High risk detected - consider reducing position size or increasing hedging'
      });
    }

    if (utilization > 90) {
      recommendations.push({
        type: 'info',
        message: 'Pool utilization is very high - withdrawal may be limited'
      });
    }

    if (hedgeRatio < 0.3 && riskScore > 4000) {
      recommendations.push({
        type: 'suggestion',
        message: 'Low hedge ratio for medium-high risk - consider increasing protection'
      });
    }

    if (riskMetrics.volatility > 6000) {
      recommendations.push({
        type: 'warning',
        message: 'High volatility detected - monitor positions closely'
      });
    }

    return recommendations;
  }

  generatePortfolioRecommendations(avgRisk, diversificationScore, riskDistribution) {
    const recommendations = [];

    if (avgRisk > 6000) {
      recommendations.push('Portfolio risk is high - consider rebalancing towards lower-risk pools');
    }

    if (diversificationScore < 30) {
      recommendations.push('Low diversification - consider adding pools with different token pairs');
    }

    if (riskDistribution.high > riskDistribution.low + riskDistribution.medium) {
      recommendations.push('Too many high-risk positions - balance with some low-risk pools');
    }

    if (diversificationScore > 80) {
      recommendations.push('Excellent diversification - well-balanced portfolio');
    }

    return recommendations;
  }

  generateHistoricalData(poolId, timeframe, currentMetrics) {
    const intervals = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
    const intervalMs = timeframe === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const now = Date.now();

    const data = {
      timestamps: [],
      riskScores: [],
      volatility: [],
      impermanentLoss: [],
      correlationRisk: [],
      liquidityRisk: []
    };

    for (let i = intervals - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      data.timestamps.push(timestamp);

      // Generate realistic variations around current metrics
      const volatilityBase = currentMetrics.volatility;
      const ilBase = currentMetrics.impermanentLoss;
      const corrBase = currentMetrics.correlationRisk;
      const liquidityBase = currentMetrics.liquidityRisk;

      const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
      
      data.volatility.push(Math.max(0, volatilityBase * (1 + variation)));
      data.impermanentLoss.push(Math.max(0, ilBase * (1 + variation)));
      data.correlationRisk.push(Math.max(0, corrBase * (1 + variation)));
      data.liquidityRisk.push(Math.max(0, liquidityBase * (1 + variation)));

      // Calculate composite risk score
      const compositeRisk = (
        data.volatility[data.volatility.length - 1] * 0.3 +
        data.impermanentLoss[data.impermanentLoss.length - 1] * 0.4 +
        data.correlationRisk[data.correlationRisk.length - 1] * 0.2 +
        data.liquidityRisk[data.liquidityRisk.length - 1] * 0.1
      );
      
      data.riskScores.push(Math.min(Math.max(compositeRisk, 0), 10000));
    }

    return data;
  }

  generateFallbackHistoricalData(timeframe) {
    const intervals = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
    const intervalMs = timeframe === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const now = Date.now();

    const data = {
      timestamps: [],
      riskScores: [],
      volatility: [],
      impermanentLoss: [],
      correlationRisk: [],
      liquidityRisk: []
    };

    for (let i = intervals - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      data.timestamps.push(timestamp);
      
      // Generate fallback data
      const baseRisk = 3000;
      const variation = Math.sin(i * 0.5) * 1000 + (Math.random() - 0.5) * 500;
      
      data.riskScores.push(Math.max(1000, Math.min(8000, baseRisk + variation)));
      data.volatility.push(2000 + Math.random() * 2000);
      data.impermanentLoss.push(1500 + Math.random() * 2500);
      data.correlationRisk.push(1000 + Math.random() * 1500);
      data.liquidityRisk.push(500 + Math.random() * 1000);
    }

    return data;
  }

  // Mathematical utility for square root approximation
  sqrt(value) {
    if (value === 0n) return 0n;
    
    let z = (value + 1n) / 2n;
    let y = value;
    
    while (z < y) {
      y = z;
      z = (value / z + z) / 2n;
    }
    
    return y;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      oldestEntry: Math.min(...Array.from(this.cache.values()).map(v => v.timestamp)),
      newestEntry: Math.max(...Array.from(this.cache.values()).map(v => v.timestamp))
    };
  }
}

export const riskService = new RiskService();
