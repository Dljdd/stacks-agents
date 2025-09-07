;; payment-processor.clar
;; Ready for Stacks Playground deployment

(define-constant ERR-NOT-INITIALIZED u200)
(define-constant ERR-ALREADY-INITIALIZED u201)
(define-constant ERR-UNAUTHORIZED u202)
(define-constant ERR-AGENT-NOT-FOUND u203)
(define-constant ERR-HALTED u204)
(define-constant ERR-RULES-NOT-FOUND u205)
(define-constant ERR-AMOUNT-TOO-HIGH u206)
(define-constant ERR-RECIPIENT-NOT-ALLOWED u207)
(define-constant ERR-DAILY-LIMIT u208)
(define-constant ERR-MONTHLY-LIMIT u209)
(define-constant ERR-RATE-LIMIT u210)
(define-constant ERR-INVALID-PARAMS u212)

(define-constant RATE-LIMIT-BLOCKS u5)
(define-constant MAX-HISTORY-RETURN u20)

;; UPDATE THIS: Replace with your agent-manager contract address
(define-constant AGENT-MANAGER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.agent-manager)

(define-data-var contract-owner (optional principal) none)
(define-data-var global-halt bool false)

(define-map agent-halt
  { agent-id: principal }
  { halted: bool })

(define-map payment-rules
  { agent-id: principal }
  { max-amount: uint, version: uint })

(define-map recipient-whitelist
  { agent-id: principal, version: uint, recipient: principal }
  { allowed: bool })

(define-map payment-history
  { agent-id: principal, payment-id: uint }
  { recipient: principal, amount: uint, success: bool, block: uint, memo: (optional (string-ascii 256)) })

(define-map agent-payment-count
  { agent-id: principal }
  { count: uint })

(define-map agent-last-payment
  { agent-id: principal }
  { block: uint })

(define-map daily-spending
  { agent-id: principal, day: uint }
  { spent: uint })

(define-map monthly-spending
  { agent-id: principal, month: uint }
  { spent: uint })

(define-public (init-contract (owner principal))
  (begin
    (asserts! (is-none (var-get contract-owner)) (err ERR-ALREADY-INITIALIZED))
    (var-set contract-owner (some owner))
    (ok true)))

(define-private (is-contract-owner)
  (is-eq (some tx-sender) (var-get contract-owner)))

(define-private (is-agent-authorized (agent-id principal))
  (contract-call? AGENT-MANAGER is-agent-authorized agent-id))

(define-public (update-payment-rules (agent-id principal) (max-amount uint) (allowed-recipients (list 50 principal)))
  (let ((current-version (default-to u0 (get version (map-get? payment-rules { agent-id: agent-id })))))
    (begin
      (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
      (asserts! (> max-amount u0) (err ERR-INVALID-PARAMS))
      
      (map-set payment-rules
        { agent-id: agent-id }
        { max-amount: max-amount, version: (+ current-version u1) })
      
      (map update-recipient-whitelist allowed-recipients agent-id (+ current-version u1))
      (ok true))))

(define-private (update-recipient-whitelist (recipient principal) (agent-id principal) (version uint))
  (map-set recipient-whitelist
    { agent-id: agent-id, version: version, recipient: recipient }
    { allowed: true }))

(define-public (execute-payment (agent-id principal) (recipient principal) (amount uint) (memo (optional (string-ascii 256))))
  (let ((payment-id (+ (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id }))) u1))
        (current-block block-height)
        (day (/ current-block u144))
        (month (/ current-block u4320)))
    (begin
      (asserts! (is-eq tx-sender agent-id) (err ERR-UNAUTHORIZED))
      (asserts! (unwrap! (is-agent-authorized agent-id) (err ERR-AGENT-NOT-FOUND)) (err ERR-AGENT-NOT-FOUND))
      (asserts! (not (var-get global-halt)) (err ERR-HALTED))
      (asserts! (not (default-to false (get halted (map-get? agent-halt { agent-id: agent-id })))) (err ERR-HALTED))
      
      (try! (validate-payment-rules agent-id amount))
      
      (let ((last-payment-block (default-to u0 (get block (map-get? agent-last-payment { agent-id: agent-id })))))
        (asserts! (>= (- current-block last-payment-block) RATE-LIMIT-BLOCKS) (err ERR-RATE-LIMIT)))
      
      (try! (validate-recipient agent-id recipient))
      (try! (validate-spending-limits agent-id amount day month))
      
      (match (stx-transfer? amount tx-sender recipient)
        success (begin
          (map-set payment-history
            { agent-id: agent-id, payment-id: payment-id }
            { recipient: recipient, amount: amount, success: true, block: current-block, memo: memo })
          
          (map-set agent-payment-count { agent-id: agent-id } { count: payment-id })
          (map-set agent-last-payment { agent-id: agent-id } { block: current-block })
          (update-spending-tracking agent-id amount day month)
          (ok payment-id))
        error (begin
          (map-set payment-history
            { agent-id: agent-id, payment-id: payment-id }
            { recipient: recipient, amount: amount, success: false, block: current-block, memo: memo })
          (map-set agent-payment-count { agent-id: agent-id } { count: payment-id })
          (err error))))))

