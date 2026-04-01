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

  function rawToPretty(raw) {
    return raw
      .replace(/([0-9xy)])([+\-])/g, '$1 $2')          // space before operator
      .replace(/(?<!\()([+\-])([0-9xy(])/g, '$1 $2')  // space after operator (not after opening bracket)
      .replace(/\^([0-9]+)/g, (_, digits) => [...digits].map(d => superscriptMap[d] || d).join(''))
      .replace(/\^$/g, '\uE000')   // bare caret → private sentinel (must come after ^digits)
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
    // Replace all regular spaces with thin spaces — ensures consistent math spacing
    // in the HTML layer without touching raw strings elsewhere in the codebase.
    const withSpacing = escaped.replace(/ /g, '&thinsp;');
    // Wrap x and y in math-variable spans — only when not adjacent to non-math letters.
    // Excludes x/y inside words like "Multiply", "exponent", "every" etc.
    // Allows xy compound variables and standalone x/y next to digits/operators.
    const withVars = withSpacing.replace(/(?<![a-wzA-WZ])[xy](?![a-wzA-WZ])/g, (match) => `<span class="math-var">${match}</span>`);
    // Wrap the ⁰ placeholder in a blink span. No alignment CSS needed —
    // ⁰ is a real Unicode superscript character with the same font metrics
    // and baseline position as ²³⁴ etc.
    return withVars.replace(/\uE000/g, '<span class="exp-placeholder">\u2070</span>');
  }

  function normalizeRaw(raw) {
    return raw
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace(/\u2062/g, '')
      .replace(/^\+/, '')           // strip leading + (e.g. +8 → 8)
      .replace(/\b0+(\d)/g, '$1')  // strip leading zeroes from integers (e.g. 08 → 8)
      .replace(/([0-9)])([a-zA-Z(])/g, '$1*$2')
      .replace(/([a-zA-Z])\(/g, '$1*(')
      .replace(/\)([0-9a-zA-Z])/g, ')*$1');
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
    generateSeed,
    setSeed,
    clearSeed,
    rawToPrettyHtml,
    gcdList,
    pickNumbers,
    isPerfectSquare,
    isLikelyIrreducibleQuadratic,
    normalizeRaw,
    randInt,
    rawToPretty
  };
})();