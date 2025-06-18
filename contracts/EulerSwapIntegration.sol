// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interface based on EulerSwap protocol structure
interface IEulerSwapPool {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external returns (uint256 amountOut);
    
    function addLiquidity(
        uint256 amount0,
        uint256 amount1,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 liquidity);
    
    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1);
    
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function totalSupply() external view returns (uint256);
}

interface IEulerSwapFactory {
    function createPool(address token0, address token1, uint24 fee) external returns (address pool);
    function getPool(address token0, address token1, uint24 fee) external view returns (address pool);
    function pools(uint256 index) external view returns (address pool);
    function poolsLength() external view returns (uint256);
}

interface IEulerSwapRouter {
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
    
    function addLiquidity(
        address token0,
        address token1,
        uint24 fee,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address recipient
    ) external returns (uint256 amount0, uint256 amount1, uint256 liquidity);
}

/**
 * @title EulerSwapIntegration
 * @dev Integration layer for EulerSwap protocol operations
 */
contract EulerSwapIntegration is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PoolInfo {
        address pool;
        address token0;
        address token1;
        uint24 fee;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalSupply;
    }

    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
    }

    IEulerSwapFactory public factory;
    IEulerSwapRouter public router;
    
    mapping(address => mapping(address => address)) public poolRegistry;
    mapping(address => bool) public authorizedCallers;
    
    uint24 public constant DEFAULT_FEE = 3000; // 0.3%
    uint256 public constant SLIPPAGE_DENOMINATOR = 10000;
    uint256 public defaultSlippage = 500; // 5%
    
    event PoolRegistered(address indexed token0, address indexed token1, address pool);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    event LiquidityAdded(
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    constructor(address _factory, address _router) {
        factory = IEulerSwapFactory(_factory);
        router = IEulerSwapRouter(_router);
        authorizedCallers[msg.sender] = true;
    }

    /**
     * @dev Execute exact input swap
     */
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external onlyAuthorized nonReentrant returns (uint256 amountOut) {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
        require(amountIn > 0, "Amount must be greater than 0");
        
        // Transfer tokens from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router
        IERC20(tokenIn).safeApprove(address(router), amountIn);
        
        // Execute swap
        amountOut = router.swapExactInputSingle(
            tokenIn,
            tokenOut,
            DEFAULT_FEE,
            msg.sender,
            amountIn,
            amountOutMin,
            0 // No price limit
        );
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
        return amountOut;
    }

    /**
     * @dev Add liquidity to a pool
     */
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) external onlyAuthorized nonReentrant returns (uint256 liquidity) {
        require(token0 != address(0) && token1 != address(0), "Invalid token addresses");
        require(amount0 > 0 && amount1 > 0, "Amounts must be greater than 0");
        
        // Transfer tokens from caller
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
        
        // Approve router
        IERC20(token0).safeApprove(address(router), amount0);
        IERC20(token1).safeApprove(address(router), amount1);
        
        // Calculate minimum amounts with slippage
        uint256 amount0Min = (amount0 * (SLIPPAGE_DENOMINATOR - defaultSlippage)) / SLIPPAGE_DENOMINATOR;
        uint256 amount1Min = (amount1 * (SLIPPAGE_DENOMINATOR - defaultSlippage)) / SLIPPAGE_DENOMINATOR;
        
        // Add liquidity
        (uint256 actualAmount0, uint256 actualAmount1, liquidity) = router.addLiquidity(
            token0,
            token1,
            DEFAULT_FEE,
            amount0,
            amount1,
            amount0Min,
            amount1Min,
            msg.sender
        );
        
        // Refund unused tokens
        if (amount0 > actualAmount0) {
            IERC20(token0).safeTransfer(msg.sender, amount0 - actualAmount0);
        }
        if (amount1 > actualAmount1) {
            IERC20(token1).safeTransfer(msg.sender, amount1 - actualAmount1);
        }
        
        emit LiquidityAdded(token0, token1, actualAmount0, actualAmount1, liquidity);
        return liquidity;
    }

    /**
     * @dev Remove liquidity from a pool
     */
    function removeLiquidity(
        address token0,
        address token1,
        uint256 liquidity
    ) external onlyAuthorized nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(token0 != address(0) && token1 != address(0), "Invalid token addresses");
        require(liquidity > 0, "Liquidity must be greater than 0");
        
        address pool = getPool(token0, token1);
        require(pool != address(0), "Pool does not exist");
        
        IEulerSwapPool poolContract = IEulerSwapPool(pool);
        
        // Calculate minimum amounts
        (uint256 reserve0, uint256 reserve1) = poolContract.getReserves();
        uint256 totalSupply = poolContract.totalSupply();
        
        uint256 amount0Min = (reserve0 * liquidity * (SLIPPAGE_DENOMINATOR - defaultSlippage)) / 
                            (totalSupply * SLIPPAGE_DENOMINATOR);
        uint256 amount1Min = (reserve1 * liquidity * (SLIPPAGE_DENOMINATOR - defaultSlippage)) / 
                            (totalSupply * SLIPPAGE_DENOMINATOR);
        
        // Remove liquidity
        (amount0, amount1) = poolContract.removeLiquidity(
            liquidity,
            amount0Min,
            amount1Min,
            msg.sender
        );
        
        emit LiquidityRemoved(token0, token1, amount0, amount1, liquidity);
        return (amount0, amount1);
    }

    /**
     * @dev Get price of token0 in terms of token1
     */
    function getPrice(address token0, address token1) external view returns (uint256) {
        address pool = getPool(token0, token1);
        if (pool == address(0)) {
            return 0;
        }
        
        IEulerSwapPool poolContract = IEulerSwapPool(pool);
        (uint256 reserve0, uint256 reserve1) = poolContract.getReserves();
        
        if (reserve0 == 0 || reserve1 == 0) {
            return 0;
        }
        
        // Return price as reserve1/reserve0 scaled by 1e18
        return (reserve1 * 1e18) / reserve0;
    }

    /**
     * @dev Get pool address for token pair
     */
    function getPool(address token0, address token1) public view returns (address) {
        return factory.getPool(token0, token1, DEFAULT_FEE);
    }

    /**
     * @dev Get detailed pool information
     */
    function getPoolInfo(address token0, address token1) 
        external 
        view 
        returns (PoolInfo memory) 
    {
        address pool = getPool(token0, token1);
        
        if (pool == address(0)) {
            return PoolInfo({
                pool: address(0),
                token0: token0,
                token1: token1,
                fee: DEFAULT_FEE,
                reserve0: 0,
                reserve1: 0,
                totalSupply: 0
            });
        }
        
        IEulerSwapPool poolContract = IEulerSwapPool(pool);
        (uint256 reserve0, uint256 reserve1) = poolContract.getReserves();
        uint256 totalSupply = poolContract.totalSupply();
        
        return PoolInfo({
            pool: pool,
            token0: token0,
            token1: token1,
            fee: DEFAULT_FEE,
            reserve0: reserve0,
            reserve1: reserve1,
            totalSupply: totalSupply
        });
    }

    /**
     * @dev Create a new pool if it doesn't exist
     */
    function createPool(address token0, address token1) 
        external 
        onlyOwner 
        returns (address pool) 
    {
        require(token0 != address(0) && token1 != address(0), "Invalid token addresses");
        require(token0 != token1, "Tokens must be different");
        
        pool = factory.createPool(token0, token1, DEFAULT_FEE);
        poolRegistry[token0][token1] = pool;
        poolRegistry[token1][token0] = pool;
        
        emit PoolRegistered(token0, token1, pool);
        return pool;
    }

    /**
     * @dev Get quote for swap
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        address pool = getPool(tokenIn, tokenOut);
        if (pool == address(0)) {
            return 0;
        }
        
        IEulerSwapPool poolContract = IEulerSwapPool(pool);
        (uint256 reserve0, uint256 reserve1) = poolContract.getReserves();
        
        bool token0IsTokenIn = poolContract.token0() == tokenIn;
        (uint256 reserveIn, uint256 reserveOut) = token0IsTokenIn ? 
            (reserve0, reserve1) : (reserve1, reserve0);
        
        if (reserveIn == 0 || reserveOut == 0) {
            return 0;
        }
        
        // Simple constant product formula (x * y = k)
        // amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        // Apply 0.3% fee
        uint256 amountInWithFee = amountIn * 997; // 99.7% after 0.3% fee
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        
        amountOut = numerator / denominator;
        return amountOut;
    }

    /**
     * @dev Set authorized caller
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /**
     * @dev Set default slippage tolerance
     */
    function setDefaultSlippage(uint256 _slippage) external onlyOwner {
        require(_slippage <= 1000, "Slippage too high"); // Max 10%
        defaultSlippage = _slippage;
    }

    /**
     * @dev Update factory address
     */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory address");
        factory = IEulerSwapFactory(_factory);
    }

    /**
     * @dev Update router address
     */
    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router address");
        router = IEulerSwapRouter(_router);
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
