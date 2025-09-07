;; Agent Manager Contract - Fixed for Deployment
;; Minimal working version for testnet deployment

(define-constant ERR-NOT-INITIALIZED u100)
(define-constant ERR-ALREADY-INITIALIZED u101)
(define-constant ERR-UNAUTHORIZED u102)
(define-constant ERR-AGENT-EXISTS u103)
(define-constant ERR-AGENT-NOT-FOUND u104)

;; Contract owner
(define-data-var contract-owner (optional principal) none)

;; Simple agents registry
(define-map agents
  { agent-id: principal }
  { owner: principal,
    active: bool,
    authorized: bool })

;; Initialize contract (call this first after deployment)
(define-public (init-contract (owner principal))
  (begin
    (asserts! (is-none (var-get contract-owner)) (err ERR-ALREADY-INITIALIZED))
    (var-set contract-owner (some owner))
    (ok true)))

;; Register agent
(define-public (register-agent (agent-id principal))
  (begin
    (asserts! (is-some (var-get contract-owner)) (err ERR-NOT-INITIALIZED))
    (asserts! (is-none (map-get? agents { agent-id: agent-id })) (err ERR-AGENT-EXISTS))
    (map-set agents { agent-id: agent-id }
      { owner: agent-id,
        active: true,
        authorized: false })
    (ok true)))

;; Authorize agent
(define-public (authorize-agent (agent-id principal))
  (begin
    (asserts! (is-some (var-get contract-owner)) (err ERR-NOT-INITIALIZED))
    (match (map-get? agents { agent-id: agent-id })
      agent-data
        (begin
          (map-set agents { agent-id: agent-id }
            { owner: (get owner agent-data),
              active: (get active agent-data),
              authorized: true })
          (ok true))
      (err ERR-AGENT-NOT-FOUND))))

;; Get agent info
(define-read-only (get-agent-info (agent-id principal))
  (match (map-get? agents { agent-id: agent-id })
    agent-data (ok agent-data)
    (err ERR-AGENT-NOT-FOUND)))

;; Check if agent is authorized
(define-read-only (is-agent-authorized (agent-id principal))
  (match (map-get? agents { agent-id: agent-id })
    agent-data (ok (get authorized agent-data))
    (err ERR-AGENT-NOT-FOUND)))
