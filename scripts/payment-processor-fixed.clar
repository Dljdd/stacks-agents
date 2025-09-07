;; payment-processor.clar
;; Standalone version for playground deployment

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

(define-data-var contract-owner (optional principal) none)
(define-data-var global-halt bool false)

;; Agent authorization (simplified for standalone deployment)
(define-map authorized-agents
  { agent-id: principal }
  { authorized: bool, daily-limit: uint, monthly-limit: uint })

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

;; Simplified agent authorization for standalone contract
(define-public (authorize-agent (agent-id principal) (daily-limit uint) (monthly-limit uint))
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (map-set authorized-agents
      { agent-id: agent-id }
      { authorized: true, daily-limit: daily-limit, monthly-limit: monthly-limit })
    (ok true)))

(define-private (is-agent-authorized (agent-id principal))
  (match (map-get? authorized-agents { agent-id: agent-id })
    agent-data (get authorized agent-data)
    false))

;; Validate per-payment rules (defined before use)
(define-private (validate-payment-rules (agent-id principal) (amount uint))
  (let ((rules (map-get? payment-rules { agent-id: agent-id })))
    (match rules
      rule (if (<= amount (get max-amount rule))
             (ok true)
             (err ERR-AMOUNT-TOO-HIGH))
      (err ERR-RULES-NOT-FOUND))))

(define-public (update-payment-rules (agent-id principal) (max-amount uint) (allowed-recipients (list 50 principal)))
  (let ((current-version (default-to u0 (get version (map-get? payment-rules { agent-id: agent-id })))))
    (begin
      (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
      (asserts! (> max-amount u0) (err ERR-INVALID-PARAMS))
      
      (map-set payment-rules
        { agent-id: agent-id }
        { max-amount: max-amount, version: (+ current-version u1) })
      ;; NOTE: For maximum Playground compatibility, we avoid higher-order map/lambda here.
      ;; Use add-allowed-recipient per recipient after updating rules.
      (ok true))))

;; helper removed (inlined with lambda above)

(define-public (execute-payment (agent-id principal) (recipient principal) (amount uint) (memo (optional (string-ascii 256))))
  (let ((payment-id (+ (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id }))) u1))
        (current-block block-height)
        (day (/ current-block u144))
        (month (/ current-block u4320)))
    (begin
      (asserts! (is-eq tx-sender agent-id) (err ERR-UNAUTHORIZED))
      (asserts! (is-agent-authorized agent-id) (err ERR-AGENT-NOT-FOUND))
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

;; Add a recipient to the current rules version (call after update-payment-rules)
(define-public (add-allowed-recipient (agent-id principal) (recipient principal))
  (let ((rules (map-get? payment-rules { agent-id: agent-id })))
    (match rules
      rule (begin
             (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
             (map-set recipient-whitelist { agent-id: agent-id, version: (get version rule), recipient: recipient } { allowed: true })
             (ok true))
      (err ERR-RULES-NOT-FOUND))))

;; moved above execute-payment

(define-private (validate-recipient (agent-id principal) (recipient principal))
  (let ((rules (map-get? payment-rules { agent-id: agent-id })))
    (match rules
      rule (let ((version (get version rule)))
             (match (map-get? recipient-whitelist { agent-id: agent-id, version: version, recipient: recipient })
               entry (if (get allowed entry) (ok true) (err ERR-RECIPIENT-NOT-ALLOWED))
               (err ERR-RULES-NOT-FOUND)))
      (err ERR-RULES-NOT-FOUND))))

(define-private (validate-spending-limits (agent-id principal) (amount uint) (day uint) (month uint))
  (let ((agent-info (unwrap! (map-get? authorized-agents { agent-id: agent-id }) (err ERR-AGENT-NOT-FOUND)))
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

(define-private (build-history (agent-id principal) (i uint) (left uint) (acc (list 20 (tuple (recipient principal) (amount uint) (success bool) (block uint) (memo (optional (string-ascii 256)))))))
  (if (or (is-eq left u0) (is-eq i u0))
      acc
      (let ((rec (map-get? payment-history { agent-id: agent-id, payment-id: i })))
        (match rec
          r (build-history agent-id (- i u1) (- left u1) (cons r acc))
          none (build-history agent-id (- i u1) left acc)))))

(define-read-only (get-payment-history (agent-id principal) (limit uint))
  (let ((count (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id }))))
        (actual-limit (if (> limit MAX-HISTORY-RETURN) MAX-HISTORY-RETURN limit)))
    (build-history agent-id count actual-limit (list))))

;; helper defined above: build-history

(define-read-only (get-payment-rules (agent-id principal))
  (map-get? payment-rules { agent-id: agent-id }))

(define-read-only (get-agent-info (agent-id principal))
  (map-get? authorized-agents { agent-id: agent-id }))

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
