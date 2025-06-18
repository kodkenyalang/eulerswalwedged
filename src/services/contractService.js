import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS } from '../utils/constants';

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
  }

  initialize(provider, signer) {
    this.provider = provider;
    this.signer = signer;
    this.initializeContracts();
  }

  initializeContracts() {
    if (!this.signer || !CONTRACT_ADDRESSES) return;

    try {
      // Initialize all contract instances
      this.contracts.wedgedPool = new ethers.Contract(
        CONTRACT_ADDRESSES.WEDGED_POOL,
        ABIS.WEDGED_POOL,
        this.signer
      );

      this.contracts.hedgingManager = new ethers.Contract(
        CONTRACT_ADDRESSES.HEDGING_MANAGER,
        ABIS.HEDGING_MANAGER,
        this.signer
      );

      this.contracts.riskCalculator = new ethers.Contract(
        CONTRACT_ADDRESSES.RISK_CALCULATOR,
        ABIS.RISK_CALCULATOR,
        this.signer
      );

      this.contracts.eulerSwapIntegration = new ethers.Contract(
        CONTRACT_ADDRESSES.EULER_SWAP_INTEGRATION,
        ABIS.EULER_SWAP_INTEGRATION,
        this.signer
      );
    } catch (error) {
      console.error('Error initializing contracts:', error);
    }
  }

  // Pool Management Methods
  async getAllPools() {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const totalPools = await contract.totalPools();
      const pools = [];

      for (let i = 1; i <= totalPools.toNumber(); i++) {
        try {
          const poolInfo = await contract.getPoolInfo(i);
          pools.push({
            id: poolInfo.id.toString(),
            token0: poolInfo.token0,
            token1: poolInfo.token1,
            totalDeposits: poolInfo.totalDeposits,
            availableLiquidity: poolInfo.availableLiquidity,
            hedgedAmount: poolInfo.hedgedAmount,
            riskScore: poolInfo.riskScore.toNumber(),
            active: poolInfo.active
          });
        } catch (error) {
          console.warn(`Error fetching pool ${i}:`, error);
        }
      }

      return pools;
    } catch (error) {
      console.error('Error getting all pools:', error);
      throw new Error('Failed to fetch pools: ' + error.message);
    }
  }

  async getPoolInfo(poolId) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const poolInfo = await contract.getPoolInfo(poolId);
      return {
        id: poolInfo.id.toString(),
        token0: poolInfo.token0,
        token1: poolInfo.token1,
        totalDeposits: poolInfo.totalDeposits,
        availableLiquidity: poolInfo.availableLiquidity,
        hedgedAmount: poolInfo.hedgedAmount,
        riskScore: poolInfo.riskScore.toNumber(),
        active: poolInfo.active
      };
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw new Error('Failed to fetch pool info: ' + error.message);
    }
  }

  async getUserPools(userAddress) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const userPools = await contract.getUserPools(userAddress);
      return userPools.map(poolId => poolId.toString());
    } catch (error) {
      console.error('Error getting user pools:', error);
      throw new Error('Failed to fetch user pools: ' + error.message);
    }
  }

  async getUserDeposit(poolId, userAddress) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const deposit = await contract.getUserDeposit(poolId, userAddress);
      return deposit;
    } catch (error) {
      console.error('Error getting user deposit:', error);
      return 0n;
    }
  }

  async getUserRewards(poolId, userAddress) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const rewards = await contract.getUserRewards(poolId, userAddress);
      return rewards;
    } catch (error) {
      console.error('Error getting user rewards:', error);
      return 0n;
    }
  }

  // Transaction Methods
  async deposit(poolId, amount, tokenAddress) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      // First approve token spending if needed
      await this.approveTokenIfNeeded(tokenAddress, CONTRACT_ADDRESSES.WEDGED_POOL, amount);

      const tx = await contract.deposit(poolId, amount, {
        gasLimit: 300000
      });

      return tx;
    } catch (error) {
      console.error('Error depositing:', error);
      throw new Error('Deposit failed: ' + error.message);
    }
  }

  async withdraw(poolId, amount) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const tx = await contract.withdraw(poolId, amount, {
        gasLimit: 250000
      });

      return tx;
    } catch (error) {
      console.error('Error withdrawing:', error);
      throw new Error('Withdrawal failed: ' + error.message);
    }
  }

  async emergencyWithdraw(poolId) {
    try {
      const contract = this.contracts.wedgedPool;
      if (!contract) throw new Error('WedgedPool contract not initialized');

      const tx = await contract.emergencyWithdraw(poolId, {
        gasLimit: 200000
      });

      return tx;
    } catch (error) {
      console.error('Error with emergency withdrawal:', error);
      throw new Error('Emergency withdrawal failed: ' + error.message);
    }
  }

  // Token Methods
  async getTokenBalance(tokenAddress, userAddress) {
    try {
      if (!this.provider) throw new Error('Provider not initialized');

      // ERC20 ABI for balance checking
      const erc20Abi = [
        'function balanceOf(address account) external view returns (uint256)',
        'function symbol() external view returns (string)',
        'function decimals() external view returns (uint8)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await tokenContract.balanceOf(userAddress);
      return balance;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0n;
    }
  }

  async getTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
    try {
      if (!this.provider) throw new Error('Provider not initialized');

      const erc20Abi = [
        'function allowance(address owner, address spender) external view returns (uint256)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
      return allowance;
    } catch (error) {
      console.error('Error getting token allowance:', error);
      return 0n;
    }
  }

  async approveToken(tokenAddress, spenderAddress, amount) {
    try {
      if (!this.signer) throw new Error('Signer not initialized');

      const erc20Abi = [
        'function approve(address spender, uint256 amount) external returns (bool)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.signer);
      const tx = await tokenContract.approve(spenderAddress, amount, {
        gasLimit: 100000
      });

      return tx;
    } catch (error) {
      console.error('Error approving token:', error);
      throw new Error('Token approval failed: ' + error.message);
    }
  }

  async approveTokenIfNeeded(tokenAddress, spenderAddress, amount) {
    try {
      const userAddress = await this.signer.getAddress();
      const currentAllowance = await this.getTokenAllowance(tokenAddress, userAddress, spenderAddress);

      if (currentAllowance.lt(amount)) {
        const approveTx = await this.approveToken(tokenAddress, spenderAddress, amount);
        await approveTx.wait();
      }
    } catch (error) {
      console.error('Error checking/approving token:', error);
      throw error;
    }
  }

  // Risk Calculator Methods
  async getPoolRiskMetrics(poolId) {
    try {
      const contract = this.contracts.riskCalculator;
      if (!contract) throw new Error('RiskCalculator contract not initialized');

      const metrics = await contract.getPoolRiskMetrics(poolId);
      return {
        volatility: metrics.volatility.toNumber(),
        impermanentLoss: metrics.impermanentLoss.toNumber(),
        correlationRisk: metrics.correlationRisk.toNumber(),
        liquidityRisk: metrics.liquidityRisk.toNumber(),
        compositeRisk: metrics.compositeRisk.toNumber()
      };
    } catch (error) {
      console.error('Error getting risk metrics:', error);
      throw new Error('Failed to fetch risk metrics: ' + error.message);
    }
  }

  async calculateImpermanentLoss(token0, token1, amount) {
    try {
      const contract = this.contracts.riskCalculator;
      if (!contract) throw new Error('RiskCalculator contract not initialized');

      const loss = await contract.calculateImpermanentLoss(token0, token1, amount);
      return loss;
    } catch (error) {
      console.error('Error calculating impermanent loss:', error);
      return 0n;
    }
  }

  // Hedging Manager Methods
  async getHedgingStrategies() {
    try {
      const contract = this.contracts.hedgingManager;
      if (!contract) throw new Error('HedgingManager contract not initialized');

      const strategies = [];
      // Fetch strategies (assuming there's a way to get total strategies)
      // This would need to be implemented based on actual contract methods
      for (let i = 1; i <= 10; i++) {
        try {
          const strategy = await contract.getStrategy(i);
          if (strategy.active) {
            strategies.push({
              id: strategy.id.toString(),
              name: strategy.name,
              riskThreshold: strategy.riskThreshold.toNumber(),
              hedgeRatio: strategy.hedgeRatio.toNumber(),
              active: strategy.active
            });
          }
        } catch (error) {
          // Strategy doesn't exist, break the loop
          break;
        }
      }

      return strategies;
    } catch (error) {
      console.error('Error getting hedging strategies:', error);
      throw new Error('Failed to fetch hedging strategies: ' + error.message);
    }
  }

  async getHedgePosition(positionId) {
    try {
      const contract = this.contracts.hedgingManager;
      if (!contract) throw new Error('HedgingManager contract not initialized');

      const position = await contract.getHedgePosition(positionId);
      return {
        poolId: position.poolId.toString(),
        token0: position.token0,
        token1: position.token1,
        originalAmount: position.originalAmount,
        hedgedAmount: position.hedgedAmount,
        timestamp: position.timestamp.toNumber(),
        active: position.active
      };
    } catch (error) {
      console.error('Error getting hedge position:', error);
      throw new Error('Failed to fetch hedge position: ' + error.message);
    }
  }

  // EulerSwap Integration Methods
  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    try {
      const contract = this.contracts.eulerSwapIntegration;
      if (!contract) throw new Error('EulerSwapIntegration contract not initialized');

      const quote = await contract.getSwapQuote(tokenIn, tokenOut, amountIn);
      return quote;
    } catch (error) {
      console.error('Error getting swap quote:', error);
      return 0n;
    }
  }

  async getPrice(token0, token1) {
    try {
      const contract = this.contracts.eulerSwapIntegration;
      if (!contract) throw new Error('EulerSwapIntegration contract not initialized');

      const price = await contract.getPrice(token0, token1);
      return price;
    } catch (error) {
      console.error('Error getting price:', error);
      return 0n;
    }
  }

  // Utility Methods
  getWedgedPoolAddress() {
    return CONTRACT_ADDRESSES.WEDGED_POOL;
  }

  getHedgingManagerAddress() {
    return CONTRACT_ADDRESSES.HEDGING_MANAGER;
  }

  async estimateGas(contractMethod, ...args) {
    try {
      const gasEstimate = await contractMethod.estimateGas(...args);
      return gasEstimate;
    } catch (error) {
      console.error('Error estimating gas:', error);
      return 300000n; // Default gas limit
    }
  }

  async getCurrentGasPrice() {
    try {
      if (!this.provider) throw new Error('Provider not initialized');
      return await this.provider.getGasPrice();
    } catch (error) {
      console.error('Error getting gas price:', error);
      return ethers.parseUnits('20', 'gwei'); // Default gas price
    }
  }
}

export const contractService = new ContractService();
