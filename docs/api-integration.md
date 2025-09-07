# API Integration Guide

Complete guide for integrating with the Stacks AI Payment Agent API.

## Base Configuration

### API Base URL
- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`

### Authentication
All API endpoints require Bearer token authentication:

```bash
Authorization: Bearer your_jwt_token
```

For development/testing, use token `test`.

## Agent Management

### Create Agent

**Endpoint**: `POST /api/agents/create`

**Request**:
```json
{
  "name": "My Payment Agent",
  "owner": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  "limits": {
    "daily": 2000000,
    "monthly": 5000000
  },
  "permissions": ["stx:transfer"],
  "metadata": {
    "description": "Automated hosting payments"
  }
}
```

**Response**:
```json
{
  "id": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  "name": "My Payment Agent",
  "owner": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  "limits": {
    "daily": 2000000,
    "monthly": 5000000
  },
  "permissions": ["stx:transfer"],
  "metadata": {
    "description": "Automated hosting payments"
  },
  "createdAt": "2025-09-03T10:22:33.727Z",
  "txIds": {
    "registerTxId": "0xabc123...",
    "limitsTxId": "0xdef456...",
    "authTxId": "0x789xyz..."
  },
  "status": "active"
}
```

### List Agents

**Endpoint**: `GET /api/agents/list`

**Query Parameters**:
- `owner` (optional): Filter by owner address
- `limit` (optional): Number of results (default: 50)

**Example**:
```bash
curl -H "Authorization: Bearer your_token" \
     "http://localhost:3001/api/agents/list?owner=ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
```

**Response**:
```json
{
  "items": [
    {
      "id": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
      "name": "My Payment Agent",
      "owner": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
      "limits": {
        "daily": 2000000,
        "monthly": 5000000
      },
      "permissions": ["stx:transfer"],
      "createdAt": "2025-09-03T10:22:33.727Z",
      "status": "active"
    }
  ],
  "nextCursor": null
}
```

### Update Agent Permissions

**Endpoint**: `PUT /api/agents/{agentId}/permissions`

**Request**:
```json
{
  "permissions": ["stx:transfer", "contract:call"],
  "limits": {
    "daily": 3000000,
    "monthly": 10000000
  }
}
```

## Payment Processing

### Process Payment

**Endpoint**: `POST /api/payments/process`

**Request**:
```json
{
  "agentId": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  "amount": 1500000,
  "recipient": "SP3TESTRECIPIENT",
  "memo": "hosting payment",
  "metadata": {
    "invoice_id": "INV-001",
    "service": "web_hosting"
  }
}
```

**Response**:
```json
{
  "paymentId": "pay_abc123-def456-789xyz",
  "status": "pending",
  "txId": "0x1234567890abcdef",
  "decision": {
    "authorize": true,
    "risk": 0.1,
    "reason": "ok"
  }
}
```

### Get Payment History

**Endpoint**: `GET /api/payments/history`

**Query Parameters**:
- `agentId` (optional): Filter by agent
- `status` (optional): Filter by status (`pending`, `success`, `failed`)
- `limit` (optional): Number of results (default: 20)

**Example**:
```bash
curl -H "Authorization: Bearer your_token" \
     "http://localhost:3001/api/payments/history?agentId=ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG&limit=10"
```

**Response**:
```json
{
  "items": [
    {
      "id": "pay_abc123-def456-789xyz",
      "agentId": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
      "amount": 1500000,
      "recipient": "SP3TESTRECIPIENT",
      "memo": "hosting payment",
      "status": "success",
      "txId": "0x1234567890abcdef",
      "createdAt": "2025-09-03T10:22:52.164Z",
      "metadata": {
        "invoice_id": "INV-001",
        "service": "web_hosting"
      }
    }
  ],
  "nextCursor": null
}
```

## Analytics

### Get Spending Analytics

**Endpoint**: `GET /api/analytics/spending`

**Query Parameters**:
- `agentId` (optional): Filter by agent
- `period` (optional): Time period (`day`, `week`, `month`)

**Response**:
```json
{
  "trend": [
    {
      "date": "2025-09-03",
      "amount": 4500000
    }
  ],
  "byCategory": [
    {
      "name": "hosting",
      "amount": 3000000
    },
    {
      "name": "services",
      "amount": 1500000
    }
  ],
  "agentPerformance": [
    {
      "agentId": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
      "successRate": 0.98,
      "totalAmount": 4500000
    }
  ]
}
```

## WebSocket Events

### Connection

Connect to real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws/updates');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.event, 'Payload:', data.payload);
};
```

### Event Types

**Agent Events**:
- `agent:created` - New agent registered
- `agent:auth-changed` - Permissions updated

