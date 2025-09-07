;; rules-engine.clar
;; Ready for Stacks Playground deployment

(define-constant ERR-NOT-INITIALIZED u300)
(define-constant ERR-ALREADY-INITIALIZED u301)
(define-constant ERR-UNAUTHORIZED u302)
(define-constant ERR-RULE-NOT-FOUND u303)
(define-constant ERR-INVALID-CONDITION u304)
(define-constant ERR-INVALID-ACTION u305)
(define-constant ERR-RULE-LIMIT u306)
(define-constant ERR-CONDITION-FAILED u307)

(define-constant MAX-RULES-PER-AGENT u50)
(define-constant MAX-CONDITIONS-PER-RULE u10)
(define-constant MAX-ACTIONS-PER-RULE u5)

;; UPDATE THIS: Replace with your agent-manager contract address
(define-constant AGENT-MANAGER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.agent-manager)

(define-data-var contract-owner (optional principal) none)
(define-data-var next-rule-id uint u1)

(define-map rules
  { rule-id: uint }
  { agent-id: principal
    name: (string-ascii 64)
    active: bool
    priority: uint
    created-at: uint })

(define-map rule-conditions
  { rule-id: uint, condition-index: uint }
  { condition-type: (string-ascii 32)
    operator: (string-ascii 16)
    value: uint
    string-value: (optional (string-ascii 256)) })

(define-map rule-actions
  { rule-id: uint, action-index: uint }
  { action-type: (string-ascii 32)
    target: (optional principal)
    value: uint
    string-value: (optional (string-ascii 256)) })

(define-map agent-rules
  { agent-id: principal }
  { rule-ids: (list 50 uint)
    count: uint })

(define-map rule-execution-log
  { rule-id: uint, execution-id: uint }
  { executed-at: uint
    success: bool
    conditions-met: uint
    actions-executed: uint })

(define-public (init-contract (owner principal))
  (begin
    (asserts! (is-none (var-get contract-owner)) (err ERR-ALREADY-INITIALIZED))
    (var-set contract-owner (some owner))
    (ok true)))

(define-private (is-contract-owner)
  (is-eq (some tx-sender) (var-get contract-owner)))

(define-private (is-agent-authorized (agent-id principal))
  (contract-call? AGENT-MANAGER is-agent-authorized agent-id))

(define-public (create-rule 
  (agent-id principal)
  (name (string-ascii 64))
  (priority uint)
  (conditions (list 10 { condition-type: (string-ascii 32), operator: (string-ascii 16), value: uint, string-value: (optional (string-ascii 256)) }))
  (actions (list 5 { action-type: (string-ascii 32), target: (optional principal), value: uint, string-value: (optional (string-ascii 256)) })))
  (let ((rule-id (var-get next-rule-id))
        (agent-rule-data (default-to { rule-ids: (list), count: u0 } (map-get? agent-rules { agent-id: agent-id }))))
    (begin
      (asserts! (unwrap! (is-agent-authorized agent-id) (err ERR-UNAUTHORIZED)) (err ERR-UNAUTHORIZED))
      (asserts! (< (get count agent-rule-data) MAX-RULES-PER-AGENT) (err ERR-RULE-LIMIT))
      (asserts! (<= (len conditions) MAX-CONDITIONS-PER-RULE) (err ERR-INVALID-CONDITION))
      (asserts! (<= (len actions) MAX-ACTIONS-PER-RULE) (err ERR-INVALID-ACTION))
      
      ;; Create rule
      (map-set rules
        { rule-id: rule-id }
        { agent-id: agent-id, name: name, active: true, priority: priority, created-at: block-height })
      
      ;; Store conditions
      (map store-condition conditions rule-id u0)
      
      ;; Store actions
      (map store-action actions rule-id u0)
      
      ;; Update agent rules
      (map-set agent-rules
        { agent-id: agent-id }
        { rule-ids: (unwrap! (as-max-len? (append (get rule-ids agent-rule-data) rule-id) u50) (err ERR-RULE-LIMIT))
          count: (+ (get count agent-rule-data) u1) })
      
      ;; Increment rule ID
      (var-set next-rule-id (+ rule-id u1))
      
      (ok rule-id))))

(define-private (store-condition 
  (condition { condition-type: (string-ascii 32), operator: (string-ascii 16), value: uint, string-value: (optional (string-ascii 256)) })
  (rule-id uint)
  (index uint))
  (map-set rule-conditions
    { rule-id: rule-id, condition-index: index }
    condition))

(define-private (store-action 
  (action { action-type: (string-ascii 32), target: (optional principal), value: uint, string-value: (optional (string-ascii 256)) })
  (rule-id uint)
  (index uint))
  (map-set rule-actions
    { rule-id: rule-id, action-index: index }
    action))

