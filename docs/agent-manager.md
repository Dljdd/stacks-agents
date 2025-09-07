# Agent Manager Smart Contract

Path: `contracts/agent-manager.clar`

This contract manages AI agent registration, authorization, permissions, and spending limits on the Stacks blockchain.

## Quick Start

1. **Deploy Contract**: Use `scripts/deploy-contracts.js` or manual deployment
2. **Initialize**: Call `init-contract` with admin address
3. **Register Agent**: Call `register-agent` with agent principal and permissions
4. **Set Limits**: Call `set-spending-limit` with daily/monthly amounts
5. **Authorize**: Call `authorize-agent` to enable payments

## Prerequisites

- Deployed on Stacks testnet or mainnet
- Admin private key for initialization
- Agent addresses for registration

## Data Model

- `agents` (map)
  - key: `{ agent-id: principal }`
  - value: `{ owner: principal, daily-limit: uint, monthly-limit: uint, active: bool, authorized: bool }`
- `agent-permissions` (map)
  - key: `{ agent-id: principal }`
  - value: `{ permissions: (list 10 (string-ascii 50)) }`
- `contract-owner` (data-var optional principal)

## Roles & Access Control

- Contract Admin: set via `init-contract(owner)`. Can manage any agent.
- Agent Owner: the `tx-sender` who registered an agent. Can manage their agent.
- Modifying operations require admin or agent owner.

## Errors

- `u100` ERR-NOT-INITIALIZED
- `u101` ERR-ALREADY-INITIALIZED
- `u102` ERR-UNAUTHORIZED
- `u103` ERR-AGENT-EXISTS
- `u104` ERR-AGENT-NOT-FOUND
- `u105` ERR-INVALID-PARAMS

## Events

Events are emitted via `print` with tuples:
- `{"init", owner}` on contract initialization
- `{"register", agent}` on registration
- `{"authorize", agent}` on authorization
- `{"deauthorize", agent}` on deauthorization
- `{"update-perms", agent}` on permission updates
- `{"set-limits", agent}` on spending limit updates

## Public Functions

1. `(init-contract (owner principal)) => (response bool uint)`
   - Sets the contract admin once.
2. `(register-agent (agent-id principal) (permissions (list 10 (string-ascii 50)))) => (response bool uint)`
   - Registers a new agent with `tx-sender` as owner. Fails if exists.
3. `(authorize-agent (agent-id principal)) => (response bool uint)`
   - Admin or owner marks agent as authorized.
4. `(deauthorize-agent (agent-id principal)) => (response bool uint)`
   - Admin or owner marks agent as unauthorized.
5. `(update-permissions (agent-id principal) (new-permissions (list 10 (string-ascii 50)))) => (response bool uint)`
   - Admin or owner updates permissions list.
6. `(set-spending-limit (agent-id principal) (daily-limit uint) (monthly-limit uint)) => (response bool uint)`
   - Admin or owner sets limits. Requires monthly >= daily.
7. `(get-agent-info (agent-id principal)) => (optional (tuple ...))`
   - Returns full agent data + permissions.
8. `(is-agent-authorized (agent-id principal)) => bool`
   - Returns authorization status.

## Security Considerations

- Role-based access control enforced by `assert-admin-or-owner`.
- Parameter bounds: permissions list capped at 10, string-ascii 50 per permission.
- Spending sanity: monthly >= daily.
- Explicit error codes for robust client handling.

## Example Usage

### Contract Deployment & Initialization

```bash
# Deploy using script
cd scripts
export DEPLOYER_PRIVATE_KEY=0x...
npm run deploy

# Manual deployment
stx deploy_contract agent-manager contracts/agent-manager.clar --testnet
stx call_contract_func ST_DEPLOYER.agent-manager init-contract ST_ADMIN_ADDRESS --testnet
```

### Agent Registration (Clarity)

```clarity
;; Register agent with permissions
(contract-call? .agent-manager register-agent 
  'SP2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG 
  (list "stx:transfer" "contract:call"))

;; Set spending limits (amounts in microSTX)
(contract-call? .agent-manager set-spending-limit 
  'SP2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG 
  u2000000   ;; 2 STX daily
  u5000000)  ;; 5 STX monthly

;; Authorize for payments
(contract-call? .agent-manager authorize-agent 
  'SP2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; Query agent info
(contract-call? .agent-manager get-agent-info 
  'SP2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
```

### Backend API Integration

```javascript
// Create agent via backend API
const response = await fetch('http://localhost:3001/api/agents/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Payment Agent',
    owner: 'SP2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
    limits: { daily: 2000000, monthly: 5000000 },
    permissions: ['stx:transfer']
  })
});
```

## Integration with Payment Processor

The `payment-processor.clar` contract calls this contract to:
- Verify agent authorization via `is-agent-authorized`
- Check spending limits via `get-agent-info`
- Validate agent ownership

```clarity
;; Payment processor checks authorization
(asserts! (contract-call? .agent-manager is-agent-authorized agent-id) 
          (err u203))

;; Get limits for validation
(let ((agent-info (unwrap! (contract-call? .agent-manager get-agent-info agent-id) 
                           (err u203))))
  (get daily-limit agent-info))
```
