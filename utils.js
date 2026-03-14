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
      .replace(/\^([0-9])/g, (_, digit) => superscriptMap[digit] || `^${digit}`)
      .replace(/-/g, '−');
  }

  // Like rawToPretty but returns safe HTML with variables wrapped in styled spans.
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
    return escaped.replace(/(?<![a-wzA-WZ])[xy](?![a-wzA-WZ])/g, (match) => `<span class="math-var">${match}</span>`);
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
  // Formats a linear factor as a readable string with correct sign display.
  // Used wherever (x + n) or (x − n) factors appear.
  //   formatLinearFactor(3)  → "x + 3"
  //   formatLinearFactor(-5) → "x - 5"
  //   formatLinearFactor(0)  → "x"  (degenerate case, included for safety)
  // ---------------------------------------------------------------------------
  function formatLinearFactor(root) {
    if (root === 0) return 'x';
    return root > 0 ? `x + ${root}` : `x - ${Math.abs(root)}`;
  }

  return {
    buildFromPrimes,
    choice,
    formatLinearFactor,
    generateSeed,
    setSeed,
    clearSeed,
    rawToPrettyHtml,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    isPerfectSquare,
    normalizeRaw,
    randInt,
    rawToPretty
  };
})();