// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IEVault.sol";
import "./EulerVaultManager.sol";

interface IHedgingManager {
    function executeHedging(uint256 poolId, uint256 amount) external returns (bool);
    function calculateHedgingCost(uint256 poolId, uint256 amount) external view returns (uint256);
}

interface IRiskCalculator {
    function calculatePoolRisk(uint256 poolId) external view returns (uint256);
    function calculateImpermanentLoss(address token0, address token1, uint256 amount) external view returns (uint256);
}

/**
 * @title WedgedPool
 * @dev Main contract for managing liquidity hedging pools
 */
contract WedgedPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    struct Pool {
        uint256 id;
        address token0;
        address token1;
        uint256 totalDeposits;
        uint256 availableLiquidity;
        uint256 hedgedAmount;
        uint256 riskScore;
        bool active;
        mapping(address => uint256) userDeposits;
        mapping(address => uint256) userRewards;
    }

    struct PoolInfo {
        uint256 id;
        address token0;
        address token1;
        uint256 totalDeposits;
        uint256 availableLiquidity;
        uint256 hedgedAmount;
        uint256 riskScore;
        bool active;
    }

    mapping(uint256 => Pool) public pools;
    mapping(address => uint256[]) public userPools;
    
    uint256 public nextPoolId = 1;
    uint256 public totalPools;
    uint256 public protocolFee = 100; // 1% in basis points
    uint256 public constant MAX_FEE = 1000; // 10% max fee
    
    IHedgingManager public hedgingManager;
    IRiskCalculator public riskCalculator;
    EulerVaultManager public vaultManager;
    
    address public feeRecipient;
    uint256 public totalFeesCollected;
    
    // Euler Vault integration
    mapping(uint256 => address) public poolVaults; // poolId => vault address
    mapping(uint256 => uint256) public poolVaultShares; // poolId => total vault shares

    event PoolCreated(uint256 indexed poolId, address token0, address token1);
    event Deposit(uint256 indexed poolId, address indexed user, uint256 amount);
    event Withdrawal(uint256 indexed poolId, address indexed user, uint256 amount);
    event HedgingExecuted(uint256 indexed poolId, uint256 amount, uint256 cost);
    event RewardsDistributed(uint256 indexed poolId, uint256 totalRewards);
    event PoolDeactivated(uint256 indexed poolId);

    modifier poolExists(uint256 poolId) {
        require(poolId > 0 && poolId < nextPoolId, "Pool does not exist");
        _;
    }

    modifier poolActive(uint256 poolId) {
        require(pools[poolId].active, "Pool is not active");
        _;
    }

    constructor(
        address _hedgingManager,
        address _riskCalculator,
        address _feeRecipient,
        address _vaultManager
    ) {
        hedgingManager = IHedgingManager(_hedgingManager);
        riskCalculator = IRiskCalculator(_riskCalculator);
        feeRecipient = _feeRecipient;
        vaultManager = EulerVaultManager(_vaultManager);
    }

    /**
     * @dev Create a new hedging pool for a token pair
     */
    function createPool(address token0, address token1) external onlyOwner returns (uint256) {
        require(token0 != address(0) && token1 != address(0), "Invalid token addresses");
        require(token0 != token1, "Tokens must be different");
        
        uint256 poolId = nextPoolId++;
        Pool storage pool = pools[poolId];
        
        pool.id = poolId;
        pool.token0 = token0;
        pool.token1 = token1;
        pool.active = true;
        
        totalPools++;
        
        emit PoolCreated(poolId, token0, token1);
        return poolId;
    }

    /**
     * @dev Deposit tokens into a hedging pool with Euler Vault integration
     */
    function deposit(uint256 poolId, uint256 amount) 
        external 
        nonReentrant 
        poolExists(poolId) 
        poolActive(poolId) 
    {
        require(amount > 0, "Amount must be greater than 0");
        
        Pool storage pool = pools[poolId];
        IERC20 token = IERC20(pool.token0);
        
        // Transfer tokens from user
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate and deduct protocol fee
        uint256 fee = (amount * protocolFee) / 10000;
        uint256 netAmount = amount - fee;
        
        // Collect fees
        totalFeesCollected += fee;
        if (fee > 0) {
            token.safeTransfer(feeRecipient, fee);
        }
        
        // Deposit into Euler Vault for yield generation
        token.safeApprove(address(vaultManager), netAmount);
        uint256 vaultShares = vaultManager.deposit(pool.token0, netAmount);
        
        // Update pool state
        pool.userDeposits[msg.sender] += netAmount;
        pool.totalDeposits += netAmount;
        pool.availableLiquidity += netAmount;
        poolVaultShares[poolId] += vaultShares;
        
        // Track user pools
        if (pool.userDeposits[msg.sender] == netAmount) {
            userPools[msg.sender].push(poolId);
        }
        
        // Update risk score
        pool.riskScore = riskCalculator.calculatePoolRisk(poolId);
        
        emit Deposit(poolId, msg.sender, netAmount);
    }

    /**
     * @dev Withdraw tokens from a hedging pool with Euler Vault integration
     */
    function withdraw(uint256 poolId, uint256 amount) 
        external 
        nonReentrant 
        poolExists(poolId) 
    {
        require(amount > 0, "Amount must be greater than 0");
        
        Pool storage pool = pools[poolId];
        require(pool.userDeposits[msg.sender] >= amount, "Insufficient balance");
        
        // Calculate proportional vault shares to redeem
        uint256 totalShares = poolVaultShares[poolId];
        uint256 sharesToRedeem = (totalShares * amount) / pool.totalDeposits;
        
        // Redeem from Euler Vault
        uint256 assetsReceived = vaultManager.withdraw(pool.token0, sharesToRedeem);
        
        // Update pool state
        pool.userDeposits[msg.sender] -= amount;
        pool.totalDeposits -= amount;
        pool.availableLiquidity -= amount;
        poolVaultShares[poolId] -= sharesToRedeem;
        
        // Add any rewards (vault yield)
        uint256 rewards = pool.userRewards[msg.sender];
        if (rewards > 0) {
            pool.userRewards[msg.sender] = 0;
        }
        
        // Calculate total withdrawal amount including vault yield
        uint256 totalWithdrawal = assetsReceived + rewards;
        
        // Transfer tokens to user
        IERC20(pool.token0).safeTransfer(msg.sender, totalWithdrawal);
        
        // Update risk score
        pool.riskScore = riskCalculator.calculatePoolRisk(poolId);
        
        emit Withdrawal(poolId, msg.sender, totalWithdrawal);
    }

    /**
     * @dev Execute hedging strategy for a pool
     */
    function executeHedging(uint256 poolId, uint256 amount) 
        external 
        onlyOwner 
        poolExists(poolId) 
        poolActive(poolId) 
    {
        Pool storage pool = pools[poolId];
        require(pool.availableLiquidity >= amount, "Insufficient liquidity");
        
        uint256 hedgingCost = hedgingManager.calculateHedgingCost(poolId, amount);
        require(pool.availableLiquidity >= hedgingCost, "Insufficient funds for hedging");
        
        // Execute hedging through manager
        bool success = hedgingManager.executeHedging(poolId, amount);
        require(success, "Hedging execution failed");
        
        // Update pool state
        pool.availableLiquidity -= hedgingCost;
        pool.hedgedAmount += amount;
        
        emit HedgingExecuted(poolId, amount, hedgingCost);
    }

    /**
     * @dev Distribute rewards to pool participants
     */
    function distributeRewards(uint256 poolId, uint256 totalRewards) 
        external 
        onlyOwner 
        poolExists(poolId) 
    {
        Pool storage pool = pools[poolId];
        require(totalRewards > 0, "No rewards to distribute");
        require(pool.totalDeposits > 0, "No deposits in pool");
        
        // Transfer reward tokens to contract
        IERC20(pool.token0).safeTransferFrom(msg.sender, address(this), totalRewards);
        
        // Note: Individual reward distribution would be handled off-chain or through separate calls
        // This is a simplified version for gas efficiency
        
        emit RewardsDistributed(poolId, totalRewards);
    }

    /**
     * @dev Deactivate a pool
     */
    function deactivatePool(uint256 poolId) external onlyOwner poolExists(poolId) {
        pools[poolId].active = false;
        emit PoolDeactivated(poolId);
    }

    /**
     * @dev Get pool information
     */
    function getPoolInfo(uint256 poolId) external view poolExists(poolId) returns (PoolInfo memory) {
        Pool storage pool = pools[poolId];
        return PoolInfo({
            id: pool.id,
            token0: pool.token0,
            token1: pool.token1,
            totalDeposits: pool.totalDeposits,
            availableLiquidity: pool.availableLiquidity,
            hedgedAmount: pool.hedgedAmount,
            riskScore: pool.riskScore,
            active: pool.active
        });
    }

    /**
     * @dev Get user deposit amount for a pool
     */
    function getUserDeposit(uint256 poolId, address user) external view returns (uint256) {
        return pools[poolId].userDeposits[user];
    }

    /**
     * @dev Get user rewards for a pool
     */
    function getUserRewards(uint256 poolId, address user) external view returns (uint256) {
        return pools[poolId].userRewards[user];
    }

    /**
     * @dev Get all pools for a user
     */
    function getUserPools(address user) external view returns (uint256[] memory) {
        return userPools[user];
    }

    /**
     * @dev Update protocol fee
     */
    function setProtocolFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_FEE, "Fee too high");
        protocolFee = _fee;
    }

    /**
     * @dev Update fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Emergency withdrawal function
     */
    function emergencyWithdraw(uint256 poolId) external nonReentrant poolExists(poolId) {
        Pool storage pool = pools[poolId];
        uint256 userBalance = pool.userDeposits[msg.sender];
        require(userBalance > 0, "No balance to withdraw");
        
        // Only allow if pool is deactivated or in emergency state
        require(!pool.active, "Pool is still active");
        
        pool.userDeposits[msg.sender] = 0;
        pool.totalDeposits -= userBalance;
        
        IERC20(pool.token0).safeTransfer(msg.sender, userBalance);
        
        emit Withdrawal(poolId, msg.sender, userBalance);
    }
}
