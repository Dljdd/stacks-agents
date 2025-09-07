#!/usr/bin/env node

import { randomBytes } from 'crypto';
import { createStacksPrivateKey, getAddressFromPrivateKey, TransactionVersion } from '@stacks/transactions';
import fs from 'fs';
import path from 'path';

console.log('🔑 Setting up Real Blockchain Deployment\n');

// Generate new keys for real deployment
const deployerKey = randomBytes(32).toString('hex');
const agentKey = randomBytes(32).toString('hex');

const deployerPrivKey = createStacksPrivateKey(deployerKey);
const agentPrivKey = createStacksPrivateKey(agentKey);

const deployerAddr = getAddressFromPrivateKey(deployerPrivKey, TransactionVersion.Testnet);
const agentAddr = getAddressFromPrivateKey(agentPrivKey, TransactionVersion.Testnet);

console.log('Generated Keys:');
console.log(`Deployer Address: ${deployerAddr}`);
console.log(`Agent Address: ${agentAddr}`);
console.log('');

// Create .env file with real keys
const envContent = `# Stacks Network Configuration
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so

# Contract Addresses (Will be updated after deployment)
DEPLOYER_ADDRESS=${deployerAddr}
AGENT_MANAGER_CONTRACT=${deployerAddr}.agent-manager
PAYMENT_PROCESSOR_CONTRACT=${deployerAddr}.payment-processor

# Generated Keys
DEPLOYER_PRIVATE_KEY=${deployerKey}
AGENT_PRIVATE_KEY=${agentKey}
AGENT_ADDRESS=${agentAddr}

# Backend Configuration
JWT_SECRET=stacks-ai-agents-jwt-secret-${randomBytes(16).toString('hex')}
PORT=3001

# Enable Real Blockchain Transactions
DEMO_MODE=false
`;

// Write to backend .env
const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
fs.writeFileSync(backendEnvPath, envContent);

console.log('✅ Created backend/.env with real deployment keys');
console.log('');
console.log('🚨 IMPORTANT NEXT STEPS:');
console.log('1. Fund these addresses with testnet STX:');
console.log(`   https://explorer.stacks.co/sandbox/faucet?chain=testnet`);
console.log(`   Deployer: ${deployerAddr}`);
console.log(`   Agent: ${agentAddr}`);
console.log('');
console.log('2. Deploy contracts:');
console.log('   cd /Users/dylanmoraes/Documents/GitHub/stacks-agents');
console.log('   node scripts/deploy-contracts.js');
console.log('');
console.log('3. Restart backend to use real blockchain:');
console.log('   cd backend && node src/index.js');
