#!/usr/bin/env node

import { StacksTestnet } from '@stacks/network';
import { 
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode
} from '@stacks/transactions';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const network = new StacksTestnet();
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (!deployerPrivateKey) {
  console.error('❌ DEPLOYER_PRIVATE_KEY environment variable required');
  console.log('Usage: DEPLOYER_PRIVATE_KEY=your-key node deploy-rules-engine.js');
  process.exit(1);
}

async function deployRulesEngine() {
  try {
    console.log('🚀 Deploying Rules Engine Contract...\n');

    // Read contract source
    const contractPath = join(__dirname, '../contracts/rules-engine.clar');
    const contractSource = readFileSync(contractPath, 'utf8');

    console.log('📄 Contract Source Length:', contractSource.length, 'characters');

    // Create deployment transaction
    const deployTx = await makeContractDeploy({
      contractName: 'rules-engine',
      codeBody: contractSource,
      senderKey: deployerPrivateKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 75000, // 0.075 STX fee (larger contract)
    });

    console.log('📡 Broadcasting transaction...');
    
    // Broadcast transaction
    const result = await broadcastTransaction(deployTx, network);
    
    if (result.error) {
      console.error('❌ Deployment failed:', result.error);
      console.error('Reason:', result.reason);
      process.exit(1);
    }

    console.log('✅ Rules Engine deployed successfully!');
    console.log('Transaction ID:', result.txid);
    console.log('Explorer:', `https://explorer.stacks.co/txid/${result.txid}?chain=testnet`);
    
    // Extract deployer address from transaction
    const deployerAddress = deployTx.auth.spendingCondition.signer;
    const contractAddress = `${deployerAddress}.rules-engine`;
    
    console.log('\n📋 Contract Details:');
    console.log('Contract Address:', contractAddress);
    console.log('Deployer Address:', deployerAddress);
    
    console.log('\n🔧 Add to your .env file:');
    console.log(`RULES_ENGINE_CONTRACT=${contractAddress}`);
    
    return {
      txid: result.txid,
      contractAddress,
      deployerAddress
    };

  } catch (error) {
    console.error('❌ Deployment error:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployRulesEngine()
  .then((result) => {
    console.log('\n🎉 Rules Engine deployment complete!');
  })
  .catch((error) => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  });
