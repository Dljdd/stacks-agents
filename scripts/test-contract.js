#!/usr/bin/env node

// Simple script to test if smart contracts are actually deployed
console.log('🔍 Testing Smart Contract Deployment Status\n');

// Check if we have real contract addresses vs demo mode
const demoAddress = 'ST23Z1N1XD66CM151FM7NFPJ1VXPE6RT51XH4CG7';
const contractAddress = 'ST23Z1N1XD66CM151FM7NFPJ1VXPE6RT51XH4CG7.agent-manager2';

console.log('Current Contract Address:', contractAddress);
console.log('Demo Mode Address Pattern:', demoAddress);

if (contractAddress.includes(demoAddress)) {
  console.log('\n❌ DEMO MODE DETECTED');
  console.log('Your contracts are NOT deployed to the blockchain.');
  console.log('All transactions are fake/simulated.');
} else {
  console.log('\n✅ REAL DEPLOYMENT DETECTED');
  console.log('Contracts appear to be deployed to testnet.');
}

console.log('\n🔗 To test real deployment:');
console.log('1. Generate keys: node generate-keys.js');
console.log('2. Get addresses: node get-addresses.js');
console.log('3. Fund addresses: https://explorer.stacks.co/sandbox/faucet');
console.log('4. Deploy contracts: node deploy-contracts.js');
console.log('5. Update backend .env with real addresses');

console.log('\n📊 Current Status: DEMO MODE ONLY');
console.log('Explorer links will show "Transaction not found"');
