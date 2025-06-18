// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IEVault.sol";
import "./interfaces/IEVaultFactory.sol";
import "./interfaces/IEVC.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EulerVaultManager
/// @notice Manages Euler Vault integration for Wedged platform
contract EulerVaultManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct VaultInfo {
        address vault;
        address asset;
        uint256 totalDeposited;
        uint256 totalShares;
        bool isActive;
        uint256 createdAt;
    }

    struct UserPosition {
        uint256 shares;
        uint256 depositedAmount;
        uint256 lastUpdateTime;
        uint256 accruedRewards;
    }

    // State variables
    IEVaultFactory public immutable vaultFactory;
    IEVC public immutable evc; // Ethereum Vault Connector

    mapping(address => VaultInfo) public vaultInfo; // asset => VaultInfo
    mapping(address => mapping(address => UserPosition)) public userPositions; // user => asset => UserPosition
    mapping(address => bool) public authorizedAssets;
    
    address[] public supportedAssets;
    address[] public activeVaults;

    // Events
    event VaultCreated(address indexed asset, address indexed vault, string name, string symbol);
    event DepositMade(address indexed user, address indexed asset, uint256 amount, uint256 shares);
    event WithdrawalMade(address indexed user, address indexed asset, uint256 amount, uint256 shares);
    event AssetAuthorized(address indexed asset, bool authorized);
    event RewardsAccrued(address indexed user, address indexed asset, uint256 amount);

    // Errors
    error AssetNotAuthorized();
    error VaultNotFound();
    error InsufficientBalance();
    error ZeroAmount();
    error VaultCreationFailed();

    constructor(address _vaultFactory, address _evc) {
        vaultFactory = IEVaultFactory(_vaultFactory);
        evc = IEVC(_evc);
    }

    /// @notice Authorize an asset for vault creation
    /// @param asset Address of the asset to authorize
    /// @param authorized Whether the asset is authorized
    function authorizeAsset(address asset, bool authorized) external onlyOwner {
        authorizedAssets[asset] = authorized;
        
        if (authorized) {
            // Add to supported assets if not already present
            bool found = false;
            for (uint256 i = 0; i < supportedAssets.length; i++) {
                if (supportedAssets[i] == asset) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                supportedAssets.push(asset);
            }
        }
        
        emit AssetAuthorized(asset, authorized);
    }

    /// @notice Create a new Euler Vault for an asset
    /// @param asset Address of the underlying asset
    /// @param name Name of the vault token
    /// @param symbol Symbol of the vault token
    /// @return vault Address of the created vault
    function createVault(
        address asset,
        string calldata name,
        string calldata symbol
    ) external onlyOwner returns (address vault) {
        if (!authorizedAssets[asset]) revert AssetNotAuthorized();
        if (vaultInfo[asset].vault != address(0)) revert VaultCreationFailed();

        // Create vault through factory (using asset as unit of account for simplicity)
        vault = vaultFactory.createVault(asset, asset, name, symbol);
        
        if (vault == address(0)) revert VaultCreationFailed();

        // Store vault information
        vaultInfo[asset] = VaultInfo({
            vault: vault,
            asset: asset,
            totalDeposited: 0,
            totalShares: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        activeVaults.push(vault);

        emit VaultCreated(asset, vault, name, symbol);
    }

    /// @notice Deposit assets into an Euler Vault
    /// @param asset Address of the asset to deposit
    /// @param amount Amount of assets to deposit
    /// @return shares Amount of vault shares received
    function deposit(address asset, uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        
        VaultInfo storage vault = vaultInfo[asset];
        if (vault.vault == address(0) || !vault.isActive) revert VaultNotFound();

        // Transfer assets from user to this contract
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Approve vault to spend assets
        IERC20(asset).safeApprove(vault.vault, amount);

        // Deposit into Euler Vault
        shares = IEVault(vault.vault).deposit(amount, address(this));

        // Update user position
        UserPosition storage position = userPositions[msg.sender][asset];
        position.shares += shares;
        position.depositedAmount += amount;
        position.lastUpdateTime = block.timestamp;

        // Update vault totals
        vault.totalDeposited += amount;
        vault.totalShares += shares;

        emit DepositMade(msg.sender, asset, amount, shares);
    }

    /// @notice Withdraw assets from an Euler Vault
    /// @param asset Address of the asset to withdraw
    /// @param shares Amount of shares to redeem
    /// @return assets Amount of assets received
    function withdraw(address asset, uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        
        VaultInfo storage vault = vaultInfo[asset];
        if (vault.vault == address(0) || !vault.isActive) revert VaultNotFound();

        UserPosition storage position = userPositions[msg.sender][asset];
        if (position.shares < shares) revert InsufficientBalance();

        // Redeem shares from Euler Vault
        assets = IEVault(vault.vault).redeem(shares, address(this), address(this));

        // Update user position
        position.shares -= shares;
        uint256 withdrawnPortion = (shares * position.depositedAmount) / (position.shares + shares);
        position.depositedAmount -= withdrawnPortion;
        position.lastUpdateTime = block.timestamp;

        // Update vault totals
        vault.totalShares -= shares;
        vault.totalDeposited -= withdrawnPortion;

        // Transfer assets to user
        IERC20(asset).safeTransfer(msg.sender, assets);

        emit WithdrawalMade(msg.sender, asset, assets, shares);
    }

    /// @notice Get user's position in a vault
    /// @param user Address of the user
    /// @param asset Address of the asset
    /// @return position User's position information
    function getUserPosition(address user, address asset) external view returns (UserPosition memory position) {
        return userPositions[user][asset];
    }

    /// @notice Get vault information for an asset
    /// @param asset Address of the asset
    /// @return info Vault information
    function getVaultInfo(address asset) external view returns (VaultInfo memory info) {
        return vaultInfo[asset];
    }

    /// @notice Get all supported assets
    /// @return assets Array of supported asset addresses
    function getSupportedAssets() external view returns (address[] memory assets) {
        return supportedAssets;
    }

    /// @notice Get all active vaults
    /// @return vaults Array of active vault addresses
    function getActiveVaults() external view returns (address[] memory vaults) {
        return activeVaults;
    }

    /// @notice Get user's total value across all vaults
    /// @param user Address of the user
    /// @return totalValue Total value in ETH (requires price oracle integration)
    function getUserTotalValue(address user) external view returns (uint256 totalValue) {
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            address asset = supportedAssets[i];
            VaultInfo memory vault = vaultInfo[asset];
            UserPosition memory position = userPositions[user][asset];
            
            if (position.shares > 0 && vault.vault != address(0)) {
                // Convert shares to assets
                uint256 assetAmount = IEVault(vault.vault).convertToAssets(position.shares);
                // For now, assume 1:1 with ETH (would need price oracle in production)
                totalValue += assetAmount;
            }
        }
    }

    /// @notice Calculate yield earned by user
    /// @param user Address of the user
    /// @param asset Address of the asset
    /// @return yield Amount of yield earned
    function calculateYield(address user, address asset) external view returns (uint256 yield) {
        VaultInfo memory vault = vaultInfo[asset];
        UserPosition memory position = userPositions[user][asset];
        
        if (position.shares == 0 || vault.vault == address(0)) return 0;
        
        uint256 currentValue = IEVault(vault.vault).convertToAssets(position.shares);
        if (currentValue > position.depositedAmount) {
            yield = currentValue - position.depositedAmount;
        }
    }

    /// @notice Enable collateral for a user in the EVC
    /// @param asset Address of the collateral asset
    function enableCollateral(address asset) external {
        VaultInfo memory vault = vaultInfo[asset];
        if (vault.vault == address(0)) revert VaultNotFound();
        
        IEVault(vault.vault).enterMarket(vault.vault);
    }

    /// @notice Disable collateral for a user in the EVC
    /// @param asset Address of the collateral asset
    function disableCollateral(address asset) external {
        VaultInfo memory vault = vaultInfo[asset];
        if (vault.vault == address(0)) revert VaultNotFound();
        
        IEVault(vault.vault).exitMarket(vault.vault);
    }

    /// @notice Emergency function to pause a vault
    /// @param asset Address of the asset whose vault to pause
    function pauseVault(address asset) external onlyOwner {
        vaultInfo[asset].isActive = false;
    }

    /// @notice Emergency function to unpause a vault
    /// @param asset Address of the asset whose vault to unpause
    function unpauseVault(address asset) external onlyOwner {
        vaultInfo[asset].isActive = true;
    }
}