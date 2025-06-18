// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.0;

/// @title IInitialize
/// @notice Interface of the initialization module of EVault
interface IInitialize {
    /// @notice Initialization of the newly deployed proxy contract
    /// @param proxyCreator Account which created the proxy or should be the initial governor
    function initialize(address proxyCreator) external;
}

/// @title IERC20
/// @notice Interface of the EVault's ERC20 module
interface IERC20 {
    /// @notice Vault share token (eToken) name, ie "Euler Vault: DAI"
    /// @return The name of the eToken
    function name() external view returns (string memory);

    /// @notice Vault share token (eToken) symbol, ie "eDAI"
    /// @return The symbol of the eToken
    function symbol() external view returns (string memory);

    /// @notice Decimals, the same as the asset's or 18 if the asset doesn't implement `decimals()`
    /// @return The decimals of the eToken
    function decimals() external view returns (uint8);

    /// @notice Sum of all eToken balances
    /// @return The total supply of the eToken
    function totalSupply() external view returns (uint256);

    /// @notice Balance of a particular account, in eTokens
    /// @param account Address to query
    /// @return The balance of the account
    function balanceOf(address account) external view returns (uint256);

    /// @notice Retrieve the current allowance
    /// @param holder The account holding the eTokens
    /// @param spender Trusted address
    /// @return The allowance from holder for spender
    function allowance(address holder, address spender) external view returns (uint256);

    /// @notice Transfer eTokens to another address
    /// @param to Recipient account
    /// @param amount In shares.
    /// @return True if transfer succeeded
    function transfer(address to, uint256 amount) external returns (bool);

    /// @notice Transfer eTokens from one address to another
    /// @param from This address must've approved the to address
    /// @param to Recipient account
    /// @param amount In shares
    /// @return True if transfer succeeded
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Allow spender to access an amount of your eTokens
    /// @param spender Trusted address
    /// @param amount Use max uint for "infinite" allowance
    /// @return True if approval succeeded
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title IERC4626
/// @notice Interface of an ERC4626 vault
interface IERC4626 {
    /// @notice Vault's underlying asset
    /// @return The vault's underlying asset
    function asset() external view returns (address);

    /// @notice Total amount of managed assets, cash and borrows
    /// @return The total amount of assets
    function totalAssets() external view returns (uint256);

    /// @notice Calculate amount of assets corresponding to the requested shares amount
    /// @param shares Amount of shares to convert
    /// @return The amount of assets
    function convertToAssets(uint256 shares) external view returns (uint256);

    /// @notice Calculate amount of shares corresponding to the requested assets amount
    /// @param assets Amount of assets to convert
    /// @return The amount of shares
    function convertToShares(uint256 assets) external view returns (uint256);

    /// @notice Fetch the maximum amount of assets a user can deposit
    /// @param account Address to query
    /// @return The max amount of assets the account can deposit
    function maxDeposit(address account) external view returns (uint256);

    /// @notice Fetch the maximum amount of shares a user can mint
    /// @param account Address to query
    /// @return The max amount of shares the account can mint
    function maxMint(address account) external view returns (uint256);

    /// @notice Fetch the maximum amount of assets a user can withdraw
    /// @param owner Address to query
    /// @return The max amount of assets the owner can withdraw
    function maxWithdraw(address owner) external view returns (uint256);

    /// @notice Fetch the maximum amount of shares a user can redeem
    /// @param owner Address to query
    /// @return The max amount of shares the owner can redeem
    function maxRedeem(address owner) external view returns (uint256);

    /// @notice Preview amount of shares that would be minted on deposit
    /// @param assets Amount of assets to deposit
    /// @return The amount of shares that would be minted
    function previewDeposit(uint256 assets) external view returns (uint256);

    /// @notice Preview amount of assets that would be required for minting shares
    /// @param shares Amount of shares to mint
    /// @return The amount of assets that would be required
    function previewMint(uint256 shares) external view returns (uint256);

    /// @notice Preview amount of shares that would be redeemed on withdrawal
    /// @param assets Amount of assets to withdraw
    /// @return The amount of shares that would be redeemed
    function previewWithdraw(uint256 assets) external view returns (uint256);

    /// @notice Preview amount of assets that would be received on redemption
    /// @param shares Amount of shares to redeem
    /// @return The amount of assets that would be received
    function previewRedeem(uint256 shares) external view returns (uint256);

