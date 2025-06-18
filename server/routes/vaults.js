const express = require('express');
const router = express.Router();

// In-memory cache for development (would use Redis in production)
let eulerVaultService = null;

// Initialize service when first route is called
const initializeService = async () => {
  if (!eulerVaultService) {
    const EulerVaultService = require('../services/eulerVaultService');
    eulerVaultService = new EulerVaultService();
    await eulerVaultService.initialize();
  }
  return eulerVaultService;
};

// Get all supported assets
router.get('/assets', async (req, res) => {
  try {
    const service = await initializeService();
    const assets = await service.getAllSupportedAssets();
    
    res.json({
      success: true,
      data: {
        assets,
        count: assets.length
      }
    });
  } catch (error) {
    console.error('Error getting supported assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported assets',
      message: error.message
    });
  }
});

// Get all active vaults
router.get('/active', async (req, res) => {
  try {
    const service = await initializeService();
    const vaults = await service.getAllActiveVaults();
    
    res.json({
      success: true,
      data: {
        vaults,
        count: vaults.length
      }
    });
  } catch (error) {
    console.error('Error getting active vaults:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active vaults',
      message: error.message
    });
  }
});

// Get vault information for a specific asset
router.get('/info/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    
    if (!asset || !/^0x[a-fA-F0-9]{40}$/.test(asset)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset address format'
      });
    }

    const service = await initializeService();
    const vaultInfo = await service.getVaultInfo(asset);
    const apy = await service.getVaultAPY(asset);
    const tvl = await service.getVaultTVL(asset);
    const utilization = await service.getVaultUtilization(asset);
    
    res.json({
      success: true,
      data: {
        ...vaultInfo,
        apy,
        tvl,
        utilization
      }
    });
  } catch (error) {
    console.error('Error getting vault info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vault information',
      message: error.message
    });
  }
});

// Get user position in a vault
router.get('/position/:user/:asset', async (req, res) => {
  try {
    const { user, asset } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    if (!asset || !/^0x[a-fA-F0-9]{40}$/.test(asset)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset address format'
      });
    }

    const service = await initializeService();
    const position = await service.getUserPosition(user, asset);
    const yield_ = await service.getUserYield(user, asset);
    
    res.json({
      success: true,
      data: {
        ...position,
        currentYield: yield_
      }
    });
  } catch (error) {
    console.error('Error getting user position:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user position',
      message: error.message
    });
  }
});

// Get user's total value across all vaults
router.get('/portfolio/:user', async (req, res) => {
  try {
    const { user } = req.params;
    
    if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format'
      });
    }

    const service = await initializeService();
    const totalValue = await service.getUserTotalValue(user);
    const assets = await service.getAllSupportedAssets();
    
    // Get positions for each asset
    const positions = [];
    for (const asset of assets) {
      try {
        const position = await service.getUserPosition(user, asset.address);
        if (position.shares !== '0') {
          const yield_ = await service.getUserYield(user, asset.address);
          positions.push({
            asset: asset.address,
            ...position,
            currentYield: yield_
          });
        }
      } catch (error) {
        console.error(`Error getting position for asset ${asset.address}:`, error);
      }
    }
    
    res.json({
      success: true,
      data: {
        totalValue,
        positions,
        positionCount: positions.length
      }
    });
  } catch (error) {
    console.error('Error getting user portfolio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user portfolio',
      message: error.message
    });
  }
});

// Get gas estimates for deposit
router.get('/gas/deposit/:asset/:amount', async (req, res) => {
  try {
    const { asset, amount } = req.params;
    
    if (!asset || !/^0x[a-fA-F0-9]{40}$/.test(asset)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset address format'
      });
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const service = await initializeService();
    const gasEstimate = await service.estimateDepositGas(asset, amount);
    
    res.json({
      success: true,
      data: {
        gasEstimate,
        operation: 'deposit'
      }
    });
  } catch (error) {
    console.error('Error estimating deposit gas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate gas',
      message: error.message
    });
  }
});

// Get gas estimates for withdrawal
router.get('/gas/withdraw/:asset/:shares', async (req, res) => {
  try {
    const { asset, shares } = req.params;
    
    if (!asset || !/^0x[a-fA-F0-9]{40}$/.test(asset)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset address format'
      });
    }

    if (!shares || isNaN(shares) || Number(shares) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid shares amount'
      });
    }

    const service = await initializeService();
    const gasEstimate = await service.estimateWithdrawGas(asset, shares);
    
    res.json({
      success: true,
      data: {
        gasEstimate,
        operation: 'withdraw'
      }
    });
  } catch (error) {
    console.error('Error estimating withdraw gas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate gas',
      message: error.message
    });
  }
});

// Get vault analytics
router.get('/analytics/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const { timeframe = '7d' } = req.query;
    
    if (!asset || !/^0x[a-fA-F0-9]{40}$/.test(asset)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid asset address format'
      });
    }

    const service = await initializeService();
    const vaultInfo = await service.getVaultInfo(asset);
    const apy = await service.getVaultAPY(asset);
    const tvl = await service.getVaultTVL(asset);
    const utilization = await service.getVaultUtilization(asset);
    
    // Generate historical data (placeholder for now)
    const historicalData = generateHistoricalData(timeframe, {
      tvl: parseFloat(tvl) || 0,
      apy: parseFloat(apy) || 0,
      utilization: parseFloat(utilization) || 0
    });
    
    res.json({
      success: true,
      data: {
        current: {
          tvl,
          apy,
          utilization,
          totalShares: vaultInfo.totalShares,
          isActive: vaultInfo.isActive
        },
        historical: historicalData,
        timeframe
      }
    });
  } catch (error) {
    console.error('Error getting vault analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vault analytics',
      message: error.message
    });
  }
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
  try {
    if (eulerVaultService) {
      eulerVaultService.clearCache();
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
    const stats = eulerVaultService ? eulerVaultService.getCacheStats() : { size: 0, supportedAssets: 0, activeVaults: 0 };
    
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

// Helper function to generate historical data
function generateHistoricalData(timeframe, currentMetrics) {
  const periods = {
    '24h': { points: 24, interval: 'hour' },
    '7d': { points: 7, interval: 'day' },
    '30d': { points: 30, interval: 'day' },
    '90d': { points: 90, interval: 'day' }
  };

  const config = periods[timeframe] || periods['7d'];
  const data = [];
  const now = Date.now();

  for (let i = config.points - 1; i >= 0; i--) {
    const timestamp = now - (i * (config.interval === 'hour' ? 3600000 : 86400000));
    
    // Generate realistic variations
    const tvlVariation = 0.95 + (Math.random() * 0.1); // ±5% variation
    const apyVariation = 0.9 + (Math.random() * 0.2); // ±10% variation
    const utilizationVariation = 0.8 + (Math.random() * 0.4); // ±20% variation

    data.push({
      timestamp,
      tvl: (currentMetrics.tvl * tvlVariation).toFixed(2),
      apy: (currentMetrics.apy * apyVariation).toFixed(2),
      utilization: Math.min(100, currentMetrics.utilization * utilizationVariation).toFixed(2)
    });
  }

  return data;
}

module.exports = router;