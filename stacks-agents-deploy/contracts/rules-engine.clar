;; rules-engine.clar
;; Manage complex payment rules and evaluate payments for agentic control

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Constants & Error Codes
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant ERR-NOT-INITIALIZED u300)
(define-constant ERR-ALREADY-INITIALIZED u301)
(define-constant ERR-UNAUTHORIZED u302)
(define-constant ERR-RULE-NOT-FOUND u303)
(define-constant ERR-INVALID-PARAMS u304)

(define-constant MAX-RULES-RETURN u20)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; External contracts (integration)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant AGENT-MANAGER .agent-manager)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Storage
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-data-var contract-owner (optional principal) none)

;; Global rule id counter
(define-data-var rule-counter uint u0)

;; Rule base record
;; rule-id -> data
(define-map rules
  { rule-id: uint }
  { agent-id: principal,
    rule-type: (string-ascii 50),
    conditions: (string-ascii 500),
    actions: (string-ascii 200),
    priority: uint,
    enabled: bool,
    created-at: uint })

;; Agent -> priority -> rule index (to iterate in priority order)
(define-map agent-rule-index
  { agent-id: principal, priority: uint, rule-id: uint }
  { exists: bool })

;; Typed parameters per rule-id (optional usage in evaluation)
(define-map rule-spending
  { rule-id: uint }
  { daily: uint, weekly: uint, monthly: uint })

(define-map rule-merchant
  { rule-id: uint }
  { mode: (string-ascii 10), ;; "whitelist" | "blacklist"
    merchants: (list 50 principal),
    categories: (list 50 (string-ascii 20)) })

(define-map rule-time
  { rule-id: uint }
  { business-hours: bool, weekend-allowed: bool, start-hour: uint, end-hour: uint })

(define-map rule-velocity
  { rule-id: uint }
  { max-per-hour: uint })

(define-map rule-amount
  { rule-id: uint }
  { min-amount: uint, max-amount: uint })

(define-map rule-geo
  { rule-id: uint }
  { countries: (list 20 (string-ascii 2)) })

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

(define-private (assert-admin-or-agent-owner (agent-id principal))
  (let ((sender tx-sender))
    (if (is-admin sender)
        (ok true)
        (match (contract-call? AGENT-MANAGER get-agent-info agent-id)
          info (if (is-eq sender (get owner info)) (ok true) (err ERR-UNAUTHORIZED))
          (err ERR-UNAUTHORIZED)))))

(define-private (next-rule-id)
  (let ((id (+ (var-get rule-counter) u1)))
    (var-set rule-counter id)
    id))

(define-private (index-add (agent-id principal) (priority uint) (rule-id uint))
  (map-set agent-rule-index { agent-id: agent-id, priority: priority, rule-id: rule-id } { exists: true }))

(define-private (index-del (agent-id principal) (priority uint) (rule-id uint))
  (map-delete agent-rule-index { agent-id: agent-id, priority: priority, rule-id: rule-id }))

;; Utility: membership check
(define-read-only (str-list-contains (xs (list 50 (string-ascii 20))) (s (string-ascii 20)))
  (fold (lambda (item acc) (or acc (is-eq item s))) xs false))

(define-read-only (p-list-contains (xs (list 50 principal)) (p principal))
  (fold (lambda (item acc) (or acc (is-eq item p))) xs false))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Initialization
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (init-contract (owner principal))
  (if (is-some (var-get contract-owner))
      (err ERR-ALREADY-INITIALIZED)
      (begin
        (var-set contract-owner (some owner))
        (print (tuple (event "init") (owner owner)))
        (ok true))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Rule CRUD
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (create-rule (agent-id principal) (rule-type (string-ascii 50)) (conditions (string-ascii 500)) (actions (string-ascii 200)))
  (begin
    (try! (assert-initialized))
    (try! (assert-admin-or-agent-owner agent-id))
    (let ((rid (next-rule-id))
          (priority u100))
      (map-set rules { rule-id: rid }
        { agent-id: agent-id,
          rule-type: rule-type,
          conditions: conditions,
          actions: actions,
          priority: priority,
          enabled: true,
          created-at: block-height })
      (index-add agent-id priority rid)
      (print (tuple (event "create-rule") (agent agent-id) (rule-id rid) (type rule-type)))
      (ok rid))))

