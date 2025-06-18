// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
    function getPriceHistory(address token, uint256 periods) external view returns (uint256[] memory);
}

interface IWedgedPoolData {
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
 * @title RiskCalculator
 * @dev Calculates various risk metrics for liquidity pools
 */
contract RiskCalculator is Ownable {
    using Math for uint256;

    struct RiskMetrics {
        uint256 volatility;
        uint256 impermanentLoss;
        uint256 correlationRisk;
        uint256 liquidityRisk;
        uint256 compositeRisk;
    }

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 volume;
    }

    mapping(address => PriceData[]) public priceHistory;
    mapping(uint256 => RiskMetrics) public poolRiskMetrics;
    mapping(address => uint256) public tokenVolatility;
    
    IPriceOracle public priceOracle;
    IWedgedPoolData public wedgedPool;
    
    uint256 public constant VOLATILITY_PERIODS = 30;
    uint256 public constant SCALE = 1e18;
    uint256 public constant MAX_RISK_SCORE = 10000; // 100%
    
    // Risk weight factors (in basis points)
    uint256 public volatilityWeight = 3000; // 30%
    uint256 public impermanentLossWeight = 4000; // 40%
    uint256 public correlationWeight = 2000; // 20%
    uint256 public liquidityWeight = 1000; // 10%
    
    event RiskScoreUpdated(uint256 indexed poolId, uint256 riskScore);
    event VolatilityCalculated(address indexed token, uint256 volatility);
    event ImpermanentLossCalculated(address token0, address token1, uint256 loss);

    constructor(address _priceOracle, address _wedgedPool) {
        priceOracle = IPriceOracle(_priceOracle);
        wedgedPool = IWedgedPoolData(_wedgedPool);
    }

    /**
     * @dev Calculate overall risk score for a pool
     */
    function calculatePoolRisk(uint256 poolId) external returns (uint256) {
        (
            ,
            address token0,
            address token1,
            uint256 totalDeposits,
            uint256 availableLiquidity,
            ,
            ,
            bool active
        ) = wedgedPool.getPoolInfo(poolId);

        require(active, "Pool not active");

        RiskMetrics memory metrics = _calculateRiskMetrics(
            token0,
            token1,
            totalDeposits,
            availableLiquidity
        );

        // Calculate composite risk score
        uint256 compositeRisk = (
            (metrics.volatility * volatilityWeight) +
            (metrics.impermanentLoss * impermanentLossWeight) +
            (metrics.correlationRisk * correlationWeight) +
            (metrics.liquidityRisk * liquidityWeight)
        ) / 10000;

        // Cap at maximum risk score
        compositeRisk = Math.min(compositeRisk, MAX_RISK_SCORE);

        // Store metrics
        poolRiskMetrics[poolId] = RiskMetrics({
            volatility: metrics.volatility,
            impermanentLoss: metrics.impermanentLoss,
            correlationRisk: metrics.correlationRisk,
            liquidityRisk: metrics.liquidityRisk,
            compositeRisk: compositeRisk
        });

        emit RiskScoreUpdated(poolId, compositeRisk);
        return compositeRisk;
    }

    /**
     * @dev Calculate impermanent loss for a token pair
     */
    function calculateImpermanentLoss(
        address token0,
        address token1,
        uint256 amount
    ) external view returns (uint256) {
        uint256 price0 = priceOracle.getPrice(token0);
        uint256 price1 = priceOracle.getPrice(token1);
        
        // Get historical prices for comparison
        uint256[] memory history0 = priceOracle.getPriceHistory(token0, 7); // 7 days
        uint256[] memory history1 = priceOracle.getPriceHistory(token1, 7);
        
        if (history0.length == 0 || history1.length == 0) {
            return 0; // No historical data available
        }
        
        uint256 initialPrice0 = history0[0];
        uint256 initialPrice1 = history1[0];
        
        // Calculate price ratio changes
        uint256 priceRatio = (price0 * SCALE) / price1;
        uint256 initialPriceRatio = (initialPrice0 * SCALE) / initialPrice1;
        
        // Calculate impermanent loss using the standard formula
        // IL = 2 * sqrt(ratio) / (1 + ratio) - 1
        uint256 ratio = (priceRatio * SCALE) / initialPriceRatio;
        
        if (ratio == SCALE) {
            return 0; // No price change, no impermanent loss
        }
        
        uint256 sqrtRatio = _sqrt(ratio);
        uint256 numerator = 2 * sqrtRatio;
        uint256 denominator = SCALE + ratio;
        
        uint256 ilFactor = (numerator * SCALE) / denominator;
        
        if (ilFactor > SCALE) {
            return ((ilFactor - SCALE) * amount) / SCALE;
        }
        
        return 0;
    }

