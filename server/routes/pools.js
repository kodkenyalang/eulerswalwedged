const express = require('express');
const { ethers } = require('ethers');
const { hedgingService } = require('../services/hedgingService');
const { riskAnalyzer } = require('../services/riskAnalyzer');
const { eulerSwapService } = require('../services/eulerSwapService');

const router = express.Router();

// Get all pools
router.get('/', async (req, res) => {
  try {
    const { active, sortBy = 'id', order = 'asc', limit = 50, offset = 0 } = req.query;

    if (!hedgingService.isInitialized) {
      return res.status(503).json({
        error: 'Service not initialized',
        message: 'Hedging service is still initializing. Please try again later.'
      });
    }

    // Get pools from blockchain
    const pools = await hedgingService.getAllPools();
    
    // Filter by active status if specified
    let filteredPools = pools;
    if (active !== undefined) {
      const isActive = active === 'true';
      filteredPools = pools.filter(pool => pool.active === isActive);
    }

    // Sort pools
    const validSortFields = ['id', 'totalDeposits', 'availableLiquidity', 'riskScore', 'hedgedAmount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
    
    filteredPools.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle BigNumber values
      if (ethers.BigNumber.isBigNumber(aValue)) {
        aValue = parseFloat(ethers.utils.formatEther(aValue));
      }
      if (ethers.BigNumber.isBigNumber(bValue)) {
        bValue = parseFloat(ethers.utils.formatEther(bValue));
      }
      
      if (order === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPools = filteredPools.slice(startIndex, endIndex);

    // Enhance pools with additional data
    const enhancedPools = await Promise.all(
      paginatedPools.map(async (pool) => {
        try {
          const [riskAnalysis, eulerPoolInfo] = await Promise.all([
            riskAnalyzer.analyzePoolRisk(pool.id).catch(() => null),
            eulerSwapService.getPoolInfo(pool.token0, pool.token1).catch(() => null)
          ]);

          return {
            ...pool,
            riskAnalysis: riskAnalysis ? {
              level: riskAnalysis.riskLevel,
              score: riskAnalysis.currentRiskScore,
              components: riskAnalysis.components,
              utilization: riskAnalysis.utilization,
              hedgeRatio: riskAnalysis.hedgeRatio
            } : null,
            eulerPool: eulerPoolInfo ? {
              address: eulerPoolInfo.pool,
              reserves: {
                token0: ethers.utils.formatEther(eulerPoolInfo.reserve0),
                token1: ethers.utils.formatEther(eulerPoolInfo.reserve1)
              },
              totalSupply: ethers.utils.formatEther(eulerPoolInfo.totalSupply)
            } : null,
            // Format BigNumber values for API response
            totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
            availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
            hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount)
          };
        } catch (error) {
          console.error(`Error enhancing pool ${pool.id}:`, error);
          return {
            ...pool,
            totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
            availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
            hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount)
          };
        }
      })
    );

    res.json({
      pools: enhancedPools,
      pagination: {
        total: filteredPools.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasNext: endIndex < filteredPools.length,
        hasPrev: startIndex > 0
      },
      filters: {
        active: active,
        sortBy: sortField,
        order
      }
    });

  } catch (error) {
    console.error('Error getting pools:', error);
    res.status(500).json({
      error: 'Failed to fetch pools',
      message: error.message
    });
  }
});

// Get specific pool by ID
router.get('/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    
    if (!hedgingService.isInitialized) {
      return res.status(503).json({
        error: 'Service not initialized'
      });
    }

    // Validate pool ID
    if (!poolId || isNaN(parseInt(poolId))) {
      return res.status(400).json({
        error: 'Invalid pool ID',
        message: 'Pool ID must be a valid number'
      });
    }

    // Get pool information
    const pool = await hedgingService.getPoolInfo(parseInt(poolId));
    
    if (!pool) {
      return res.status(404).json({
        error: 'Pool not found',
        message: `Pool with ID ${poolId} does not exist`
      });
    }

    // Get detailed analysis
    const [riskAnalysis, hedgingRecommendations, eulerPoolInfo] = await Promise.all([
      riskAnalyzer.analyzePoolRisk(parseInt(poolId)).catch(error => {
        console.error(`Risk analysis failed for pool ${poolId}:`, error);
        return null;
      }),
      hedgingService.getHedgingRecommendations(parseInt(poolId)).catch(error => {
        console.error(`Hedging recommendations failed for pool ${poolId}:`, error);
        return [];
      }),
      eulerSwapService.getPoolInfo(pool.token0, pool.token1).catch(error => {
        console.error(`EulerSwap pool info failed for pool ${poolId}:`, error);
        return null;
      })
    ]);

    const response = {
      ...pool,
      totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
      availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
      hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount),
      riskAnalysis,
      hedgingRecommendations,
      eulerPool: eulerPoolInfo
    };

    res.json(response);

  } catch (error) {
    console.error(`Error getting pool ${req.params.poolId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch pool',
      message: error.message
    });
  }
});

// Get pool risk metrics
router.get('/:poolId/risk', async (req, res) => {
  try {
    const { poolId } = req.params;
    
    if (!riskAnalyzer.isInitialized) {
      return res.status(503).json({
        error: 'Risk analyzer not initialized'
      });
    }

    const riskAnalysis = await riskAnalyzer.analyzePoolRisk(parseInt(poolId));
    
    res.json(riskAnalysis);

  } catch (error) {
    console.error(`Error getting risk metrics for pool ${req.params.poolId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch risk metrics',
      message: error.message
    });
  }
});

