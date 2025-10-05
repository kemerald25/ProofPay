import { ethers, network } from 'hardhat';
import fs from 'fs';
import 'ts-node/register';

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());
    
    const usdcAddresses = {
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e' // USDC on Base Sepolia
    };

    const networkName = network.name as keyof typeof usdcAddresses;

    if (!usdcAddresses[networkName]) {
        throw new Error(`USDC address not defined for network: ${networkName}`);
    }

    const USDC_ADDRESS = usdcAddresses[networkName];
    
    // Fee collector address (your wallet)
    const FEE_COLLECTOR = deployer.address;
    
    // Deploy Escrow contract
    const Escrow = await ethers.getContractFactory('ProofPayEscrow');
    const escrow = await Escrow.deploy(USDC_ADDRESS, FEE_COLLECTOR);
    
    await escrow.waitForDeployment();
    
    const escrowAddress = await escrow.getAddress();
    
    console.log('ProofPayEscrow deployed to:', escrowAddress);
    console.log('Network:', networkName);
    console.log('USDC address:', USDC_ADDRESS);
    console.log('Fee collector:', FEE_COLLECTOR);
    
    // Save deployment info
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
    
    fs.writeFileSync(
        `${dir}/addresses.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\nDeployment info saved to ${dir}/addresses.json`);
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
