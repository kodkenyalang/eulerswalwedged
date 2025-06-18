// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IEVC.sol";
import "./interfaces/IEVault.sol";
import "./EulerVaultManager.sol";
import "./WedgedPool.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EVCIntegration
/// @notice Integrates Euler Vault Connector with Wedged pools for cross-vault functionality
contract EVCIntegration is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct CrossVaultPosition {
        address vault;
        address collateralVault;
        uint256 collateralAmount;
        uint256 borrowAmount;
        uint256 poolId;
        bool isActive;
        uint256 lastUpdateTime;
    }

    struct LiquidityBridge {
        address sourceVault;
        address targetPool;
        uint256 bridgedAmount;
        uint256 shares;
        bool isActive;
    }

    // State variables
    IEVC public immutable evc;
    EulerVaultManager public immutable vaultManager;
    WedgedPool public immutable wedgedPool;
    
    mapping(address => mapping(uint256 => CrossVaultPosition)) public crossVaultPositions; // user => positionId => position
    mapping(address => uint256) public userPositionCount;
    mapping(address => LiquidityBridge) public liquidityBridges; // vault => bridge
    mapping(address => bool) public authorizedVaults;
    mapping(address => bool) public authorizedPools;
    
    uint256 public nextPositionId = 1;
    uint256 public totalCrossVaultPositions;
    uint256 public totalLiquidityBridged;

    // Events
    event CrossVaultPositionCreated(
        address indexed user,
        uint256 indexed positionId,
        address vault,
        address collateralVault,
        uint256 collateralAmount,
        uint256 borrowAmount
    );
    
    event CrossVaultPositionClosed(
        address indexed user,
        uint256 indexed positionId,
        uint256 collateralReturned,
        uint256 borrowRepaid
    );
    
    event LiquidityBridgeCreated(
        address indexed vault,
        address indexed pool,
        uint256 amount
    );
    
    event LiquidityBridgeRemoved(
        address indexed vault,
        address indexed pool,
        uint256 amount
    );
    
    event VaultAuthorized(address indexed vault, bool authorized);
    event PoolAuthorized(address indexed pool, bool authorized);

    // Errors
    error UnauthorizedVault();
    error UnauthorizedPool();
    error InvalidPosition();
    error InsufficientCollateral();
    error PositionNotFound();
    error EVCChecksFailed();

    constructor(
        address _evc,
        address _vaultManager,
        address _wedgedPool
    ) {
        evc = IEVC(_evc);
        vaultManager = EulerVaultManager(_vaultManager);
        wedgedPool = WedgedPool(_wedgedPool);
    }

    /// @notice Authorize a vault for cross-vault operations
    function authorizeVault(address vault, bool authorized) external onlyOwner {
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }

    /// @notice Authorize a pool for liquidity bridging
    function authorizePool(address pool, bool authorized) external onlyOwner {
        authorizedPools[pool] = authorized;
        emit PoolAuthorized(pool, authorized);
    }

    /// @notice Create a cross-vault leveraged position using EVC
    function createCrossVaultPosition(
        address collateralVault,
        address borrowVault,
        uint256 collateralAmount,
        uint256 borrowAmount,
        uint256 poolId
    ) external nonReentrant returns (uint256 positionId) {
        if (!authorizedVaults[collateralVault] || !authorizedVaults[borrowVault]) {
            revert UnauthorizedVault();
        }

        address user = msg.sender;
        positionId = nextPositionId++;

        // Create EVC batch operations for atomic cross-vault position
        IEVC.BatchItem[] memory batchItems = new IEVC.BatchItem[](4);
        
        // 1. Enable collateral vault as collateral
        batchItems[0] = IEVC.BatchItem({
            targetContract: address(evc),
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVC.enableCollateral.selector,
                user,
                collateralVault
            )
        });

        // 2. Enable borrow vault as controller
        batchItems[1] = IEVC.BatchItem({
            targetContract: address(evc),
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVC.enableController.selector,
                user,
                borrowVault
            )
        });

        // 3. Deposit collateral into collateral vault
        batchItems[2] = IEVC.BatchItem({
            targetContract: collateralVault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.deposit.selector,
                collateralAmount,
                user
            )
        });

        // 4. Borrow from borrow vault and deposit into pool
        batchItems[3] = IEVC.BatchItem({
            targetContract: borrowVault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.borrow.selector,
                borrowAmount,
                address(this)
            )
        });

        // Execute batch through EVC
        try evc.batch(batchItems) {
            // If successful, record the position
            crossVaultPositions[user][positionId] = CrossVaultPosition({
                vault: borrowVault,
                collateralVault: collateralVault,
                collateralAmount: collateralAmount,
                borrowAmount: borrowAmount,
                poolId: poolId,
                isActive: true,
                lastUpdateTime: block.timestamp
            });

            userPositionCount[user]++;
            totalCrossVaultPositions++;

            // Deposit borrowed amount into Wedged pool
            IERC20 borrowAsset = IERC20(IEVault(borrowVault).asset());
            borrowAsset.safeApprove(address(wedgedPool), borrowAmount);
            wedgedPool.deposit(poolId, borrowAmount);

            emit CrossVaultPositionCreated(
                user,
                positionId,
                borrowVault,
                collateralVault,
                collateralAmount,
                borrowAmount
            );
        } catch {
            revert EVCChecksFailed();
        }
    }

    /// @notice Close a cross-vault position
    function closeCrossVaultPosition(uint256 positionId) external nonReentrant {
        address user = msg.sender;
        CrossVaultPosition storage position = crossVaultPositions[user][positionId];
        
        if (!position.isActive) {
            revert PositionNotFound();
        }

        uint256 poolWithdrawAmount = position.borrowAmount;
        
        // Withdraw from Wedged pool
        wedgedPool.withdraw(position.poolId, poolWithdrawAmount);

        // Create EVC batch operations for position closure
        IEVC.BatchItem[] memory batchItems = new IEVC.BatchItem[](2);
        
        // 1. Repay borrowed amount
        IERC20 borrowAsset = IERC20(IEVault(position.vault).asset());
        borrowAsset.safeApprove(position.vault, position.borrowAmount);
        
        batchItems[0] = IEVC.BatchItem({
            targetContract: position.vault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.repay.selector,
                position.borrowAmount,
                user
            )
        });

        // 2. Withdraw collateral
        batchItems[1] = IEVC.BatchItem({
            targetContract: position.collateralVault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.withdraw.selector,
                position.collateralAmount,
                user,
                user
            )
        });

        // Execute batch through EVC
        evc.batch(batchItems);

        // Mark position as closed
        position.isActive = false;
        userPositionCount[user]--;
        totalCrossVaultPositions--;

        emit CrossVaultPositionClosed(
            user,
            positionId,
            position.collateralAmount,
            position.borrowAmount
        );
    }

    /// @notice Create a liquidity bridge between vault and pool
    function createLiquidityBridge(
        address vault,
        uint256 poolId,
        uint256 amount
    ) external onlyOwner {
        if (!authorizedVaults[vault]) {
            revert UnauthorizedVault();
        }

        // Get vault asset
        address asset = IEVault(vault).asset();
        
        // Create bridge operations through EVC
        IEVC.BatchItem[] memory batchItems = new IEVC.BatchItem[](2);
        
        // 1. Withdraw from vault
        batchItems[0] = IEVC.BatchItem({
            targetContract: vault,
            onBehalfOfAccount: address(this),
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.withdraw.selector,
                amount,
                address(this),
                address(this)
            )
        });

        // 2. Deposit into pool
        batchItems[1] = IEVC.BatchItem({
            targetContract: address(wedgedPool),
            onBehalfOfAccount: address(0), // EVC itself
            value: 0,
            data: abi.encodeWithSelector(
                WedgedPool.deposit.selector,
                poolId,
                amount
            )
        });

        // Execute bridge creation
        evc.batch(batchItems);

        // Record bridge
        liquidityBridges[vault] = LiquidityBridge({
            sourceVault: vault,
            targetPool: address(wedgedPool),
            bridgedAmount: amount,
            shares: amount, // Simplified 1:1 for now
            isActive: true
        });

        totalLiquidityBridged += amount;

        emit LiquidityBridgeCreated(vault, address(wedgedPool), amount);
    }

    /// @notice Remove a liquidity bridge
    function removeLiquidityBridge(address vault) external onlyOwner {
        LiquidityBridge storage bridge = liquidityBridges[vault];
        
        if (!bridge.isActive) {
            revert InvalidPosition();
        }

        // Withdraw from pool and deposit back to vault
        wedgedPool.withdraw(0, bridge.bridgedAmount); // Assuming pool ID 0 for simplicity
        
        address asset = IEVault(vault).asset();
        IERC20(asset).safeApprove(vault, bridge.bridgedAmount);
        IEVault(vault).deposit(bridge.bridgedAmount, address(this));

        totalLiquidityBridged -= bridge.bridgedAmount;
        bridge.isActive = false;

        emit LiquidityBridgeRemoved(vault, bridge.targetPool, bridge.bridgedAmount);
    }

    /// @notice Get user's cross-vault positions
    function getUserPositions(address user) external view returns (CrossVaultPosition[] memory) {
        uint256 count = userPositionCount[user];
        CrossVaultPosition[] memory positions = new CrossVaultPosition[](count);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (crossVaultPositions[user][i].isActive) {
                positions[index] = crossVaultPositions[user][i];
                index++;
            }
        }
        
        return positions;
    }

    /// @notice Calculate cross-vault position health
    function getPositionHealth(address user, uint256 positionId) external view returns (uint256 healthFactor) {
        CrossVaultPosition memory position = crossVaultPositions[user][positionId];
        
        if (!position.isActive) {
            return 0;
        }

        // Get collateral value from EVC
        try IEVault(position.collateralVault).convertToAssets(position.collateralAmount) returns (uint256 collateralValue) {
            // Simple health factor calculation (would need oracle integration for real implementation)
            if (position.borrowAmount == 0) {
                return type(uint256).max;
            }
            
            healthFactor = (collateralValue * 10000) / position.borrowAmount; // 100% = 10000
        } catch {
            healthFactor = 0;
        }
    }

    /// @notice Liquidate an unhealthy cross-vault position
    function liquidatePosition(
        address user,
        uint256 positionId,
        uint256 maxRepayAmount
    ) external nonReentrant {
        CrossVaultPosition storage position = crossVaultPositions[user][positionId];
        
        if (!position.isActive) {
            revert PositionNotFound();
        }

        uint256 healthFactor = this.getPositionHealth(user, positionId);
        require(healthFactor < 10000, "Position is healthy"); // Below 100%

        // Calculate liquidation amounts
        uint256 repayAmount = maxRepayAmount > position.borrowAmount ? position.borrowAmount : maxRepayAmount;
        uint256 collateralSeized = (repayAmount * 110) / 100; // 10% liquidation bonus

        // Execute liquidation through EVC
        IEVC.BatchItem[] memory batchItems = new IEVC.BatchItem[](2);
        
        // 1. Repay debt
        IERC20 borrowAsset = IERC20(IEVault(position.vault).asset());
        borrowAsset.safeTransferFrom(msg.sender, address(this), repayAmount);
        borrowAsset.safeApprove(position.vault, repayAmount);
        
        batchItems[0] = IEVC.BatchItem({
            targetContract: position.vault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.repay.selector,
                repayAmount,
                user
            )
        });

        // 2. Seize collateral
        batchItems[1] = IEVC.BatchItem({
            targetContract: position.collateralVault,
            onBehalfOfAccount: user,
            value: 0,
            data: abi.encodeWithSelector(
                IEVault.withdraw.selector,
                collateralSeized,
                msg.sender,
                user
            )
        });

        evc.batch(batchItems);

        // Update position
        position.borrowAmount -= repayAmount;
        position.collateralAmount -= collateralSeized;
        
        if (position.borrowAmount == 0) {
            position.isActive = false;
            userPositionCount[user]--;
            totalCrossVaultPositions--;
        }
    }

    /// @notice Emergency function to disable EVC operations
    function emergencyPause() external onlyOwner {
        // Implementation would pause all EVC operations
    }

    /// @notice Get EVC execution context
    function getExecutionContext() external view returns (uint256) {
        return evc.getRawExecutionContext();
    }

    /// @notice Check if user has any active cross-vault positions
    function hasActivePositions(address user) external view returns (bool) {
        return userPositionCount[user] > 0;
    }
}