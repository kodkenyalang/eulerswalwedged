const { ethers } = require("hardhat");

async function main() {
    console.log("Starting Wedged Protocol deployment...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy contracts in dependency order
    console.log("\n1. Deploying EulerSwapIntegration...");
    
    // Mock addresses for EulerSwap Factory and Router
    // In production, these would be the actual deployed EulerSwap addresses
    const EULER_FACTORY = process.env.EULER_FACTORY || "0x1234567890123456789012345678901234567890";
    const EULER_ROUTER = process.env.EULER_ROUTER || "0x1234567890123456789012345678901234567891";
    
    const EulerSwapIntegration = await ethers.getContractFactory("EulerSwapIntegration");
    const eulerSwapIntegration = await EulerSwapIntegration.deploy(EULER_FACTORY, EULER_ROUTER);
    await eulerSwapIntegration.deployed();
    console.log("EulerSwapIntegration deployed to:", eulerSwapIntegration.address);

    console.log("\n2. Deploying RiskCalculator...");
    
    // Mock price oracle address - in production this would be Chainlink or similar
    const PRICE_ORACLE = process.env.PRICE_ORACLE || "0x1234567890123456789012345678901234567892";
    
    const RiskCalculator = await ethers.getContractFactory("RiskCalculator");
    const riskCalculator = await RiskCalculator.deploy(PRICE_ORACLE, ethers.constants.AddressZero);
    await riskCalculator.deployed();
    console.log("RiskCalculator deployed to:", riskCalculator.address);

    console.log("\n3. Deploying WedgedPool...");
    
    const WedgedPool = await ethers.getContractFactory("WedgedPool");
    const wedgedPool = await WedgedPool.deploy(
        ethers.constants.AddressZero, // HedgingManager - will be set later
        riskCalculator.address,
        deployer.address // Fee recipient
    );
    await wedgedPool.deployed();
    console.log("WedgedPool deployed to:", wedgedPool.address);

    // Update RiskCalculator with WedgedPool address
    await riskCalculator.setWedgedPool && await riskCalculator.setWedgedPool(wedgedPool.address);

    console.log("\n4. Deploying HedgingManager...");
    
    const HedgingManager = await ethers.getContractFactory("HedgingManager");
    const hedgingManager = await HedgingManager.deploy(
        eulerSwapIntegration.address,
        wedgedPool.address,
        deployer.address // Operator
    );
    await hedgingManager.deployed();
    console.log("HedgingManager deployed to:", hedgingManager.address);

    console.log("\n5. Setting up contract connections...");
    
    // Set HedgingManager in WedgedPool
    const wedgedPoolContract = await ethers.getContractAt("WedgedPool", wedgedPool.address);
    // Note: WedgedPool constructor already sets hedgingManager, but this would be the update method
    
    // Authorize HedgingManager to call EulerSwapIntegration
    await eulerSwapIntegration.setAuthorizedCaller(hedgingManager.address, true);
    console.log("HedgingManager authorized to call EulerSwapIntegration");

    // Authorize WedgedPool to call HedgingManager
    // This would be done through appropriate setter methods if they exist

    console.log("\n6. Creating initial hedging strategies...");
    
    try {
        // Create conservative strategy
        await hedgingManager.createStrategy(
            "Conservative IL Protection",
            3000, // 30% risk threshold
            2500  // 25% hedge ratio
        );
        console.log("Conservative strategy created");

        // Create aggressive strategy
        await hedgingManager.createStrategy(
            "Aggressive IL Protection", 
            5000, // 50% risk threshold
            5000  // 50% hedge ratio
        );
        console.log("Aggressive strategy created");
    } catch (error) {
        console.log("Error creating strategies:", error.message);
    }

    console.log("\n=== Deployment Summary ===");
    console.log("EulerSwapIntegration:", eulerSwapIntegration.address);
    console.log("RiskCalculator:", riskCalculator.address);
    console.log("WedgedPool:", wedgedPool.address);
    console.log("HedgingManager:", hedgingManager.address);

    console.log("\n=== Configuration ===");
    console.log("Euler Factory:", EULER_FACTORY);
    console.log("Euler Router:", EULER_ROUTER);
    console.log("Price Oracle:", PRICE_ORACLE);
    console.log("Fee Recipient:", deployer.address);

    // Save deployment addresses to file
    const fs = require('fs');
    const deploymentInfo = {
        network: hre.network.name,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            EulerSwapIntegration: eulerSwapIntegration.address,
            RiskCalculator: riskCalculator.address,
            WedgedPool: wedgedPool.address,
            HedgingManager: hedgingManager.address
        },
        config: {
            eulerFactory: EULER_FACTORY,
            eulerRouter: EULER_ROUTER,
            priceOracle: PRICE_ORACLE,
            feeRecipient: deployer.address
        }
    };

    fs.writeFileSync(
        `deployment-${hre.network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log(`\nDeployment info saved to deployment-${hre.network.name}.json`);
    console.log("\nDeployment completed successfully!");

    // Verify contracts on etherscan if not local network
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\nWaiting for block confirmations...");
        await eulerSwapIntegration.deployTransaction.wait(6);
        
        console.log("Verifying contracts on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: eulerSwapIntegration.address,
                constructorArguments: [EULER_FACTORY, EULER_ROUTER]
            });
            
            await hre.run("verify:verify", {
                address: riskCalculator.address,
                constructorArguments: [PRICE_ORACLE, wedgedPool.address]
            });
            
            await hre.run("verify:verify", {
                address: wedgedPool.address,
                constructorArguments: [hedgingManager.address, riskCalculator.address, deployer.address]
            });
            
            await hre.run("verify:verify", {
                address: hedgingManager.address,
                constructorArguments: [eulerSwapIntegration.address, wedgedPool.address, deployer.address]
            });
            
            console.log("Contracts verified successfully!");
        } catch (error) {
            console.log("Verification failed:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
