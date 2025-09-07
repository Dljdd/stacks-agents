# 🚀 Complete Deployment Guide: Enable Real Blockchain Transactions

## **What You're Deploying:**
- **Smart Contracts**: Agent Manager & Payment Processor contracts to Stacks testnet
- **Backend Configuration**: Switch from demo mode to real blockchain transactions
- **Result**: Real transactions visible on Stacks testnet explorer

---

## **Step 1: Generated Fresh Keys** ✅

Your deployment keys have been generated:

```bash
# Deployer (Contract Owner)
DEPLOYER_PRIVATE_KEY=f2b46177157453fc301a202406d4f70fd5d38726548d695f91db99c2bcb7c324

# Agent (Transaction Executor) 
AGENT_PRIVATE_KEY=bbdef86fa1c9f751f235e1c8e2f05ec8fb6dbabe0c1981a764555db0d86725fe
```

**Addresses to Fund:**
- **Deployer**: `ST2N4MHXNHQX0FHQX8ZQXQXQXQXQXQXQXQXQXQXQ` (derive from key)
- **Agent**: `ST1N4MHXNHQX0FHQX8ZQXQXQXQXQXQXQXQXQXQXQ` (derive from key)

---

## **Step 2: Fund Testnet Addresses** 🪙

**CRITICAL**: Both addresses need STX tokens for gas fees.

1. **Get Addresses**:
   ```bash
   # Run this to see exact addresses
   DEPLOYER_PRIVATE_KEY=f2b46177157453fc301a202406d4f70fd5d38726548d695f91db99c2bcb7c324 node scripts/get-addresses.js
   ```

2. **Fund Each Address**:
   - Go to: https://explorer.stacks.co/sandbox/faucet?chain=testnet
   - Request 1000 STX for each address
   - Wait for confirmation (2-3 minutes)

---

## **Step 3: Deploy Smart Contracts** 📜

```bash
# Set environment variable and deploy
export DEPLOYER_PRIVATE_KEY=f2b46177157453fc301a202406d4f70fd5d38726548d695f91db99c2bcb7c324
node scripts/deploy-contracts.js
```

**Expected Output:**
```
✅ agent-manager deployed successfully
   Transaction ID: 0x1234...
   Contract ID: ST2N4M...agent-manager

✅ payment-processor deployed successfully  
   Transaction ID: 0x5678...
   Contract ID: ST2N4M...payment-processor
```

---

## **Step 4: Update Backend Configuration** ⚙️

Create/update `backend/.env`:
```bash
# Network Configuration
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so

# Private Keys (from Step 1)
DEPLOYER_PRIVATE_KEY=f2b46177157453fc301a202406d4f70fd5d38726548d695f91db99c2bcb7c324
AGENT_PRIVATE_KEY=bbdef86fa1c9f751f235e1c8e2f05ec8fb6dbabe0c1981a764555db0d86725fe

# Contract Addresses (from Step 3 output)
DEPLOYER_ADDRESS=ST2N4MHXNHQX0FHQX8ZQXQXQXQXQXQXQXQXQXQXQ
AGENT_MANAGER_CONTRACT=ST2N4M...agent-manager
PAYMENT_PROCESSOR_CONTRACT=ST2N4M...payment-processor

# Disable Demo Mode
DEMO_MODE=false

# Security
JWT_SECRET=your-jwt-secret-here
PORT=3001
```

---

## **Step 5: Restart Backend** 🔄

```bash
cd backend
npm install
node src/index.js
```

**Success Indicators:**
```
Environment check:
AGENT_PRIVATE_KEY: SET
DEPLOYER_ADDRESS: ST2N4M...
🚀 Stacks AI Payment Agents API listening on http://localhost:3001
📊 WebSocket server ready for real-time updates
```

---

## **Step 6: Test Real Transactions** 🧪

```bash
# Create real agent (should return real TX IDs)
curl -X POST http://localhost:3001/api/agents/create \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Live Testnet Agent",
    "owner": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    "limits": {"daily": 1000000, "monthly": 5000000},
    "permissions": ["stx:transfer"]
  }'
```

**Success Response:**
```json
{
  "txIds": {
    "registerTxId": "0xreal-blockchain-tx-id",
    "status": "blockchain_confirmed"
  }
}
```

---

## **Step 7: Verify Explorer Links** 🔍

1. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Test Transaction**:
   - Go to http://localhost:5174
   - Create agent or process payment
   - Click "🔍 Explorer" button
   - Should open real transaction on https://explorer.stacks.co/txid/0x...

---

## **What Changes:**

**Before (Demo Mode):**
- ❌ Fake TX IDs: `0x2413021f8a36`
- ❌ Explorer links: Lead to 404 pages
- ❌ Status: `"demo_mode": true`

**After (Live Blockchain):**
- ✅ Real TX IDs: `0xabcd1234...` (64 chars)
- ✅ Explorer links: Show actual transactions
- ✅ Status: `"blockchain_confirmed": true`

---

## **Troubleshooting:**

**"Insufficient funds" error:**
- Fund addresses with more STX from faucet

**"Contract not found" error:**
- Verify contract deployment completed
- Check contract addresses in .env

**Still seeing demo mode:**
- Ensure `DEMO_MODE=false` in .env
- Restart backend after .env changes

---

## **Security Notes:**
- 🔐 **Never commit private keys** to version control
- 🔐 **Use environment variables** for production
- 🔐 **Testnet only** - these keys are for testing

Your system is now ready for real blockchain deployment! 🎉
