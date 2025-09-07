# Stacks AI Payment Agents

A comprehensive AI-powered payment agent system built on the Stacks blockchain with intelligent fraud detection, real-time monitoring, and automated payment processing capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ (for AI agents)
- Git

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd stacks-agents

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies  
cd frontend && npm install && cd ..

# Install deployment scripts
cd scripts && npm install && cd ..

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 2. Generate Keys
```bash
cd scripts
npm run generate-keys
```
Save the output private keys securely.

### 3. Start Development Environment
```bash
# Terminal 1: Start backend
cd backend
PORT=3001 npm start

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 4. Access the System
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **API Documentation**: See [API.md](./API.md)

## 📋 What's Included

### Smart Contracts (Clarity)
- **agent-manager.clar**: Agent registration, authorization, and limits
- **payment-processor.clar**: Payment execution with rules and validation
- **rules-engine.clar**: Advanced rule management

### Backend Services (Node.js)
- **REST API**: Agent management and payment processing
- **WebSocket**: Real-time event streaming
- **Stacks Integration**: Blockchain transaction handling
- **Authentication**: JWT-based security

### AI Agents (Python)
- **Payment Agent**: NLP-powered payment instruction processing
- **Fraud Detection**: ML-based risk assessment and anomaly detection
- **Context Management**: Adaptive learning and history tracking

### Frontend (React)
- **Agent Dashboard**: Create and manage AI agents
- **Payment Interface**: Process payments with real-time status
- **Analytics**: Spending trends and performance metrics
- **Monitoring**: Live transaction and event tracking

### Deployment
- **Docker**: Multi-service orchestration with docker-compose
- **Kubernetes**: Production-ready manifests with autoscaling
- **Scripts**: Automated contract deployment and key generation

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
# Network Configuration
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so

# Contract Addresses (set after deployment)
DEPLOYER_ADDRESS=ST...
AGENT_MANAGER_CONTRACT=ST....agent-manager
PAYMENT_PROCESSOR_CONTRACT=ST....payment-processor

# Keys
AGENT_PRIVATE_KEY=your_agent_private_key
AGENT_ADDRESS=ST...

# Security
JWT_SECRET=your_jwt_secret
```

**Frontend (.env)**:
```env
VITE_API_BASE=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws/updates
```

## 📚 Documentation

- **[Contract Deployment Guide](./docs/deployment.md)** - Deploy contracts to testnet/mainnet
- **[API Integration Guide](./docs/api-integration.md)** - Integrate with the REST API
- **[Agent Manager Documentation](./docs/agent-manager.md)** - Smart contract details
- **[Payment Processor Documentation](./docs/payment-processor.md)** - Payment flow details
- **[Troubleshooting Guide](./docs/troubleshooting.md)** - Common issues and solutions

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │ Stacks Blockchain│
│   (React)       │◄──►│   (Express)     │◄──►│   (Clarity)     │
│                 │    │                 │    │                 │
│ • Agent UI      │    │ • REST API      │    │ • agent-manager │
│ • Payment Forms │    │ • WebSocket     │    │ • payment-proc  │
│ • Analytics     │    │ • Auth (JWT)    │    │ • rules-engine  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   AI Agents     │
                       │   (Python)      │
                       │                 │
                       │ • Payment Agent │
                       │ • Fraud Detect  │
                       │ • NLP Processing│
                       └─────────────────┘
```

## 🚀 Production Deployment

### Option 1: Docker Compose
```bash
# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Deploy with Docker
docker-compose up -d

# Access at https://localhost (with SSL)
```

### Option 2: Kubernetes
```bash
# Configure secrets
kubectl apply -f deployment.yml

# Access via LoadBalancer or Ingress
```

### Option 3: Manual Deployment

1. **Deploy Smart Contracts**:
   ```bash
   cd scripts
   export DEPLOYER_PRIVATE_KEY=your_key
   npm run deploy
   ```

2. **Configure Backend**:
   ```bash
   cd backend
   # Update .env with contract addresses from step 1
   npm start
   ```

3. **Build and Serve Frontend**:
   ```bash
   cd frontend
   npm run build
   # Serve dist/ with nginx or your preferred server
   ```

## 🧪 Testing

### Run Backend Tests
```bash
cd backend/src/services
python -m unittest test_payment_agent.py
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Create agent
curl -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Agent","owner":"ST...","limits":{"daily":2000000}}' \
     http://localhost:3001/api/agents/create

# Process payment
curl -H "Authorization: Bearer test" \
     -H "Content-Type: application/json" \
     -d '{"agentId":"ST...","amount":1500000,"recipient":"SP...","memo":"test"}' \
     http://localhost:3001/api/payments/process
```

### Test AI Agents
```bash
cd backend/src/services

# Test payment agent
python payment-agent.py --agent-id ST... --instruction "send 1.5 STX to SP... for hosting"

# Test fraud detection
python fraud-detection-agent.py --mode score --tx '{"amount":1500000,"status":"submitted"}'
```

## 🔒 Security

- **Private Keys**: Never commit to version control, use environment variables
- **JWT Tokens**: Rotate regularly, use strong secrets
- **Rate Limiting**: Configured in nginx.conf and backend
- **Input Validation**: All endpoints validate inputs
- **CORS**: Configured for your domains only

## 📈 Monitoring

- **Health Endpoints**: `/health` for service monitoring
- **WebSocket Events**: Real-time transaction status
- **Logs**: Structured logging with timestamps
- **Metrics**: Payment volumes, success rates, agent performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🆘 Support

- **Documentation**: Check [docs/](./docs/) directory
- **Issues**: Create GitHub issues for bugs
- **API Reference**: See [API.md](./API.md)
- **Troubleshooting**: See [docs/troubleshooting.md](./docs/troubleshooting.md)
