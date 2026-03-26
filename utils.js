window.Utils = (() => {
  const superscriptMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };

  // ---------------------------------------------------------------------------
  // Seeded RNG — Mulberry32 algorithm.
  // Fast, simple, high-quality 32-bit generator. When a seed is active,
  // randInt and choice produce deterministic sequences. Call setSeed(n) before
  // generating a problem, clearSeed() to go back to Math.random().
  // ---------------------------------------------------------------------------
  let _rng = null;

  function generateSeed() {
    return Math.floor(Math.random() * 1_000_000);
  }

  function setSeed(seed) {
    let s = seed >>> 0; // ensure unsigned 32-bit integer
    _rng = () => {
      s += 0x6d2b79f5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
  }

  function clearSeed() {
    _rng = null;
  }

  function _random() {
    return _rng ? _rng() : Math.random();
  }

  function randInt(min, max) {
    return Math.floor(_random() * (max - min + 1)) + min;
  }

  function choice(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function gcdTwo(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a || 1;
  }

  function gcdList(values) {
    return values.reduce((acc, value) => gcdTwo(acc, value));
  }

  function formatFactorPiece(coefficient, exponent, variable = 'x') {
    if (exponent === 0) return String(coefficient);
    if (coefficient === 1) return exponent === 1 ? variable : `${variable}^${exponent}`;
    return exponent === 1 ? `${coefficient}${variable}` : `${coefficient}${variable}^${exponent}`;
  }

  function formatInsideTerm(coefficient, exponent, isFirst, variable = 'x', yExponent = 0) {
    const sign = coefficient >= 0 ? (isFirst ? '' : ' + ') : (isFirst ? '-' : ' - ');
    const absCoeff = Math.abs(coefficient);

    // Build variable part: x portion + optional y portion
    let varPart = '';
    if (exponent > 0) {
      varPart += exponent === 1 ? variable : `${variable}^${exponent}`;
    }
    if (yExponent > 0) {
      varPart += yExponent === 1 ? 'y' : `y^${yExponent}`;
    }

    if (varPart === '') return `${sign}${absCoeff}`;
    const coeffPart = absCoeff === 1 ? '' : String(absCoeff);
    return `${sign}${coeffPart}${varPart}`;
  }

  function formatPolynomial(terms) {
    return terms
      .map((term, index) => formatInsideTerm(term.coefficient, term.exponent, index === 0, term.variable || 'x', term.yExponent || 0))
      .join('');
  }

  function rawToPretty(raw) {
    return raw
      .replace(/\^([0-9]+)/g, (_, digits) => [...digits].map(d => superscriptMap[d] || d).join(''))
      .replace(/\^$/g, '\u2070')   // bare caret → ⁰ placeholder (same font metrics as ²³⁴)
      .replace(/-/g, '−');
  }

  // Like rawToPretty but returns safe HTML with variables wrapped in styled spans.
  // Also wraps the ⁰ exponent placeholder in a blink-styled span so students
  // can see where their exponent digit will go.
  // Use this for innerHTML display fields only — not for plain text contexts.
  function rawToPrettyHtml(raw) {
    const pretty = rawToPretty(raw);
    // Escape HTML special chars before injecting as innerHTML
    const escaped = pretty
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Wrap x and y in math-variable spans — only when not adjacent to non-math letters.
    // Excludes x/y inside words like "Multiply", "exponent", "every" etc.
    // Allows xy compound variables and standalone x/y next to digits/operators.
    const withVars = escaped.replace(/(?<![a-wzA-WZ])[xy](?![a-wzA-WZ])/g, (match) => `<span class="math-var">${match}</span>`);
    // Wrap the ⁰ placeholder in a blink span. No alignment CSS needed —
    // ⁰ is a real Unicode superscript character with the same font metrics
    // and baseline position as ²³⁴ etc.
    return withVars.replace(/\u2070/g, '<span class="exp-placeholder">⁰</span>');
  }

  function normalizeRaw(raw) {
    return raw
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace(/\u2062/g, '')
      .replace(/([0-9)])([a-zA-Z(])/g, '$1*$2')
      .replace(/([a-zA-Z])\(/g, '$1*(')
      .replace(/\)([0-9a-zA-Z])/g, ')*$1');
  }

  // ---------------------------------------------------------------------------
  // parseFactors(expr)
  //
  // Splits a factored expression into a sorted canonical list of factor tokens.
  // Handles: leading coefficients/variables, parenthesized factors, ^2 suffix.
  //   "(x+3)(x-2)"        → ["(x+3)", "(x-2)"] sorted
  //   "3(x+2)(x-3)"       → ["3", "(x+2)", "(x-3)"] sorted
  //   "5(x^2+4)(x+2)(x-2)"→ ["(x+2)", "(x-2)", "(x^2+4)", "5"] sorted
  //   "(x+2)^2"           → ["(x+2)^2"]
  // Used by compareAnswers for factored-form steps.
  // ---------------------------------------------------------------------------
  function parseFactors(expr) {
    const s = expr.replace(/\s+/g, '').replace(/−/g, '-');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === '(') {
        // Find matching close paren
        let depth = 0, j = i;
        while (j < s.length) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') { depth--; if (depth === 0) break; }
          j++;
        }
        let token = s.slice(i, j + 1);
        // Include ^n suffix if present
        let k = j + 1;
        if (k < s.length && s[k] === '^') {
          k++;
          while (k < s.length && s[k] >= '0' && s[k] <= '9') k++;
          token = s.slice(i, k);
          j = k - 1;
        }
        tokens.push(token);
        i = j + 1;
      } else {
        // Leading coefficient/variable up to next '('
        let j = i;
        while (j < s.length && s[j] !== '(') j++;
        if (j > i) tokens.push(s.slice(i, j));
        i = j;
      }
    }
    return tokens.sort();
  }

  // ---------------------------------------------------------------------------
  // compareFactored(student, expected)
  //
  // Compares two factored expressions canonically — factor order doesn't matter.
  // Falls back to exact normalizeRaw comparison if parsing produces no tokens
  // (e.g. for intermediate steps that aren't fully factored products).
  // ---------------------------------------------------------------------------
  function compareFactored(student, expected) {
    const sTokens = parseFactors(student);
    const eTokens = parseFactors(expected);
    // Only use token comparison if both parsed into multiple factors
    // (single token means it's probably not a factored product)
    if (sTokens.length > 1 || eTokens.length > 1) {
      return sTokens.length === eTokens.length &&
             sTokens.every((t, i) => normalizeRaw(t) === normalizeRaw(eTokens[i]));
    }
    return normalizeRaw(student) === normalizeRaw(expected);
  }

  function isPerfectSquare(n) {
    if (n < 0) return false;
    const root = Math.round(Math.sqrt(n));
    return root * root === n;
  }

  function isLikelyIrreducibleQuadratic(a, b, c) {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return true;
    const root = Math.sqrt(disc);
    return !Number.isInteger(root);
  }

  // ---------------------------------------------------------------------------
  // buildFromPrimes(pool, maxPrimeCount, maxFactor)
  //
  // Builds an integer by multiplying primes drawn from a weighted pool.
  // Before each multiplication, the pool is filtered to primes that keep
  // the running product within maxFactor — guaranteeing the result never
  // exceeds maxFactor with no rejection loop needed.
  //
  // maxPrimeCount and maxFactor may each be a [min, max] range — a random
  // value is chosen within that range each call, giving natural variance.
  //
  // Parameters:
  //   pool          array of primes (repeated entries = higher probability)
  //   maxPrimeCount number or [min, max] — max prime factors to multiply
  //   maxFactor     number or [min, max] — ceiling on the result
  // ---------------------------------------------------------------------------
  function buildFromPrimes(pool, maxPrimeCount, maxFactor) {
    const primeLimit  = Array.isArray(maxPrimeCount) ? randInt(maxPrimeCount[0], maxPrimeCount[1]) : maxPrimeCount;
    const factorLimit = Array.isArray(maxFactor)     ? randInt(maxFactor[0],     maxFactor[1])     : maxFactor;
    let current = 1;
    for (let i = 0; i < primeLimit; i++) {
      const available = pool.filter(p => p <= factorLimit / current);
      if (available.length === 0) break;
      current *= choice(available);
    }
    return current;
  }

  // ---------------------------------------------------------------------------
  // formatLinearFactor(root)
  //
  // Convenience wrapper — formats (x + root) or (x − |root|).
  // Delegates to formatPolynomial so all formatting logic stays in one place.
  //   formatLinearFactor(3)  → "x + 3"
  //   formatLinearFactor(-5) → "x - 5"
  // ---------------------------------------------------------------------------
  function formatLinearFactor(root) {
    return formatPolynomial([
      { coefficient: 1,    exponent: 1 },
      { coefficient: root, exponent: 0 }
    ]);
  }

  // ---------------------------------------------------------------------------
  // formatSecondFactor(b, bXExp, c, cYExp)
  //
  // Convenience wrapper — formats the second factor in a grouping problem.
  // Delegates to formatPolynomial so all formatting logic stays in one place.
  //   formatSecondFactor(2, 2, 5, 0) → "2x^2 + 5"
  //   formatSecondFactor(3, 1, 4, 1) → "3x + 4y"
  //   formatSecondFactor(1, 2, -7, 0) → "x^2 - 7"
  // ---------------------------------------------------------------------------
  function formatSecondFactor(b, bXExp, c, cYExp = 0) {
    return formatPolynomial([
      { coefficient: b, exponent: bXExp },
      { coefficient: c, exponent: 0, yExponent: cYExp }
    ]);
  }


  // ---------------------------------------------------------------------------
  // pickNumbers(slots, options)
  //
  // Generates one number per slot, deterministically satisfying constraints.
  // Each slot is [min, max] or { range: [min, max], exclude: [...] }.
  // Slots are processed narrowest-pool-first so fixes happen on wider pools.
  //
  // Options:
  //   avoidGCD: bool             — gcd of ALL generated numbers must = 1
  //   avoidEqual: bool           — no two generated numbers may be equal
  //   avoidAllPerfectSquares     — at least one must not be a perfect square
  //
  // Internal flow per slot:
  //   1. Build pool from range, remove excluded + already-chosen values
  //   2. Pick random start index, scan forward (wrapping) for valid value
  //   3. If full circle fails → fallback to first prime above pool max
  //
  // Returns array in SAME ORDER as input slots.
  // ---------------------------------------------------------------------------
  function nextPrime(n) {
    const isPr = v => { if (v < 2) return false; for (let i=2; i*i<=v; i++) if (v%i===0) return false; return true; };
    let v = n + 1;
    while (!isPr(v)) v++;
    return v;
  }

  function pickNumbers(slots, {
    avoidGCD               = false,
    avoidEqual             = false,
    avoidAllPerfectSquares = false
  } = {}) {
    const n = slots.length;

    // Normalise: accept [min,max] or {range, exclude}
    const norm = slots.map(s =>
      Array.isArray(s)
        ? { range: s, exclude: [] }
        : { range: s.range, exclude: s.exclude || [] }
    );

    // Sort narrowest-pool-first, preserve original index
    const indexed = norm.map((s, i) => ({
      ...s,
      i,
      poolSize: s.range[1] - s.range[0] + 1 - s.exclude.length
    }));
    indexed.sort((a, b) => a.poolSize - b.poolSize);

    const result = new Array(n);

    for (let step = 0; step < n; step++) {
      const { range: [lo, hi], exclude, i } = indexed[step];
      const prevResults = indexed.slice(0, step).map(({ i }) => result[i]);

      // Build pool: range minus excluded and (if avoidEqual) already-chosen values
      const excluded = new Set([
        ...exclude,
        ...(avoidEqual ? prevResults : [])
      ]);
      const pool = [];
      for (let v = lo; v <= hi; v++) {
        if (!excluded.has(v)) pool.push(v);
      }

      // Constraint: avoidGCD against all previously chosen values
      const combined = avoidGCD && prevResults.length > 0
        ? prevResults.reduce((a, b) => a * b, 1)
        : null;

      // On the last slot: if avoidAllPerfectSquares and all previous values are
      // perfect squares, this slot must not be a perfect square.
      const isLastSlot = step === n - 1;
      const mustAvoidSquare = avoidAllPerfectSquares
        && isLastSlot
        && prevResults.every(v => isPerfectSquare(v));

      const satisfies = v =>
        (!combined || gcdList([v, combined]) === 1) &&
        (!mustAvoidSquare || !isPerfectSquare(v));

      let val = null;
      if (pool.length > 0) {
        const startIdx = randInt(0, pool.length - 1);
        for (let offset = 0; offset < pool.length; offset++) {
          const candidate = pool[(startIdx + offset) % pool.length];
          if (satisfies(candidate)) { val = candidate; break; }
        }
      }

      // Fallback: first prime above pool max satisfying constraint
      // (primes always satisfy avoidGCD; also never perfect squares for p>2... wait,
      //  no prime is a perfect square since squares are composite — so primes
      //  satisfy mustAvoidSquare automatically too)
      if (val === null) {
        let fb = nextPrime(hi);
        while (!satisfies(fb)) fb = nextPrime(fb);
        val = fb;
      }

      result[i] = val;
    }

    return result;
  }


  return {
    buildFromPrimes,
    choice,
    formatLinearFactor,
    formatSecondFactor,
    generateSeed,
    setSeed,
    clearSeed,
    rawToPrettyHtml,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    pickNumbers,
    isPerfectSquare,
    compareFactored,
    normalizeRaw,
    randInt,
    rawToPretty
  };
})();