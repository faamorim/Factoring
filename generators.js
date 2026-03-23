window.Generators = (() => {
  const {
    buildFromPrimes,
    choice,
    formatFactorPiece,
    formatLinearFactor,
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
  // generatePerfectSquareTrinomialProblem(proficiency)
  //
  // Generates a perfect square trinomial: A² + 2AB + B² → (A + B)²
  //                                    or A² − 2AB + B² → (A − B)²
  //
  // The "verify middle term" step is pedagogically central — it teaches
  // students to confirm the pattern rather than assume it.
  //
  // Proficiency levels:
  //   emerging:   x² ± 2bx + b²          leading coeff 1, small b (2–6)
  //   developing: x² ± 2bx + b²          leading coeff 1, b up to 12, b can be negative
  //   proficient: a²x² ± 2abx + b²       leading coeff a perfect square
  //   extending:  a²x^2n ± 2abx^n + b²   higher even exponents
  // ---------------------------------------------------------------------------
  function generatePerfectSquareTrinomialProblem(proficiency) {

    // Proficiency levels — using notation where exponents are explicit squares:
    //   emerging:   x² ± 2bx + b²              leading coeff 1, positive b only
    //   developing: x² ± 2bx + b²              leading coeff 1, b can be negative
    //   proficient: a²x² ± 2abx + b²           leading coeff a perfect square
    //   extending:  a²x^2n ± 2abx^n + b²y²     higher exponents, adds y variable
    //               OR a²x^2n ± 2abx^n + b²    higher exponents, single variable
    //
    // Two-variable form (ax ± by)² — curriculum-standard, matches GCF and DoS
    // in having y appear at Extending level.
    //
    // Chained factoring prevention: if bRoot is negative AND both aRoot and
    // bRootAbs are perfect squares AND varExponent === 2, the factor (ax ± b)
    // would itself be a difference of squares — rejected via retry loop.
    const configs = {
      emerging:   { aRootRange: [1, 1], bRootRange: [2, 6],  varExponents: [2],    allowNegativeB: false, allowY: false },
      developing: { aRootRange: [1, 1], bRootRange: [2, 12], varExponents: [2],    allowNegativeB: true,  allowY: false },
      proficient: { aRootRange: [2, 4], bRootRange: [2, 9],  varExponents: [2],    allowNegativeB: true,  allowY: false },
      extending:  { aRootRange: [1, 4], bRootRange: [2, 9],  varExponents: [2, 4], allowNegativeB: true,  allowY: true  }
    };

    const config = configs[proficiency];
    let aRoot, bRootAbs, bRoot, varExponent;

    // Generate components, then fix any chained-factoring situation deterministically.
    // A chained problem occurs when bRoot is negative AND varExponent === 2 AND both
    // aRoot and bRootAbs are perfect squares — making the factor (ax ± b) itself a DoS.
    // Fix: increment bRootAbs by 1. Adding 1 to any perfect square > 1 always produces
    // a non-perfect-square (no two consecutive integers are both perfect squares above 1),
    // so this resolves the condition in a single step with no loop needed.
    aRoot      = randInt(config.aRootRange[0], config.aRootRange[1]);
    bRootAbs   = randInt(config.bRootRange[0], config.bRootRange[1]);
    bRoot      = config.allowNegativeB ? bRootAbs * choice([1, -1]) : bRootAbs;
    varExponent = choice(config.varExponents);

    if (bRoot < 0 && varExponent === 2 && isPerfectSquare(aRoot) && isPerfectSquare(bRootAbs)) {
      bRootAbs += 1;
      bRoot = -bRootAbs;
    }

    // 50% chance of two-variable form at Extending: (ax^n ± by)²
    const useY = config.allowY && choice([true, false]);
    const halfExp = varExponent / 2;

    // --- Build the three terms ---
    // Single-variable: a²x^2n ± 2ab·x^n + b²       → (ax^n ± b)²
    // Two-variable:    a²x^2n ± 2ab·x^n·y + b²y²   → (ax^n ± by)²
    const leadCoeff   = aRoot * aRoot;
    const midCoeff    = 2 * aRoot * bRoot;    // signed
    const constCoeff  = bRootAbs * bRootAbs;  // always positive
    const midExponent = halfExp;              // x^n in middle term

    const expression = useY
      ? formatPolynomial([
          { coefficient: leadCoeff,  exponent: varExponent, yExponent: 0 },
          { coefficient: midCoeff,   exponent: midExponent, yExponent: 1 },
          { coefficient: constCoeff, exponent: 0,           yExponent: 2 }
        ])
      : formatPolynomial([
          { coefficient: leadCoeff,  exponent: varExponent },
          { coefficient: midCoeff,   exponent: midExponent },
          { coefficient: constCoeff, exponent: 0 }
        ]);

    // --- Factored form ---
    const aRootText  = formatFactorPiece(aRoot, halfExp);          // e.g. 2x^2
    const bRootText  = useY ? formatFactorPiece(bRootAbs, 1, 'y') : String(bRootAbs); // e.g. 3y or 3
    const bSign      = bRoot >= 0 ? '+' : '−';
    const innerFactor = `${aRootText} ${bSign} ${bRootText}`;
    const answer      = `(${innerFactor})^2`;

    // --- Descriptions for hints ---
    const firstTermDesc = leadCoeff === 1 && varExponent === 2 ? 'x²'
      : leadCoeff === 1 ? `x^${varExponent}`
      : varExponent === 2 ? `${leadCoeff}x²`
      : `${leadCoeff}x^${varExponent}`;

    const lastTermDesc = useY
      ? (constCoeff === 1 ? 'y²' : `${constCoeff}y²`)
      : String(constCoeff);

    const middleTermDesc = (() => {
      const absCoeff = Math.abs(midCoeff);
      const varPart  = useY
        ? (midExponent === 1 ? 'xy' : `x^${midExponent}y`)
        : (midExponent === 1 ? 'x'  : `x^${midExponent}`);
      const sign = midCoeff >= 0 ? '+' : '−';
      return `${sign} ${absCoeff}${varPart}`;
    })();

    const expectedMiddle = (() => {
      const absCoeff = Math.abs(midCoeff);
      const varPart  = useY
        ? (midExponent === 1 ? 'xy' : `x^${midExponent}y`)
        : (midExponent === 1 ? 'x'  : `x^${midExponent}`);
      return midCoeff >= 0 ? `${absCoeff}${varPart}` : `-${absCoeff}${varPart}`;
    })();

    // expectedMiddleAbs: the positive magnitude for the verify step
    // expectedMiddle: signed, kept for the steps explanation
    const expectedMiddleAbs = (() => {
      const absCoeff = Math.abs(midCoeff);
      const varPart  = useY
        ? (midExponent === 1 ? 'xy' : `x^${midExponent}y`)
        : (midExponent === 1 ? 'x'  : `x^${midExponent}`);
      return `${absCoeff}${varPart}`;
    })();

    const middleSign = midCoeff >= 0 ? '+' : '-';

    // --- Hints ---
    const firstRootHint   = `The first term is ${firstTermDesc}. What is √(${firstTermDesc})?`;
    const lastRootHint    = useY
      ? `The last term is ${lastTermDesc}. Square roots are always positive — what is √(${lastTermDesc})?`
      : `The last term is ${constCoeff}. Square roots are always positive — what is √${constCoeff}?`;
    const verifyHint      = `Multiply 2 × first_root × last_root: 2 × ${aRootText} × ${bRootText}. Enter the result as a positive value — we check the sign separately.`;
    const signHint        = `Look at the middle term of the original expression (${middleTermDesc}). Is it positive or negative? Enter + or −.`;
    const finalHint       = `Use the sign from the previous step. Write (first_root ± last_root)² with the correct sign between the roots.`;

    // --- Workflow ---
    const workflow = [
      {
        id: 'first-root',
        label: 'Find the square root of the first term',
        hint: firstRootHint,
        expected: aRootText
      },
      {
        id: 'last-root',
        label: 'Find the square root of the last term (always positive)',
        hint: lastRootHint,
        expected: bRootText
      },
      {
        id: 'verify-middle',
        label: 'Verify: 2 × first_root × last_root matches the middle term (ignore its sign)',
        hint: verifyHint,
        expected: expectedMiddleAbs
      },
      {
        id: 'middle-sign',
        label: 'What is the sign of the middle term?',
        hint: signHint,
        expected: middleSign
      },
      {
        id: 'final',
        label: 'Write the factored form (first_root ± last_root)²',
        hint: finalHint,
        expected: answer
      }
    ];

    // --- Steps ---
    const steps = [
      {
        expression,
        rule: 'pst',
        output: answer,
        explanation: `Perfect square trinomial: √(${firstTermDesc}) = ${aRootText}, √${constCoeff} = ${bRootAbs}, middle term = 2 × ${aRootText} × ${bRootAbs} = ${expectedMiddle} ✓`
      }
    ];

    return {
      id: `pst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'pst',
      proficiency,
      expression,
      factors: [innerFactor],
      answer,
      steps,
      workflow
    };
  }


  // ---------------------------------------------------------------------------
  // generateSimpleTrinomialProblem(proficiency)
  //
  // Generates a simple trinomial: x² + bx + c → (x + p)(x + q)
  // where p × q = c and p + q = b, with a = 1 always.
  //
  // Numbers are built progressively from prime factors for precise control:
  //   - pool is filtered at each step to primes that keep the result <= maxFactor
  //   - this guarantees the factor ceiling with no rejection loop
  //   - weighted prime pool skews toward smaller primes naturally
  //   - highly composite numbers (many small prime factors) are harder to
  //     factor than large primes — more candidate pairs to test before finding
  //     the one that satisfies both the product AND sum conditions
  //
  // Proficiency levels and sign rules:
  //   emerging:   p, q both positive  — b and c both positive
  //   developing: p, q both negative  — b negative, c positive
  //   proficient: one positive, one negative (mixed, |p|≠|q|) — c negative
  //   extending:  one positive, one negative, highly composite — c negative, small |b|
  //
  // |p| ≠ |q| always — prevents perfect square trinomials (p=q) and
  // difference-of-squares disguised as trinomials (p=−q gives b=0).
  //
  // Workflow (4 steps):
  //   1. Find two integers that multiply to c  (comma-separated input)
  //   2. Verify they multiply to c
  //   3. Verify they add to b
  //   4. Write the factored form
  // ---------------------------------------------------------------------------
  function generateSimpleTrinomialProblem(proficiency) {

    // Config per proficiency:
    //   pool          weighted prime pool (repeated entries = higher probability)
    //   maxPrimeCount max number of prime factors to multiply together
    //   maxFactor     hard ceiling on each factor — guaranteed by progressive build
    //   signs         sign rule applied after generation
    //
    // No 11 or 13 in any pool — large primes reduce factor pair count, making
    // problems harder in the wrong way (one obvious pair vs many to search).
    // No 5 in the extending pool — with multiple 2s also present, 5 almost
    // guarantees factors ending in 0, making products suspiciously round.
    // maxPrimeCount and maxFactor are [min, max] ranges — buildFromPrimes picks
    // a random value within each range per call, giving natural variance within
    // each proficiency level without needing a stopChance hack.
    // signs arrays are weighted pools — choice() gives the distribution naturally.
    // For mixed sign mode, the larger factor randomly takes positive or negative,
    // so b can be either sign and students must read it carefully.
    const configs = {
      emerging: {
        pool: [2, 2, 3, 3, 5],
        maxPrimeCount: [1, 2],
        maxFactor: [4, 12],
        signs: ['both-positive']
      },
      developing: {
        pool: [2, 2, 3, 3, 5],
        maxPrimeCount: [1, 3],
        maxFactor: [6, 18],
        signs: ['both-negative', 'both-negative', 'both-negative', 'both-positive']  // 75% negative
      },
      proficient: {
        pool: [2, 3, 5, 7],
        maxPrimeCount: [1, 2],
        maxFactor: [6, 20],
        signs: ['mixed', 'mixed', 'mixed', 'both-positive', 'both-negative']  // 60% mixed
      },
      extending: {
        pool: [2, 2, 3, 3, 7],
        maxPrimeCount: [2, 4],
        maxFactor: [12, 36],
        signs: ['mixed', 'mixed', 'mixed', 'mixed', 'both-positive', 'both-negative']  // 67% mixed
      }
    };

    const config = configs[proficiency];
    const signMode = choice(config.signs);

    // Only retry for pAbs === qAbs — maxFactor ceiling is guaranteed by
    // buildFromPrimes in utils.js. Safety fallback for the degenerate case.
    let pAbs, qAbs;
    let attempts = 0;
    do {
      pAbs = buildFromPrimes(config.pool, config.maxPrimeCount, config.maxFactor);
      qAbs = buildFromPrimes(config.pool, config.maxPrimeCount, config.maxFactor);
      attempts++;
      if (attempts > 50) { pAbs = 2; qAbs = 3; break; }
    } while (pAbs === qAbs);

    // Apply signs — for mixed, randomly decide which factor is negative so
    // b can be either positive or negative, forcing students to read the sign carefully
    let p, q;
    if (signMode === 'both-positive') {
      p = pAbs;
      q = qAbs;
    } else if (signMode === 'both-negative') {
      p = -pAbs;
      q = -qAbs;
    } else {
      // mixed: larger absolute value randomly positive or negative
      const larger  =  Math.max(pAbs, qAbs);
      const smaller =  Math.min(pAbs, qAbs);
      const sign    = choice([1, -1]);
      p = sign * larger;
      q = -sign * smaller;
    }

    const b = p + q;   // coefficient of x
    const c = p * q;   // constant term

    // --- Build expression ---
    const expression = formatPolynomial([
      { coefficient: 1, exponent: 2 },
      { coefficient: b, exponent: 1 },
      { coefficient: c, exponent: 0 }
    ]);

    // --- Factored form ---
    // Sort factors for canonical display: larger absolute value first
    const [f1, f2] = [p, q].sort((a, b) => Math.abs(b) - Math.abs(a));
    const answer = `(${formatLinearFactor(f1)})(${formatLinearFactor(f2)})`;

    // --- Expected inputs ---
    // For the "find two factors" step, student enters p and q as a comma-separated
    // pair. We normalize by sorting numerically before comparing.
    const factorPairSorted = [p, q].slice().sort((a, b) => a - b).join(', ');

    // --- Hints ---
    const coeffHint  = `Look at the term with x. What number is multiplied by x?`;
    const constHint  = `Look at the last term. What is the number with no variable?`;
    const cSign      = c >= 0 ? 'positive' : 'negative';
    const findHint   = `You need two integers that multiply to ${c} and add to ${b}. ` +
      `Think about factor pairs of ${Math.abs(c)}.` +
      (c > 0 && b > 0 ? ` Since the product is positive and the sum is positive, both integers are positive.` : '') +
      (c > 0 && b < 0 ? ` Since the product is positive and the sum is negative, both integers are negative.` : '') +
      (c < 0 ? ` Since the product is negative, the integers have opposite signs. The one with the larger absolute value has the same sign as the sum (${b > 0 ? 'positive' : 'negative'}).` : '');
    const finalHint  = `Use your two integers as the constants in each factor. ` +
      `Remember: (x + negative number) writes as (x − positive number).`;

    // --- Workflow ---
    const workflow = [
      {
        id: 'identify-b',
        label: 'Identify the coefficient of x',
        hint: coeffHint,
        expected: String(b)
      },
      {
        id: 'identify-c',
        label: 'Identify the constant term',
        hint: constHint,
        expected: String(c)
      },
      {
        id: 'find-factors',
        label: 'Find two integers: product = constant term, sum = coefficient of x',
        hint: findHint,
        expected: factorPairSorted,
        inputType: 'pair'   // signals renderer to expect comma-separated input
      },
      {
        id: 'final',
        label: 'Write the factored form',
        hint: finalHint,
        expected: answer
      }
    ];

    // --- Steps ---
    const steps = [
      {
        expression,
        rule: 'st',
        output: answer,
        explanation: `Find p, q where p × q = ${c} and p + q = ${b}: p = ${p}, q = ${q}. So (${formatLinearFactor(f1)})(${formatLinearFactor(f2)}).`
      }
    ];

    return {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'st',
      proficiency,
      expression,
      factors: [formatLinearFactor(f1), formatLinearFactor(f2)],
      answer,
      steps,
      workflow
    };
  }


  // ---------------------------------------------------------------------------
  // generateGroupingLayer (FUTURE)
  //
  // When Full Factoring is built, this generator should be split into:
  //   generateGroupingLayer({ linearFactor, secondFactor, expression, terms })
  //     → accepts pre-chosen factors from an external caller (e.g. Full Factoring)
  //     → returns { groupingWorkflow, groupingSteps, answer }
  //
  // This mirrors the generateGCFLayer pattern. The Full Factoring generator
  // would pick its own binomials (e.g. a DoS factor + a linear factor), expand
  // them, then call generateGroupingLayer() to get the workflow/hints/steps
  // without re-generating the factors internally.
  //
  // For now, all logic lives inside generateGroupingProblem — refactor when
  // Full Factoring is introduced.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // generateGroupingProblem(proficiency)
  //
  // Generates a four-term polynomial factorable by grouping:
  //   bx³ + abx² + cx + ac  →  (x + a)(bx² + c)
  //
  // Built backwards from factors to guarantee clean integer grouping:
  //   First pair GCF:  bx²  leaving (x + a)
  //   Second pair GCF: c    leaving (x + a)
  //   Common binomial: (x + a)
  //
  // Constraints:
  //   - gcd(b, c) = 1  so no overall GCF exists (pure grouping problem)
  //   - gcd(a, c) = 1  so second pair GCF is exactly c, not a multiple
  //   - b and c are never 1 at the same time (would be trivially simple)
  //
  // Proficiency levels:
  //   emerging:   b=1, a and c small positive     e.g. x³ + 2x² + 3x + 6
  //   developing: b=1, a or c can be negative     e.g. x³ − 3x² + 2x − 6
  //   proficient: b>1, all positive               e.g. 2x³ + 6x² + 3x + 9
  //   extending:  b>1, signs mixed, 50% two-variable  e.g. 3x³ − 6x² + 5x − 10
  //                                                    or  3x² − 6xy + 5x − 10y
  //
  // Two-variable Extending: (x + a)(bx + cy) → bx² + cxy + abx + acy
  //   First pair:  bx²  + abx  = bx(x + a)   GCF = bx
  //   Second pair: cxy  + acy  = cy(x + a)    GCF = cy
  //   Common binomial: (x + a) → (bx + cy)
  // ---------------------------------------------------------------------------
  function generateGroupingProblem(proficiency) {

    const configs = {
      emerging:   { bRange: [1, 1], aRange: [2, 6],  cRange: [2, 8],  allowNegativeA: false, allowNegativeC: false, allowY: false },
      developing: { bRange: [1, 1], aRange: [2, 8],  cRange: [2, 8],  allowNegativeA: true,  allowNegativeC: true,  allowY: false },
      proficient: { bRange: [2, 4], aRange: [2, 6],  cRange: [2, 8],  allowNegativeA: false, allowNegativeC: false, allowY: false },
      extending:  { bRange: [2, 5], aRange: [2, 8],  cRange: [2, 10], allowNegativeA: true,  allowNegativeC: true,  allowY: true  }
    };

    const config = configs[proficiency];

    // 50% chance of two-variable form at Extending: (x + a)(bx + cy)
    const useY = config.allowY && choice([true, false]);

    let a, b, c, attempts = 0;

    do {
      attempts++;
      if (attempts > 200) { a = 2; b = 2; c = 3; break; }

      b = randInt(config.bRange[0], config.bRange[1]);
      a = randInt(config.aRange[0], config.aRange[1]) * (config.allowNegativeA ? choice([1, -1]) : 1);
      c = randInt(config.cRange[0], config.cRange[1]) * (config.allowNegativeC ? choice([1, -1]) : 1);

    } while (
      gcdList([Math.abs(b), Math.abs(c)]) !== 1 ||   // no overall GCF
      gcdList([Math.abs(a), Math.abs(c)]) !== 1 ||   // second pair GCF is exactly c (or cy)
      (b === 1 && Math.abs(c) === 1)                 // avoid trivially simple
    );

    // --- Build the four terms ---
    // Single-variable: bx³ + abx² + cx + ac     → (x + a)(bx² + c)
    //   t1=bx³  t2=abx²  t3=cx   t4=ac
    // Two-variable:   bx² + abx + cxy + acy     → (x + a)(bx + cy)
    //   t1=bx²  t2=abx   t3=cxy  t4=acy
    let t1, t2, t3, t4;
    if (useY) {
      t1 = { coefficient: b,     exponent: 2, yExponent: 0 };
      t2 = { coefficient: a * b, exponent: 1, yExponent: 0 };
      t3 = { coefficient: c,     exponent: 1, yExponent: 1 };
      t4 = { coefficient: a * c, exponent: 0, yExponent: 1 };
    } else {
      t1 = { coefficient: b,     exponent: 3 };
      t2 = { coefficient: a * b, exponent: 2 };
      t3 = { coefficient: c,     exponent: 1 };
      t4 = { coefficient: a * c, exponent: 0 };
    }

    const expression = formatPolynomial([t1, t2, t3, t4]);

    // --- Factor pieces ---
    const linearFactor = formatLinearFactor(a);   // common binomial: (x + a)

    // Second factor: (bx² + c) single-variable or (bx + cy) two-variable
    const secondFactor = useY
      ? (c >= 0 ? `${b}x + ${c}y` : `${b}x - ${Math.abs(c)}y`)
      : b === 1
        ? (c >= 0 ? `x^2 + ${c}` : `x^2 - ${Math.abs(c)}`)
        : (c >= 0 ? `${b}x^2 + ${c}` : `${b}x^2 - ${Math.abs(c)}`);

    const answer = `(${linearFactor})(${secondFactor})`;

    // --- First pair GCF ---
    // Single: bx² from (bx³ + abx²)
    // Two-var: bx  from (bx²  + abx)
    const firstPairGCF    = useY ? (b === 1 ? 'x' : `${b}x`) : (b === 1 ? 'x^2' : `${b}x^2`);
    const firstPairResult = `${firstPairGCF}(${linearFactor})`;

    // --- Second pair GCF ---
    // Single: c  from (cx + ac)
    // Two-var: cy from (cxy + acy)
    const cAbs = Math.abs(c);
    const secondPairGCF    = useY
      ? (c >= 0 ? `${cAbs}y` : `-${cAbs}y`)
      : (c >= 0 ? (cAbs === 1 ? '1' : String(cAbs)) : `-${cAbs}`);
    const secondPairResult = `${secondPairGCF}(${linearFactor})`;

    // --- Hints ---
    const firstPairTerms  = formatPolynomial([t1, t2]);
    const secondPairTerms = formatPolynomial([t3, t4]);

    const hint1 = `The first two terms are ${firstPairTerms}. Factor out their GCF and write the full result in the form GCF(binomial).`;
    const hint2 = `The last two terms are ${secondPairTerms}. Factor out their GCF and write the full result in the form GCF(binomial). The binomial inside must match the one from the first pair.`;
    const hint3 = `Both pairs share a common binomial factor. Look at what's inside the parentheses in each pair — what binomial appears in both?`;
    const hint4 = `Write the common binomial (${linearFactor}) times the remaining factor (${secondFactor}).`;

    // --- Workflow ---
    const workflow = [
      {
        id: 'first-pair-gcf',
        label: 'Factor the GCF from the first two terms — write as GCF(binomial)',
        hint: hint1,
        expected: firstPairResult
      },
      {
        id: 'second-pair-gcf',
        label: 'Factor the GCF from the last two terms — write as GCF(binomial)',
        hint: hint2,
        expected: secondPairResult
      },
      {
        id: 'common-binomial',
        label: 'Identify the common binomial factor',
        hint: hint3,
        expected: linearFactor
      },
      {
        id: 'final',
        label: 'Write the factored form',
        hint: hint4,
        expected: answer
      }
    ];

    // --- Steps ---
    const steps = [
      {
        expression,
        rule: 'grouping',
        output: answer,
        explanation: `Group: (${firstPairTerms}) + (${secondPairTerms}) → ${firstPairResult} + ${secondPairResult} → ${answer}`
      }
    ];

    return {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'grouping',
      proficiency,
      expression,
      factors: [linearFactor, secondFactor],
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
    if (settings.method === 'pst') {
      return generatePerfectSquareTrinomialProblem(settings.difficulty);
    }
    if (settings.method === 'st') {
      return generateSimpleTrinomialProblem(settings.difficulty);
    }
    if (settings.method === 'grouping') {
      return generateGroupingProblem(settings.difficulty);
    }
    return null;
  }

  return { generateProblem };
})();