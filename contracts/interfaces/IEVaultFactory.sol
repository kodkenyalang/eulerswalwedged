// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.0;

/// @title IEVaultFactory
/// @notice Interface for the Euler Vault Factory
interface IEVaultFactory {
    /// @notice Struct containing vault creation parameters
    struct VaultDeployment {
        address asset;
        address oracle;
        string name;
        string symbol;
        uint256 unitOfAccount;
        uint256 borrowFactor;
        uint256 supplyCap;
        uint256 borrowCap;
        address governor;
        address feeReceiver;
        uint256 protocolFeeShare;
        uint256 interestFee;
    }

    /// @notice Event emitted when a new vault is created
    /// @param vault Address of the created vault
    /// @param asset Address of the underlying asset
    /// @param creator Address that created the vault
    event VaultCreated(address indexed vault, address indexed asset, address indexed creator);

    /// @notice Create a new Euler Vault
    /// @param asset Address of the underlying asset
    /// @param unitOfAccount Unit of account for the vault (address of quote asset)
    /// @param name Name of the vault token
    /// @param symbol Symbol of the vault token
    /// @return vault Address of the created vault
    function createVault(
        address asset,
        address unitOfAccount,
        string calldata name,
        string calldata symbol
    ) external returns (address vault);

    /// @notice Create a new Euler Vault with custom parameters
    /// @param deployment Struct containing all deployment parameters
    /// @return vault Address of the created vault
    function createVaultWithParameters(VaultDeployment calldata deployment) external returns (address vault);

    /// @notice Get the vault address for a given asset
    /// @param asset Address of the underlying asset
    /// @return vault Address of the vault (zero if doesn't exist)
    function getVault(address asset) external view returns (address vault);

    /// @notice Get all vaults created by this factory
    /// @return vaults Array of vault addresses
    function getAllVaults() external view returns (address[] memory vaults);

    /// @notice Get the number of vaults created
    /// @return count Number of vaults
    function getVaultCount() external view returns (uint256 count);

    /// @notice Check if an address is a valid vault created by this factory
    /// @param vault Address to check
    /// @return isValid True if the vault was created by this factory
    function isValidVault(address vault) external view returns (bool isValid);

    /// @notice Get vault implementation address
    /// @return implementation Address of the vault implementation
    function getImplementation() external view returns (address implementation);

    /// @notice Get the EVC (Ethereum Vault Connector) address
    /// @return evc Address of the EVC
    function getEVC() external view returns (address evc);
}