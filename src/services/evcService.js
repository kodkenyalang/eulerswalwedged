import { ethers } from 'ethers';

class EVCService {
  constructor() {
    this.baseURL = '/api/evc';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async getCachedData(key, fetchFunction, timeout = this.cacheTimeout) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < timeout) {
      return cached.data;
    }

    try {
      const data = await fetchFunction();
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      console.error(`Error fetching data for key ${key}:`, error);
      throw error;
    }
  }

  async createCrossVaultPosition(
    collateralVault,
    borrowVault,
    collateralAmount,
    borrowAmount,
    poolId,
    provider,
    signer
  ) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }

    try {
      const evcIntegrationAddress = process.env.REACT_APP_EVC_INTEGRATION_ADDRESS;
      if (!evcIntegrationAddress) {
        throw new Error('EVC integration address not configured');
      }

      const evcIntegrationABI = [
        "function createCrossVaultPosition(address collateralVault, address borrowVault, uint256 collateralAmount, uint256 borrowAmount, uint256 poolId) external returns (uint256 positionId)"
      ];

      const evcIntegration = new ethers.Contract(evcIntegrationAddress, evcIntegrationABI, signer);
      
      const tx = await evcIntegration.createCrossVaultPosition(
        collateralVault,
        borrowVault,
        ethers.parseUnits(collateralAmount.toString(), 18),
        ethers.parseUnits(borrowAmount.toString(), 18),
        poolId
      );

      const receipt = await tx.wait();
      
      // Extract position ID from events
      const positionCreatedEvent = receipt.logs.find(
        log => log.topics[0] === ethers.id("CrossVaultPositionCreated(address,uint256,address,address,uint256,uint256)")
      );
      
      let positionId = null;
      if (positionCreatedEvent) {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256', 'address', 'address', 'uint256', 'uint256'],
          positionCreatedEvent.data
        );
        positionId = decoded[0].toString();
      }

      this.invalidateUserCache(await signer.getAddress());

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        positionId
      };
    } catch (error) {
      console.error('Error creating cross-vault position:', error);
      throw error;
    }
  }

  async closeCrossVaultPosition(positionId, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }

    try {
      const evcIntegrationAddress = process.env.REACT_APP_EVC_INTEGRATION_ADDRESS;
      if (!evcIntegrationAddress) {
        throw new Error('EVC integration address not configured');
      }

      const evcIntegrationABI = [
        "function closeCrossVaultPosition(uint256 positionId) external"
      ];

      const evcIntegration = new ethers.Contract(evcIntegrationAddress, evcIntegrationABI, signer);
      
      const tx = await evcIntegration.closeCrossVaultPosition(positionId);
      const receipt = await tx.wait();

      this.invalidateUserCache(await signer.getAddress());

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error closing cross-vault position:', error);
      throw error;
    }
  }

  async getUserCrossVaultPositions(userAddress) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }

    const cacheKey = `cross_vault_positions_${userAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/positions/${userAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch cross-vault positions');
      }
      return result.data;
    }, 15000);
  }

  async getPositionHealth(userAddress, positionId) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }

    const cacheKey = `position_health_${userAddress}_${positionId}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/health/${userAddress}/${positionId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch position health');
      }
      return result.data;
    }, 10000);
  }

  async getLiquidityBridges() {
    return this.getCachedData('liquidity_bridges', async () => {
      const response = await fetch(`${this.baseURL}/bridges`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch liquidity bridges');
      }
      return result.data;
    });
  }

  async enableCollateral(vaultAddress, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!vaultAddress || !ethers.isAddress(vaultAddress)) {
      throw new Error('Invalid vault address');
    }

    try {
      const evcAddress = process.env.REACT_APP_EVC_ADDRESS;
      if (!evcAddress) {
        throw new Error('EVC address not configured');
      }

      const evcABI = [
        "function enableCollateral(address account, address collateral) external"
      ];

      const evc = new ethers.Contract(evcAddress, evcABI, signer);
      const userAddress = await signer.getAddress();
      
      const tx = await evc.enableCollateral(userAddress, vaultAddress);
      const receipt = await tx.wait();

      this.invalidateUserCache(userAddress);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error enabling collateral:', error);
      throw error;
    }
  }

  async enableController(controllerAddress, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!controllerAddress || !ethers.isAddress(controllerAddress)) {
      throw new Error('Invalid controller address');
    }

    try {
      const evcAddress = process.env.REACT_APP_EVC_ADDRESS;
      if (!evcAddress) {
        throw new Error('EVC address not configured');
      }

      const evcABI = [
        "function enableController(address account, address controller) external"
      ];

      const evc = new ethers.Contract(evcAddress, evcABI, signer);
      const userAddress = await signer.getAddress();
      
      const tx = await evc.enableController(userAddress, controllerAddress);
      const receipt = await tx.wait();

      this.invalidateUserCache(userAddress);

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error enabling controller:', error);
      throw error;
    }
  }

  async getEnabledCollaterals(userAddress) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }

    const cacheKey = `enabled_collaterals_${userAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/collaterals/${userAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch enabled collaterals');
      }
      return result.data;
    }, 15000);
  }

  async getEnabledControllers(userAddress) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }

    const cacheKey = `enabled_controllers_${userAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/controllers/${userAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch enabled controllers');
      }
      return result.data;
    }, 15000);
  }

  async executeBatchOperations(batchItems, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!batchItems || !Array.isArray(batchItems)) {
      throw new Error('Invalid batch items');
    }

    try {
      const evcAddress = process.env.REACT_APP_EVC_ADDRESS;
      if (!evcAddress) {
        throw new Error('EVC address not configured');
      }

      const evcABI = [
        "function batch((address targetContract, address onBehalfOfAccount, uint256 value, bytes data)[] calldata items) external payable returns ((bool success, bytes result)[] memory)"
      ];

      const evc = new ethers.Contract(evcAddress, evcABI, signer);
      
      const tx = await evc.batch(batchItems);
      const receipt = await tx.wait();

      this.invalidateUserCache(await signer.getAddress());

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error executing batch operations:', error);
      throw error;
    }
  }

  async getExecutionContext() {
    const response = await fetch(`${this.baseURL}/context`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch execution context');
    }
    return result.data;
  }

  async checkAccountStatus(accountAddress, vaultAddress) {
    if (!accountAddress || !ethers.isAddress(accountAddress)) {
      throw new Error('Invalid account address');
    }
    if (!vaultAddress || !ethers.isAddress(vaultAddress)) {
      throw new Error('Invalid vault address');
    }

    const cacheKey = `account_status_${accountAddress}_${vaultAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/status/account/${accountAddress}/${vaultAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to check account status');
      }
      return result.data;
    }, 10000);
  }

  async liquidatePosition(userAddress, positionId, maxRepayAmount, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }

    try {
      const evcIntegrationAddress = process.env.REACT_APP_EVC_INTEGRATION_ADDRESS;
      if (!evcIntegrationAddress) {
        throw new Error('EVC integration address not configured');
      }

      const evcIntegrationABI = [
        "function liquidatePosition(address user, uint256 positionId, uint256 maxRepayAmount) external"
      ];

      const evcIntegration = new ethers.Contract(evcIntegrationAddress, evcIntegrationABI, signer);
      
      const tx = await evcIntegration.liquidatePosition(
        userAddress,
        positionId,
        ethers.parseUnits(maxRepayAmount.toString(), 18)
      );

      const receipt = await tx.wait();

      this.invalidateUserCache(userAddress);
      this.invalidateUserCache(await signer.getAddress());

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error liquidating position:', error);
      throw error;
    }
  }

  async getCrossVaultAnalytics(timeframe = '7d') {
    const validTimeframes = ['24h', '7d', '30d', '90d'];
    if (!validTimeframes.includes(timeframe)) {
      throw new Error('Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d');
    }

    const cacheKey = `cross_vault_analytics_${timeframe}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/analytics?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch cross-vault analytics');
      }
      return result.data;
    }, 60000);
  }

  invalidateUserCache(userAddress) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(userAddress.toLowerCase())) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  async clearCache() {
    try {
      await fetch(`${this.baseURL}/cache/clear`, { method: 'POST' });
      this.cache.clear();
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.cache.clear();
    }
  }

  async getCacheStats() {
    try {
      const response = await fetch(`${this.baseURL}/cache/stats`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch cache stats');
      }
      return {
        ...result.data,
        localCacheSize: this.cache.size
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { localCacheSize: this.cache.size };
    }
  }

  formatHealthFactor(healthFactor) {
    const factor = parseFloat(healthFactor) / 10000; // Convert from basis points
    if (factor === 0) return 'Liquidated';
    if (factor >= 1000) return '∞';
    return factor.toFixed(2);
  }

  getHealthStatus(healthFactor) {
    const factor = parseFloat(healthFactor) / 10000;
    if (factor < 1) return 'critical';
    if (factor < 1.2) return 'warning';
    return 'healthy';
  }
}

export const evcService = new EVCService();