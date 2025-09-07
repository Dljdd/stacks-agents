import pkg from '@stacks/transactions';
const { privateKeyToStxAddress } = pkg;
import { StacksTestnet } from '@stacks/network';

const deployerKey = '75bc4f380d8a70754790a341287484fc49cb4c071de130abea30288f9af39226';
const agentKey = 'd021719b39095ea2cce22ccf81838fefadeda7be52a9d47f340cdc25b3c9ea73';

const deployerAddress = privateKeyToStxAddress(deployerKey, StacksTestnet.version);
const agentAddress = privateKeyToStxAddress(agentKey, StacksTestnet.version);

console.log('📍 Addresses Generated:');
console.log('');
console.log('Deployer Address:', deployerAddress);
console.log('Agent Address:', agentAddress);
console.log('');
console.log('🚰 Next Steps:');
console.log('1. Visit: https://explorer.stacks.co/sandbox/faucet');
console.log('2. Request testnet STX for BOTH addresses above');
console.log('3. Wait 1-2 minutes for confirmation');
console.log('4. Check balances in Stacks Explorer');
console.log('');
console.log('💡 You need at least 0.5 STX in deployer address for contract deployment');
