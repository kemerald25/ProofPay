import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ProofPayEscrow } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

describe('ProofPayEscrow', function () {
    let escrow: ProofPayEscrow;
    let owner: HardhatEthersSigner, buyer: HardhatEthersSigner, seller: HardhatEthersSigner;
    let usdc: Contract;
    
    beforeEach(async function () {
        [owner, buyer, seller] = await ethers.getSigners();
        
        // Deploy mock USDC
        const MockUSDC = await ethers.getContractFactory('MockERC20');
        usdc = await MockUSDC.deploy('USD Coin', 'USDC', 6);
        
        // Deploy Escrow
        const Escrow = await ethers.getContractFactory('ProofPayEscrow');
        const escrowContract = await Escrow.deploy(await usdc.getAddress(), owner.address);
        escrow = escrowContract as unknown as ProofPayEscrow;
        
        // Mint USDC to buyer
        await usdc.mint(buyer.address, ethers.parseUnits('1000', 6));
    });
    
    it('Should create escrow', async function () {
        const amount = ethers.parseUnits('100', 6);
        
        const tx = await escrow.createEscrow(
            buyer.address,
            seller.address,
            amount
        );
        
        const receipt = await tx.wait();
        expect(receipt).to.not.be.null;
    });
    
    it('Should fund escrow', async function () {
        const amount = ethers.parseUnits('100', 6);
        
        const createTx = await escrow.createEscrow(
            buyer.address,
            seller.address,
            amount
        );
        
        const createReceipt = await createTx.wait();
        const logs = createReceipt?.logs.map(log => escrow.interface.parseLog(log as any)).filter(Boolean);
        const event = logs?.find(log => log?.name === 'EscrowCreated');
        const escrowId = event?.args.escrowId;
        
        // Approve USDC
        await usdc.connect(buyer).approve(await escrow.getAddress(), amount);
        
        // Fund escrow
        await expect(escrow.connect(buyer).fundEscrow(escrowId))
            .to.emit(escrow, 'EscrowFunded');
    });
    
    it('Should release funds', async function () {
        const amount = ethers.parseUnits('100', 6);
        
        // Create and fund escrow
        const createTx = await escrow.createEscrow(
            buyer.address,
            seller.address,
            amount
        );
        
        const createReceipt = await createTx.wait();
        const logs = createReceipt?.logs.map(log => escrow.interface.parseLog(log as any)).filter(Boolean);
        const event = logs?.find(log => log?.name === 'EscrowCreated');
        const escrowId = event?.args.escrowId;

        await usdc.connect(buyer).approve(await escrow.getAddress(), amount);
        await escrow.connect(buyer).fundEscrow(escrowId);
        
        // Release funds
        await expect(escrow.connect(buyer).releaseFunds(escrowId))
            .to.emit(escrow, 'EscrowCompleted');
        
        // Check seller balance
        const sellerBalance = await usdc.balanceOf(seller.address);
        expect(sellerBalance).to.be.gt(0);
    });
});
