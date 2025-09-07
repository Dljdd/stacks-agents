;; payment-processor.clar
;; Processes payments initiated by authorized agents with rules, limits, and logging

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Constants & Error Codes
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

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
(define-constant ERR-MULTISIG-REQUIRED u211)
(define-constant ERR-INVALID-PARAMS u212)

(define-constant RATE-LIMIT-BLOCKS u5)         ;; minimal blocks between payments per agent
(define-constant MAX-HISTORY-RETURN u20)       ;; cap on returned history items

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; External contracts (integration points)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Agent-manager contract expected at same project, update as needed
(define-constant AGENT-MANAGER .agent-manager)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Storage
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var contract-owner (optional principal) none)
(define-data-var global-halt bool false)

;; Per-agent emergency halt flag
(define-map agent-halt
  { agent-id: principal }
  { halted: bool })

;; Per-agent rules
(define-map payment-rules
  { agent-id: principal }
  { max-amount: uint,
    initialized: bool,
    version: uint })

;; Versioned recipient whitelist index to avoid expensive clears
(define-map allowed-recipient
  { agent-id: principal, version: uint, recipient: principal }
  { allowed: bool })

;; Rate limiting: last block a payment executed
(define-map rate-limiter
  { agent-id: principal }
  { last-block: uint })

;; Spending accounting (time-based using block-height buckets)
(define-map spend-daily
  { agent-id: principal, day: uint }
  { total: uint })

(define-map spend-monthly
  { agent-id: principal, month: uint }
  { total: uint })

;; History logging
(define-map payment-counter
  { agent-id: principal }
  { seq: uint })

(define-map payment-history
  { agent-id: principal, seq: uint }
  { recipient: principal,
    amount: uint,
    success: bool,
    block: uint,
    memo: (optional (string-ascii 200)) })

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

;; Access if contract admin or the agent owner from agent-manager
(define-private (assert-admin-or-agent-owner (agent-id principal))
  (let ((sender tx-sender))
    (if (is-admin sender)
        (ok true)
        (match (contract-call? AGENT-MANAGER get-agent-info agent-id)
          info (if (is-eq sender (get owner info)) (ok true) (err ERR-UNAUTHORIZED))
          (err ERR-AGENT-NOT-FOUND)))))

;; Util: derive day and month buckets from block-height
(define-read-only (day-index)
  (/ block-height u144))

(define-read-only (month-index)
  (/ (day-index) u30))

;; Util: check list contains principal
(define-read-only (list-contains-principal (xs (list 20 principal)) (p principal))
  (fold (lambda (item acc) (or acc (is-eq item p))) xs false))

;; History helpers
(define-private (next-seq (agent-id principal))
  (let ((cur (get seq (default-to { seq: u0 } (map-get? payment-counter { agent-id: agent-id })))) )
    (map-set payment-counter { agent-id: agent-id } { seq: (+ cur u1) })
    (+ cur u1)))

(define-private (log-payment (agent-id principal) (recipient principal) (amount uint) (success bool) (memo (optional (string-ascii 200))))
  (let ((seq (next-seq agent-id)))
    (map-set payment-history { agent-id: agent-id, seq: seq }
      { recipient: recipient, amount: amount, success: success, block: block-height, memo: memo })
    (print (tuple (event "payment") (agent agent-id) (recipient recipient) (amount amount) (success success)))
    seq))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public: Initialization
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (init-contract (owner principal))
  (if (is-some (var-get contract-owner))
      (err ERR-ALREADY-INITIALIZED)
      (begin
        (var-set contract-owner (some owner))
        (print (tuple (event "init") (owner owner)))
        (ok true))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public: Rule Management & Halting
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (update-payment-rules (agent-id principal) (max-amount uint) (allowed-recipients (list 20 principal)))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-agent-owner agent-id))
    (let ((cur (get version (default-to { version: u0, max-amount: u0 } (map-get? payment-rules { agent-id: agent-id }))))
          (new (+ (get version (default-to { version: u0, max-amount: u0 } (map-get? payment-rules { agent-id: agent-id }))) u1)))
      (map-set payment-rules { agent-id: agent-id } { max-amount: max-amount, version: new })
      ;; index allowed recipients for this version
      (map (lambda (r)
             (begin (map-set allowed-recipient { agent-id: agent-id, version: new, recipient: r } { allowed: true }) true))
           allowed-recipients)
      (print (tuple (event "update-rules") (agent agent-id) (max max-amount) (version new))))
    (ok true)))

(define-public (emergency-halt-payments (agent-id principal))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-agent-owner agent-id))
    (map-set agent-halt { agent-id: agent-id } { halted: true })
    (print (tuple (event "halt") (agent agent-id)))
    (ok true)))

