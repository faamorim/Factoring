# Factoring Practice App — Roadmap

A living document of what's built, what's planned, and what's been
deliberately deferred and why.

---

## Generators

### Built
- **GCF** — numeric and variable GCF, optional y variable at Extending
- **Difference of Squares** — single and two-variable (a²x^2n − b²y²)
- **Perfect Square Trinomial** — single and two-variable at Extending,
  chained factoring prevention built in
- **Simple Trinomial** — x² + bx + c (a = 1), prime-based number
  generation, routes through generateTrinomialLayer
- **Grouping** — four-term polynomials, two-variable at Extending,
  five-step workflow including combined-pairs intermediate step
- **General Trinomial** — ax² + bx + c (a > 1), routes through
  generateTrinomialLayer which internally calls generateGroupingLayer
- **Mixed Method** — randomly selects from all six methods using a
  weighted pool (GCF 25%, ST 20%, DoS/PST/GT 15% each, Grouping 10%).
  Guided mode: radio button method identification step first, remaining
  steps locked until correct method selected. Final answer mode: skips
  identification entirely. Decision-tree hint walks through term count
  and pattern recognition.

- **Full Factoring** — chained multi-step problems. Flat pre-computed
  workflow with progressive reveal via gatedBy. Proficiency structures:
  Emerging: GCF + [DoS|PST|ST]. Developing: GCF + [DoS|PST|ST|GT].
  Proficient: GCF + inner OR two-step no-GCF [DoS→DoS | Grp→DoS].
  Extending: GCF + two-step inner.
  Method identification radios use method-specific options (not yes/no)
  so students identify the technique, not just confirm factorability.
  Known gaps (planned extensions):
  - Degree-4 PST: (x²±a)² not yet a FF structure
  - GT→DoS chain: x⁴+Bx²+C factoring into (x²+p)(x²+q) where each
    factor is a DoS — GT step exists but follow-up DoS steps are not
    generated. Needs new structure type and extended workflow builder.

### Planned — in curriculum order

### Deferred
- **Two-variable PST at Extending** — (ax + by)² is curriculum-standard
  and confirmed in math guides, but PST Extending already has higher
  exponents. Deferring to avoid three distinct "flavors" of hard in one
  level. Revisit when adding two-variable problems more systematically.

- **Irreducible trinomials** — only relevant in Mixed mode at Extending,
  where a student should recognize a polynomial cannot be factored.
  Teacher-controlled setting when implemented.

- **Negative leading coefficients** — changes the workflow steps
  (factor out −1 first). Future feature.

- **Irreducible lookalikes** — generate intentionally-unfactorable expressions
  that resemble factorable ones, for use in Mixed/FF identification steps at
  Proficient/Extending. Three strategies for DoS lookalikes:
  1. Odd exponent (x³−9) — exponent not even, so not a perfect square
  2. Sum instead of difference (x²+9) — sum of squares is irreducible
  3. Non-perfect-square coefficient/constant (8x²−25, 4x²−45) — coefficients
     not perfect squares. Increment factor by 1..2×original to stay just below
     next perfect square.
  Layer returns no factoring steps/workflow; caller handles "can't factor"
  identification. Each layer (DoS, PST, trinomial) would need its own
  lookalike strategy. Low probability trigger (10-15%) at appropriate levels.

- **varExponent semantic rename** — currently means the degree of the
  expanded expression (must be even). Should mean the exponent of the
  root variable (half current value), so odd values work naturally.
  Purely mechanical rename: halve all config values and call sites,
  remove the /2 inside the layers. Zero functional change for current
  even-only cases.

- **pickNumbers backtracking** — if all slots fail constraints, could
  backtrack and re-generate earlier slots. Currently uses prime fallback
  which handles all realistic cases. Full backtracking would be the
  theoretically complete solution but is unnecessary for our ranges.

- **nextPrime memoization** — cache computed primes for reuse. Only
  called as fallback when a pool is exhausted (extremely rare). Not
  worth implementing until profiling shows it as a bottleneck.

---

## Answer Checking

### Built
- String normalization (`normalizeRaw`) — strips spaces, converts
  unicode minus, handles implicit multiplication
