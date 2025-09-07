# Rules Engine Smart Contract

Path: `contracts/rules-engine.clar`

Manages complex, priority-ordered rules for agent payments. Supports spending, merchant, time, velocity, amount, and geo rules, with CRUD, enabling/disabling, and evaluation returning an action (default: "allow"). Integrates with `agent-manager` for RBAC.

## Data Model

- `rules` `{ rule-id } -> { agent-id, rule-type, conditions, actions, priority, enabled, created-at }`
- `agent-rule-index` `{ agent-id, priority, rule-id } -> { exists }` (sparse index)
- `rule-spending` `{ rule-id } -> { daily, weekly, monthly }`
- `rule-merchant` `{ rule-id } -> { mode, merchants, categories }`
- `rule-time` `{ rule-id } -> { business-hours, weekend-allowed, start-hour, end-hour }`
- `rule-velocity` `{ rule-id } -> { max-per-hour }`
- `rule-amount` `{ rule-id } -> { min-amount, max-amount }`
- `rule-geo` `{ rule-id } -> { countries }`

## Errors

- `u300` NOT-INITIALIZED
- `u301` ALREADY-INITIALIZED
- `u302` UNAUTHORIZED
- `u303` RULE-NOT-FOUND
- `u304` INVALID-PARAMS

## Functions

- `(init-contract (owner principal)) => (response bool uint)`
- `(create-rule (agent-id principal) (rule-type (string-ascii 50)) (conditions (string-ascii 500)) (actions (string-ascii 200))) => (response uint uint)`
- `(update-rule (rule-id uint) (new-conditions (string-ascii 500))) => (response bool uint)`
- `(delete-rule (rule-id uint)) => (response bool uint)`
- `(set-rule-priority (rule-id uint) (new-priority uint)) => (response bool uint)`
- `(set-rule-enabled (rule-id uint) (flag bool)) => (response bool uint)`
- Typed setters: `set-spending-params`, `set-merchant-params`, `set-time-params`, `set-velocity-params`, `set-amount-params`, `set-geo-params`
- `(get-agent-rules (agent-id principal)) => (list ...)` (lightweight; for now returns empty list placeholder — extend as needed)
- `(rule-conflict-check (agent-id principal)) => uint` (counts misconfigurations like min>max)
- `(evaluate-rules (agent-id principal) (payment-data (tuple ...))) => (string-ascii 200)`
  - First-match evaluation by ascending `rule-id` (proxy for priority). Action strings are developer-defined (e.g., "block", "flag"), default is "allow".

## Payment Data Schema

```clarity
(tuple
  (amount uint)
  (merchant principal)
  (category (string-ascii 20))
  (hour uint)          ;; 0..23
  (day uint)           ;; 0=Sun .. 6=Sat
  (txs-last-hour uint)
  (country (string-ascii 2))
)
```

## Security

- RBAC via `agent-manager.get-agent-info` owner or contract admin.
- Error codes for robust client handling.
- Events emitted for CRUD and state changes.

## Example

```clarity
;; init and create a min/max amount rule blocking outside range
(contract-call? .rules-engine init-contract tx-sender)
(let ((rid (unwrap-panic (contract-call? .rules-engine create-rule 'SP..A "amount" "min=10,max=200" "block"))))
  (contract-call? .rules-engine set-amount-params rid u10 u200))

;; evaluate
(define-constant data (tuple (amount u500) (merchant 'SP..M) (category "retail") (hour u15) (day u1) (txs-last-hour u0) (country "US")))
(contract-call? .rules-engine evaluate-rules 'SP..A data)
```
