window.Generators = (() => {
  const {
    choice,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    isPerfectSquare,
    randInt
  } = window.Utils;

  // ---------------------------------------------------------------------------
  // generateGCFLayer({ coeffRange, xExpRange, yExpRange, expression, insideTerms })
  //
  // Shared primitive used by any problem that has a GCF step.
  // Picks the GCF components from the given ranges, then builds and returns
  // the complete workflow steps and hints for the GCF portion of a problem.
  //
  // The caller is responsible for:
  //   - Generating inside terms (no shared numeric, x, or y factor)
  //   - Building the full polynomial by multiplying inside terms by the GCF
  //   - Appending the final workflow step (write the factored form)
  //
  // Parameters:
  //   coeffRange  [min, max]  range for the numeric GCF
  //   xExpRange   [min, max]  range for the x GCF exponent (0 = no x in GCF)
  //   yExpRange   [min, max]  range for the y GCF exponent (default [0,0])
  //   expression              full polynomial string (for hints)
  //   insideTerms             inside terms array (for hints and answer)
  //
  // Returns:
  //   numericGCF, xGCFExponent, yGCFExponent  — the GCF components
  //   totalGCF, variableGCFText               — formatted GCF strings
  //   insideExpression, answer                — formatted strings
  //   gcfSteps, gcfWorkflow                   — steps/workflow for GCF portion
  // ---------------------------------------------------------------------------
  function generateGCFLayer({
    coeffRange,
    xExpRange,
    yExpRange = [0, 0],
    expression,
    insideTerms
  }) {
    const numericGCF   = randInt(coeffRange[0], coeffRange[1]);
    const xGCFExponent = randInt(xExpRange[0], xExpRange[1]);
    const yGCFExponent = randInt(yExpRange[0], yExpRange[1]);

    const xGCFPart = xGCFExponent === 0 ? '' : xGCFExponent === 1 ? 'x' : `x^${xGCFExponent}`;
    const yGCFPart = yGCFExponent === 0 ? '' : yGCFExponent === 1 ? 'y' : `y^${yGCFExponent}`;
    const variableGCFText = (xGCFPart + yGCFPart) || '1';
    const totalGCF = variableGCFText === '1'
      ? String(numericGCF)
      : numericGCF === 1 ? variableGCFText : `${numericGCF}${variableGCFText}`;

    const insideExpression = formatPolynomial(insideTerms);
    const answer = `${totalGCF}(${insideExpression})`;

    // Reconstruct full terms for hint text
    const fullTerms = insideTerms.map(t => ({
      coefficient: numericGCF * t.coefficient,
      exponent:    t.exponent + xGCFExponent,
      yExponent:   (t.yExponent || 0) + yGCFExponent
    }));

    const coefficients = fullTerms.map(t => Math.abs(t.coefficient));
    const numericHint = `What is the GCF of ${coefficients.join(', ')}?`;

    const xExpList = fullTerms
      .map(t => t.exponent === 0 ? 'none' : t.exponent === 1 ? 'x' : `x^${t.exponent}`)
      .join(', ');

    // Mention y whenever y appears anywhere in the polynomial — even if there is no y GCF.
    // This teaches students to always check for a y factor, not just assume there isn't one.
    const yAppearsInProblem = fullTerms.some(t => (t.yExponent || 0) > 0);
    const yExpList = yAppearsInProblem
      ? ` Y exponents: ${fullTerms.map(t => (t.yExponent || 0) === 0 ? 'none' : (t.yExponent || 0) === 1 ? 'y' : `y^${t.yExponent}`).join(', ')}.`
      : '';
    const yGCFNote = yAppearsInProblem && yGCFExponent === 0
      ? ' There is no shared y factor — the y GCF is 1.'
      : '';

    const variableHint = variableGCFText === '1' && !yAppearsInProblem
      ? 'There is no variable factor shared by all terms — the variable GCF is 1.'
      : `Find the lowest power of each variable shared by every term. X exponents: ${xExpList}.${yExpList}${yGCFNote}`;

    const totalGCFHint = variableGCFText === '1'
      ? `The numeric GCF is ${numericGCF} and there is no variable GCF. Total GCF = ${numericGCF}.`
      : `Multiply the numeric GCF (${numericGCF}) by the variable GCF (${variableGCFText}).`;

    const insideHint = `Divide every term of ${expression} by the total GCF (${totalGCF}). What expression is left inside the parentheses?`;

    const gcfWorkflow = [
      {
        id: 'numeric-gcf',
        label: 'Find the numeric GCF',
        hint: numericHint,
        expected: String(numericGCF)
      },
      {
        id: 'variable-gcf',
        label: 'Find the variable GCF',
        hint: variableHint,
        expected: variableGCFText
      },
      {
        id: 'total-gcf',
        label: 'Multiply the numeric and variable GCF to get the total GCF',
        hint: totalGCFHint,
        expected: totalGCF
      },
      {
        id: 'inside',
        label: 'Divide the expression by the total GCF to find what goes inside the parentheses',
        hint: insideHint,
        expected: insideExpression
      }
    ];

    const gcfSteps = [
      {
        expression,
        rule: 'gcf',
        output: answer,
        explanation: `Numeric GCF: ${numericGCF}. Variable GCF: ${variableGCFText}. Total GCF: ${totalGCF}.`
      }
    ];

    return {
      numericGCF,
      xGCFExponent,
      yGCFExponent,
      variableGCFText,
      totalGCF,
      insideExpression,
      answer,
      gcfSteps,
      gcfWorkflow
    };
  }

  // ---------------------------------------------------------------------------
  // generateInsideTerms({ termCount, xExpRange, allowNegative, allowY, yExpRange })
  //
  // Generates inside terms with NO shared numeric, x, or y factor.
  // Guarantees:
  //   - At least one term has x exponent 0 (so x cannot be further factored)
  //   - If any term has y, at least one term has no y (so y cannot be factored)
  //   - gcd of all coefficients = 1
  // ---------------------------------------------------------------------------
  function generateInsideTerms({
    termCount,
    xExpRange,
    allowNegative = false,
    allowY = false,
    yExpRange = [1, 2]
  }) {
    let terms;
    let attempts = 0;

    do {
      attempts++;
      if (attempts > 200) break;

      if (termCount === 2) {
        const c1 = randInt(1, 8);
        const c2 = randInt(1, 8) * (allowNegative ? choice([1, -1]) : 1);
        const xExp = randInt(xExpRange[0], xExpRange[1]);
        terms = [
          { coefficient: c1, exponent: xExp },
          { coefficient: c2, exponent: 0 }
        ];
        // Optionally add y to first term only — constant term has no y
        if (allowY && choice([true, false])) {
          terms[0].yExponent = randInt(yExpRange[0], yExpRange[1]);
        }

      } else {
        const a = randInt(1, 5);
        const b = randInt(1, 8) * (allowNegative ? choice([1, -1]) : 1);
        const c = randInt(1, 6) * (allowNegative ? choice([1, -1]) : 1);
        const leadExp = randInt(xExpRange[0], xExpRange[1]);
        const midExp  = leadExp > 1 ? randInt(1, leadExp - 1) : 1;
        terms = [
          { coefficient: a, exponent: leadExp },
          { coefficient: b, exponent: midExp },
          { coefficient: c, exponent: 0 }
        ];
        // Optionally add y to some (not all) terms.
        // Each term independently gets a y exponent. Only constraint: at least
        // one term must end up with no y (so y can't be a common factor).
        // This naturally covers all 6 patterns: 1, 2, 3, 1&2, 1&3, 2&3.
        if (allowY && choice([true, false])) {
          for (const term of terms) {
            if (choice([true, false])) {
              term.yExponent = randInt(yExpRange[0], yExpRange[1]);
            }
          }
          // Guarantee at least one term has no y — clear a random term's y if needed
          if (terms.every(t => (t.yExponent || 0) > 0)) {
            terms[randInt(0, terms.length - 1)].yExponent = 0;
          }
        }
      }

      terms.sort((a, b) => b.exponent - a.exponent);

    } while (!isValidInsideTerms(terms));

    return terms;
  }

  function isValidInsideTerms(terms) {
    if (!terms || terms.length === 0) return false;
    // No zero coefficients
    if (terms.some(t => t.coefficient === 0)) return false;
    // No shared numeric factor
    if (gcdList(terms.map(t => Math.abs(t.coefficient))) !== 1) return false;
    // At least one term with x exponent 0
    if (!terms.some(t => t.exponent === 0)) return false;
    // If any term has y, at least one must have no y
    const hasAnyY = terms.some(t => (t.yExponent || 0) > 0);
    if (hasAnyY && !terms.some(t => (t.yExponent || 0) === 0)) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // generateGCFProblem(proficiency)
  //
  // Standalone GCF factoring problem. Calls generateGCFLayer with ranges
  // tuned for the given proficiency level. All GCF logic lives in the layer —
  // this function only defines ranges and generates the inside terms.
  // ---------------------------------------------------------------------------
  function generateGCFProblem(proficiency) {

    const configs = {
      emerging: {
        coeffRange: [2, 5],
        xExpRange:  [0, 0],
        yExpRange:  [0, 0],
        inside: { termCount: 2, xExpRange: [1, 2], allowNegative: false, allowY: false }
      },
      developing: {
        coeffRange: [2, 6],
        xExpRange:  [1, 2],
        yExpRange:  [0, 0],
        inside: { termCount: 2, xExpRange: [1, 2], allowNegative: false, allowY: false }
      },
      proficient: {
        coeffRange: [2, 12],
        xExpRange:  [0, 2],
        yExpRange:  [0, 0],  // no y GCF — y may appear inside terms only
        inside: { termCount: 3, xExpRange: [2, 3], allowNegative: true, allowY: true, yExpRange: [1, 2] }
      },
      extending: {
        coeffRange: [2, 16],
        xExpRange:  [1, 3],
        yExpRange:  [0, 2],
        inside: { termCount: 3, xExpRange: [2, 4], allowNegative: true, allowY: true, yExpRange: [1, 2] }
      }
    };

    const config = configs[proficiency];
    const insideTerms = generateInsideTerms(config.inside);

    // First pass: get GCF components
    const firstPass = generateGCFLayer({
      coeffRange: config.coeffRange,
      xExpRange:  config.xExpRange,
      yExpRange:  config.yExpRange,
      expression: '__placeholder__',
      insideTerms
    });

    const { numericGCF, xGCFExponent, yGCFExponent } = firstPass;

    // Build the real full polynomial
    const fullTerms = insideTerms
      .map(t => ({
        coefficient: numericGCF * t.coefficient,
        exponent:    t.exponent + xGCFExponent,
        yExponent:   (t.yExponent || 0) + yGCFExponent
      }))
      .sort((a, b) => b.exponent - a.exponent);

    const expression = formatPolynomial(fullTerms);

    // Second pass: rebuild with real expression so hint text is accurate
    const layer = generateGCFLayer({
      coeffRange: [numericGCF, numericGCF],
      xExpRange:  [xGCFExponent, xGCFExponent],
      yExpRange:  [yGCFExponent, yGCFExponent],
      expression,
      insideTerms
    });

    const finalHint = `Write the total GCF (${layer.totalGCF}) followed by the inside expression in parentheses.`;
    const workflow = [
      ...layer.gcfWorkflow,
      { id: 'final', label: 'Write the factored form', hint: finalHint, expected: layer.answer }
    ];

    return {
      id: `gcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'gcf',
      proficiency,
      expression,
      factors: [layer.totalGCF, layer.insideExpression],
      answer: layer.answer,
      steps: layer.gcfSteps,
      workflow
    };
  }

  // ---------------------------------------------------------------------------
  // generateDifferenceOfSquaresProblem(proficiency)
  //
  // Generates a difference of squares problem: A² − B² → (A+B)(A−B)
  //
  // All problems are genuinely single-step — no factor can itself be a DoS.
  // The y exponent in Extending is always exactly y² to prevent the second
  // factor from becoming another difference of squares (which would make it
  // a chained/full-factoring problem instead). Higher y exponents belong there.
  //
  // Proficiency levels — using notation where exponents are explicit squares:
  //   emerging:   x² − b²          small b root (2–7)       e.g. x² − 25
  //   developing: a²x² − b²        both terms need roots     e.g. 9x² − 16
  //   proficient: a²x^2n − b²      higher x exponents        e.g. 4x^4 − 49
  //   extending:  a²x^2n − b²y²    adds second variable      e.g. 9x^4 − 64y²
  // ---------------------------------------------------------------------------
  function generateDifferenceOfSquaresProblem(proficiency) {
    // Config table: aRoot range, bRoot range, allowed varExponents, useY
    // varExponent must always be even (half-exponent appears in each factor)
    const configs = {
      emerging:   { aRootRange: [1, 1], bRootRange: [2, 7],  varExponents: [2],       useY: false },
      developing: { aRootRange: [2, 4], bRootRange: [2, 9],  varExponents: [2],       useY: false },
      proficient: { aRootRange: [1, 4], bRootRange: [2, 11], varExponents: [2, 4, 6], useY: false },
      extending:  { aRootRange: [2, 5], bRootRange: [2, 11], varExponents: [2, 4, 6], useY: true  }
    };

    const config = configs[proficiency];
    let aRoot = randInt(config.aRootRange[0], config.aRootRange[1]);
    let bRoot = randInt(config.bRootRange[0], config.bRootRange[1]);
    const varExponent = choice(config.varExponents);
    const useY = config.useY;

    // Avoid overlap: emerging-style problems slipping into proficient
    if (proficiency === 'proficient' && aRoot === 1 && varExponent === 2) {
      bRoot = randInt(4, 11);
    }
    // Extending: avoid aRoot === bRoot (trivial-looking problems)
    if (proficiency === 'extending') {
      while (bRoot === aRoot) bRoot = randInt(config.bRootRange[0], config.bRootRange[1]);
    }

    const a = aRoot * aRoot;
    const b = bRoot * bRoot;
    const halfExponent = varExponent / 2;

    const expression = useY
      ? formatPolynomial([
          { coefficient: a,  exponent: varExponent },
          { coefficient: -b, exponent: 0, yExponent: 2 }
        ])
      : formatPolynomial([
          { coefficient: a,  exponent: varExponent },
          { coefficient: -b, exponent: 0 }
        ]);

    const aRootTermText = formatFactorPiece(aRoot, halfExponent);
    const bRootTermText = useY ? formatFactorPiece(bRoot, 1, 'y') : String(bRoot);
    const leftFactor    = `${aRootTermText} + ${bRootTermText}`;
    const rightFactor   = `${aRootTermText} - ${bRootTermText}`;
    const answer        = `(${leftFactor})(${rightFactor})`;

    const firstTermDesc  = a === 1 && varExponent === 2 ? 'x²'
      : a === 1 ? `x^${varExponent}`
      : varExponent === 2 ? `${a}x²`
      : `${a}x^${varExponent}`;
    const secondTermDesc = useY ? (b === 1 ? 'y²' : `${b}y²`) : String(b);

    const firstTermHint  = `The first term is ${firstTermDesc}. What is √(${firstTermDesc})?`;
    const secondTermHint = useY
      ? `The second term is ${secondTermDesc}. What is √(${secondTermDesc})?`
      : `The second term is ${b}. What is √${b}?`;
    const finalHint = `Write (A + B)(A − B) where A = ${aRootTermText} and B = ${bRootTermText}.`;

    const workflow = [
      { id: 'first-root',  label: 'Find the square root of the first term',  hint: firstTermHint,  expected: aRootTermText },
      { id: 'second-root', label: 'Find the square root of the second term', hint: secondTermHint, expected: bRootTermText },
      { id: 'final',       label: 'Write the factored form (A + B)(A − B)',  hint: finalHint,      expected: answer }
    ];

    const steps = [
      {
        expression,
        rule: 'dos',
        output: answer,
        explanation: `Difference of squares: √(${firstTermDesc}) = ${aRootTermText}, √(${secondTermDesc}) = ${bRootTermText}, so (${aRootTermText} + ${bRootTermText})(${aRootTermText} − ${bRootTermText}).`
      }
    ];

    return {
      id: `dos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'dos',
      proficiency,
      expression,
      factors: [leftFactor, rightFactor],
      answer,
      steps,
      workflow
    };
  }

  // ---------------------------------------------------------------------------
  // generateProblem(settings)
  // ---------------------------------------------------------------------------
  function generateProblem(settings) {
    if (settings.method === 'gcf') {
      return generateGCFProblem(settings.difficulty);
    }
    if (settings.method === 'dos') {
      return generateDifferenceOfSquaresProblem(settings.difficulty);
    }
    return null;
  }

  return { generateProblem };
})();