- Comma-separated pair input for Simple Trinomial (sorted before
  comparing so order doesn't matter)
- Factor-order-insensitive comparison (`parseFactors` + `compareFactored`)
  — splits factored expressions into sorted canonical tokens, so
  `(x+2)(x-3)` correctly matches `(x-3)(x+2)` everywhere

### Planned
- **Term order within factors** — `(x+2)` should match `(2+x)`.
  Sort terms within each factor canonically before comparing.
  Currently not an issue since our generators always write terms
  in a consistent order, but worth hardening.

---

## UX / Features

### Built
- Guided mode (step-by-step workflow with hints)
- Final answer mode
- Seeded generation + shareable problem URLs (`?p=method.proficiency.mode.seed`)
- Copy Link button
- BC Proficiency Scale labels (Emerging / Developing / Proficient / Extending)

### Planned
- **Custom problem input** — teacher or student specifies the roots/
  factors manually; app generates the polynomial, workflow, and all
  steps from those known roots. Not a general solver — still works
  forwards from known answers. Fits naturally into existing architecture.

- **Incremental hints** — each workflow step gets `hints: [hint1, hint2, hint3]`
  instead of a single `hint` string. Each press of the Hint button reveals
  the next level for the current step — progressively stronger nudges without
  giving away the answer. First hint: general direction. Second: more specific.
  Third: nearly explicit (e.g. gives one of the two factors directly).
  Existing single `hint` strings stay supported as fallback for steps that
  don't need multiple levels. The find-factors step in Simple Trinomial is
  the natural first candidate: hint1 = "think about factor pairs of |c|",
  hint2 = sign conclusion (both negative / opposite signs / larger has sign
  of b), hint3 = one of the two factors explicitly.

- **Progress tracking** — count of correct/incorrect per method and
  proficiency level, stored in localStorage. Simple session stats.

- **Timer mode** — optional countdown or elapsed time display.

- **Quiz generator** — generate a sequence of problems from a single
  seed, so the whole quiz is reproducible and shareable via URL.
  Configuration specifies counts per method and proficiency level,
  e.g. "2 GCF emerging, 3 GCF developing, 4 DoS proficient, ...".
  The seed deterministically produces the same sequence every time —
  useful for teachers assigning the same practice set to a whole class,
  or for retrying a specific quiz.
  Format TBD — could be a structured config UI or a compact URL string
  like `?quiz=gcf:2,3,4,1|dos:2,3,4,1|st:1,2,2,1&seed=123456`.
  Problems would be navigable (next/previous) with progress tracking.

- **Print / export** — three output modes, all from the same seed so
  a teacher can generate all three from one URL:
    - *Quiz* — problems only. No steps, no hints, no answers. Clean
      layout for in-class assessment.
    - *Worksheet* — problems with guided step labels printed below each
      one (e.g. "Find the numeric GCF", "Find the variable GCF"). Not
      hints, not solutions — just the workflow scaffold for students who
      haven't memorized the steps yet. In Mixed mode, only the first
      label ("Identify the factoring method") is printed; remaining
      steps left blank since the method determines the workflow.
    - *Solution key* — problems with full answers, on a separate page.
      Separation prevents accidental answer-peeking. Useful both as a
      teacher answer key for quizzes and as a self-check sheet for
      worksheet practice.

---

## Infrastructure

### Built
- `buildFromPrimes(pool, maxPrimeCount, maxFactor)` — shared utility
  for generating numbers with controlled prime factorization complexity
- `formatLinearFactor(root)`, `formatSecondFactor(b, bXExp, c, cYExp)`
  — convenience wrappers delegating to `formatPolynomial`
- `generateGCFLayer()` — reusable GCF workflow builder, builds
  expression internally, returns `fullTerms` for chaining
- `generateGroupingLayer()` — unified grouping primitive for
  `(ax+b)(cx^n+dy^m)`, GCFs derived via gcd(), covers standalone
  grouping and general trinomial grouping from a single source
- `generateDoSLayer()` — reusable DoS workflow builder
- `generatePSTLayer()` — reusable PST workflow builder
- `generateTrinomialLayer()` — shared trinomial primitive for both
  Simple and General Trinomial, calls grouping layer internally.
  Supports `xExponent` parameter for trinomials in x² (degree 4).
  ST/GT generators use xExponent=2 at Proficient/Extending (33%).
- `generateInsideTerms()` — validated inside-term generator,
  guarantees no shared GCF across coefficients.
- `pickNumbers(slots, options)` — deterministic number generator.
  Pool-based (not range-trimming). Supports avoidGCD, avoidEqual,
  avoidAllPerfectSquares. Circular scan within pool; prime fallback
  if pool exhausted. Replaces all do-while retry loops.
- `gatedBy` step system — any workflow step can gate subsequent steps.
  Used by Mixed Method (identify-method gates all inner steps) and
  Full Factoring (each factoring checkpoint gates its sub-steps).

### Planned
- **`normalizeAnswer(str, method)`** — method-aware normalization
  for remaining edge cases. Factor order is now handled by
  `compareFactored`. Remaining gap: term order within individual
  factors (e.g. `(2+x)` vs `(x+2)`).

---

## Deliberately Out of Scope

- **General polynomial solver** — the app generates problems from known
  roots, so all steps and answers are pre-computed. A solver would work
  backwards from arbitrary input, which is a fundamentally different
  problem. More importantly: if students can paste in a homework problem
  and receive a worked solution, the app becomes a homework shortcut
  rather than a practice tool. That's a different product with different
  goals.