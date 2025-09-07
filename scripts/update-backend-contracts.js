#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get contract addresses from command line arguments
const agentManagerContract = process.argv[2];
const paymentProcessorContract = process.argv[3];
const rulesEngineContract = process.argv[4];

if (!agentManagerContract || !paymentProcessorContract || !rulesEngineContract) {
  console.log('Usage: node update-backend-contracts.js <agent-manager> <payment-processor> <rules-engine>');
  console.log('Example: node update-backend-contracts.js ST1234.agent-manager ST1234.payment-processor ST1234.rules-engine');
  process.exit(1);
}

console.log('🔧 Updating Backend Contract Addresses...\n');

// Update backend configuration
const backendEnvPath = join(__dirname, '../backend/.env');
const backendEnvExamplePath = join(__dirname, '../backend/.env.example');

// Read current .env file or use example as template
let envContent;
try {
  envContent = readFileSync(backendEnvPath, 'utf8');
  console.log('✅ Found existing .env file');
} catch (error) {
  envContent = readFileSync(backendEnvExamplePath, 'utf8');
  console.log('📄 Using .env.example as template');
}

// Update contract addresses
envContent = envContent.replace(
  /AGENT_MANAGER_CONTRACT=.*/,
  `AGENT_MANAGER_CONTRACT=${agentManagerContract}`
);

envContent = envContent.replace(
  /PAYMENT_PROCESSOR_CONTRACT=.*/,
  `PAYMENT_PROCESSOR_CONTRACT=${paymentProcessorContract}`
);

// Add rules engine contract if not present
if (!envContent.includes('RULES_ENGINE_CONTRACT=')) {
  envContent += `\nRULES_ENGINE_CONTRACT=${rulesEngineContract}\n`;
} else {
  envContent = envContent.replace(
    /RULES_ENGINE_CONTRACT=.*/,
    `RULES_ENGINE_CONTRACT=${rulesEngineContract}`
  );
}

// Ensure demo mode is disabled
envContent = envContent.replace(
  /DEMO_MODE=.*/,
  'DEMO_MODE=false'
);

// Write updated .env file
writeFileSync(backendEnvPath, envContent);

console.log('📋 Updated Contract Addresses:');
console.log(`Agent Manager: ${agentManagerContract}`);
console.log(`Payment Processor: ${paymentProcessorContract}`);
console.log(`Rules Engine: ${rulesEngineContract}`);

console.log('\n✅ Backend .env file updated successfully!');
console.log('🔄 Restart your backend server to use the new contracts');

console.log('\n🔗 Explorer Links:');
console.log(`Agent Manager: https://explorer.stacks.co/address/${agentManagerContract}?chain=testnet`);
console.log(`Payment Processor: https://explorer.stacks.co/address/${paymentProcessorContract}?chain=testnet`);
console.log(`Rules Engine: https://explorer.stacks.co/address/${rulesEngineContract}?chain=testnet`);
