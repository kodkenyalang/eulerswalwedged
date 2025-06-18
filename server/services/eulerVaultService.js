const { EventEmitter } = require('events');
const { ethers } = require('ethers');

class EulerVaultService extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.vaultManager = null;
    this.vaultFactory = null;
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    this.supportedAssets = new Map();
    this.activeVaults = new Map();
  }

  async initialize() {
    try {
      console.log('Initializing Euler Vault Service...');
      
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      await this.initializeContracts();
      await this.loadSupportedAssets();
      await this.loadActiveVaults();
      
      this.startMonitoring();
      
      console.log('Euler Vault Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize Euler Vault Service:', error);
      this.emit('error', error);
    }
  }

  async initializeContracts() {
    const vaultManagerABI = [
      "function getSupportedAssets() external view returns (address[] memory)",
      "function getActiveVaults() external view returns (address[] memory)",
      "function getVaultInfo(address asset) external view returns (tuple(address vault, address asset, uint256 totalDeposited, uint256 totalShares, bool isActive, uint256 createdAt))",
      "function getUserPosition(address user, address asset) external view returns (tuple(uint256 shares, uint256 depositedAmount, uint256 lastUpdateTime, uint256 accruedRewards))",
      "function deposit(address asset, uint256 amount) external returns (uint256 shares)",
      "function withdraw(address asset, uint256 shares) external returns (uint256 assets)",
      "function calculateYield(address user, address asset) external view returns (uint256 yield)",
      "function getUserTotalValue(address user) external view returns (uint256 totalValue)"
    ];

    const vaultFactoryABI = [
      "function getVault(address asset) external view returns (address vault)",
      "function getAllVaults() external view returns (address[] memory)",
      "function getVaultCount() external view returns (uint256 count)",
      "function isValidVault(address vault) external view returns (bool isValid)",
      "function createVault(address asset, address unitOfAccount, string calldata name, string calldata symbol) external returns (address vault)"
    ];

    const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000';
    const vaultFactoryAddress = process.env.VAULT_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';

    this.vaultManager = new ethers.Contract(vaultManagerAddress, vaultManagerABI, this.provider);
    this.vaultFactory = new ethers.Contract(vaultFactoryAddress, vaultFactoryABI, this.provider);
  }

  async loadSupportedAssets() {
    try {
      const assets = await this.vaultManager.getSupportedAssets();
      
      for (const asset of assets) {
        const vaultInfo = await this.vaultManager.getVaultInfo(asset);
        this.supportedAssets.set(asset.toLowerCase(), {
          address: asset,
          vault: vaultInfo.vault,
          totalDeposited: vaultInfo.totalDeposited.toString(),
          totalShares: vaultInfo.totalShares.toString(),
          isActive: vaultInfo.isActive,
          createdAt: Number(vaultInfo.createdAt)
        });
      }

      console.log(`Loaded ${this.supportedAssets.size} supported assets`);
    } catch (error) {
      console.error('Error loading supported assets:', error);
    }
  }

  async loadActiveVaults() {
    try {
      const vaults = await this.vaultManager.getActiveVaults();
      
      for (const vault of vaults) {
        // Get vault details through factory
        const isValid = await this.vaultFactory.isValidVault(vault);
        if (isValid) {
          this.activeVaults.set(vault.toLowerCase(), {
            address: vault,
            isActive: true,
            lastUpdate: Date.now()
          });
        }
      }

      console.log(`Loaded ${this.activeVaults.size} active vaults`);
    } catch (error) {
      console.error('Error loading active vaults:', error);
    }
  }

  startMonitoring() {
    // Monitor vault events every 30 seconds
    setInterval(async () => {
      try {
        await this.updateVaultMetrics();
      } catch (error) {
        console.error('Error monitoring vaults:', error);
      }
    }, 30000);
  }

  async updateVaultMetrics() {
    for (const [assetAddress, assetInfo] of this.supportedAssets) {
      try {
        const vaultInfo = await this.vaultManager.getVaultInfo(assetAddress);
        
        // Update cached information
        this.supportedAssets.set(assetAddress, {
          ...assetInfo,
          totalDeposited: vaultInfo.totalDeposited.toString(),
          totalShares: vaultInfo.totalShares.toString(),
          lastUpdate: Date.now()
        });

        this.emit('vaultUpdated', assetAddress, vaultInfo);
      } catch (error) {
        console.error(`Error updating vault metrics for ${assetAddress}:`, error);
      }
    }
  }

  async getVaultInfo(assetAddress) {
    const cacheKey = `vault_info_${assetAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const vaultInfo = await this.vaultManager.getVaultInfo(assetAddress);
      const result = {
        vault: vaultInfo.vault,
        asset: vaultInfo.asset,
        totalDeposited: vaultInfo.totalDeposited.toString(),
        totalShares: vaultInfo.totalShares.toString(),
        isActive: vaultInfo.isActive,
        createdAt: Number(vaultInfo.createdAt)
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error getting vault info:', error);
      throw error;
    }
  }

  async getUserPosition(userAddress, assetAddress) {
    const cacheKey = `user_position_${userAddress.toLowerCase()}_${assetAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const position = await this.vaultManager.getUserPosition(userAddress, assetAddress);
      const result = {
        shares: position.shares.toString(),
        depositedAmount: position.depositedAmount.toString(),
        lastUpdateTime: Number(position.lastUpdateTime),
        accruedRewards: position.accruedRewards.toString()
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error getting user position:', error);
      throw error;
    }
  }

  async getUserYield(userAddress, assetAddress) {
    try {
      const yield_ = await this.vaultManager.calculateYield(userAddress, assetAddress);
      return yield_.toString();
    } catch (error) {
      console.error('Error calculating user yield:', error);
      return '0';
    }
  }

  async getUserTotalValue(userAddress) {
    const cacheKey = `user_total_value_${userAddress.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const totalValue = await this.vaultManager.getUserTotalValue(userAddress);
      const result = totalValue.toString();

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error getting user total value:', error);
      return '0';
    }
  }

  async getAllSupportedAssets() {
    return Array.from(this.supportedAssets.values());
  }

  async getAllActiveVaults() {
    return Array.from(this.activeVaults.values());
  }

  async getVaultAPY(assetAddress) {
    try {
      // Calculate APY based on vault performance
      // This would require historical data and proper calculation
      // For now, return a placeholder calculation
      const vaultInfo = await this.getVaultInfo(assetAddress);
      
      if (!vaultInfo.totalDeposited || vaultInfo.totalDeposited === '0') {
        return '0';
      }

      // Simplified APY calculation (would need proper implementation)
      return '5.25'; // 5.25% APY placeholder
    } catch (error) {
      console.error('Error calculating vault APY:', error);
      return '0';
    }
  }

  async getVaultTVL(assetAddress) {
    try {
      const vaultInfo = await this.getVaultInfo(assetAddress);
      return vaultInfo.totalDeposited;
    } catch (error) {
      console.error('Error getting vault TVL:', error);
      return '0';
    }
  }

  async getVaultUtilization(assetAddress) {
    try {
      // Get vault utilization ratio
      // This would require borrowing data from the vault
      return '0'; // Placeholder
    } catch (error) {
      console.error('Error getting vault utilization:', error);
      return '0';
    }
  }

  async estimateDepositGas(assetAddress, amount) {
    try {
      const gasEstimate = await this.vaultManager.deposit.estimateGas(assetAddress, amount);
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating deposit gas:', error);
      return '100000'; // Default gas estimate
    }
  }

  async estimateWithdrawGas(assetAddress, shares) {
    try {
      const gasEstimate = await this.vaultManager.withdraw.estimateGas(assetAddress, shares);
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating withdraw gas:', error);
      return '120000'; // Default gas estimate
    }
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      supportedAssets: this.supportedAssets.size,
      activeVaults: this.activeVaults.size
    };
  }
}

module.exports = EulerVaultService;