window.Utils = (() => {
  const superscriptMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

  function formatFactorPiece(coefficient, exponent) {
    if (exponent === 0) return String(coefficient);
    if (coefficient === 1) return exponent === 1 ? 'x' : `x^${exponent}`;
    return exponent === 1 ? `${coefficient}x` : `${coefficient}x^${exponent}`;
  }

  function formatInsideTerm(coefficient, exponent, isFirst) {
    const sign = coefficient >= 0 ? (isFirst ? '' : ' + ') : (isFirst ? '-' : ' - ');
    const absCoeff = Math.abs(coefficient);

    if (exponent === 0) return `${sign}${absCoeff}`;
    const coeffPart = absCoeff === 1 ? '' : String(absCoeff);
    const varPart = exponent === 1 ? 'x' : `x^${exponent}`;
    return `${sign}${coeffPart}${varPart}`;
  }

  function formatPolynomial(terms) {
    return terms
      .map((term, index) => formatInsideTerm(term.coefficient, term.exponent, index === 0))
      .join('');
  }

  function rawToPretty(raw) {
    return raw
      .replace(/\^([0-9])/g, (_, digit) => superscriptMap[digit] || `^${digit}`)
      .replace(/-/g, '−');
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

  function isLikelyIrreducibleQuadratic(a, b, c) {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return true;
    const root = Math.sqrt(disc);
    return !Number.isInteger(root);
  }

  return {
    choice,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    normalizeRaw,
    randInt,
    rawToPretty
  };
})();
