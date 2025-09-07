# Contract Deployment Guide

This guide covers deploying the Stacks AI Payment Agent smart contracts to testnet or mainnet.

## Prerequisites

- Node.js 18+ and npm
- Stacks CLI or deployment scripts (included)
- STX tokens for deployment fees
- Private key for deployment account

## 1. Generate Deployment Keys

```bash
cd scripts
npm install
npm run generate-keys
```

This generates:
- **Deployer Private Key**: Used to deploy contracts
- **Agent Private Key**: Used by agents to sign transactions

**⚠️ Security**: Save these keys securely and never commit to version control.

## 2. Fund Deployment Address

### Testnet
1. Get your deployer address from the key generation output
2. Visit [Stacks Testnet Faucet](https://explorer.stacks.co/sandbox/faucet)
3. Request testnet STX for your deployer address
4. Wait for confirmation (usually 1-2 minutes)

### Mainnet
1. Transfer STX to your deployer address
2. Ensure sufficient balance for deployment fees (~0.1 STX per contract)

## 3. Deploy Contracts

### Automatic Deployment (Recommended)

```bash
cd scripts
export DEPLOYER_PRIVATE_KEY=your_deployer_private_key_here
npm run deploy
```

This will:
1. Deploy `agent-manager.clar`
2. Deploy `payment-processor.clar` 
3. Initialize both contracts
4. Output contract addresses for configuration

### Manual Deployment

If you prefer manual control:

```bash
# Deploy agent-manager
stx deploy_contract agent-manager contracts/agent-manager.clar --testnet

# Deploy payment-processor  
stx deploy_contract payment-processor contracts/payment-processor.clar --testnet

# Initialize contracts
stx call_contract_func ST...agent-manager init-contract ST_YOUR_ADMIN_ADDRESS --testnet
stx call_contract_func ST...payment-processor init-contract ST_YOUR_ADMIN_ADDRESS --testnet
```

## 4. Verify Deployment

Check contract deployment status:

```bash
# Check agent-manager
curl "https://api.testnet.hiro.so/v2/contracts/interface/ST_DEPLOYER_ADDRESS/agent-manager"

# Check payment-processor
curl "https://api.testnet.hiro.so/v2/contracts/interface/ST_DEPLOYER_ADDRESS/payment-processor"
```

## 5. Configure Backend

Update `backend/.env` with deployed contract addresses:

```env
DEPLOYER_ADDRESS=ST7F3D4KTKGZT6Z1TMDC68M7THS8K3E86RJFBZ4V
AGENT_MANAGER_CONTRACT=ST7F3D4KTKGZT6Z1TMDC68M7THS8K3E86RJFBZ4V.agent-manager
PAYMENT_PROCESSOR_CONTRACT=ST7F3D4KTKGZT6Z1TMDC68M7THS8K3E86RJFBZ4V.payment-processor
```

## 6. Test Deployment

### Create Test Agent

```bash
cd backend
npm start

# In another terminal
curl -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Agent","owner":"ST_YOUR_AGENT_ADDRESS","limits":{"daily":2000000}}' \
     http://localhost:3001/api/agents/create
```

### Process Test Payment

```bash
curl -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{"agentId":"ST_YOUR_AGENT_ADDRESS","amount":100000,"recipient":"SP_RECIPIENT","memo":"test"}' \
     http://localhost:3001/api/payments/process
```

## Contract Details

### Agent Manager Contract

**Functions**:
- `init-contract(owner)`: Initialize with admin
- `register-agent(agent-id, permissions)`: Register new agent
- `authorize-agent(agent-id)`: Enable agent for payments
- `set-spending-limit(agent-id, daily, monthly)`: Set limits
- `get-agent-info(agent-id)`: Query agent details

### Payment Processor Contract

**Functions**:
- `init-contract(owner)`: Initialize with admin
- `update-payment-rules(agent-id, max-amount, recipients)`: Set rules
- `execute-payment(agent-id, recipient, amount, memo)`: Process payment
- `get-payment-history(agent-id, limit)`: Query history

## Network Configuration

### Testnet
- **API URL**: `https://api.testnet.hiro.so`
- **Explorer**: `https://explorer.stacks.co/?chain=testnet`
- **Faucet**: `https://explorer.stacks.co/sandbox/faucet`

### Mainnet
- **API URL**: `https://api.hiro.so`
- **Explorer**: `https://explorer.stacks.co`

## Troubleshooting

### Common Issues

**"Insufficient funds"**:
- Ensure deployer address has enough STX
- Check balance: `stx balance ST_YOUR_ADDRESS --testnet`

**"Contract already exists"**:
- Use different contract name or deployer address
- Check existing contracts: `stx get_contract_info ST_ADDRESS CONTRACT_NAME --testnet`

**"Invalid private key"**:
- Ensure private key has 0x prefix
- Verify key format: 64 hex characters

**"Transaction failed"**:
- Check transaction details in explorer
- Verify contract syntax with `clarity-cli check`

### Getting Help

- Check [troubleshooting.md](./troubleshooting.md)
- View transaction details in Stacks Explorer
- Test contracts locally with Clarinet

## Security Best Practices

1. **Private Key Management**:
   - Use hardware wallets for mainnet
   - Never share private keys
   - Use environment variables, not hardcoded values

2. **Contract Security**:
   - Test thoroughly on testnet first
   - Audit contract code before mainnet deployment
   - Use multi-sig for admin functions

3. **Access Control**:
   - Set proper admin addresses
   - Limit agent permissions appropriately
   - Monitor contract interactions

## Next Steps

After successful deployment:

1. **Configure Backend**: Update environment variables
2. **Set Up Monitoring**: Track contract events and transactions
3. **Create Agents**: Register and authorize payment agents
4. **Test Thoroughly**: Verify all functionality works as expected
5. **Deploy Frontend**: Configure UI to use deployed contracts