// Get pool statistics
router.get('/:poolId/stats', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { timeframe = '24h' } = req.query;
    
    const pool = await hedgingService.getPoolInfo(parseInt(poolId));
    
    if (!pool) {
      return res.status(404).json({
        error: 'Pool not found'
      });
    }

    const [eulerStats, riskAnalysis] = await Promise.all([
      eulerSwapService.getPoolStatistics(pool.token0, pool.token1, timeframe).catch(() => null),
      riskAnalyzer.analyzePoolRisk(parseInt(poolId)).catch(() => null)
    ]);

    const stats = {
      poolId: parseInt(poolId),
      timeframe,
      basic: {
        totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
        availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
        hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount),
        utilization: riskAnalysis ? riskAnalysis.utilization : 0,
        hedgeRatio: riskAnalysis ? riskAnalysis.hedgeRatio : 0
      },
      risk: riskAnalysis ? {
        currentScore: riskAnalysis.currentRiskScore,
        level: riskAnalysis.riskLevel,
        components: riskAnalysis.components
      } : null,
      eulerSwap: eulerStats,
      performance: {
        // These would be calculated from historical data
        returns: 0,
        volatility: riskAnalysis ? riskAnalysis.components.volatility / 100 : 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      }
    };

    res.json(stats);

  } catch (error) {
    console.error(`Error getting stats for pool ${req.params.poolId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch pool statistics',
      message: error.message
    });
  }
});

// Get user positions in pools
router.get('/user/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'User address is not a valid Ethereum address'
      });
    }

    if (!hedgingService.isInitialized) {
      return res.status(503).json({
        error: 'Service not initialized'
      });
    }

    const userPools = await hedgingService.getUserPools(userAddress);
    
    const userPositions = await Promise.all(
      userPools.map(async (poolId) => {
        try {
          const [pool, userDeposit, userRewards] = await Promise.all([
            hedgingService.getPoolInfo(poolId),
            hedgingService.getUserDeposit(poolId, userAddress),
            hedgingService.getUserRewards(poolId, userAddress)
          ]);

          if (!pool) return null;

          return {
            poolId,
            pool: {
              ...pool,
              totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
              availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
              hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount)
            },
            userDeposit: ethers.utils.formatEther(userDeposit),
            userRewards: ethers.utils.formatEther(userRewards),
            share: pool.totalDeposits.gt(0) 
              ? userDeposit.mul(10000).div(pool.totalDeposits).toNumber() / 100
              : 0
          };
        } catch (error) {
          console.error(`Error getting user position for pool ${poolId}:`, error);
          return null;
        }
      })
    );

    const validPositions = userPositions.filter(pos => pos !== null);

    // Calculate portfolio totals
    const portfolioSummary = {
      totalPools: validPositions.length,
      totalDeposited: validPositions.reduce((sum, pos) => sum + parseFloat(pos.userDeposit), 0),
      totalRewards: validPositions.reduce((sum, pos) => sum + parseFloat(pos.userRewards), 0),
      averageRisk: validPositions.length > 0 
        ? validPositions.reduce((sum, pos) => sum + pos.pool.riskScore, 0) / validPositions.length
        : 0
    };

    res.json({
      userAddress,
      positions: validPositions,
      summary: portfolioSummary
    });

  } catch (error) {
    console.error(`Error getting user pools for ${req.params.userAddress}:`, error);
    res.status(500).json({
      error: 'Failed to fetch user positions',
      message: error.message
    });
  }
});

// Get market overview
router.get('/market/overview', async (req, res) => {
  try {
    const [marketConditions, eulerPools] = await Promise.all([
      riskAnalyzer.getMarketConditions().catch(() => null),
      eulerSwapService.getAllPools().catch(() => [])
    ]);

    const overview = {
      market: marketConditions,
      totalEulerPools: eulerPools.length,
      totalTVL: eulerPools.reduce((sum, pool) => sum + parseFloat(pool.tvl || 0), 0),
      averageAPR: eulerPools.length > 0 
        ? eulerPools.reduce((sum, pool) => sum + pool.apr, 0) / eulerPools.length
        : 0,
      topPools: eulerPools
        .sort((a, b) => parseFloat(b.tvl) - parseFloat(a.tvl))
        .slice(0, 5)
    };

    res.json(overview);

  } catch (error) {
    console.error('Error getting market overview:', error);
    res.status(500).json({
      error: 'Failed to fetch market overview',
      message: error.message
    });
  }
});

// Search pools
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Search query must be at least 2 characters long'
      });
    }

    const pools = await hedgingService.getAllPools();
    
    // Search by pool ID or token addresses
    const searchResults = pools.filter(pool => {
      const poolIdMatch = pool.id.toString().includes(query);
      const token0Match = pool.token0.toLowerCase().includes(query.toLowerCase());
      const token1Match = pool.token1.toLowerCase().includes(query.toLowerCase());
      
      return poolIdMatch || token0Match || token1Match;
    }).slice(0, parseInt(limit));

    // Format results
    const formattedResults = searchResults.map(pool => ({
      ...pool,
      totalDeposits: ethers.utils.formatEther(pool.totalDeposits),
      availableLiquidity: ethers.utils.formatEther(pool.availableLiquidity),
      hedgedAmount: ethers.utils.formatEther(pool.hedgedAmount)
    }));

    res.json({
      query,
      results: formattedResults,
      total: formattedResults.length
    });

  } catch (error) {
    console.error(`Error searching pools with query "${req.params.query}":`, error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

module.exports = router;