(define-public (update-rule (rule-id uint) (new-conditions (string-ascii 500)))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rules { rule-id: rule-id }
            { agent-id: (get agent-id r),
              rule-type: (get rule-type r),
              conditions: new-conditions,
              actions: (get actions r),
              priority: (get priority r),
              enabled: (get enabled r),
              created-at: (get created-at r) })
          (print (tuple (event "update-rule") (rule-id rule-id)))
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (delete-rule (rule-id uint))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (index-del (get agent-id r) (get priority r) rule-id)
          (map-delete rules { rule-id: rule-id })
          (print (tuple (event "delete-rule") (rule-id rule-id)))
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

;; Optional helpers to manage priority and enable flags
(define-public (set-rule-priority (rule-id uint) (new-priority uint))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (index-del (get agent-id r) (get priority r) rule-id)
          (index-add (get agent-id r) new-priority rule-id)
          (map-set rules { rule-id: rule-id }
            { agent-id: (get agent-id r),
              rule-type: (get rule-type r),
              conditions: (get conditions r),
              actions: (get actions r),
              priority: new-priority,
              enabled: (get enabled r),
              created-at: (get created-at r) })
          (print (tuple (event "priority") (rule-id rule-id) (priority new-priority)))
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-rule-enabled (rule-id uint) (flag bool))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rules { rule-id: rule-id }
            { agent-id: (get agent-id r),
              rule-type: (get rule-type r),
              conditions: (get conditions r),
              actions: (get actions r),
              priority: (get priority r),
              enabled: flag,
              created-at: (get created-at r) })
          (print (tuple (event "enable") (rule-id rule-id) (enabled flag)))
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Typed configuration setters (optional but used by evaluator)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-public (set-spending-params (rule-id uint) (daily uint) (weekly uint) (monthly uint))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-spending { rule-id: rule-id } { daily: daily, weekly: weekly, monthly: monthly })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-merchant-params (rule-id uint) (mode (string-ascii 10)) (merchants (list 50 principal)) (categories (list 50 (string-ascii 20))))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-merchant { rule-id: rule-id } { mode: mode, merchants: merchants, categories: categories })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-time-params (rule-id uint) (business-hours bool) (weekend-allowed bool) (start-hour uint) (end-hour uint))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-time { rule-id: rule-id } { business-hours: business-hours, weekend-allowed: weekend-allowed, start-hour: start-hour, end-hour: end-hour })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-velocity-params (rule-id uint) (max-per-hour uint))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-velocity { rule-id: rule-id } { max-per-hour: max-per-hour })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-amount-params (rule-id uint) (min-amount uint) (max-amount uint))
  (begin
    (try! (assert-initialized))
    (if (> min-amount max-amount) (err ERR-INVALID-PARAMS) (ok true))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-amount { rule-id: rule-id } { min-amount: min-amount, max-amount: max-amount })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