(define-public (validate-payment-rules (agent-id principal) (amount uint))
  (let ((rules (map-get? payment-rules { agent-id: agent-id })))
    (match rules
      rule (if (<= amount (get max-amount rule))
             (ok true)
             (err ERR-AMOUNT-TOO-HIGH))
      (err ERR-RULES-NOT-FOUND))))

(define-private (validate-recipient (agent-id principal) (recipient principal))
  (let ((rules (map-get? payment-rules { agent-id: agent-id })))
    (match rules
      rule (let ((version (get version rule)))
             (if (default-to false (get allowed (map-get? recipient-whitelist { agent-id: agent-id, version: version, recipient: recipient })))
               (ok true)
               (err ERR-RECIPIENT-NOT-ALLOWED)))
      (err ERR-RULES-NOT-FOUND))))

(define-private (validate-spending-limits (agent-id principal) (amount uint) (day uint) (month uint))
  (let ((agent-info (unwrap! (contract-call? AGENT-MANAGER get-agent-info agent-id) (err ERR-AGENT-NOT-FOUND)))
        (daily-spent (default-to u0 (get spent (map-get? daily-spending { agent-id: agent-id, day: day }))))
        (monthly-spent (default-to u0 (get spent (map-get? monthly-spending { agent-id: agent-id, month: month }))))
        (daily-limit (get daily-limit agent-info))
        (monthly-limit (get monthly-limit agent-info)))
    (begin
      (asserts! (<= (+ daily-spent amount) daily-limit) (err ERR-DAILY-LIMIT))
      (asserts! (<= (+ monthly-spent amount) monthly-limit) (err ERR-MONTHLY-LIMIT))
      (ok true))))

(define-private (update-spending-tracking (agent-id principal) (amount uint) (day uint) (month uint))
  (let ((daily-spent (default-to u0 (get spent (map-get? daily-spending { agent-id: agent-id, day: day }))))
        (monthly-spent (default-to u0 (get spent (map-get? monthly-spending { agent-id: agent-id, month: month })))))
    (begin
      (map-set daily-spending { agent-id: agent-id, day: day } { spent: (+ daily-spent amount) })
      (map-set monthly-spending { agent-id: agent-id, month: month } { spent: (+ monthly-spent amount) }))))

(define-read-only (get-payment-history (agent-id principal) (limit uint))
  (let ((count (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id }))))
        (actual-limit (if (> limit MAX-HISTORY-RETURN) MAX-HISTORY-RETURN limit)))
    (map get-payment-by-id 
         (map (lambda (i) { agent-id: agent-id, payment-id: (- count i) })
              (unwrap! (slice? (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19) u0 actual-limit) (list))))))

(define-private (get-payment-by-id (key { agent-id: principal, payment-id: uint }))
  (default-to 
    { recipient: tx-sender, amount: u0, success: false, block: u0, memo: none }
    (map-get? payment-history key)))

(define-read-only (get-payment-rules (agent-id principal))
  (map-get? payment-rules { agent-id: agent-id }))

(define-public (emergency-halt)
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (var-set global-halt true)
    (ok true)))

(define-public (emergency-resume)
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (var-set global-halt false)
    (ok true)))

(define-public (halt-agent (agent-id principal))
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (map-set agent-halt { agent-id: agent-id } { halted: true })
    (ok true)))

(define-public (resume-agent (agent-id principal))
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (map-set agent-halt { agent-id: agent-id } { halted: false })
    (ok true)))