(define-public (resume-payments (agent-id principal))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-agent-owner agent-id))
    (map-set agent-halt { agent-id: agent-id } { halted: false })
    (print (tuple (event "resume") (agent agent-id)))
    (ok true)))

(define-read-only (is-halted (agent-id principal))
  (or (var-get global-halt)
      (get halted (default-to { halted: false } (map-get? agent-halt { agent-id: agent-id })))) )

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public: Validation
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (validate-payment-rules (agent-id principal) (amount uint))
  (begin
    (if (is-halted agent-id) (err ERR-HALTED) (ok true))
    ;; only the agent principal itself may initiate (prevents spoof)
    (if (is-eq tx-sender agent-id) (ok true) (err ERR-UNAUTHORIZED))
    ;; agent authorization via agent-manager
    (if (contract-call? AGENT-MANAGER is-agent-authorized agent-id)
        (ok true)
        (err ERR-UNAUTHORIZED))
    ;; rules must exist
    (let ((rules (map-get? payment-rules { agent-id: agent-id })))
      (if (is-none rules) (err ERR-RULES-NOT-FOUND) (ok true))
      (let ((r (unwrap-panic rules)))
        ;; amount within per-payment max (otherwise multi-sig required)
        (if (> amount (get max-amount r)) (err ERR-MULTISIG-REQUIRED) (ok true))
        ;; recipient whitelist check is enforced in execute with parameter
        (ok true)))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Public: Payments & History
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (execute-payment (agent-id principal) (recipient principal) (amount uint) (memo (optional (string-ascii 200))))
  (begin
    (try! (assert-initialized))
    (try! (validate-payment-rules agent-id amount))
    ;; recipient whitelisting via versioned index
    (let ((rules (unwrap! (map-get? payment-rules { agent-id: agent-id }) (err ERR-RULES-NOT-FOUND))))
      (let ((rec (default-to { allowed: false } (map-get? allowed-recipient { agent-id: agent-id, version: (get version rules), recipient: recipient }))))
        (if (get allowed rec)
            (ok true)
            (err ERR-RECIPIENT-NOT-ALLOWED))))
    ;; Rate limiting
    (let ((rl (map-get? rate-limiter { agent-id: agent-id })))
      (match rl
        data (if (< (- block-height (get last-block data)) RATE-LIMIT-BLOCKS)
                 (err ERR-RATE-LIMIT)
                 (ok true))
        none (ok true)))
    ;; Spending limits (from agent-manager)
    (let (
          (info (contract-call? AGENT-MANAGER get-agent-info agent-id))
         )
      (match info
        some-info
          (let ((daily (get daily-limit some-info))
                (monthly (get monthly-limit some-info)))
            (let ((d (day-index)) (m (month-index)))
              (let ((dspent (get total (default-to { total: u0 } (map-get? spend-daily { agent-id: agent-id, day: d }))))
                    (mspent (get total (default-to { total: u0 } (map-get? spend-monthly { agent-id: agent-id, month: m }))))
                   )
                (if (> (+ dspent amount) daily) (err ERR-DAILY-LIMIT) (ok true))
                (if (> (+ mspent amount) monthly) (err ERR-MONTHLY-LIMIT) (ok true))
                ;; perform transfer from agent (tx-sender) to recipient
                (let ((res (stx-transfer? amount tx-sender recipient)))
                  (match res
                    okv (begin
                           ;; update spend and rate limiter
                           (map-set spend-daily { agent-id: agent-id, day: d } { total: (+ dspent amount) })
                           (map-set spend-monthly { agent-id: agent-id, month: m } { total: (+ mspent amount) })
                           (map-set rate-limiter { agent-id: agent-id } { last-block: block-height })
                           (log-payment agent-id recipient amount true memo)
                           (ok true))
                    errv (begin
                           (log-payment agent-id recipient amount false memo)
                           errv))))))
        none (err ERR-AGENT-NOT-FOUND)))

;; Return last up-to `limit` history entries (most recent first)
;; Helper for building history list (most recent first)
(define-private (build-history (agent-id principal) (i uint) (left uint) (acc (list 20 (tuple (recipient principal) (amount uint) (success bool) (block uint) (memo (optional (string-ascii 200)))))))
  (if (or (is-eq left u0) (is-eq i u0))
      acc
      (let ((rec (map-get? payment-history { agent-id: agent-id, seq: i })))
        (match rec
          r (build-history agent-id (- i u1) (- left u1) (cons r acc))
          none (build-history agent-id (- i u1) left acc)))))

(define-read-only (get-payment-history (agent-id principal) (limit uint))
  (let ((lim (if (> limit MAX-HISTORY-RETURN) MAX-HISTORY-RETURN limit))
        (seq (get seq (default-to { seq: u0 } (map-get? payment-counter { agent-id: agent-id })))) )
    (build-history agent-id seq lim (list))))
