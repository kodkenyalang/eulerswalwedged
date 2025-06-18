// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.0;

/// @title IEVC
/// @notice Interface for the Ethereum Vault Connector
interface IEVC {
    /// @notice A struct representing a batch item.
    struct BatchItem {
        /// @notice The target contract to be called.
        address targetContract;
        /// @notice The account on behalf of which the operation is to be performed.
        address onBehalfOfAccount;
        /// @notice The amount of value to be forwarded with the call.
        uint256 value;
        /// @notice The encoded data which is called on the target contract.
        bytes data;
    }

    /// @notice A struct representing the result of a batch item operation.
    struct BatchItemResult {
        /// @notice A boolean indicating whether the operation was successful.
        bool success;
        /// @notice The result of the operation.
        bytes result;
    }

    /// @notice A struct representing the result of the account or vault status check.
    struct StatusCheckResult {
        /// @notice The address of the account or vault for which the check was performed.
        address checkedAddress;
        /// @notice A boolean indicating whether the status of the account or vault is valid.
        bool isValid;
        /// @notice The result of the check.
        bytes result;
    }

    /// @notice Returns current raw execution context.
    function getRawExecutionContext() external view returns (uint256 context);

    /// @notice Returns an account on behalf of which the operation is being executed.
    function getCurrentOnBehalfOfAccount(address controllerToCheck)
        external
        view
        returns (address onBehalfOfAccount, bool controllerEnabled);

    /// @notice Checks if checks are deferred.
    function areChecksDeferred() external view returns (bool);

    /// @notice Checks if checks are in progress.
    function areChecksInProgress() external view returns (bool);

    /// @notice Checks if control collateral is in progress.
    function isControlCollateralInProgress() external view returns (bool);

    /// @notice Checks if an operator is authenticated.
    function isOperatorAuthenticated() external view returns (bool);

    /// @notice Checks if a simulation is in progress.
    function isSimulationInProgress() external view returns (bool);

    /// @notice Checks whether accounts have the same owner.
    function haveCommonOwner(address account, address otherAccount) external pure returns (bool);

    /// @notice Returns the address prefix of the specified account.
    function getAddressPrefix(address account) external pure returns (bytes19);

    /// @notice Enables a controller for the authenticated account.
    function enableController(address account, address controller) external;

    /// @notice Disables a controller for the authenticated account.
    function disableController(address account, address controller) external;

    /// @notice Enables a collateral for the authenticated account.
    function enableCollateral(address account, address collateral) external;

    /// @notice Disables a collateral for the authenticated account.
    function disableCollateral(address account, address collateral) external;

    /// @notice Reorders collaterals for the authenticated account.
    function reorderCollaterals(address account, uint8[] calldata indices) external;

    /// @notice Batch multiple operations together.
    function batch(BatchItem[] calldata items) external payable returns (BatchItemResult[] memory);

    /// @notice Batch multiple operations together for another account.
    function batchRevert(BatchItem[] calldata items) external payable;

    /// @notice Batch multiple operations together and simulate the results.
    function batchSimulation(BatchItem[] calldata items) external payable returns (BatchItemResult[] memory, StatusCheckResult[] memory);

    /// @notice Enables privileged mode for the calling contract.
    function requireAccountAndVaultStatusCheck(address account) external;

    /// @notice Executes account status checks.
    function requireAccountStatusCheck(address account) external;

    /// @notice Executes vault status checks.
    function requireVaultStatusCheck(address vault) external;

    /// @notice Forgives account status check for one of the currently enabled controllers.
    function forgiveAccountStatusCheck(address account) external;

    /// @notice Forgives vault status check.
    function forgiveVaultStatusCheck(address vault) external;

    /// @notice Retrieves the controllers enabled for an account.
    function getControllers(address account) external view returns (address[] memory);

    /// @notice Retrieves the collaterals enabled for an account.
    function getCollaterals(address account) external view returns (address[] memory);

    /// @notice Checks if a controller is enabled for an account.
    function isControllerEnabled(address account, address controller) external view returns (bool);

    /// @notice Checks if a collateral is enabled for an account.
    function isCollateralEnabled(address account, address collateral) external view returns (bool);

    /// @notice Retrieves the nonce of an account.
    function getNonce(address account) external view returns (uint256);

    /// @notice Retrieves the owner of an account.
    function getAccountOwner(address account) external view returns (address);

    /// @notice Checks if an account is a valid vault.
    function isValidVault(address vault) external view returns (bool);

    /// @notice Sets the account operator.
    function setAccountOperator(address account, address operator, bool authorized) external;

    /// @notice Checks if an operator is authorized for an account.
    function isAccountOperatorAuthorized(address account, address operator) external view returns (bool);

    /// @notice Sets the nonce of an account.
    function setNonce(address account, uint256 nonce) external;

    /// @notice Permits an operation by signature.
    function permit(
        address account,
        address caller,
        uint256 nonceNamespace,
        uint256 nonce,
        uint256 deadline,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external payable;

    /// @notice Creates a permit message hash.
    function permitMessageHash(
        address account,
        address caller,
        uint256 nonceNamespace,
        uint256 nonce,
        uint256 deadline,
        uint256 value,
        bytes calldata data
    ) external view returns (bytes32);

    /// @notice Retrieves the operator nonce for an account.
    function getOperatorNonce(address account, uint256 nonceNamespace) external view returns (uint256);
}

/// @title IVault
/// @notice Interface for vaults that integrate with the EVC
interface IVault {
    /// @notice Returns the address of the EVC.
    function EVC() external view returns (address);

    /// @notice Enables the account for the vault.
    function enableAccount(address account) external;

    /// @notice Disables the account for the vault.
    function disableAccount(address account) external;

    /// @notice Checks the status of an account.
    function checkAccountStatus(address account) external view returns (bytes memory);

    /// @notice Checks the status of the vault.
    function checkVaultStatus() external view returns (bytes memory);

    /// @notice Disables the vault.
    function disableVault() external;

    /// @notice Creates a snapshot of the vault.
    function createVaultSnapshot() external returns (bytes memory);
}