    /// @notice Deposit assets in exchange for shares
    /// @param assets Amount of assets to deposit
    /// @param receiver Account to receive the shares
    /// @return shares Amount of shares minted
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @notice Mint shares for a given amount of assets
    /// @param shares Amount of shares to mint
    /// @param receiver Account to receive the shares
    /// @return assets Amount of assets deposited
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /// @notice Withdraw assets by redeeming shares
    /// @param assets Amount of assets to withdraw
    /// @param receiver Account to receive the assets
    /// @param owner Account owning the shares
    /// @return shares Amount of shares redeemed
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /// @notice Redeem shares for assets
    /// @param shares Amount of shares to redeem
    /// @param receiver Account to receive the assets
    /// @param owner Account owning the shares
    /// @return assets Amount of assets received
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

/// @title IVault
/// @notice Interface of the EVault's Vault module
interface IVault is IERC4626 {
    /// @notice Address of the EVC
    /// @return The EVC address
    function EVC() external view returns (address);

    /// @notice Retrieve the account on behalf of which the current operation is being performed
    /// @return account The account on behalf of which the operation is being performed
    function getAccountOwner() external view returns (address account);

    /// @notice Create allowance for an account
    /// @param spender Trusted address
    /// @param value Amount of allowance
    /// @return True if allowance was created successfully
    function createVaultSnapshot() external returns (bool);
}

/// @title IBorrowing
/// @notice Interface of the EVault's Borrowing module
interface IBorrowing {
    /// @notice Sum of all outstanding debts, in underlying units
    /// @return The total borrows
    function totalBorrows() external view returns (uint256);

    /// @notice Sum of all outstanding debts, in underlying units scaled up by internal exchange rate
    /// @return The total borrow shares
    function totalBorrowsExact() external view returns (uint256);

    /// @notice Debt owed by a particular account, in underlying units
    /// @param account Address to query
    /// @return The debt of the account
    function debtOf(address account) external view returns (uint256);

    /// @notice Debt owed by a particular account, in underlying units scaled up by internal exchange rate
    /// @param account Address to query
    /// @return The exact debt of the account
    function debtOfExact(address account) external view returns (uint256);

    /// @notice Transfer underlying tokens from the vault to the sender, and increase the sender's debt
    /// @param amount Amount of underlying tokens to borrow
    /// @param receiver Account to receive the borrowed tokens
    function borrow(uint256 amount, address receiver) external returns (uint256);

    /// @notice Transfer underlying tokens from the sender to the vault, and decrease the sender's debt
    /// @param amount Amount of underlying tokens to repay
    /// @param receiver Account to receive any excess tokens
    function repay(uint256 amount, address receiver) external returns (uint256);

    /// @notice Liquidate a borrower who's assets are insufficient to cover their debt
    /// @param borrower Address of the borrower to liquidate
    /// @param collateral Address of the collateral to liquidate
    /// @param repayAssets Amount of underlying tokens to repay
    /// @param minYieldBalance Minimum amount of collateral to receive
    function liquidate(
        address borrower,
        address collateral,
        uint256 repayAssets,
        uint256 minYieldBalance
    ) external;
}

/// @title IRiskManager
/// @notice Interface of the EVault's RiskManager module
interface IRiskManager {
    /// @notice Retrieve the collateral factor for an asset
    /// @param collateral Address of the collateral asset
    /// @return The collateral factor
    function collateralFactor(address collateral) external view returns (uint256);

    /// @notice Retrieve the borrow factor for this vault
    /// @return The borrow factor
    function borrowFactor() external view returns (uint256);

    /// @notice Retrieve the liquidation threshold for an account
    /// @param account Address to query
    /// @return The liquidation threshold
    function liquidationThreshold(address account) external view returns (uint256);

    /// @notice Retrieve account's total collateral value
    /// @param account Address to query
    /// @return The collateral value in the unit of account
    function collateralValue(address account) external view returns (uint256);

    /// @notice Retrieve account's total liability value
    /// @param account Address to query
    /// @return The liability value in the unit of account
    function liabilityValue(address account) external view returns (uint256);

    /// @notice Retrieve account's liquidity in the unit of account
    /// @param account Address to query
    /// @return The liquidity value
    function liquidity(address account) external view returns (uint256);
}

/// @title IEVault
/// @notice Main interface of EVault
interface IEVault is IInitialize, IERC20, IVault, IBorrowing, IRiskManager {
    /// @notice Retrieves the address of the underlying asset
    /// @return The underlying asset address
    function underlying() external view returns (address);

    /// @notice Current interest rate being charged on borrows
    /// @return The interest rate in percentage (1e27 = 100%)
    function interestRate() external view returns (uint256);

    /// @notice Time when interest was last accrued
    /// @return The timestamp of the last interest accrual
    function interestAccrualTime() external view returns (uint256);

    /// @notice Current exchange rate between shares and underlying assets
    /// @return The exchange rate (1e18 = 1:1)
    function exchangeRate() external view returns (uint256);

    /// @notice Enable an asset as collateral for the calling account
    /// @param collateral Address of the collateral asset
    function enterMarket(address collateral) external;

    /// @notice Disable an asset as collateral for the calling account
    /// @param collateral Address of the collateral asset
    function exitMarket(address collateral) external;
}