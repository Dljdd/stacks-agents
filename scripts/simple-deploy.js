#!/usr/bin/env node

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  TransactionVersion
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('Error: DEPLOYER_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

const network = new StacksTestnet({ url: 'https://api.testnet.hiro.so' });
const formattedPrivateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const privateKey = createStacksPrivateKey(formattedPrivateKey);
const deployerAddress = getAddressFromPrivateKey(formattedPrivateKey, TransactionVersion.Testnet);

console.log(`Deploying contracts to testnet`);
console.log(`Deployer address: ${deployerAddress}`);

async function deployContract(contractName, contractPath) {
  try {
    console.log(`\nDeploying ${contractName}...`);
    
    const contractSource = readFileSync(contractPath, 'utf8');
    
    const txOptions = {
      contractName,
      codeBody: contractSource,
      senderKey: formattedPrivateKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 200000, // 0.2 STX fee
    };

    const transaction = await makeContractDeploy(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    if (result.error) {
      throw new Error(`Deployment failed: ${result.error} - ${result.reason}`);
    }
    
    console.log(`✅ ${contractName} deployment submitted`);
    console.log(`   Transaction ID: ${result.txid}`);
    console.log(`   Contract ID: ${deployerAddress}.${contractName}`);
    
    return {
      contractName,
      contractId: `${deployerAddress}.${contractName}`,
      txId: result.txid
    };
  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    // Deploy contracts
    const agentManager = await deployContract('agent-manager', join(__dirname, '../contracts/agent-manager.clar'));
    const paymentProcessor = await deployContract('payment-processor', join(__dirname, '../contracts/payment-processor.clar'));
    
    console.log('\n🎉 Deployment Summary:');
    console.log(`Agent Manager: ${agentManager.contractId}`);
    console.log(`Payment Processor: ${paymentProcessor.contractId}`);
    console.log(`Deployer Address: ${deployerAddress}`);
    
    console.log('\n📝 Environment Variables for backend/.env:');
    console.log(`DEPLOYER_ADDRESS=${deployerAddress}`);
    console.log(`AGENT_MANAGER_CONTRACT=${agentManager.contractId}`);
    console.log(`PAYMENT_PROCESSOR_CONTRACT=${paymentProcessor.contractId}`);
    console.log(`AGENT_PRIVATE_KEY=844c0aa2be2a9f5a9ff4e2cddc3cde0ede554d6255afa9f534c95e98b0928620`);
    console.log(`AGENT_ADDRESS=ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG`);
    
    console.log('\n⏳ Note: Contracts may take 1-2 minutes to be available on the network');
    console.log('Check transaction status at: https://explorer.stacks.co/?chain=testnet');
    
  } catch (error) {
    console.error('💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
