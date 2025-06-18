const express = require('express');
const { ethers } = require('ethers');
const { hedgingService } = require('../services/hedgingService');
const { riskAnalyzer } = require('../services/riskAnalyzer');

const router = express.Router();

// Get all hedging strategies
router.get('/strategies', async (req, res) => {
  try {
    if (!hedgingService.isInitialized) {
      return res.status(503).json({
        error: 'Service not initialized',
        message: 'Hedging service is still initializing. Please try again later.'
      });
    }

    const strategies = hedgingService.getStrategies();
    
    res.json({
      strategies,
      total: strategies.length
    });

  } catch (error) {
    console.error('Error getting hedging strategies:', error);
    res.status(500).json({
      error: 'Failed to fetch hedging strategies',
      message: error.message
    });
  }
});

// Get specific strategy
router.get('/strategies/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    
    if (!strategyId || isNaN(parseInt(strategyId))) {
      return res.status(400).json({
        error: 'Invalid strategy ID',
        message: 'Strategy ID must be a valid number'
      });
    }

    const strategy = hedgingService.getStrategy(parseInt(strategyId));
    
    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found',
        message: `Strategy with ID ${strategyId} does not exist`
      });
    }

    res.json(strategy);

  } catch (error) {
    console.error(`Error getting strategy ${req.params.strategyId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch strategy',
      message: error.message
    });
  }
});

// Create new hedging strategy (admin only)
router.post('/strategies', async (req, res) => {
  try {
    const { name, riskThreshold, hedgeRatio } = req.body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Strategy name is required and must be a non-empty string'
      });
    }

    if (!riskThreshold || isNaN(parseInt(riskThreshold)) || parseInt(riskThreshold) < 0 || parseInt(riskThreshold) > 10000) {
      return res.status(400).json({
        error: 'Invalid risk threshold',
        message: 'Risk threshold must be a number between 0 and 10000 (basis points)'
      });
    }

    if (!hedgeRatio || isNaN(parseInt(hedgeRatio)) || parseInt(hedgeRatio) < 0 || parseInt(hedgeRatio) > 10000) {
      return res.status(400).json({
        error: 'Invalid hedge ratio',
        message: 'Hedge ratio must be a number between 0 and 10000 (basis points)'
      });
    }

    const txHash = await hedgingService.createStrategy(
      name.trim(),
      parseInt(riskThreshold),
      parseInt(hedgeRatio)
    );

    res.status(201).json({
      message: 'Strategy created successfully',
      transactionHash: txHash,
      strategy: {
        name: name.trim(),
        riskThreshold: parseInt(riskThreshold),
        hedgeRatio: parseInt(hedgeRatio)
      }
    });

  } catch (error) {
    console.error('Error creating hedging strategy:', error);
    
    if (error.message.includes('Signer required')) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Administrative privileges required for strategy creation'
      });
    }

    res.status(500).json({
      error: 'Failed to create strategy',
      message: error.message
    });
  }
});

// Update hedging strategy (admin only)
router.put('/strategies/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const { riskThreshold, hedgeRatio } = req.body;

    if (!strategyId || isNaN(parseInt(strategyId))) {
      return res.status(400).json({
        error: 'Invalid strategy ID'
      });
    }

    // Validate input
    if (riskThreshold !== undefined && (isNaN(parseInt(riskThreshold)) || parseInt(riskThreshold) < 0 || parseInt(riskThreshold) > 10000)) {
      return res.status(400).json({
        error: 'Invalid risk threshold',
        message: 'Risk threshold must be a number between 0 and 10000 (basis points)'
      });
    }

    if (hedgeRatio !== undefined && (isNaN(parseInt(hedgeRatio)) || parseInt(hedgeRatio) < 0 || parseInt(hedgeRatio) > 10000)) {
      return res.status(400).json({
        error: 'Invalid hedge ratio',
        message: 'Hedge ratio must be a number between 0 and 10000 (basis points)'
      });
    }

    const strategy = hedgingService.getStrategy(parseInt(strategyId));
    if (!strategy) {
      return res.status(404).json({
        error: 'Strategy not found'
      });
    }

    const txHash = await hedgingService.updateStrategy(
      parseInt(strategyId),
      parseInt(riskThreshold),
      parseInt(hedgeRatio)
    );

    res.json({
      message: 'Strategy updated successfully',
      transactionHash: txHash,
      strategy: {
        id: parseInt(strategyId),
        riskThreshold: parseInt(riskThreshold),
        hedgeRatio: parseInt(hedgeRatio)
      }
    });

  } catch (error) {
    console.error(`Error updating strategy ${req.params.strategyId}:`, error);
    
    if (error.message.includes('Signer required')) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Administrative privileges required for strategy updates'
      });
    }

    res.status(500).json({
      error: 'Failed to update strategy',
      message: error.message
    });
  }
});

// Get hedging recommendations for a pool
router.get('/recommendations/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    
    if (!poolId || isNaN(parseInt(poolId))) {
      return res.status(400).json({
        error: 'Invalid pool ID'
      });
    }

    const recommendations = await hedgingService.getHedgingRecommendations(parseInt(poolId));
    
    res.json({
      poolId: parseInt(poolId),
      recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error getting hedging recommendations for pool ${req.params.poolId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch hedging recommendations',
      message: error.message
    });
  }
});

// Get active hedge positions
router.get('/positions', async (req, res) => {
  try {
    const { poolId, active = 'true', limit = 50, offset = 0 } = req.query;

    let positions = await hedgingService.getActivePositions();

    // Filter by pool if specified
    if (poolId) {
      positions = positions.filter(pos => pos.poolId === parseInt(poolId));
    }

    // Filter by active status
    if (active !== undefined) {
      const isActive = active === 'true';
      positions = positions.filter(pos => pos.active === isActive);
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPositions = positions.slice(startIndex, endIndex);

    res.json({
      positions: paginatedPositions,
      pagination: {
        total: positions.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasNext: endIndex < positions.length,
        hasPrev: startIndex > 0
      }
    });

  } catch (error) {
    console.error('Error getting hedge positions:', error);
    res.status(500).json({
      error: 'Failed to fetch hedge positions',
      message: error.message
    });
  }
});

// Get hedging analytics
router.get('/analytics', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;

    const analytics = await hedgingService.getHedgingAnalytics(timeframe);
    
    res.json({
      timeframe,
      analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting hedging analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch hedging analytics',
      message: error.message
    });
  }
});

// Execute hedging for a pool (operator only)
router.post('/execute', async (req, res) => {
  try {
    const { poolId, amount } = req.body;

    // Validate input
    if (!poolId || isNaN(parseInt(poolId))) {
      return res.status(400).json({
        error: 'Invalid pool ID',
        message: 'Pool ID must be a valid number'
      });
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number'
      });
    }

    // Convert amount to BigNumber
    const amountWei = ethers.utils.parseEther(amount.toString());

    // Get hedging cost estimate
    const estimatedCost = await hedgingService.estimateHedgingCost(parseInt(poolId), amountWei);

    // Execute hedging
    await hedgingService.executeAutomaticHedge(parseInt(poolId), amountWei);

    res.json({
      message: 'Hedging execution initiated',
      poolId: parseInt(poolId),
      amount: amount.toString(),
      estimatedCost,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error executing hedging:', error);
    
    if (error.message.includes('Signer required') || error.message.includes('Not authorized')) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Operator privileges required for hedging execution'
      });
    }

    res.status(500).json({
      error: 'Failed to execute hedging',
      message: error.message
    });
  }
});

// Get hedging cost estimate
router.post('/estimate-cost', async (req, res) => {
  try {
    const { poolId, amount } = req.body;

    if (!poolId || isNaN(parseInt(poolId))) {
      return res.status(400).json({
        error: 'Invalid pool ID'
      });
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid amount'
      });
    }

    const amountWei = ethers.utils.parseEther(amount.toString());
    const estimatedCost = await hedgingService.estimateHedgingCost(parseInt(poolId), amountWei);

    res.json({
      poolId: parseInt(poolId),
      amount: amount.toString(),
      estimatedCost,
      costPercentage: parseFloat(estimatedCost) / parseFloat(amount) * 100,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error estimating hedging cost:', error);
    res.status(500).json({
      error: 'Failed to estimate hedging cost',
      message: error.message
    });
  }
});

// Get hedging effectiveness analysis
router.get('/effectiveness/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { timeframe = '30d' } = req.query;

    if (!poolId || isNaN(parseInt(poolId))) {
      return res.status(400).json({
        error: 'Invalid pool ID'
      });
    }

    const effectiveness = await riskAnalyzer.analyzeHedgingEffectiveness(parseInt(poolId), timeframe);
    
    res.json({
      poolId: parseInt(poolId),
      timeframe,
      effectiveness,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error getting hedging effectiveness for pool ${req.params.poolId}:`, error);
    res.status(500).json({
      error: 'Failed to analyze hedging effectiveness',
      message: error.message
    });
  }
});

// WebSocket event simulation endpoint (for testing)
router.post('/simulate-event', async (req, res) => {
  try {
    const { eventType, data } = req.body;

    if (!eventType || !data) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'eventType and data are required'
      });
    }

    // Emit event for testing purposes
    hedgingService.emit(eventType, data);

    res.json({
      message: 'Event simulated successfully',
      eventType,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error simulating event:', error);
    res.status(500).json({
      error: 'Failed to simulate event',
      message: error.message
    });
  }
});

// Health check for hedging service
router.get('/health', (req, res) => {
  try {
    const health = {
      hedgingService: hedgingService.isInitialized,
      riskAnalyzer: riskAnalyzer.isInitialized,
      strategies: hedgingService.getStrategies().length,
      cacheStats: {
        hedging: 'N/A', // hedgingService doesn't expose cache stats
        risk: riskAnalyzer.getCacheStats()
      },
      timestamp: new Date().toISOString()
    };

    const statusCode = health.hedgingService && health.riskAnalyzer ? 200 : 503;
    
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Error getting hedging service health:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

module.exports = router;
