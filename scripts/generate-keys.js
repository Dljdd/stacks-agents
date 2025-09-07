#!/usr/bin/env node

import { randomBytes } from 'crypto';

console.log('🔑 Generating Stacks Keys for Testnet\n');

// Generate random 32-byte private keys
function generatePrivateKey() {
  return randomBytes(32).toString('hex');
}

// Generate deployer keys
const deployerSecretKey = generatePrivateKey();
console.log('Deployer Keys:');
console.log(`Private Key: ${deployerSecretKey}`);

// Generate agent keys  
const agentSecretKey = generatePrivateKey();
console.log('\nAgent Keys:');
console.log(`Private Key: ${agentSecretKey}`);

console.log('\nEnvironment Variables for .env:');
console.log(`DEPLOYER_PRIVATE_KEY=${deployerSecretKey}`);
console.log(`AGENT_PRIVATE_KEY=${agentSecretKey}`);

console.log('\n⚠️  Important Notes:');
console.log('1. Use these keys to derive addresses in the deploy script');
console.log('2. Fund both addresses with testnet STX from: https://explorer.stacks.co/sandbox/faucet');
console.log('3. Keep private keys secure and never commit them to version control');
