/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hardhat_1 = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hardhat_1.ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());
    const usdcAddresses = {
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    };
    const networkName = hardhat_1.network.name;
    if (!usdcAddresses[networkName]) {
        throw new Error(`No USDC address configured for network: ${networkName}`);
    }
    const USDC_ADDRESS = usdcAddresses[networkName];
    const FEE_COLLECTOR = deployer.address;
    console.log(`Deploying to network: ${networkName}`);
    console.log('Using USDC address:', USDC_ADDRESS);
    const Escrow = await hardhat_1.ethers.getContractFactory('ProofPayEscrow');
    const escrow = await Escrow.deploy(USDC_ADDRESS, FEE_COLLECTOR);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log('ProofPayEscrow deployed to:', escrowAddress);
    console.log(`Network: ${networkName}`);
    console.log('USDC address:', USDC_ADDRESS);
    console.log('Fee collector:', FEE_COLLECTOR);
    const deploymentInfo = {
        escrowAddress,
        usdcAddress: USDC_ADDRESS,
        feeCollector: FEE_COLLECTOR,
        network: networkName,
        deployedAt: new Date().toISOString()
    };
    const dir = './src/contracts';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(`${dir}/addresses.json`, JSON.stringify(deploymentInfo, null, 2));

    // Copy the artifact
    const artifact = fs.readFileSync('./artifacts/src/contracts/ProofPayEscrow.sol/ProofPayEscrow.json', 'utf-8');
    fs.writeFileSync(`${dir}/ProofPayEscrow.json`, artifact);

    console.log(`\nDeployment info saved to ${dir}/addresses.json`);
    console.log(`Contract artifact saved to ${dir}/ProofPayEscrow.json`);
    console.log('\n⚠️ IMPORTANT: Update your .env file with:');
    console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    console.log(`USDC_CONTRACT_ADDRESS=${USDC_ADDRESS}`);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
