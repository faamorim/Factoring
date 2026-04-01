// ---------------------------------------------------------------------------
// Factoring-specific utilities — polynomial formatting and factored form
// comparison. Depends on window.Utils (rawToPretty, normalizeRaw).
// ---------------------------------------------------------------------------
window.FactoringUtils = (() => {
  const { normalizeRaw } = window.Utils;

  function formatFactorPiece(coefficient, exponent, variable = 'x') {
    if (exponent === 0) return String(coefficient);
    if (coefficient === 1) return exponent === 1 ? variable : `${variable}^${exponent}`;
    return exponent === 1 ? `${coefficient}${variable}` : `${coefficient}${variable}^${exponent}`;
  }

  function formatInsideTerm(coefficient, exponent, isFirst, variable = 'x', yExponent = 0) {
    const sign = coefficient >= 0 ? (isFirst ? '' : ' + ') : (isFirst ? '-' : ' - ');
    const absCoeff = Math.abs(coefficient);
    let varPart = '';
    if (exponent > 0) varPart += exponent === 1 ? variable : `${variable}^${exponent}`;
    if (yExponent > 0) varPart += yExponent === 1 ? 'y' : `y^${yExponent}`;
    if (varPart === '') return `${sign}${absCoeff}`;
    const coeffPart = absCoeff === 1 ? '' : String(absCoeff);
    return `${sign}${coeffPart}${varPart}`;
  }

  function formatPolynomial(terms) {
    return terms
      .map((term, index) => formatInsideTerm(term.coefficient, term.exponent, index === 0, term.variable || 'x', term.yExponent || 0))
      .join('');
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
    const s = expr.replace(/\s+/g, '').replace(/\u2212/g, '-').replace(/−/g, '-');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === '(') {
        let depth = 0, j = i;
        while (j < s.length) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') { depth--; if (depth === 0) break; }
          j++;
        }
        let token = s.slice(i, j + 1);
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
    if (sTokens.length > 1 || eTokens.length > 1) {
      return sTokens.length === eTokens.length &&
             sTokens.every((t, i) => normalizeRaw(t) === normalizeRaw(eTokens[i]));
    }
    return normalizeRaw(student) === normalizeRaw(expected);
  }

  return {
    compareFactored,
    formatFactorPiece,
    formatLinearFactor,
    formatPolynomial,
    formatSecondFactor,
    parseFactors
  };
})();