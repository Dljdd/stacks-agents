# Stacks Agents API Documentation

Version: 1.0.0

This document describes the REST and WebSocket APIs for the Stacks Agents platform, including authentication, agents, payments, analytics, and real-time events.

- Base URL: `https://your-domain` (Nginx)
- REST Base Path: `/api`
- WebSocket Path: `/ws/updates`


## 1. Authentication

- Scheme: Bearer JWT in `Authorization` header.
- Header: `Authorization: Bearer <token>`
- Token acquisition: via your identity service (outside scope). The API validates signature and claims.
- Required claims (recommended):
  - `sub` (subject / user id)
  - `scope` or `roles` (e.g., `admin`, `agent:write`, `payment:process`)
  - `exp` (expiry)

Example header:
```
Authorization: Bearer eyJhbGciOi...
```

Common auth errors:
- 401 Unauthorized: missing/invalid token
- 403 Forbidden: insufficient scope/role


## 2. Agent Management Endpoints

### POST /api/agents/create
Creates a new payment agent.

- Auth: `admin` or `agent:write`
- Request Body (JSON):
```
{
  "name": "Marketing Agent",
  "owner": "SP3...",
  "limits": { "daily": 100000000, "monthly": 3000000000 },
  "permissions": ["stx:transfer", "fiat:pay"],
  "metadata": {"team": "marketing"}
}
```
- Response 201 (JSON):
```
{
  "id": "agt_01H...",
  "name": "Marketing Agent",
  "owner": "SP3...",
  "limits": { "daily": 100000000, "monthly": 3000000000 },
  "permissions": ["stx:transfer", "fiat:pay"],
  "createdAt": "2025-09-01T12:35:00Z"
}
```
- Errors: 400 validation, 409 conflict (duplicate), 401/403 auth

### GET /api/agents/list
Lists agents visible to caller.

- Auth: `agent:read` or `admin`
- Query params: `owner`, `limit` (default 50), `cursor`
- Response 200:
```
{
  "items": [ {"id": "agt_01H...", "name": "...", "owner": "SP..."} ],
  "nextCursor": "eyJvZmZzZXQiOjEwMH0="
}
```

### PUT /api/agents/{id}/permissions
Update agent permissions and/or limits.

- Auth: `admin` or `agent:write`
- Body:
```
{ "permissions": ["stx:transfer"], "limits": {"daily": 2_000_000_000} }
```
- Response 200:
```
{ "id": "agt_01H...", "permissions": ["stx:transfer"], "limits": {"daily": 2000000000}}
```


## 3. Payment Processing Endpoints

### POST /api/payments/process
Processes a payment request (sync enqueue + AI/rules validation)

- Auth: `payment:process`
- Body:
```
{
  "agentId": "agt_01H...",
  "amount": 1500000,    // uSTX
  "recipient": "SP2...",
  "memo": "hosting",
  "metadata": {"invoice": "INV-1009"}
}
```
- Response 202:
```
{
  "paymentId": "pay_01H...",
  "status": "queued",
  "decision": {"authorize": true, "risk": 0.23, "reason": "ok"}
}
```
- Errors: 400 invalid fields, 402 blocked by rules/risk, 409 duplicate, 500 backend failure

### GET /api/payments/history
Returns historical payments with filters.

- Auth: `payment:read`
- Query: `agentId`, `status`, `from`, `to`, `limit`, `cursor`
- Response 200:
```
{
  "items": [
    {
      "id": "pay_01H...",
      "agentId": "agt_01H...",
      "amount": 1500000,
      "recipient": "SP2...",
      "status": "success",
      "txId": "0xabc...",
      "createdAt": "2025-08-30T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```


## 4. Analytics Endpoints

### GET /api/analytics/spending
Aggregated spending metrics.

- Auth: `analytics:read`
- Query: `agentId`, `range`(7d|30d|90d)
- Response 200:
```
{
  "trend": [ {"date":"2025-08-25","amount": 1000000} ],
  "byCategory": [ {"name":"hosting","amount": 3000000} ],
  "agentPerformance": [ {"agentId":"agt_01H...","successRate":0.98,"total":10000000} ]
}
```


## 5. WebSocket Events

Path: `/ws/updates`
- Protocol: WebSocket
- Auth: Bearer token via `Authorization` header or `?token=...` query.
- Events (JSON envelope):
```
{ "event": "payment:queued", "payload": {"paymentId":"pay_01H...", ...} }
{ "event": "payment:success", "payload": {"paymentId":"pay_01H...", "txId":"0x..."} }
{ "event": "payment:failed", "payload": {"paymentId":"pay_01H...", "error":"insufficient_funds"} }
{ "event": "agent:limits", "payload": {"agentId":"agt_01H...", "limits": {...}} }
{ "event": "agent:auth-changed", "payload": {"agentId":"agt_01H..."} }
```


## 6. Error Responses

- Envelope:
```
{
  "error": {
    "code": "<machine_readable>",
    "message": "Human readable description",
    "details": { }
  }
}
```
- Common codes:
  - `unauthorized`, `forbidden`, `validation_error`, `not_found`, `conflict`, `rate_limited`, `internal_error`.

Examples:
- 401
```
{ "error": {"code":"unauthorized", "message":"Missing or invalid token"} }
```
- 402 (blocked by risk/rules)
```
{ "error": {"code":"payment_blocked", "message":"Decision engine blocked this payment", "details": {"risk": 0.91}} }
```


