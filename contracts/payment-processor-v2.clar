;; Payment Processor Contract v2
;; Integrates with deployed agent-manager and rules-engine
;; Handles STX transfers with comprehensive policy enforcement

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Constants & Error Codes
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR-NOT-INITIALIZED u200)
(define-constant ERR-ALREADY-INITIALIZED u201)
(define-constant ERR-UNAUTHORIZED u202)
(define-constant ERR-AGENT-NOT-FOUND u203)
(define-constant ERR-AGENT-NOT-AUTHORIZED u204)
(define-constant ERR-HALTED u205)
(define-constant ERR-AMOUNT-TOO-HIGH u206)
(define-constant ERR-RECIPIENT-NOT-ALLOWED u207)
(define-constant ERR-DAILY-LIMIT u208)
(define-constant ERR-MONTHLY-LIMIT u209)
(define-constant ERR-RATE-LIMIT u210)
(define-constant ERR-INSUFFICIENT-BALANCE u211)
(define-constant ERR-TRANSFER-FAILED u212)

(define-constant RATE-LIMIT-BLOCKS u6) ;; ~1 hour at 10min blocks
(define-constant MAX-HISTORY-ENTRIES u50)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; External Contract References
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Set these to your deployed contract addresses
(define-constant AGENT-MANAGER-CONTRACT .agent-manager)
(define-constant RULES-ENGINE-CONTRACT .rules-engine)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Storage
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var contract-owner (optional principal) none)
(define-data-var global-halt bool false)
(define-data-var payment-counter uint u0)

;; Per-agent spending tracking
(define-map daily-spending
  { agent-id: principal, day: uint }
  { amount: uint })

(define-map monthly-spending
  { agent-id: principal, month: uint }
  { amount: uint })

;; Rate limiting
(define-map last-payment-block
  { agent-id: principal }
  { block: uint })

;; Payment history
(define-map payment-history
  { payment-id: uint }
  { agent-id: principal,
    recipient: principal,
    amount: uint,
    block-height: uint,
    success: bool,
    memo: (optional (string-ascii 500)) })

;; Agent payment counters
(define-map agent-payment-count
  { agent-id: principal }
  { count: uint })

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Helper Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (get-contract-owner)
  (var-get contract-owner))

(define-private (is-contract-owner)
  (is-eq (some tx-sender) (var-get contract-owner)))

(define-read-only (get-day-index)
  (/ block-height u144)) ;; ~24 hours at 10min blocks

(define-read-only (get-month-index)
  (/ block-height u4320)) ;; ~30 days at 10min blocks