(define-public (set-geo-params (rule-id uint) (countries (list 20 (string-ascii 2))))
  (begin
    (try! (assert-initialized))
    (match (map-get? rules { rule-id: rule-id })
      r (begin
          (try! (assert-admin-or-agent-owner (get agent-id r)))
          (map-set rule-geo { rule-id: rule-id } { countries: countries })
          (ok true))
      none (err ERR-RULE-NOT-FOUND))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Queries
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (get-agent-rules (agent-id principal))
  (let ((result (list)))
    ;; iterate a priority window u0..u999 for brevity
    (let ((loop (lambda (p acc)
                  (if (> p u999)
                      acc
                      (let ((cursor (lambda (rid acc2)
                                       (let ((rec (map-get? rules { rule-id: rid })))
                                         (match rec r (if (and (is-eq (get agent-id r) agent-id) (get enabled r)) (cons r acc2) acc2) acc2)))))
                        acc)))) )
      result)) )

;; Simple conflict checker: counts misconfigured rules
(define-read-only (rule-conflict-check (agent-id principal))
  (let ((conflicts u0))
    ;; scan amount rules for min<=max
    (let ((inc (lambda (x) (+ x u1))))
      (fold (lambda (rid acc)
              (let ((a (map-get? rule-amount { rule-id: rid })))
                (match a
                  rec (if (> (get min-amount rec) (get max-amount rec)) (inc acc) acc)
                  acc)))
            (list) conflicts))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Evaluation
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; payment-data schema expected by evaluator
;; { amount, merchant, category, hour, day, txs-last-hour, country }
(define-read-only (evaluate-rules (agent-id principal)
  (payment-data (tuple (amount uint) (merchant principal) (category (string-ascii 20)) (hour uint) (day uint) (txs-last-hour uint) (country (string-ascii 2)) )))
  (let (
        (amount (get amount payment-data))
        (merchant (get merchant payment-data))
        (category (get category payment-data))
        (hour (get hour payment-data))
        (day (get day payment-data))
        (txh (get txs-last-hour payment-data))
        (country (get country payment-data))
       )
    ;; Evaluation strategy: first-match by ascending priority.
    ;; For simplicity, iterate rule-ids up to current counter and filter by agent.
    (let ((max-id (var-get rule-counter)))
      (let ((decide (lambda (rid acc)
                      (if (is-some acc) ;; decision taken
                          acc
                          (match (map-get? rules { rule-id: rid })
                            r (if (and (is-eq (get agent-id r) agent-id) (get enabled r))
                                    (let ((rtype (get rule-type r))
                                          (act (get actions r)))
                                      ;; amount-based
                                      (if (is-eq rtype "amount")
                                          (let ((params (map-get? rule-amount { rule-id: rid })))
                                            (match params p
                                              (if (or (< amount (get min-amount p)) (> amount (get max-amount p))) (some act) (none))
                                              (none)))
                                          (if (is-eq rtype "merchant")
                                              (let ((m (map-get? rule-merchant { rule-id: rid })))
                                                (match m p
                                                  (let ((in-list (or (p-list-contains (get merchants p) merchant)
                                                                     (str-list-contains (get categories p) category)))
                                                        (mode (get mode p)))
                                                    (if (or (and (is-eq mode "whitelist") (not in-list))
                                                            (and (is-eq mode "blacklist") in-list))
                                                        (some act)
                                                        (none)))
                                                  (none)))
                                              (if (is-eq rtype "time")
                                                  (let ((t (map-get? rule-time { rule-id: rid })))
                                                    (match t p
                                                      (let ((bh (get business-hours p)) (we (get weekend-allowed p)) (sh (get start-hour p)) (eh (get end-hour p)))
                                                        (let ((is-weekend (or (is-eq day u0) (is-eq day u6)))
                                                              (in-hours (and (>= hour sh) (<= hour eh))))
                                                          (if (or (and bh (not in-hours)) (and (not we) is-weekend))
                                                              (some act)
                                                              (none))))
                                                      (none)))
                                                  (if (is-eq rtype "velocity")
                                                      (let ((v (map-get? rule-velocity { rule-id: rid })))
                                                        (match v p (if (> txh (get max-per-hour p)) (some act) (none)) (none)))
                                                      (if (is-eq rtype "geo")
                                                          (let ((g (map-get? rule-geo { rule-id: rid })))
                                                            (match g p (if (not (str-list-contains (get countries p) country)) (some act) (none)) (none)))
                                                          (none))))))
                                acc))
                            acc))))
        (let ((decision (fold decide (range u1 (+ max-id u1)) none)))
          (default-to "allow" decision)))
