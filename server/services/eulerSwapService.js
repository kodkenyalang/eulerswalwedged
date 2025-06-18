const { ethers } = require('ethers');
const { EventEmitter } = require('events');

class EulerSwapService extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.contracts = {};
    this.poolRegistry = new Map();
    this.priceCache = new Map();
    this.liquidityCache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds for price data
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize blockchain connection
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Initialize contracts
      await this.initializeContracts();
      
      // Load existing pools
      await this.loadPoolRegistry();
      
      // Start monitoring
      this.startMonitoring();
      
      this.isInitialized = true;
      console.log('EulerSwapService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize EulerSwapService:', error);
      throw error;
    }
  }

  async initializeContracts() {
    if (!this.provider) throw new Error('Provider not initialized');

    const contractAddresses = {
      eulerSwapIntegration: process.env.EULER_SWAP_INTEGRATION_ADDRESS,
      eulerFactory: process.env.EULER_FACTORY_ADDRESS,
      eulerRouter: process.env.EULER_ROUTER_ADDRESS
    };

    const abis = {
      eulerSwapIntegration: [
        'function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut)',
        'function addLiquidity(address token0, address token1, uint256 amount0, uint256 amount1) external returns (uint256 liquidity)',
        'function removeLiquidity(address token0, address token1, uint256 liquidity) external returns (uint256 amount0, uint256 amount1)',
        'function getPrice(address token0, address token1) external view returns (uint256)',
        'function getSwapQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
        'function getPoolInfo(address token0, address token1) external view returns (tuple(address pool, address token0, address token1, uint24 fee, uint256 reserve0, uint256 reserve1, uint256 totalSupply))',
        'function createPool(address token0, address token1) external returns (address pool)',
        'function getPool(address token0, address token1) external view returns (address)',
        'event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address recipient)',
        'event LiquidityAdded(address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity)',
        'event PoolRegistered(address indexed token0, address indexed token1, address pool)'
      ],
      eulerFactory: [
        'function createPool(address token0, address token1, uint24 fee) external returns (address pool)',
        'function getPool(address token0, address token1, uint24 fee) external view returns (address pool)',
        'function pools(uint256 index) external view returns (address pool)',
        'function poolsLength() external view returns (uint256)'
      ],
      eulerRouter: [
        'function swapExactInputSingle(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
        'function addLiquidity(address token0, address token1, uint24 fee, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient) external returns (uint256 amount0, uint256 amount1, uint256 liquidity)'
      ]
    };

    for (const [name, address] of Object.entries(contractAddresses)) {
      if (address && abis[name]) {
        this.contracts[name] = new ethers.Contract(address, abis[name], this.provider);
      }
    }
  }

  async loadPoolRegistry() {
    try {
      if (!this.contracts.eulerSwapIntegration) return;

      // Load pools from factory if available
      if (this.contracts.eulerFactory) {
        try {
          const poolsLength = await this.contracts.eulerFactory.poolsLength();
          
          for (let i = 0; i < poolsLength.toNumber(); i++) {
            try {
              const poolAddress = await this.contracts.eulerFactory.pools(i);
              await this.registerPool(poolAddress);
            } catch (error) {
              console.warn(`Error loading pool ${i}:`, error.message);
            }
          }
        } catch (error) {
          console.warn('Error loading pools from factory:', error.message);
        }
      }

      console.log(`Loaded ${this.poolRegistry.size} pools`);
    } catch (error) {
      console.error('Error loading pool registry:', error);
    }
  }

  async registerPool(poolAddress) {
    try {
      // Get pool info from ERC20 interface
      const poolAbi = [
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
        'function fee() external view returns (uint24)',
        'function getReserves() external view returns (uint256 reserve0, uint256 reserve1)'
      ];

      const poolContract = new ethers.Contract(poolAddress, poolAbi, this.provider);
      
      const [token0, token1, fee] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee ? poolContract.fee() : 3000 // Default fee
      ]);

      const poolKey = this.getPoolKey(token0, token1);
      this.poolRegistry.set(poolKey, {
        address: poolAddress,
        token0,
        token1,
        fee: fee.toString(),
        contract: poolContract
      });

    } catch (error) {
      console.warn(`Failed to register pool ${poolAddress}:`, error.message);
    }
  }

  getPoolKey(token0, token1) {
    // Normalize token order for consistent key generation
    const [tokenA, tokenB] = token0.toLowerCase() < token1.toLowerCase() 
      ? [token0, token1] 
      : [token1, token0];
    return `${tokenA}-${tokenB}`;
  }

  startMonitoring() {
    if (!this.contracts.eulerSwapIntegration) return;

    // Monitor swap events
    this.contracts.eulerSwapIntegration.on('SwapExecuted', async (tokenIn, tokenOut, amountIn, amountOut, recipient, event) => {
      try {
        this.emit('swap-executed', {
          tokenIn,
          tokenOut,
          amountIn: ethers.utils.formatEther(amountIn),
          amountOut: ethers.utils.formatEther(amountOut),
          recipient,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });

        // Invalidate price cache for affected tokens
        this.invalidatePriceCache(tokenIn, tokenOut);
      } catch (error) {
        console.error('Error processing swap event:', error);
      }
    });

    // Monitor liquidity events
    this.contracts.eulerSwapIntegration.on('LiquidityAdded', async (token0, token1, amount0, amount1, liquidity, event) => {
      try {
        this.emit('liquidity-added', {
          token0,
          token1,
          amount0: ethers.utils.formatEther(amount0),
          amount1: ethers.utils.formatEther(amount1),
          liquidity: ethers.utils.formatEther(liquidity),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });

        // Invalidate caches
        this.invalidateLiquidityCache(token0, token1);
        this.invalidatePriceCache(token0, token1);
      } catch (error) {
        console.error('Error processing liquidity event:', error);
      }
    });

    // Monitor new pool creation
    this.contracts.eulerSwapIntegration.on('PoolRegistered', async (token0, token1, pool, event) => {
      try {
        await this.registerPool(pool);
        
        this.emit('pool-created', {
          token0,
          token1,
          poolAddress: pool,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });
      } catch (error) {
        console.error('Error processing pool creation event:', error);
      }
    });

    console.log('Started monitoring EulerSwap events');
  }

  async getPrice(token0, token1) {
    try {
      const cacheKey = `price-${token0}-${token1}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      let price = ethers.BigNumber.from(0);

      if (this.contracts.eulerSwapIntegration) {
        try {
          price = await this.contracts.eulerSwapIntegration.getPrice(token0, token1);
        } catch (error) {
          console.warn(`Contract price fetch failed for ${token0}/${token1}:`, error.message);
          price = await this.calculatePriceFromPool(token0, token1);
        }
      } else {
        price = await this.calculatePriceFromPool(token0, token1);
      }

      // Cache the price
      this.priceCache.set(cacheKey, {
        data: price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.error(`Error getting price for ${token0}/${token1}:`, error);
      return ethers.BigNumber.from(0);
    }
  }

  async calculatePriceFromPool(token0, token1) {
    try {
      const poolKey = this.getPoolKey(token0, token1);
      const pool = this.poolRegistry.get(poolKey);
      
      if (!pool) {
        return ethers.BigNumber.from(0);
      }

      const reserves = await pool.contract.getReserves();
      const [reserve0, reserve1] = reserves;

      if (reserve0.isZero() || reserve1.isZero()) {
        return ethers.BigNumber.from(0);
      }

      // Determine which token is token0 in the pool
      const isToken0First = pool.token0.toLowerCase() === token0.toLowerCase();
      
      if (isToken0First) {
        // price = reserve1 / reserve0
        return reserve1.mul(ethers.utils.parseEther('1')).div(reserve0);
      } else {
        // price = reserve0 / reserve1
        return reserve0.mul(ethers.utils.parseEther('1')).div(reserve1);
      }
    } catch (error) {
      console.error('Error calculating price from pool:', error);
      return ethers.BigNumber.from(0);
    }
  }

  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    try {
      if (!this.contracts.eulerSwapIntegration || amountIn.isZero()) {
        return ethers.BigNumber.from(0);
      }

      const quote = await this.contracts.eulerSwapIntegration.getSwapQuote(tokenIn, tokenOut, amountIn);
      return quote;
    } catch (error) {
      console.error(`Error getting swap quote for ${tokenIn}/${tokenOut}:`, error);
      
      // Fallback: estimate using price
      try {
        const price = await this.getPrice(tokenIn, tokenOut);
        return amountIn.mul(price).div(ethers.utils.parseEther('1'));
      } catch (fallbackError) {
        console.error('Fallback quote calculation failed:', fallbackError);
        return ethers.BigNumber.from(0);
      }
    }
  }

  async getPoolInfo(token0, token1) {
    try {
      const cacheKey = `pool-info-${token0}-${token1}`;
      const cached = this.liquidityCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      let poolInfo = null;

      if (this.contracts.eulerSwapIntegration) {
        try {
          poolInfo = await this.contracts.eulerSwapIntegration.getPoolInfo(token0, token1);
        } catch (error) {
          console.warn(`Contract pool info fetch failed for ${token0}/${token1}:`, error.message);
          poolInfo = await this.getPoolInfoFromRegistry(token0, token1);
        }
      } else {
        poolInfo = await this.getPoolInfoFromRegistry(token0, token1);
      }

      if (poolInfo) {
        this.liquidityCache.set(cacheKey, {
          data: poolInfo,
          timestamp: Date.now()
        });
      }

      return poolInfo;
    } catch (error) {
      console.error(`Error getting pool info for ${token0}/${token1}:`, error);
      return null;
    }
  }

  async getPoolInfoFromRegistry(token0, token1) {
    try {
      const poolKey = this.getPoolKey(token0, token1);
      const pool = this.poolRegistry.get(poolKey);
      
      if (!pool) {
        return null;
      }

      const [reserves, totalSupply] = await Promise.all([
        pool.contract.getReserves(),
        pool.contract.totalSupply ? pool.contract.totalSupply() : ethers.BigNumber.from(0)
      ]);

      return {
        pool: pool.address,
        token0: pool.token0,
        token1: pool.token1,
        fee: pool.fee,
        reserve0: reserves[0],
        reserve1: reserves[1],
        totalSupply
      };
    } catch (error) {
      console.error('Error getting pool info from registry:', error);
      return null;
    }
  }

  async getAllPools() {
    const pools = [];
    
    for (const [poolKey, pool] of this.poolRegistry) {
      try {
        const poolInfo = await this.getPoolInfoFromRegistry(pool.token0, pool.token1);
        if (poolInfo) {
          pools.push({
            key: poolKey,
            ...poolInfo,
            tvl: this.calculateTVL(poolInfo),
            apr: await this.estimateAPR(pool.token0, pool.token1)
          });
        }
      } catch (error) {
        console.warn(`Error getting info for pool ${poolKey}:`, error.message);
      }
    }

    return pools;
  }

  calculateTVL(poolInfo) {
    try {
      // Simplified TVL calculation - would need token prices for accurate calculation
      const reserve0 = parseFloat(ethers.utils.formatEther(poolInfo.reserve0));
      const reserve1 = parseFloat(ethers.utils.formatEther(poolInfo.reserve1));
      
      // Assume equal USD value for simplification
      return (reserve0 + reserve1).toFixed(4);
    } catch (error) {
      console.error('Error calculating TVL:', error);
      return '0';
    }
  }

  async estimateAPR(token0, token1) {
    try {
      // Simplified APR estimation based on trading volume and fees
      // In production, this would use historical trading data
      
      const poolInfo = await this.getPoolInfo(token0, token1);
      if (!poolInfo) return 0;

      const fee = parseFloat(poolInfo.fee) / 10000; // Convert fee to percentage
      const baseAPR = fee * 365 * 10; // Assume 10x daily volume turnover
      
      return Math.min(baseAPR * 100, 1000); // Cap at 1000% APR
    } catch (error) {
      console.error('Error estimating APR:', error);
      return 0;
    }
  }

  async getPoolStatistics(token0, token1, timeframe = '24h') {
    try {
      const poolInfo = await this.getPoolInfo(token0, token1);
      if (!poolInfo) {
        return null;
      }

      // This would typically fetch from a database of historical data
      // For now, we'll return basic current statistics
      
      return {
        token0,
        token1,
        poolAddress: poolInfo.pool,
        reserves: {
          token0: ethers.utils.formatEther(poolInfo.reserve0),
          token1: ethers.utils.formatEther(poolInfo.reserve1)
        },
        totalSupply: ethers.utils.formatEther(poolInfo.totalSupply),
        fee: poolInfo.fee,
        tvl: this.calculateTVL(poolInfo),
        apr: await this.estimateAPR(token0, token1),
        volume24h: '0', // Would be fetched from historical data
        volumeChange24h: 0,
        priceChange24h: 0,
        liquidityChange24h: 0
      };
    } catch (error) {
      console.error(`Error getting pool statistics for ${token0}/${token1}:`, error);
      return null;
    }
  }

  async findBestRoute(tokenIn, tokenOut, amountIn) {
    try {
      // For direct pools, return single hop
      const directQuote = await this.getSwapQuote(tokenIn, tokenOut, amountIn);
      
      if (!directQuote.isZero()) {
        return {
          path: [tokenIn, tokenOut],
          amountOut: directQuote,
          priceImpact: await this.calculatePriceImpact(tokenIn, tokenOut, amountIn),
          hops: 1
        };
      }

      // For multi-hop routing, we'd need to implement more complex logic
      // This would involve finding intermediate tokens and comparing routes
      
      return null;
    } catch (error) {
      console.error(`Error finding best route for ${tokenIn} -> ${tokenOut}:`, error);
      return null;
    }
  }

  async calculatePriceImpact(tokenIn, tokenOut, amountIn) {
    try {
      const poolInfo = await this.getPoolInfo(tokenIn, tokenOut);
      if (!poolInfo) return 0;

      const poolKey = this.getPoolKey(tokenIn, tokenOut);
      const pool = this.poolRegistry.get(poolKey);
      
      if (!pool) return 0;

      // Determine reserves
      const isToken0First = pool.token0.toLowerCase() === tokenIn.toLowerCase();
      const [reserveIn, reserveOut] = isToken0First 
        ? [poolInfo.reserve0, poolInfo.reserve1]
        : [poolInfo.reserve1, poolInfo.reserve0];

      if (reserveIn.isZero() || reserveOut.isZero()) return 0;

      // Calculate price impact using constant product formula
      const k = reserveIn.mul(reserveOut);
      const newReserveIn = reserveIn.add(amountIn);
      const newReserveOut = k.div(newReserveIn);
      
      const amountOut = reserveOut.sub(newReserveOut);
      const effectivePrice = amountIn.mul(ethers.utils.parseEther('1')).div(amountOut);
      const marketPrice = reserveOut.mul(ethers.utils.parseEther('1')).div(reserveIn);
      
      const priceImpact = effectivePrice.sub(marketPrice).mul(10000).div(marketPrice);
      return Math.max(0, priceImpact.toNumber() / 100); // Convert to percentage
    } catch (error) {
      console.error('Error calculating price impact:', error);
      return 0;
    }
  }

  invalidatePriceCache(token0, token1) {
    const keys = [`price-${token0}-${token1}`, `price-${token1}-${token0}`];
    keys.forEach(key => this.priceCache.delete(key));
  }

  invalidateLiquidityCache(token0, token1) {
    const keys = [`pool-info-${token0}-${token1}`, `pool-info-${token1}-${token0}`];
    keys.forEach(key => this.liquidityCache.delete(key));
  }

  // Admin functions
  async createPool(token0, token1) {
    try {
      if (!this.contracts.eulerSwapIntegration) {
        throw new Error('EulerSwap integration contract not available');
      }

      const poolAddress = await this.contracts.eulerSwapIntegration.createPool(token0, token1);
      await this.registerPool(poolAddress);
      
      return poolAddress;
    } catch (error) {
      console.error(`Error creating pool for ${token0}/${token1}:`, error);
      throw error;
    }
  }

  // Utility functions
  getRegisteredPools() {
    return Array.from(this.poolRegistry.entries()).map(([key, pool]) => ({
      key,
      ...pool,
      contract: undefined // Don't include contract instance in response
    }));
  }

  clearCache() {
    this.priceCache.clear();
    this.liquidityCache.clear();
  }

  getCacheStats() {
    return {
      priceCacheSize: this.priceCache.size,
      liquidityCacheSize: this.liquidityCache.size,
      registeredPools: this.poolRegistry.size
    };
  }
}

const eulerSwapService = new EulerSwapService();

module.exports = { eulerSwapService, EulerSwapService };
