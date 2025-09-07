# Troubleshooting Guide

Common issues and solutions for the Stacks AI Payment Agent system.

## Installation Issues

### Node.js Dependencies

**Problem**: `npm install` fails with permission errors
```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Use node version manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or fix npm permissions
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

**Problem**: Python dependencies fail to install
```
error: Microsoft Visual C++ 14.0 is required
```

**Solution**:
```bash
# macOS
brew install python3
pip3 install -r backend/requirements.txt

# Windows
# Install Visual Studio Build Tools
# Or use conda: conda install scikit-learn numpy pandas
```

## Contract Deployment

### Private Key Issues

**Problem**: "Improperly formatted private-key"
```
Error: Improperly formatted private-key. Private-key byte length should be 32 or 33
```

**Solution**:
```bash
# Ensure private key is 64 hex characters
echo $DEPLOYER_PRIVATE_KEY | wc -c  # Should be 65 (64 + newline)

# Add 0x prefix if missing
export DEPLOYER_PRIVATE_KEY=0x${DEPLOYER_PRIVATE_KEY}

# Generate new key if corrupted
cd scripts && npm run generate-keys
```

### Insufficient Funds

**Problem**: "Insufficient funds for transaction"

**Solution**:
```bash
# Check balance
curl "https://api.testnet.hiro.so/extended/v1/address/ST_YOUR_ADDRESS/balances"

# Get testnet STX
# Visit: https://explorer.stacks.co/sandbox/faucet

# Verify transaction fees
# Deployment costs ~0.1 STX per contract
```

### Contract Already Exists

**Problem**: "Contract already exists"

**Solution**:
```bash
# Use different contract name
stx deploy_contract agent-manager-v2 contracts/agent-manager.clar --testnet

# Or use different deployer address
npm run generate-keys  # Generate new deployer key
```

## Backend Issues

### Environment Variables

**Problem**: Backend starts but API calls fail
```
Error: Cannot read property 'DEPLOYER_ADDRESS' of undefined
```

**Solution**:
```bash
# Check .env file exists
ls -la backend/.env

# Verify environment loading
cd backend
node -e "require('dotenv').config(); console.log(process.env.DEPLOYER_ADDRESS)"

# Create .env if missing
cp backend/.env.example backend/.env
```

### Port Conflicts

**Problem**: "EADDRINUSE: address already in use :::3001"

**Solution**:
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 PID_NUMBER

# Or use different port
PORT=3002 npm start
```

### Stacks API Connection

**Problem**: API calls to Stacks network timeout
```
Error: connect ETIMEDOUT
```

**Solution**:
```bash
# Test Stacks API connectivity
curl https://api.testnet.hiro.so/v2/info

# Try different API endpoint
export STACKS_API_URL=https://stacks-node-api.testnet.stacks.co

# Check firewall/proxy settings
```

## Frontend Issues

### CORS Errors

**Problem**: "Access to fetch blocked by CORS policy"

**Solution**:
```bash
# Ensure backend CORS is configured
# Check backend/src/index.js has: app.use(cors())

# For development, use proxy in vite.config.js:
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

### WebSocket Connection Failed

**Problem**: WebSocket connection drops or fails

**Solution**:
```javascript
// Add reconnection logic
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:3001/ws/updates');
  
  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting...');
    setTimeout(connectWebSocket, 5000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}
```

### Build Errors

**Problem**: Frontend build fails with module errors
```
Module not found: Can't resolve 'axios'
```

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check package.json dependencies
npm list axios

# Install missing dependencies
npm install axios
```

## AI Agent Issues

### OpenAI API Errors

**Problem**: "OpenAI API key not found"

**Solution**:
```bash
# Set OpenAI API key
export OPENAI_API_KEY=sk-your-key-here

# Or disable OpenAI and use regex fallback
# Comment out OpenAI code in payment-agent.py
```

### Python Import Errors

**Problem**: "ModuleNotFoundError: No module named 'sklearn'"

**Solution**:
```bash
# Install missing packages
pip install scikit-learn numpy pandas

# Or use conda
conda install scikit-learn

# Check Python path
python -c "import sys; print(sys.path)"
```

### Model Training Fails

**Problem**: Fraud detection model training errors

**Solution**:
```bash
# Generate sample data first
cd backend/src/services
python -c "
import pandas as pd
import numpy as np
data = pd.DataFrame({
    'amount': np.random.randint(1000, 2000000, 1000),
    'is_fraud': np.random.choice([0, 1], 1000, p=[0.95, 0.05])
})
data.to_csv('sample_transactions.csv', index=False)
"

# Then train model
python train_fraud_model.py
```

## Docker Issues

### Docker Daemon Not Running

**Problem**: "Cannot connect to the Docker daemon"

**Solution**:
```bash
# Start Docker Desktop (macOS/Windows)
open -a Docker

# Start Docker service (Linux)
sudo systemctl start docker

# Verify Docker is running
docker version
```

