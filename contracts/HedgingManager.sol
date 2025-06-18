// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEulerSwapIntegration {
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut);
    
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) external returns (uint256 liquidity);
    
    function removeLiquidity(
        address token0,
        address token1,
        uint256 liquidity
    ) external returns (uint256 amount0, uint256 amount1);
    
    function getPrice(address token0, address token1) external view returns (uint256);
}

interface IWedgedPool {
    function getPoolInfo(uint256 poolId) external view returns (
        uint256 id,
        address token0,
        address token1,
        uint256 totalDeposits,
        uint256 availableLiquidity,
        uint256 hedgedAmount,
        uint256 riskScore,
        bool active
    );
}

/**
 * @title HedgingManager
 * @dev Manages automated hedging strategies for liquidity pools
 */
contract HedgingManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct HedgePosition {
        uint256 poolId;
        address token0;
        address token1;
        uint256 originalAmount;
        uint256 hedgedAmount;
        uint256 timestamp;
        bool active;
    }

    struct HedgingStrategy {
        uint256 id;
        string name;
        uint256 riskThreshold;
        uint256 hedgeRatio; // Percentage in basis points (e.g., 5000 = 50%)
        bool active;
    }

    mapping(uint256 => HedgePosition) public hedgePositions;
    mapping(uint256 => HedgingStrategy) public strategies;
    mapping(uint256 => uint256) public poolToStrategy; // Pool ID to Strategy ID
    
    uint256 public nextPositionId = 1;
    uint256 public nextStrategyId = 1;
    uint256 public constant MAX_HEDGE_RATIO = 10000; // 100%
    uint256 public constant SLIPPAGE_TOLERANCE = 500; // 5%
    
    IEulerSwapIntegration public eulerSwapIntegration;
    IWedgedPool public wedgedPool;
    
    address public operator;
    uint256 public hedgingFee = 50; // 0.5% in basis points
    
    event HedgePositionCreated(uint256 indexed positionId, uint256 indexed poolId, uint256 amount);
    event HedgeExecuted(uint256 indexed positionId, uint256 hedgedAmount, uint256 cost);
    event HedgePositionClosed(uint256 indexed positionId, uint256 pnl);
    event StrategyCreated(uint256 indexed strategyId, string name, uint256 riskThreshold);
    event StrategyUpdated(uint256 indexed strategyId, uint256 riskThreshold, uint256 hedgeRatio);
    
    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier validStrategy(uint256 strategyId) {
        require(strategyId > 0 && strategyId < nextStrategyId, "Invalid strategy");
        require(strategies[strategyId].active, "Strategy not active");
        _;
    }

    constructor(
        address _eulerSwapIntegration,
        address _wedgedPool,
        address _operator
    ) {
        eulerSwapIntegration = IEulerSwapIntegration(_eulerSwapIntegration);
        wedgedPool = IWedgedPool(_wedgedPool);
        operator = _operator;
        
        // Create default hedging strategy
        _createStrategy("Conservative Hedge", 3000, 2500); // 30% risk threshold, 25% hedge ratio
        _createStrategy("Aggressive Hedge", 5000, 5000);   // 50% risk threshold, 50% hedge ratio
    }

    /**
     * @dev Execute hedging for a specific pool
     */
    function executeHedging(uint256 poolId, uint256 amount) 
        external 
        onlyOperator 
        nonReentrant 
        returns (bool) 
    {
        require(amount > 0, "Amount must be greater than 0");
        
        // Get pool information
        (
            uint256 id,
            address token0,
            address token1,
            uint256 totalDeposits,
            uint256 availableLiquidity,
            uint256 hedgedAmount,
            uint256 riskScore,
            bool active
        ) = wedgedPool.getPoolInfo(poolId);
        
        require(active, "Pool not active");
        require(availableLiquidity >= amount, "Insufficient liquidity");
        
        // Get strategy for this pool
        uint256 strategyId = poolToStrategy[poolId];
        if (strategyId == 0) {
            strategyId = 1; // Default to conservative strategy
        }
        
        HedgingStrategy memory strategy = strategies[strategyId];
        require(strategy.active, "Strategy not active");
        
        // Check if hedging is needed based on risk threshold
        if (riskScore < strategy.riskThreshold) {
            return false; // No hedging needed
        }
        
        // Calculate hedge amount based on strategy
        uint256 hedgeAmount = (amount * strategy.hedgeRatio) / 10000;
        uint256 hedgingCost = calculateHedgingCost(poolId, hedgeAmount);
        
        // Create hedge position
        uint256 positionId = _createHedgePosition(poolId, token0, token1, amount);
        
        // Execute the actual hedging strategy
        bool success = _executeHedgeStrategy(positionId, hedgeAmount, token0, token1);
        
        if (success) {
            hedgePositions[positionId].hedgedAmount = hedgeAmount;
            emit HedgeExecuted(positionId, hedgeAmount, hedgingCost);
            return true;
        }
        
        return false;
    }

    /**
     * @dev Calculate the cost of hedging
     */
    function calculateHedgingCost(uint256 poolId, uint256 amount) 
        external 
        view 
        returns (uint256) 
    {
        // Get pool information
        (
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            ,
        ) = wedgedPool.getPoolInfo(poolId);
        
        // Calculate swap cost and fees
        uint256 price = eulerSwapIntegration.getPrice(token0, token1);
        uint256 swapCost = (amount * price) / 1e18;
        
        // Add hedging fee
        uint256 fee = (swapCost * hedgingFee) / 10000;
        
        // Add slippage buffer
        uint256 slippageCost = (swapCost * SLIPPAGE_TOLERANCE) / 10000;
        
        return swapCost + fee + slippageCost;
    }

    /**
     * @dev Create a new hedging strategy
     */
    function createStrategy(
        string memory name,
        uint256 riskThreshold,
        uint256 hedgeRatio
    ) external onlyOwner returns (uint256) {
        return _createStrategy(name, riskThreshold, hedgeRatio);
    }

    /**
     * @dev Internal function to create hedging strategy
     */
    function _createStrategy(
        string memory name,
        uint256 riskThreshold,
        uint256 hedgeRatio
    ) internal returns (uint256) {
        require(hedgeRatio <= MAX_HEDGE_RATIO, "Hedge ratio too high");
        require(riskThreshold > 0, "Invalid risk threshold");
        
        uint256 strategyId = nextStrategyId++;
        strategies[strategyId] = HedgingStrategy({
            id: strategyId,
            name: name,
            riskThreshold: riskThreshold,
            hedgeRatio: hedgeRatio,
            active: true
        });
        
        emit StrategyCreated(strategyId, name, riskThreshold);
        return strategyId;
    }

    /**
     * @dev Update hedging strategy
     */
    function updateStrategy(
        uint256 strategyId,
        uint256 riskThreshold,
        uint256 hedgeRatio
    ) external onlyOwner validStrategy(strategyId) {
        require(hedgeRatio <= MAX_HEDGE_RATIO, "Hedge ratio too high");
        require(riskThreshold > 0, "Invalid risk threshold");
        
        strategies[strategyId].riskThreshold = riskThreshold;
        strategies[strategyId].hedgeRatio = hedgeRatio;
        
        emit StrategyUpdated(strategyId, riskThreshold, hedgeRatio);
    }

    /**
     * @dev Assign strategy to pool
     */
    function assignStrategyToPool(uint256 poolId, uint256 strategyId) 
        external 
        onlyOwner 
        validStrategy(strategyId) 
    {
        poolToStrategy[poolId] = strategyId;
    }

    /**
     * @dev Create a hedge position
     */
    function _createHedgePosition(
        uint256 poolId,
        address token0,
        address token1,
        uint256 amount
    ) internal returns (uint256) {
        uint256 positionId = nextPositionId++;
        
        hedgePositions[positionId] = HedgePosition({
            poolId: poolId,
            token0: token0,
            token1: token1,
            originalAmount: amount,
            hedgedAmount: 0,
            timestamp: block.timestamp,
            active: true
        });
        
        emit HedgePositionCreated(positionId, poolId, amount);
        return positionId;
    }

    /**
     * @dev Execute hedge strategy (simplified implementation)
     */
    function _executeHedgeStrategy(
        uint256 positionId,
        uint256 hedgeAmount,
        address token0,
        address token1
    ) internal returns (bool) {
        try this._performHedgeSwap(token0, token1, hedgeAmount) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Perform hedge swap through EulerSwap
     */
    function _performHedgeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external {
        require(msg.sender == address(this), "Internal call only");
        
        // Calculate minimum output with slippage tolerance
        uint256 price = eulerSwapIntegration.getPrice(tokenIn, tokenOut);
        uint256 expectedOut = (amountIn * price) / 1e18;
        uint256 minAmountOut = (expectedOut * (10000 - SLIPPAGE_TOLERANCE)) / 10000;
        
        // Execute swap
        eulerSwapIntegration.swapExactIn(tokenIn, tokenOut, amountIn, minAmountOut);
    }

    /**
     * @dev Close hedge position
     */
    function closeHedgePosition(uint256 positionId) 
        external 
        onlyOperator 
        nonReentrant 
    {
        HedgePosition storage position = hedgePositions[positionId];
        require(position.active, "Position not active");
        
        position.active = false;
        
        // Calculate P&L (simplified)
        uint256 currentPrice = eulerSwapIntegration.getPrice(position.token0, position.token1);
        uint256 pnl = 0; // Simplified P&L calculation
        
        emit HedgePositionClosed(positionId, pnl);
    }

    /**
     * @dev Get hedge position details
     */
    function getHedgePosition(uint256 positionId) 
        external 
        view 
        returns (HedgePosition memory) 
    {
        return hedgePositions[positionId];
    }

    /**
     * @dev Get strategy details
     */
    function getStrategy(uint256 strategyId) 
        external 
        view 
        returns (HedgingStrategy memory) 
    {
        return strategies[strategyId];
    }

    /**
     * @dev Set operator address
     */
    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator address");
        operator = _operator;
    }

    /**
     * @dev Set hedging fee
     */
    function setHedgingFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        hedgingFee = _fee;
    }

    /**
     * @dev Emergency function to deactivate strategy
     */
    function deactivateStrategy(uint256 strategyId) external onlyOwner {
        strategies[strategyId].active = false;
    }
}