## 7. Rate Limiting

- Nginx: 10 req/s per IP on `/api/` with burst 20 (see `nginx.conf`).
- Exceeding rate returns 429:
```
{ "error": {"code":"rate_limited", "message":"Too many requests"} }
```
- Recommend client backoff with jitter.


## 8. SDK Examples

### cURL
```
curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Ops Agent","owner":"SP2..."}' \
     https://your-domain/api/agents/create
```

### Node.js (axios)
```js
import axios from 'axios';

const api = axios.create({ baseURL: 'https://your-domain/api' });
api.defaults.headers.common.Authorization = `Bearer ${process.env.TOKEN}`;

// Create agent
const agent = await api.post('/agents/create', {
  name: 'Ops Agent', owner: 'SP2...', limits: { daily: 2_000_000, monthly: 5_000_000 }
});

// Process payment
const pay = await api.post('/payments/process', {
  agentId: agent.data.id,
  amount: 1500000,
  recipient: 'SP3...',
  memo: 'hosting'
});

// History
const hist = await api.get('/payments/history', { params: { agentId: agent.data.id, limit: 50 } });
console.log(hist.data);
```

### Python (requests)
```python
import os, requests
base = 'https://your-domain/api'
headers = {'Authorization': f'Bearer {os.environ["TOKEN"]}', 'Content-Type': 'application/json'}

# List agents
resp = requests.get(f'{base}/agents/list', headers=headers, params={'limit': 20})
print(resp.json())

# Process payment
payload = { 'agentId': 'agt_01H...', 'amount': 1500000, 'recipient': 'SP3...', 'memo': 'hosting' }
print(requests.post(f'{base}/payments/process', json=payload, headers=headers).json())
```

### WebSocket
```js
const ws = new WebSocket('wss://your-domain/ws/updates?token=' + token);
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.event.startsWith('payment:')) console.log('Payment event', msg.payload);
};
```


## OpenAPI 3.0 Specification

```yaml
openapi: 3.0.3
info:
  title: Stacks Agents API
  version: 1.0.0
servers:
  - url: https://your-domain/api
    description: Production
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            details: { type: object }
    Agent:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        owner: { type: string }
        limits:
          type: object
          properties:
            daily: { type: integer }
            monthly: { type: integer }
        permissions:
          type: array
          items: { type: string }
        createdAt: { type: string, format: date-time }
    Payment:
      type: object
      properties:
        id: { type: string }
        agentId: { type: string }
        amount: { type: integer }
        recipient: { type: string }
        memo: { type: string }
        status: { type: string, enum: [queued, success, failed] }
        txId: { type: string }
        createdAt: { type: string, format: date-time }
paths:
  /agents/create:
    post:
      summary: Create agent
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                owner: { type: string }
                limits:
                  type: object
                  properties:
                    daily: { type: integer }
                    monthly: { type: integer }
                permissions:
                  type: array
                  items: { type: string }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Agent' }
        '400': { description: Bad Request, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
        '409': { description: Conflict }
  /agents/list:
    get:
      summary: List agents
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: owner
          schema: { type: string }
        - in: query
          name: limit
          schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
        - in: query
          name: cursor
          schema: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items: { $ref: '#/components/schemas/Agent' }
                  nextCursor: { type: string, nullable: true }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
  /agents/{id}/permissions:
    put:
      summary: Update permissions/limits
      security:
        - bearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                permissions:
                  type: array
                  items: { type: string }
                limits:
                  type: object
                  properties:
                    daily: { type: integer }
                    monthly: { type: integer }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Agent' } } } }
        '400': { description: Bad Request }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
        '404': { description: Not Found }
  /payments/process:
    post:
      summary: Process payment
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [agentId, amount, recipient]
              properties:
                agentId: { type: string }
                amount: { type: integer, description: micro-STX }
                recipient: { type: string }
                memo: { type: string }
                metadata: { type: object }
      responses:
        '202':
          description: Accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  paymentId: { type: string }
                  status: { type: string }
                  decision:
                    type: object
                    properties:
                      authorize: { type: boolean }
                      risk: { type: number, format: float }
                      reason: { type: string }
        '400': { description: Bad Request }
        '401': { description: Unauthorized }
        '402': { description: Blocked by risk/rules }
        '409': { description: Conflict }
  /payments/history:
    get:
      summary: Payment history
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: agentId
          schema: { type: string }
        - in: query
          name: status
          schema: { type: string }
        - in: query
          name: from
          schema: { type: string, format: date-time }
        - in: query
          name: to
          schema: { type: string, format: date-time }
        - in: query
          name: limit
          schema: { type: integer, default: 50 }
        - in: query
          name: cursor
          schema: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items: { $ref: '#/components/schemas/Payment' }
                  nextCursor: { type: string, nullable: true }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
  /analytics/spending:
    get:
      summary: Spending analytics
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: agentId
          schema: { type: string }
        - in: query
          name: range
          schema: { type: string, enum: [7d, 30d, 90d], default: 30d }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  trend:
                    type: array
                    items:
                      type: object
                      properties:
                        date: { type: string }
                        amount: { type: integer }
                  byCategory:
                    type: array
                    items:
                      type: object
                      properties:
                        name: { type: string }
                        amount: { type: integer }
                  agentPerformance:
                    type: array
                    items:
                      type: object
                      properties:
                        agentId: { type: string }
                        successRate: { type: number }
                        total: { type: integer }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
```