### Container Build Fails

**Problem**: Docker build fails with dependency errors

**Solution**:
```bash
# Clear Docker cache
docker system prune -a

# Build with no cache
docker-compose build --no-cache

# Check Dockerfile syntax
docker build -t test-build -f Dockerfile.backend .
```

### Volume Mount Issues

**Problem**: Files not syncing between host and container

**Solution**:
```bash
# Check volume mounts in docker-compose.yml
# Ensure paths are correct and permissions allow access

# For Windows, enable drive sharing in Docker Desktop
# For macOS, check file sharing settings
```

## Performance Issues

### Slow API Responses

**Problem**: API endpoints take >5 seconds to respond

**Solution**:
```bash
# Check backend logs for bottlenecks
tail -f backend/logs/app.log

# Monitor Stacks API response times
curl -w "@curl-format.txt" https://api.testnet.hiro.so/v2/info

# Add caching for frequent queries
# Implement connection pooling
```

### High Memory Usage

**Problem**: Backend process uses excessive memory

**Solution**:
```bash
# Monitor memory usage
top -p $(pgrep node)

# Clear caches periodically
# Implement cache size limits in backend/src/index.js

# Use streaming for large responses
```

## Security Issues

### JWT Token Errors

**Problem**: "Invalid token" or "Token expired"

**Solution**:
```bash
# Check JWT secret is set
echo $JWT_SECRET

# Verify token format
node -e "
const jwt = require('jsonwebtoken');
try {
  const decoded = jwt.verify('your_token', 'your_secret');
  console.log(decoded);
} catch(e) {
  console.error(e.message);
}
"

# Generate new token for testing
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({user: 'test'}, 'test-secret');
console.log(token);
"
```

### Private Key Exposure

**Problem**: Private keys accidentally committed to git

**Solution**:
```bash
# Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/.env' \
  --prune-empty --tag-name-filter cat -- --all

# Generate new keys immediately
cd scripts && npm run generate-keys

# Add to .gitignore
echo "backend/.env" >> .gitignore
echo "*.key" >> .gitignore
```

## Network Issues

### Testnet Connection Problems

**Problem**: Cannot connect to Stacks testnet

**Solution**:
```bash
# Test different API endpoints
curl https://api.testnet.hiro.so/v2/info
curl https://stacks-node-api.testnet.stacks.co/v2/info

# Check network status
curl https://status.hiro.so/api/v2/status.json

# Use local Stacks node if needed
# Follow Stacks documentation for local setup
```

### Transaction Stuck

**Problem**: Transaction pending for hours

**Solution**:
```bash
# Check transaction status
curl "https://api.testnet.hiro.so/extended/v1/tx/0xYOUR_TX_ID"

# Check mempool
curl "https://api.testnet.hiro.so/extended/v1/tx/mempool"

# Increase fee for faster confirmation
# Or wait for network congestion to clear
```

## Debugging Tools

### Enable Debug Logging

```bash
# Backend debug mode
DEBUG=* npm start

# Frontend debug mode
VITE_DEBUG=true npm run dev

# Python debug mode
export PYTHONPATH=.
python -m pdb payment-agent.py
```

### API Testing Tools

```bash
# Install httpie for better API testing
pip install httpie

# Test endpoints
http GET localhost:3001/health
http POST localhost:3001/api/agents/create Authorization:"Bearer test" name="Debug Agent" owner="ST..."

# Use Postman collection (if available)
# Import API.md examples into Postman
```

### Log Analysis

```bash
# Backend logs
tail -f backend/logs/app.log | grep ERROR

# Frontend console logs
# Open browser dev tools -> Console

# System logs
journalctl -u docker  # Linux
tail -f /var/log/system.log | grep Docker  # macOS
```

## Getting Help

### Check Documentation
1. [README.md](../README.md) - Overview and quick start
2. [API.md](../API.md) - Complete API reference
3. [deployment.md](./deployment.md) - Contract deployment guide

### Community Resources
- **Stacks Discord**: https://discord.gg/stacks
- **Stacks Forum**: https://forum.stacks.org
- **GitHub Issues**: Create issue with error details

### Debug Information to Include

When reporting issues, include:

```bash
# System information
uname -a
node --version
npm --version
python --version

# Environment
echo $STACKS_NETWORK
echo $DEPLOYER_ADDRESS

# Error logs
tail -50 backend/logs/app.log

# API test results
curl -v localhost:3001/health
```

### Emergency Recovery

If system is completely broken:

```bash
# Reset to clean state
git clean -fdx
git reset --hard HEAD

# Reinstall everything
npm install
cd frontend && npm install && cd ..
cd scripts && npm install && cd ..

# Regenerate keys
cd scripts && npm run generate-keys

# Restart from deployment guide
```
