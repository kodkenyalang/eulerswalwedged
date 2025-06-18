import { ethers } from 'ethers';

class VaultService {
  constructor() {
    this.baseURL = '/api/vaults';
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

  async getAllSupportedAssets() {
    return this.getCachedData('supported_assets', async () => {
      const response = await fetch(`${this.baseURL}/assets`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch supported assets');
      }
      return result.data.assets;
    });
  }

  async getAllActiveVaults() {
    return this.getCachedData('active_vaults', async () => {
      const response = await fetch(`${this.baseURL}/active`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch active vaults');
      }
      return result.data.vaults;
    });
  }

  async getVaultInfo(assetAddress) {
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }

    return this.getCachedData(`vault_info_${assetAddress}`, async () => {
      const response = await fetch(`${this.baseURL}/info/${assetAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch vault information');
      }
      return result.data;
    });
  }

  async getUserPosition(userAddress, assetAddress) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }

    const cacheKey = `user_position_${userAddress}_${assetAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/position/${userAddress}/${assetAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch user position');
      }
      return result.data;
    }, 15000); // Shorter cache for user positions
  }

  async getUserPortfolio(userAddress) {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      throw new Error('Invalid user address');
    }

    const cacheKey = `user_portfolio_${userAddress}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/portfolio/${userAddress}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch user portfolio');
      }
      return result.data;
    }, 15000);
  }

  async getDepositGasEstimate(assetAddress, amount) {
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      throw new Error('Invalid amount');
    }

    const response = await fetch(`${this.baseURL}/gas/deposit/${assetAddress}/${amount}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to estimate gas');
    }
    return result.data.gasEstimate;
  }

  async getWithdrawGasEstimate(assetAddress, shares) {
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }
    if (!shares || isNaN(shares) || Number(shares) <= 0) {
      throw new Error('Invalid shares amount');
    }

    const response = await fetch(`${this.baseURL}/gas/withdraw/${assetAddress}/${shares}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to estimate gas');
    }
    return result.data.gasEstimate;
  }

  async getVaultAnalytics(assetAddress, timeframe = '7d') {
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }

    const validTimeframes = ['24h', '7d', '30d', '90d'];
    if (!validTimeframes.includes(timeframe)) {
      throw new Error('Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d');
    }

    const cacheKey = `vault_analytics_${assetAddress}_${timeframe}`;
    return this.getCachedData(cacheKey, async () => {
      const response = await fetch(`${this.baseURL}/analytics/${assetAddress}?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch vault analytics');
      }
      return result.data;
    }, 60000); // Longer cache for analytics
  }

  async depositToVault(assetAddress, amount, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      throw new Error('Invalid amount');
    }

    try {
      // Get vault manager contract
      const vaultManagerABI = [
        "function deposit(address asset, uint256 amount) external returns (uint256 shares)"
      ];
      
      const vaultManagerAddress = process.env.REACT_APP_VAULT_MANAGER_ADDRESS;
      if (!vaultManagerAddress) {
        throw new Error('Vault manager address not configured');
      }

      const vaultManager = new ethers.Contract(vaultManagerAddress, vaultManagerABI, signer);
      
      // Execute deposit transaction
      const tx = await vaultManager.deposit(assetAddress, ethers.parseUnits(amount.toString(), 18));
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Invalidate relevant cache entries
      this.invalidateUserCache(await signer.getAddress(), assetAddress);
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error depositing to vault:', error);
      throw error;
    }
  }

  async withdrawFromVault(assetAddress, shares, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }
    if (!shares || isNaN(shares) || Number(shares) <= 0) {
      throw new Error('Invalid shares amount');
    }

    try {
      // Get vault manager contract
      const vaultManagerABI = [
        "function withdraw(address asset, uint256 shares) external returns (uint256 assets)"
      ];
      
      const vaultManagerAddress = process.env.REACT_APP_VAULT_MANAGER_ADDRESS;
      if (!vaultManagerAddress) {
        throw new Error('Vault manager address not configured');
      }

      const vaultManager = new ethers.Contract(vaultManagerAddress, vaultManagerABI, signer);
      
      // Execute withdrawal transaction
      const tx = await vaultManager.withdraw(assetAddress, ethers.parseUnits(shares.toString(), 18));
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Invalidate relevant cache entries
      this.invalidateUserCache(await signer.getAddress(), assetAddress);
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error withdrawing from vault:', error);
      throw error;
    }
  }

  async enableCollateral(assetAddress, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }

    try {
      const vaultManagerABI = [
        "function enableCollateral(address asset) external"
      ];
      
      const vaultManagerAddress = process.env.REACT_APP_VAULT_MANAGER_ADDRESS;
      if (!vaultManagerAddress) {
        throw new Error('Vault manager address not configured');
      }

      const vaultManager = new ethers.Contract(vaultManagerAddress, vaultManagerABI, signer);
      
      const tx = await vaultManager.enableCollateral(assetAddress);
      const receipt = await tx.wait();
      
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

  async disableCollateral(assetAddress, provider, signer) {
    if (!provider || !signer) {
      throw new Error('Provider and signer are required');
    }
    if (!assetAddress || !ethers.isAddress(assetAddress)) {
      throw new Error('Invalid asset address');
    }

    try {
      const vaultManagerABI = [
        "function disableCollateral(address asset) external"
      ];
      
      const vaultManagerAddress = process.env.REACT_APP_VAULT_MANAGER_ADDRESS;
      if (!vaultManagerAddress) {
        throw new Error('Vault manager address not configured');
      }

      const vaultManager = new ethers.Contract(vaultManagerAddress, vaultManagerABI, signer);
      
      const tx = await vaultManager.disableCollateral(assetAddress);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error disabling collateral:', error);
      throw error;
    }
  }

  invalidateUserCache(userAddress, assetAddress = null) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(`user_portfolio_${userAddress}`) || 
          key.includes(`user_position_${userAddress}`) ||
          (assetAddress && key.includes(`vault_info_${assetAddress}`))) {
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
      // Clear local cache even if server call fails
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

  formatAmount(amount, decimals = 18) {
    try {
      return ethers.formatUnits(amount.toString(), decimals);
    } catch (error) {
      return '0';
    }
  }

  parseAmount(amount, decimals = 18) {
    try {
      return ethers.parseUnits(amount.toString(), decimals);
    } catch (error) {
      return 0n;
    }
  }
}

export const vaultService = new VaultService();