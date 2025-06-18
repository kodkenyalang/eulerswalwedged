const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

// In-memory cache for development (would use Redis in production)
let evcService = null;

// Initialize service when first route is called
const initializeService = async () => {
  if (!evcService) {
    const EVCService = require('../services/evcService');
    evcService = new EVCService();
    await evcService.initialize();
  }
  return evcService;
};

// Get user's cross-vault positions
router.get('/positions/:user', async (req, res) => {
  try {
    const { user } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    const service = await initializeService();
    const positions = await service.getUserCrossVaultPositions(user);
    
    res.json({
      success: true,
      data: {
        positions,
        count: positions.length
      }
    });
  } catch (error) {
    console.error('Error getting cross-vault positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cross-vault positions',
      message: error.message
    });
  }
});

// Get position health factor
router.get('/health/:user/:positionId', async (req, res) => {
  try {
    const { user, positionId } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    if (!positionId || isNaN(positionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid position ID'
      });
    }

    const service = await initializeService();
    const healthData = await service.getPositionHealth(user, positionId);
    
    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    console.error('Error getting position health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch position health',
      message: error.message
    });
  }
});

// Get liquidity bridges
router.get('/bridges', async (req, res) => {
  try {
    const service = await initializeService();
    const bridges = await service.getLiquidityBridges();
    
    res.json({
      success: true,
      data: {
        bridges,
        count: bridges.length
      }
    });
  } catch (error) {
    console.error('Error getting liquidity bridges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidity bridges',
      message: error.message
    });
  }
});

// Get enabled collaterals for user
router.get('/collaterals/:user', async (req, res) => {
  try {
    const { user } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    const service = await initializeService();
    const collaterals = await service.getEnabledCollaterals(user);
    
    res.json({
      success: true,
      data: {
        collaterals,
        count: collaterals.length
      }
    });
  } catch (error) {
    console.error('Error getting enabled collaterals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enabled collaterals',
      message: error.message
    });
  }
});

// Get enabled controllers for user
router.get('/controllers/:user', async (req, res) => {
  try {
    const { user } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    const service = await initializeService();
    const controllers = await service.getEnabledControllers(user);
    
    res.json({
      success: true,
      data: {
        controllers,
        count: controllers.length
      }
    });
  } catch (error) {
    console.error('Error getting enabled controllers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enabled controllers',
      message: error.message
    });
  }
});

// Get EVC execution context
router.get('/context', async (req, res) => {
  try {
    const service = await initializeService();
    const context = await service.getExecutionContext();
    
    res.json({
      success: true,
      data: {
        context,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting execution context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch execution context',
      message: error.message
    });
  }
});

// Check account status
router.get('/status/account/:account/:vault', async (req, res) => {
  try {
    const { account, vault } = req.params;
    
    if (!account || !/^0x[a-fA-F0-9]{40}$/.test(account)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account address format'
      });
    }

    if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vault address format'
      });
    }

    const service = await initializeService();
    const status = await service.checkAccountStatus(account, vault);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error checking account status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check account status',
      message: error.message
    });
  }
});

// Get cross-vault analytics
router.get('/analytics', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    const validTimeframes = ['24h', '7d', '30d', '90d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d'
      });
    }

    const service = await initializeService();
    const analytics = await service.getCrossVaultAnalytics(timeframe);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting cross-vault analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cross-vault analytics',
      message: error.message
    });
  }
});

// Get liquidation opportunities
router.get('/liquidations', async (req, res) => {
  try {
    const service = await initializeService();
    const liquidations = await service.getLiquidationOpportunities();
    
    res.json({
      success: true,
      data: {
        liquidations,
        count: liquidations.length
      }
    });
  } catch (error) {
    console.error('Error getting liquidation opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidation opportunities',
      message: error.message
    });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    if (evcService) {
      evcService.clearCache();
    }
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// Get cache statistics
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = evcService ? evcService.getCacheStats() : { 
      size: 0, 
      crossVaultPositions: 0, 
      liquidityBridges: 0 
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics',
      message: error.message
    });
  }
});

module.exports = router;