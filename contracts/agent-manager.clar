;; agent-manager.clar
;; Clarity smart contract for managing AI agents on the Stacks blockchain

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Constants & Error Codes
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR-NOT-INITIALIZED u100)
(define-constant ERR-ALREADY-INITIALIZED u101)
(define-constant ERR-UNAUTHORIZED u102)
(define-constant ERR-AGENT-EXISTS u103)
(define-constant ERR-AGENT-NOT-FOUND u104)
(define-constant ERR-INVALID-PARAMS u105)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Storage
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Contract owner (set once via init-contract)
(define-data-var contract-owner (optional principal) none)

;; Agents registry
;; key: agent-id (principal)
;; value: owner, spending limits, active status, authorization flag
(define-map agents
  { agent-id: principal }
  { owner: principal
    daily-limit: uint
    monthly-limit: uint
    active: bool
    authorized: bool })

;; Agent permissions (kept in a distinct map to explicitly "track permissions")
(define-map agent-permissions
  { agent-id: principal }
  { permissions: (list 10 (string-ascii 50)) })

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Helpers & Access Control
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (get-contract-owner)
  (var-get contract-owner))

(define-private (assert-initialized)
  (if (is-none (var-get contract-owner))
      (err ERR-NOT-INITIALIZED)
      (ok true)))

(define-read-only (is-admin (who principal))
  (match (var-get contract-owner)
    owner (is-eq who owner)
    false))

(define-read-only (is-agent-owner (agent-id principal) (who principal))
  (match (map-get? agents { agent-id: agent-id })
    agent-data (is-eq who (get owner agent-data))
    false))

(define-private (assert-admin-or-owner (agent-id principal))
  (let ((sender tx-sender))
    (if (or (is-admin sender) (is-agent-owner agent-id sender))
        (ok true)
        (err ERR-UNAUTHORIZED))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Events (use print for event emission)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Each management action emits a tuple with an "event" tag and relevant fields

(define-private (emit (event (string-ascii 32)) (agent-id principal) (details (buff 200)))
  (print (tuple (event event) (agent agent-id) (details details))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; One-time initialization to set the contract owner (admin)
(define-public (init-contract (owner principal))
  (if (is-some (var-get contract-owner))
      (err ERR-ALREADY-INITIALIZED)
      (begin
        (var-set contract-owner (some owner))
        (print (tuple (event "init") (owner owner)))
        (ok true))))

;; 1. register-agent
(define-public (register-agent (agent-id principal) (permissions (list 10 (string-ascii 50))))
  (begin
    (try! (assert-initialized))
    ;; basic validation
    (if (> (len permissions) u10)
        (err ERR-INVALID-PARAMS)
        (ok true))
    ;; ensure agent does not exist
    (if (is-some (map-get? agents { agent-id: agent-id }))
        (err ERR-AGENT-EXISTS)
        (ok true))
    ;; register
    (map-set agents { agent-id: agent-id }
      { owner: tx-sender
        daily-limit: u0
        monthly-limit: u0
        active: true
        authorized: false })
    (map-set agent-permissions { agent-id: agent-id }
      { permissions: permissions })
    (emit "register" agent-id 0x)
    (ok true)))

;; 2. authorize-agent
(define-public (authorize-agent (agent-id principal))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-owner agent-id))
    (match (map-get? agents { agent-id: agent-id })
      agent-data
        (begin
          (map-set agents { agent-id: agent-id }
            { owner: (get owner agent-data)
              daily-limit: (get daily-limit agent-data)
              monthly-limit: (get monthly-limit agent-data)
              active: true
              authorized: true })
          (emit "authorize" agent-id 0x)
          (ok true))
      none (err ERR-AGENT-NOT-FOUND))))

;; 3. deauthorize-agent
(define-public (deauthorize-agent (agent-id principal))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-owner agent-id))
    (match (map-get? agents { agent-id: agent-id })
      agent-data
        (begin
          (map-set agents { agent-id: agent-id }
            { owner: (get owner agent-data)
              daily-limit: (get daily-limit agent-data)
              monthly-limit: (get monthly-limit agent-data)
              active: (get active agent-data)
              authorized: false })
          (emit "deauthorize" agent-id 0x)
          (ok true))
      none (err ERR-AGENT-NOT-FOUND))))

;; 4. update-permissions
(define-public (update-permissions (agent-id principal) (new-permissions (list 10 (string-ascii 50))))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-owner agent-id))
    (if (> (len new-permissions) u10)
        (err ERR-INVALID-PARAMS)
        (ok true))
    (if (is-none (map-get? agents { agent-id: agent-id }))
        (err ERR-AGENT-NOT-FOUND)
        (ok true))
    (map-set agent-permissions { agent-id: agent-id } { permissions: new-permissions })
    (emit "update-perms" agent-id 0x)
    (ok true)))

;; 5. set-spending-limit
(define-public (set-spending-limit (agent-id principal) (daily-limit uint) (monthly-limit uint))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-owner agent-id))
    ;; guard: monthly >= daily (simple sanity rule)
    (if (< monthly-limit daily-limit)
        (err ERR-INVALID-PARAMS)
        (ok true))
    (match (map-get? agents { agent-id: agent-id })
      agent-data
        (begin
          (map-set agents { agent-id: agent-id }
            { owner: (get owner agent-data)
              daily-limit: daily-limit
              monthly-limit: monthly-limit
              active: (get active agent-data)
              authorized: (get authorized agent-data) })
          (emit "set-limits" agent-id 0x)
          (ok true))
      none (err ERR-AGENT-NOT-FOUND))))

;; 6. get-agent-info
(define-read-only (get-agent-info (agent-id principal))
  (let (
        (agent (map-get? agents { agent-id: agent-id }))
        (perms (map-get? agent-permissions { agent-id: agent-id }))
       )
    (match agent
      a (match perms
          p (some (tuple
                    (owner (get owner a))
                    (permissions (get permissions p))
                    (daily-limit (get daily-limit a))
                    (monthly-limit (get monthly-limit a))
                    (active (get active a))
                    (authorized (get authorized a))
                  ))
          (none))
      (none))))

;; 7. is-agent-authorized
(define-read-only (is-agent-authorized (agent-id principal))
  (match (map-get? agents { agent-id: agent-id })
    a (get authorized a)
    false))