(define-public (evaluate-rules (agent-id principal) (context { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }))
  (let ((agent-rule-data (map-get? agent-rules { agent-id: agent-id })))
    (match agent-rule-data
      rules-data (begin
        (map evaluate-single-rule (get rule-ids rules-data) context)
        (ok true))
      (ok true))))

(define-private (evaluate-single-rule (rule-id uint) (context { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }))
  (let ((rule (map-get? rules { rule-id: rule-id })))
    (match rule
      rule-data (if (get active rule-data)
                  (begin
                    (try! (evaluate-conditions rule-id context))
                    (try! (execute-actions rule-id context))
                    (ok true))
                  (ok true))
      (ok true))))

(define-private (evaluate-conditions (rule-id uint) (context { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }))
  (let ((conditions-met (fold check-condition (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9) { rule-id: rule-id, context: context, met: u0 })))
    (if (> (get met conditions-met) u0)
      (ok true)
      (err ERR-CONDITION-FAILED))))

(define-private (check-condition 
  (condition-index uint)
  (acc { rule-id: uint, context: { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }, met: uint }))
  (let ((condition (map-get? rule-conditions { rule-id: (get rule-id acc), condition-index: condition-index })))
    (match condition
      cond (if (evaluate-condition cond (get context acc))
             { rule-id: (get rule-id acc), context: (get context acc), met: (+ (get met acc) u1) }
             acc)
      acc)))

(define-private (evaluate-condition 
  (condition { condition-type: (string-ascii 32), operator: (string-ascii 16), value: uint, string-value: (optional (string-ascii 256)) })
  (context { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }))
  (let ((cond-type (get condition-type condition))
        (operator (get operator condition))
        (value (get value condition)))
    (if (is-eq cond-type "amount")
      (if (is-eq operator "gt")
        (> (get amount context) value)
        (if (is-eq operator "lt")
          (< (get amount context) value)
          (if (is-eq operator "eq")
            (is-eq (get amount context) value)
            false)))
      (if (is-eq cond-type "recipient")
        true ;; Simplified for playground
        true))))

(define-private (execute-actions (rule-id uint) (context { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }))
  (let ((actions-executed (fold execute-single-action (list u0 u1 u2 u3 u4) { rule-id: rule-id, context: context, executed: u0 })))
    (ok (get executed actions-executed))))

(define-private (execute-single-action 
  (action-index uint)
  (acc { rule-id: uint, context: { amount: uint, recipient: principal, memo: (optional (string-ascii 256)) }, executed: uint }))
  (let ((action (map-get? rule-actions { rule-id: (get rule-id acc), action-index: action-index })))
    (match action
      act (begin
        ;; Log action execution (simplified for playground)
        { rule-id: (get rule-id acc), context: (get context acc), executed: (+ (get executed acc) u1) })
      acc)))

(define-read-only (get-rule (rule-id uint))
  (map-get? rules { rule-id: rule-id }))

(define-read-only (get-agent-rules (agent-id principal))
  (map-get? agent-rules { agent-id: agent-id }))

(define-read-only (get-rule-conditions (rule-id uint))
  (list 
    (map-get? rule-conditions { rule-id: rule-id, condition-index: u0 })
    (map-get? rule-conditions { rule-id: rule-id, condition-index: u1 })
    (map-get? rule-conditions { rule-id: rule-id, condition-index: u2 })
    (map-get? rule-conditions { rule-id: rule-id, condition-index: u3 })
    (map-get? rule-conditions { rule-id: rule-id, condition-index: u4 })))

(define-read-only (get-rule-actions (rule-id uint))
  (list 
    (map-get? rule-actions { rule-id: rule-id, action-index: u0 })
    (map-get? rule-actions { rule-id: rule-id, action-index: u1 })
    (map-get? rule-actions { rule-id: rule-id, action-index: u2 })
    (map-get? rule-actions { rule-id: rule-id, action-index: u3 })
    (map-get? rule-actions { rule-id: rule-id, action-index: u4 })))

(define-public (activate-rule (rule-id uint))
  (let ((rule (unwrap! (map-get? rules { rule-id: rule-id }) (err ERR-RULE-NOT-FOUND))))
    (begin
      (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
      (map-set rules
        { rule-id: rule-id }
        (merge rule { active: true }))
      (ok true))))

(define-public (deactivate-rule (rule-id uint))
  (let ((rule (unwrap! (map-get? rules { rule-id: rule-id }) (err ERR-RULE-NOT-FOUND))))
    (begin
      (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
      (map-set rules
        { rule-id: rule-id }
        (merge rule { active: false }))
      (ok true))))