    /**
     * @dev Calculate token volatility
     */
    function calculateVolatility(address token) external returns (uint256) {
        uint256[] memory prices = priceOracle.getPriceHistory(token, VOLATILITY_PERIODS);
        
        if (prices.length < 2) {
            return 0;
        }
        
        // Calculate returns
        uint256[] memory returns = new uint256[](prices.length - 1);
        for (uint256 i = 1; i < prices.length; i++) {
            if (prices[i-1] > 0) {
                returns[i-1] = (prices[i] * SCALE) / prices[i-1];
            }
        }
        
        // Calculate mean return
        uint256 meanReturn = 0;
        for (uint256 i = 0; i < returns.length; i++) {
            meanReturn += returns[i];
        }
        meanReturn = meanReturn / returns.length;
        
        // Calculate variance
        uint256 variance = 0;
        for (uint256 i = 0; i < returns.length; i++) {
            uint256 diff = returns[i] > meanReturn ? 
                returns[i] - meanReturn : 
                meanReturn - returns[i];
            variance += (diff * diff) / SCALE;
        }
        variance = variance / returns.length;
        
        // Calculate standard deviation (volatility)
        uint256 volatility = _sqrt(variance);
        
        tokenVolatility[token] = volatility;
        emit VolatilityCalculated(token, volatility);
        
        return volatility;
    }

    /**
     * @dev Calculate correlation between two tokens
     */
    function calculateCorrelation(address token0, address token1) 
        external 
        view 
        returns (uint256) 
    {
        uint256[] memory prices0 = priceOracle.getPriceHistory(token0, VOLATILITY_PERIODS);
        uint256[] memory prices1 = priceOracle.getPriceHistory(token1, VOLATILITY_PERIODS);
        
        if (prices0.length < 2 || prices1.length < 2) {
            return SCALE / 2; // Assume 50% correlation if no data
        }
        
        uint256 minLength = Math.min(prices0.length, prices1.length);
        
        // Calculate returns for both tokens
        uint256[] memory returns0 = new uint256[](minLength - 1);
        uint256[] memory returns1 = new uint256[](minLength - 1);
        
        for (uint256 i = 1; i < minLength; i++) {
            if (prices0[i-1] > 0 && prices1[i-1] > 0) {
                returns0[i-1] = (prices0[i] * SCALE) / prices0[i-1];
                returns1[i-1] = (prices1[i] * SCALE) / prices1[i-1];
            }
        }
        
        // Simplified correlation calculation
        // In practice, this would use the full Pearson correlation formula
        uint256 correlation = SCALE / 2; // Default to 50%
        
        return correlation;
    }

    /**
     * @dev Internal function to calculate all risk metrics
     */
    function _calculateRiskMetrics(
        address token0,
        address token1,
        uint256 totalDeposits,
        uint256 availableLiquidity
    ) internal returns (RiskMetrics memory) {
        // Calculate volatility risk
        uint256 vol0 = tokenVolatility[token0] > 0 ? 
            tokenVolatility[token0] : this.calculateVolatility(token0);
        uint256 vol1 = tokenVolatility[token1] > 0 ? 
            tokenVolatility[token1] : this.calculateVolatility(token1);
        uint256 volatilityRisk = (vol0 + vol1) / 2;
        
        // Calculate impermanent loss risk
        uint256 ilRisk = this.calculateImpermanentLoss(token0, token1, SCALE);
        
        // Calculate correlation risk (higher correlation = lower risk)
        uint256 correlation = this.calculateCorrelation(token0, token1);
        uint256 correlationRisk = SCALE - correlation;
        
        // Calculate liquidity risk based on utilization
        uint256 utilization = totalDeposits > 0 ? 
            ((totalDeposits - availableLiquidity) * SCALE) / totalDeposits : 0;
        uint256 liquidityRisk = utilization;
        
        return RiskMetrics({
            volatility: Math.min(volatilityRisk, MAX_RISK_SCORE),
            impermanentLoss: Math.min(ilRisk, MAX_RISK_SCORE),
            correlationRisk: Math.min(correlationRisk, MAX_RISK_SCORE),
            liquidityRisk: Math.min(liquidityRisk, MAX_RISK_SCORE),
            compositeRisk: 0 // Will be calculated in main function
        });
    }

    /**
     * @dev Get risk metrics for a pool
     */
    function getPoolRiskMetrics(uint256 poolId) 
        external 
        view 
        returns (RiskMetrics memory) 
    {
        return poolRiskMetrics[poolId];
    }

    /**
     * @dev Update risk calculation weights
     */
    function updateRiskWeights(
        uint256 _volatilityWeight,
        uint256 _impermanentLossWeight,
        uint256 _correlationWeight,
        uint256 _liquidityWeight
    ) external onlyOwner {
        require(
            _volatilityWeight + _impermanentLossWeight + 
            _correlationWeight + _liquidityWeight == 10000,
            "Weights must sum to 100%"
        );
        
        volatilityWeight = _volatilityWeight;
        impermanentLossWeight = _impermanentLossWeight;
        correlationWeight = _correlationWeight;
        liquidityWeight = _liquidityWeight;
    }

    /**
     * @dev Set price oracle address
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "Invalid oracle address");
        priceOracle = IPriceOracle(_priceOracle);
    }

    /**
     * @dev Integer square root function
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Emergency function to update pool risk manually
     */
    function setPoolRisk(uint256 poolId, uint256 riskScore) 
        external 
        onlyOwner 
    {
        require(riskScore <= MAX_RISK_SCORE, "Risk score too high");
        poolRiskMetrics[poolId].compositeRisk = riskScore;
        emit RiskScoreUpdated(poolId, riskScore);
    }
}