**Payment Events**:
- `payment:submitted` - Payment initiated
- `payment:success` - Payment confirmed
- `payment:failed` - Payment failed

**Example Event**:
```json
{
  "event": "payment:success",
  "payload": {
    "paymentId": "pay_abc123-def456-789xyz",
    "txId": "0x1234567890abcdef",
    "agentId": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    "amount": 1500000,
    "recipient": "SP3TESTRECIPIENT"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "validation_error",
    "message": "agentId, amount, recipient required"
  }
}
```

### Common Error Codes

- `validation_error` - Invalid request parameters
- `unauthorized` - Missing or invalid authentication
- `not_found` - Resource not found
- `rate_limit_exceeded` - Too many requests
- `blockchain_error` - Stacks blockchain error
- `insufficient_funds` - Not enough STX balance

## Rate Limiting

- **Limit**: 600 requests per minute per IP
- **Headers**: Check `X-RateLimit-*` headers in responses
- **Exceeded**: Returns 429 status with retry information

## SDK Examples

### Node.js with Axios

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Authorization': 'Bearer your_token',
    'Content-Type': 'application/json'
  }
});

// Create agent
async function createAgent() {
  try {
    const response = await api.post('/agents/create', {
      name: 'My Agent',
      owner: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      limits: { daily: 2000000, monthly: 5000000 }
    });
    console.log('Agent created:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Process payment
async function processPayment(agentId) {
  try {
    const response = await api.post('/payments/process', {
      agentId,
      amount: 1500000,
      recipient: 'SP3TESTRECIPIENT',
      memo: 'API payment'
    });
    console.log('Payment processed:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}
```

### Python with Requests

```python
import requests
import json

class StacksAgentsAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def create_agent(self, name, owner, limits):
        data = {
            'name': name,
            'owner': owner,
            'limits': limits
        }
        response = requests.post(
            f'{self.base_url}/agents/create',
            headers=self.headers,
            json=data
        )
        return response.json()
    
    def process_payment(self, agent_id, amount, recipient, memo=None):
        data = {
            'agentId': agent_id,
            'amount': amount,
            'recipient': recipient,
            'memo': memo
        }
        response = requests.post(
            f'{self.base_url}/payments/process',
            headers=self.headers,
            json=data
        )
        return response.json()

# Usage
api = StacksAgentsAPI('http://localhost:3001/api', 'your_token')

# Create agent
agent = api.create_agent(
    name='Python Agent',
    owner='ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    limits={'daily': 2000000, 'monthly': 5000000}
)

# Process payment
payment = api.process_payment(
    agent_id=agent['id'],
    amount=1500000,
    recipient='SP3TESTRECIPIENT',
    memo='Python API payment'
)
```

### cURL Examples

```bash
# Create agent
curl -X POST http://localhost:3001/api/agents/create \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cURL Agent",
    "owner": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    "limits": {"daily": 2000000, "monthly": 5000000}
  }'

# Process payment
curl -X POST http://localhost:3001/api/payments/process \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    "amount": 1500000,
    "recipient": "SP3TESTRECIPIENT",
    "memo": "cURL payment"
  }'

# Get payment history
curl -X GET "http://localhost:3001/api/payments/history?limit=10" \
  -H "Authorization: Bearer your_token"
```

## Testing

### Health Check

```bash
curl http://localhost:3001/health
# Expected: {"ok": true}
```

### API Status

```bash
curl -H "Authorization: Bearer test" \
     http://localhost:3001/api/agents/list
# Should return agent list or empty array
```

## Best Practices

1. **Authentication**: Store tokens securely, rotate regularly
2. **Error Handling**: Always check response status and handle errors
3. **Rate Limiting**: Implement exponential backoff for retries
4. **WebSocket**: Reconnect on disconnect, handle connection drops
5. **Validation**: Validate inputs before sending requests
6. **Logging**: Log API calls for debugging and monitoring

## Integration Patterns

### Webhook Alternative
Since webhooks aren't implemented, use WebSocket events for real-time updates:

```javascript
// Monitor payment status
function monitorPayment(paymentId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3001/ws/updates');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'payment:success' && 
          data.payload.paymentId === paymentId) {
        ws.close();
        resolve(data.payload);
      }
    };
    
    setTimeout(() => {
      ws.close();
      reject(new Error('Payment timeout'));
    }, 30000);
  });
}
```

### Batch Processing
For multiple payments, process sequentially to avoid rate limits:

```javascript
async function processBatchPayments(payments) {
  const results = [];
  for (const payment of payments) {
    try {
      const result = await api.post('/payments/process', payment);
      results.push(result.data);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    } catch (error) {
      results.push({ error: error.response.data, payment });
    }
  }
  return results;
}
```