(define-private (next-payment-id)
  (let ((current (var-get payment-counter)))
    (var-set payment-counter (+ current u1))
    (+ current u1)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Validation Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-private (validate-agent-authorization (agent-id principal))
  (let ((agent-check (contract-call? AGENT-MANAGER-CONTRACT is-agent-authorized agent-id)))
    (match agent-check
      success (if success (ok true) (err ERR-AGENT-NOT-AUTHORIZED))
      error (err ERR-AGENT-NOT-FOUND))))

(define-private (validate-payment-rules (agent-id principal) (recipient principal) (amount uint))
  (contract-call? RULES-ENGINE-CONTRACT validate-payment agent-id recipient amount))

(define-private (validate-rate-limit (agent-id principal))
  (let ((last-block-data (map-get? last-payment-block { agent-id: agent-id })))
    (match last-block-data
      data (if (>= (- block-height (get block data)) RATE-LIMIT-BLOCKS)
             (ok true)
             (err ERR-RATE-LIMIT))
      none (ok true))))

(define-private (validate-spending-limits (agent-id principal) (amount uint))
  (let ((day (get-day-index))
        (month (get-month-index))
        (daily-spent (default-to u0 (get amount (map-get? daily-spending { agent-id: agent-id, day: day }))))
        (monthly-spent (default-to u0 (get amount (map-get? monthly-spending { agent-id: agent-id, month: month }))))
        (limits (contract-call? RULES-ENGINE-CONTRACT get-spending-limits agent-id)))
    (match limits
      limit-data
        (let ((daily-limit (get daily-limit limit-data))
              (monthly-limit (get monthly-limit limit-data)))
          (begin
            (asserts! (<= (+ daily-spent amount) daily-limit) (err ERR-DAILY-LIMIT))
            (asserts! (<= (+ monthly-spent amount) monthly-limit) (err ERR-MONTHLY-LIMIT))
            (ok true)))
      error (err ERR-AGENT-NOT-FOUND))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Initialization
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (init-contract (owner principal))
  (begin
    (asserts! (is-none (var-get contract-owner)) (err ERR-ALREADY-INITIALIZED))
    (var-set contract-owner (some owner))
    (print { event: "payment-processor-initialized", owner: owner })
    (ok true)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Admin Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (emergency-halt)
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (var-set global-halt true)
    (print { event: "emergency-halt", block: block-height })
    (ok true)))

(define-public (emergency-resume)
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (var-set global-halt false)
    (print { event: "emergency-resume", block: block-height })
    (ok true)))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Core Payment Function
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (execute-payment (agent-id principal) (recipient principal) (amount uint) (memo (optional (string-ascii 500))))
  (let ((payment-id (next-payment-id))
        (day (get-day-index))
        (month (get-month-index)))
    (begin
      ;; Basic validations
      (asserts! (not (var-get global-halt)) (err ERR-HALTED))
      (asserts! (is-eq tx-sender agent-id) (err ERR-UNAUTHORIZED))
      (asserts! (> amount u0) (err ERR-AMOUNT-TOO-HIGH))
      
      ;; Agent authorization check
      (try! (validate-agent-authorization agent-id))
      
      ;; Rate limiting
      (try! (validate-rate-limit agent-id))
      
      ;; Rules validation (amount limits, recipient whitelist, etc.)
      (try! (validate-payment-rules agent-id recipient amount))
      
      ;; Spending limits validation
      (try! (validate-spending-limits agent-id amount))
      
      ;; Execute transfer
      (match (stx-transfer? amount tx-sender recipient)
        success
          (begin
            ;; Update spending tracking
            (let ((daily-spent (default-to u0 (get amount (map-get? daily-spending { agent-id: agent-id, day: day }))))
                  (monthly-spent (default-to u0 (get amount (map-get? monthly-spending { agent-id: agent-id, month: month })))))
              (map-set daily-spending { agent-id: agent-id, day: day } { amount: (+ daily-spent amount) })
              (map-set monthly-spending { agent-id: agent-id, month: month } { amount: (+ monthly-spent amount) }))
            
            ;; Update rate limiting
            (map-set last-payment-block { agent-id: agent-id } { block: block-height })
            
            ;; Update agent payment counter
            (let ((current-count (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id })))))
              (map-set agent-payment-count { agent-id: agent-id } { count: (+ current-count u1) }))
            
            ;; Record successful payment
            (map-set payment-history { payment-id: payment-id }
              { agent-id: agent-id,
                recipient: recipient,
                amount: amount,
                block-height: block-height,
                success: true,
                memo: memo })
            
            (print { event: "payment-success", 
                    payment-id: payment-id,
                    agent-id: agent-id,
                    recipient: recipient,
                    amount: amount })
            (ok payment-id))
        error
          (begin
            ;; Record failed payment
            (map-set payment-history { payment-id: payment-id }
              { agent-id: agent-id,
                recipient: recipient,
                amount: amount,
                block-height: block-height,
                success: false,
                memo: memo })
            
            (print { event: "payment-failed",
                    payment-id: payment-id,
                    agent-id: agent-id,
                    error: error })
            (err ERR-TRANSFER-FAILED))))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Read-Only Functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (get-payment-history (agent-id principal) (limit uint))
  (let ((total-count (var-get payment-counter))
        (actual-limit (if (> limit MAX-HISTORY-ENTRIES) MAX-HISTORY-ENTRIES limit)))
    (build-payment-history agent-id total-count actual-limit (list))))

(define-private (build-payment-history (agent-id principal) (current-id uint) (remaining uint) (acc (list 50 (tuple (payment-id uint) (recipient principal) (amount uint) (block-height uint) (success bool) (memo (optional (string-ascii 500)))))))
  (if (or (is-eq remaining u0) (is-eq current-id u0))
      acc
      (let ((payment (map-get? payment-history { payment-id: current-id })))
        (match payment
          p (if (is-eq (get agent-id p) agent-id)
                (build-payment-history agent-id (- current-id u1) (- remaining u1) 
                  (cons { payment-id: current-id,
                         recipient: (get recipient p),
                         amount: (get amount p),
                         block-height: (get block-height p),
                         success: (get success p),
                         memo: (get memo p) } acc))
                (build-payment-history agent-id (- current-id u1) remaining acc))
          none (build-payment-history agent-id (- current-id u1) remaining acc)))))

(define-read-only (get-payment-details (payment-id uint))
  (map-get? payment-history { payment-id: payment-id }))

(define-read-only (get-agent-spending (agent-id principal))
  (let ((day (get-day-index))
        (month (get-month-index)))
    (ok { daily-spent: (default-to u0 (get amount (map-get? daily-spending { agent-id: agent-id, day: day }))),
          monthly-spent: (default-to u0 (get amount (map-get? monthly-spending { agent-id: agent-id, month: month }))),
          payment-count: (default-to u0 (get count (map-get? agent-payment-count { agent-id: agent-id }))) })))

(define-read-only (is-halted)
  (var-get global-halt))
