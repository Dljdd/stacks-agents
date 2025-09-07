#!/usr/bin/env node

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  TransactionVersion,
  makeContractCall,
  standardPrincipalCV
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const NETWORK = process.env.STACKS_NETWORK || 'testnet';
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const API_URL = process.env.STACKS_API_URL || 'https://api.testnet.hiro.so';

if (!PRIVATE_KEY) {
  console.error('Error: DEPLOYER_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

const network = NETWORK === 'mainnet' 
  ? new StacksMainnet({ url: API_URL })
  : new StacksTestnet({ url: API_URL });

// Ensure private key has 0x prefix
const formattedPrivateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const privateKey = createStacksPrivateKey(formattedPrivateKey);
const deployerAddress = getAddressFromPrivateKey(formattedPrivateKey, TransactionVersion.Testnet);

console.log(`Deploying contracts to ${NETWORK}`);
console.log(`Deployer address: ${deployerAddress}`);
console.log(`API URL: ${API_URL}`);

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
      fee: 100000, // Set explicit fee (0.1 STX)
    };

    const transaction = await makeContractDeploy(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    if (result.error) {
      throw new Error(`Deployment failed: ${result.error} - ${result.reason}`);
    }
    
    console.log(`✅ ${contractName} deployed successfully`);
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

async function initializeContract(contractName, ownerAddress) {
  try {
    console.log(`\nInitializing ${contractName}...`);
    
    const txOptions = {
      contractAddress: deployerAddress,
      contractName,
      functionName: 'init-contract',
      functionArgs: [standardPrincipalCV(ownerAddress)],
      senderKey: formattedPrivateKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 50000, // Set explicit fee (0.05 STX)
    };

    const transaction = await makeContractCall(txOptions);
    const result = await broadcastTransaction(transaction, network);
    
    if (result.error) {
      throw new Error(`Initialization failed: ${result.error} - ${result.reason}`);
    }
    
    console.log(`✅ ${contractName} initialized successfully`);
    console.log(`   Transaction ID: ${result.txid}`);
    console.log(`   Owner: ${ownerAddress}`);
    
    return result.txid;
  } catch (error) {
    console.error(`❌ Failed to initialize ${contractName}:`, error.message);
    throw error;
  }
}

async function waitForTransaction(txId, timeoutMs = 60000) {
  console.log(`Waiting for transaction ${txId} to confirm...`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${API_URL}/extended/v1/tx/${txId}`);
      const tx = await response.json();
      
      if (tx.tx_status === 'success') {
        console.log(`✅ Transaction ${txId} confirmed`);
        return true;
      } else if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') {
        throw new Error(`Transaction ${txId} failed: ${tx.tx_status}`);
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      if (error.message.includes('Transaction')) {
        throw error;
      }
      // Continue waiting if it's just a network error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`Transaction ${txId} did not confirm within ${timeoutMs}ms`);
}

async function main() {
  try {
    const contractsDir = join(__dirname, '..', 'contracts');
    
    // Deploy agent-manager first
    const agentManager = await deployContract(
      'agent-manager',
      join(contractsDir, 'agent-manager.clar')
    );
    
    // Wait for agent-manager to confirm before deploying payment-processor
    await waitForTransaction(agentManager.txId);
    
    // Deploy payment-processor (depends on agent-manager)
    const paymentProcessor = await deployContract(
      'payment-processor',
      join(contractsDir, 'payment-processor.clar')
    );
    
    // Wait for payment-processor to confirm
    await waitForTransaction(paymentProcessor.txId);
    
    // Initialize both contracts (use deployer as owner)
    const agentManagerInitTx = await initializeContract('agent-manager', deployerAddress);
    await waitForTransaction(agentManagerInitTx);
    
    const paymentProcessorInitTx = await initializeContract('payment-processor', deployerAddress);
    await waitForTransaction(paymentProcessorInitTx);
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\nContract Information:');
    console.log(`Agent Manager: ${agentManager.contractId}`);
    console.log(`Payment Processor: ${paymentProcessor.contractId}`);
    console.log(`Owner: ${deployerAddress}`);
    
    console.log('\nEnvironment Variables for .env:');
    console.log(`DEPLOYER_ADDRESS=${deployerAddress}`);
    console.log(`AGENT_MANAGER_CONTRACT=${agentManager.contractId}`);
    console.log(`PAYMENT_PROCESSOR_CONTRACT=${paymentProcessor.contractId}`);
    
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
