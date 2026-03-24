window.Generators = (() => {
  const {
    buildFromPrimes,
    choice,
    formatFactorPiece,
    formatLinearFactor,
    formatSecondFactor,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    isPerfectSquare,
    randInt
  } = window.Utils;

  // ---------------------------------------------------------------------------
  // isValidGroupingFactors(a, b, c, cXExponent)
  //
  // Validates that the values produce a clean standalone grouping problem:
  //   - gcd(b, c) = 1  — no overall GCF hiding in the full polynomial
  //   - gcd(a, c) = 1  — second pair GCF is exactly c (or cy), not a multiple
  //   - not (b=1 and |c|=1)  — avoids trivially simple problems
  //   - second factor (cx^n + d) must not itself be a DoS — prevents chained
  //     factoring problems appearing as standalone grouping problems
  //     (e.g. (x+10)(x²−25) looks like grouping but x²−25 is a DoS)
  // ---------------------------------------------------------------------------
  function isValidGroupingFactors(a, b, c, cXExponent = 2) {
    if (gcdList([Math.abs(b), Math.abs(c)]) !== 1) return false;
    if (gcdList([Math.abs(a), Math.abs(c)]) !== 1) return false;
    if (b === 1 && Math.abs(c) === 1) return false;
    // Second factor is DoS when: cx^(even) + d where d < 0, c and |d| are perfect squares
    if (cXExponent % 2 === 0 && b < 0 && isPerfectSquare(c) && isPerfectSquare(Math.abs(b))) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // generateGCFLayer({ coeffRange, xExpRange, yExpRange, insideTerms })
  //
  // Shared primitive used by any problem that has a GCF step.
  // Picks the GCF components from the given ranges, builds the full polynomial
  // expression, and returns the complete workflow steps and hints for the GCF
  // portion of a problem.
  //
  // The caller is responsible for:
  //   - Generating inside terms (no shared numeric, x, or y factor)
  //   - Appending the final workflow step (write the factored form)
  //
  // Parameters:
  //   coeffRange  [min, max]  range for the numeric GCF
  //   xExpRange   [min, max]  range for the x GCF exponent (0 = no x in GCF)
  //   yExpRange   [min, max]  range for the y GCF exponent (default [0,0])
  //   insideTerms             inside terms array (no shared GCF)
  //
  // Returns:
  //   numericGCF, xGCFExponent, yGCFExponent  — the GCF components
  //   totalGCF, variableGCFText               — formatted GCF strings
  //   expression                              — the full polynomial string
  //   fullTerms                               — terms structure for chaining into next layer
  //   insideExpression, answer                — formatted strings
  //   gcfSteps, gcfWorkflow                   — steps/workflow for GCF portion
  // ---------------------------------------------------------------------------
  function generateGCFLayer({
    coeffRange,
    xExpRange,
    yExpRange = [0, 0],
    insideTerms
  }) {
    const numericGCF   = randInt(coeffRange[0], coeffRange[1]);
    const xGCFExponent = randInt(xExpRange[0], xExpRange[1]);
    const yGCFExponent = randInt(yExpRange[0], yExpRange[1]);

    // Build the full polynomial by scaling inside terms by the GCF
    const fullTerms = insideTerms
      .map(t => ({
        coefficient: numericGCF * t.coefficient,
        exponent:    t.exponent + xGCFExponent,
        yExponent:   (t.yExponent || 0) + yGCFExponent
      }))
      .sort((a, b) => b.exponent - a.exponent);

    const expression = formatPolynomial(fullTerms);

    const xGCFPart = xGCFExponent === 0 ? '' : xGCFExponent === 1 ? 'x' : `x^${xGCFExponent}`;
    const yGCFPart = yGCFExponent === 0 ? '' : yGCFExponent === 1 ? 'y' : `y^${yGCFExponent}`;
    const variableGCFText = (xGCFPart + yGCFPart) || '1';
    const totalGCF = variableGCFText === '1'
      ? String(numericGCF)
      : numericGCF === 1 ? variableGCFText : `${numericGCF}${variableGCFText}`;

    const insideExpression = formatPolynomial(insideTerms);
    const answer = `${totalGCF}(${insideExpression})`;

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
      expression,
      fullTerms,       // raw terms structure — available for chaining into the next layer
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

    // Single call — layer builds the expression internally
    const layer = generateGCFLayer({
      coeffRange: config.coeffRange,
      xExpRange:  config.xExpRange,
      yExpRange:  config.yExpRange,
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
      expression: layer.expression,
      factors: [layer.totalGCF, layer.insideExpression],
      answer: layer.answer,
      steps: layer.gcfSteps,
      workflow
    };
  }

  // ---------------------------------------------------------------------------
  // generateDoSLayer({ aRoot, bRoot, varExponent, useY })
  //
  // Shared primitive for any problem with a Difference of Squares step.
  // Accepts exact values (already generated/validated by caller).
  //
  // Structure: a²x^2n − b²y^2m → (ax^n + by^m)(ax^n − by^m)
  //   where m=0 for single-variable (y term is just the constant b²)
  //
  // Returns:
  //   innerTerms    — [{a²x^2n}, {-b²y^2m}] for chaining into GCF layer
  //   expression    — formatted polynomial string
  //   answer        — formatted factored form
  //   aRootTermText, bRootTermText — the two square roots
  //   dosWorkflow, dosSteps
  // ---------------------------------------------------------------------------
  function generateDoSLayer({ aRoot, bRoot, varExponent, useY = false }) {
    const a = aRoot * aRoot;
    const b = bRoot * bRoot;
    const halfExponent = varExponent / 2;

    const innerTerms = useY
      ? [{ coefficient: a,  exponent: varExponent },
         { coefficient: -b, exponent: 0, yExponent: 2 }]
      : [{ coefficient: a,  exponent: varExponent },
         { coefficient: -b, exponent: 0 }];

    const expression     = formatPolynomial(innerTerms);
    const aRootTermText  = formatFactorPiece(aRoot, halfExponent);
    const bRootTermText  = useY ? formatFactorPiece(bRoot, 1, 'y') : String(bRoot);
    const leftFactor     = `${aRootTermText} + ${bRootTermText}`;
    const rightFactor    = `${aRootTermText} - ${bRootTermText}`;
    const answer         = `(${leftFactor})(${rightFactor})`;

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

    const dosWorkflow = [
      { id: 'first-root',  label: 'Find the square root of the first term',  hint: firstTermHint,  expected: aRootTermText },
      { id: 'second-root', label: 'Find the square root of the second term', hint: secondTermHint, expected: bRootTermText },
      { id: 'final',       label: 'Write the factored form (A + B)(A − B)',  hint: finalHint,      expected: answer }
    ];

    const dosSteps = [{
      expression,
      rule: 'dos',
      output: answer,
      explanation: `Difference of squares: √(${firstTermDesc}) = ${aRootTermText}, √(${secondTermDesc}) = ${bRootTermText}, so (${aRootTermText} + ${bRootTermText})(${aRootTermText} − ${bRootTermText}).`
    }];

    return {
      aRoot, bRoot, varExponent, useY,
      innerTerms, expression, answer,
      aRootTermText, bRootTermText,
      leftFactor, rightFactor,
      dosWorkflow, dosSteps
    };
  }

  // ---------------------------------------------------------------------------
  // generatePSTLayer({ aRoot, bRootAbs, bRoot, varExponent, useY })
  //
  // Shared primitive for any problem with a Perfect Square Trinomial step.
  // Accepts exact values (already generated/validated by caller).
  //
  // Structure: a²x^2n ± 2ab·x^n + b² → (ax^n ± b)²
  //   Two-variable: a²x^2n ± 2ab·x^n·y + b²y² → (ax^n ± by)²
  //
  // Returns:
  //   innerTerms    — three-term structure for chaining into GCF layer
  //   expression    — formatted polynomial string
  //   answer        — formatted factored form
  //   pstWorkflow, pstSteps
  // ---------------------------------------------------------------------------
  function generatePSTLayer({ aRoot, bRootAbs, bRoot, varExponent, useY = false }) {
    const halfExp    = varExponent / 2;
    const leadCoeff  = aRoot * aRoot;
    const midCoeff   = 2 * aRoot * bRoot;
    const constCoeff = bRootAbs * bRootAbs;
    const midExp     = halfExp;

    const innerTerms = useY
      ? [{ coefficient: leadCoeff,  exponent: varExponent, yExponent: 0 },
         { coefficient: midCoeff,   exponent: midExp,      yExponent: 1 },
         { coefficient: constCoeff, exponent: 0,           yExponent: 2 }]
      : [{ coefficient: leadCoeff,  exponent: varExponent },
         { coefficient: midCoeff,   exponent: midExp      },
         { coefficient: constCoeff, exponent: 0           }];

    const expression  = formatPolynomial(innerTerms);
    const aRootText   = formatFactorPiece(aRoot, halfExp);
    const bRootText   = useY ? formatFactorPiece(bRootAbs, 1, 'y') : String(bRootAbs);
    const bSign       = bRoot >= 0 ? '+' : '−';
    const innerFactor = `${aRootText} ${bSign} ${bRootText}`;
    const answer      = `(${innerFactor})^2`;

    const firstTermDesc = leadCoeff === 1 && varExponent === 2 ? 'x²'
      : leadCoeff === 1 ? `x^${varExponent}`
      : varExponent === 2 ? `${leadCoeff}x²`
      : `${leadCoeff}x^${varExponent}`;
    const lastTermDesc  = useY ? (constCoeff === 1 ? 'y²' : `${constCoeff}y²`) : String(constCoeff);

    const expectedMiddleAbs = (() => {
      const absCoeff = Math.abs(midCoeff);
      const varPart  = useY
        ? (midExp === 1 ? 'xy' : `x^${midExp}y`)
        : (midExp === 1 ? 'x'  : `x^${midExp}`);
      return `${absCoeff}${varPart}`;
    })();
    const middleSign  = midCoeff >= 0 ? '+' : '-';
    const middleTermDesc = (() => {
      const absCoeff = Math.abs(midCoeff);
      const varPart  = useY ? (midExp === 1 ? 'xy' : `x^${midExp}y`) : (midExp === 1 ? 'x' : `x^${midExp}`);
      return `${midCoeff >= 0 ? '+' : '−'} ${absCoeff}${varPart}`;
    })();

    const firstRootHint = `The first term is ${firstTermDesc}. What is √(${firstTermDesc})?`;
    const lastRootHint  = useY
      ? `The last term is ${lastTermDesc}. Square roots are always positive — what is √(${lastTermDesc})?`
      : `The last term is ${constCoeff}. Square roots are always positive — what is √${constCoeff}?`;
    const verifyHint    = `Multiply 2 × first_root × last_root: 2 × ${aRootText} × ${bRootText}. Enter the result as a positive value — we check the sign separately.`;
    const signHint      = `Look at the middle term of the original expression (${middleTermDesc}). Is it positive or negative? Enter + or −.`;
    const finalHint     = `Use the sign from the previous step. Write (first_root ± last_root)² with the correct sign between the roots.`;

    const pstWorkflow = [
      { id: 'first-root',    label: 'Find the square root of the first term',                             hint: firstRootHint, expected: aRootText    },
      { id: 'last-root',     label: 'Find the square root of the last term (always positive)',             hint: lastRootHint,  expected: bRootText    },
      { id: 'verify-middle', label: 'Verify: 2 × first_root × last_root matches the middle term (ignore its sign)', hint: verifyHint, expected: expectedMiddleAbs },
      { id: 'middle-sign',   label: 'What is the sign of the middle term?',                               hint: signHint,      expected: middleSign   },
      { id: 'final',         label: 'Write the factored form (first_root ± last_root)²',                  hint: finalHint,     expected: answer       }
    ];

    const pstSteps = [{
      expression,
      rule: 'pst',
      output: answer,
      explanation: `Perfect square trinomial: √(${firstTermDesc}) = ${aRootText}, √${constCoeff} = ${bRootAbs}, middle = 2×${aRootText}×${bRootAbs} = ${expectedMiddleAbs} ✓`
    }];

    return {
      aRoot, bRootAbs, bRoot, varExponent, useY,
      innerTerms, expression, answer,
      aRootText, bRootText, innerFactor,
      pstWorkflow, pstSteps
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

    const layer = generateDoSLayer({ aRoot, bRoot, varExponent, useY });

    return {
      id: `dos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'dos',
      proficiency,
      expression: layer.expression,
      factors:    [layer.leftFactor, layer.rightFactor],
      answer:     layer.answer,
      steps:      layer.dosSteps,
      workflow:   layer.dosWorkflow
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

    const layer = generatePSTLayer({ aRoot, bRootAbs, bRoot, varExponent, useY });

    return {
      id: `pst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'pst',
      proficiency,
      expression: layer.expression,
      factors:    [layer.innerFactor],
      answer:     layer.answer,
      steps:      layer.pstSteps,
      workflow:   layer.pstWorkflow
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

    // Route through generateTrinomialLayer with pinned values.
    // aRange=[1,1] and cRange=[1,1] keeps leading coefficient at 1 (simple trinomial).
    // skipValidation=true because p,q are already validated above.
    const layer = generateTrinomialLayer({
      aRange: [1, 1], bRange: [p, p], allowNegativeB: false,
      cRange: [1, 1], dRange: [q, q], allowNegativeD: false,
      skipValidation: true
    });

    return {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'st',
      proficiency,
      expression:   layer.expression,
      factors:      [layer.factor1, layer.factor2],
      answer:       layer.answer,
      steps:        layer.steps,
      workflow:     layer.workflow
    };
  }


  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // generateGroupingLayer({ aRange, aXExponent, allowNegativeA,
  //                         bRange, allowNegativeB,
  //                         cRange, cXExponent,
  //                         dRange, allowNegativeD, dYExponent })
  //
  // Unified grouping primitive for (ax+b)(cx^n+dy^m) → four-term polynomial.
  // Covers standalone grouping AND the grouping step inside general trinomials.
  //
  // Expanded: (ax+b)(cx^n+dy^m)
  //   = acx^(n+1) + bcx^n + adxy^m + bdy^m
  //   First pair:  acx^(n+1) + bcx^n  →  cx^n(ax + b)
  //   Second pair: adxy^m    + bdy^m  →  dy^m(ax + b)
  //   Common binomial: (ax + b)
  //
  // GCFs are derived via gcd — no hardcoded assumptions about structure.
  // Pass [v,v] ranges to pin exact values; [min,max] to randomise.
  // aXExponent defaults to 1 (linear first factor — curriculum standard).
  //
  // Returns:
  //   a, b, c, d        — raw factor values
  //   factor1, factor2  — formatted factor strings
  //   expression        — full four-term polynomial
  //   terms             — [t1,t2,t3,t4] for chaining
  //   answer, commonBinomial, firstPairResult, secondPairResult
  //   groupingWorkflow, groupingSteps
  // ---------------------------------------------------------------------------
  function generateGroupingLayer({
    aRange, aXExponent = 1, allowNegativeA = false,
    bRange,                  allowNegativeB = false,
    cRange, cXExponent = 2,
    dRange,                  allowNegativeD = false, dYExponent = 0,
    skipValidation = false   // set true when passing pinned values already known to be valid
  }) {
    // Generate a, b, c, d — retry until valid (skip when values are pinned externally)
    let a, b, c, d, attempts = 0;
    do {
      attempts++;
      if (attempts > 200) { a = 1; b = 2; c = 1; d = 3; break; }
      a = randInt(aRange[0], aRange[1]) * (allowNegativeA ? choice([1, -1]) : 1);
      b = randInt(bRange[0], bRange[1]) * (allowNegativeB ? choice([1, -1]) : 1);
      c = randInt(cRange[0], cRange[1]);
      d = randInt(dRange[0], dRange[1]) * (allowNegativeD ? choice([1, -1]) : 1);
    } while (!skipValidation && (b === 0 || d === 0 || !isValidGroupingFactors(b, c, d, cXExponent)));

    // Build four terms: (ax+b)(cx^n+dy^m)
    // = acx^(n+aXExp) + bcx^n + adx^aXExp·y^dYExp + bd·y^dYExp
    const t1 = { coefficient: a * c, exponent: cXExponent + aXExponent, yExponent: 0         };
    const t2 = { coefficient: b * c, exponent: cXExponent,              yExponent: 0         };
    const t3 = { coefficient: a * d, exponent: aXExponent,              yExponent: dYExponent };
    const t4 = { coefficient: b * d, exponent: 0,                       yExponent: dYExponent };
    const terms = [t1, t2, t3, t4];

    const expression = formatPolynomial(terms);
    const factor1    = formatSecondFactor(a, aXExponent, b, 0);
    const factor2    = formatSecondFactor(c, cXExponent, d, dYExponent);
    const answer     = `(${factor1})(${factor2})`;

    // Derive first pair GCF: gcd(t1,t2) × x^cXExponent
    const firstGCFNum  = gcdList([Math.abs(t1.coefficient), Math.abs(t2.coefficient)]);
    const firstGCFText = firstGCFNum === 1
      ? (cXExponent === 1 ? 'x' : `x^${cXExponent}`)
      : (cXExponent === 1 ? `${firstGCFNum}x` : `${firstGCFNum}x^${cXExponent}`);

    // Common binomial (ax+b) from first pair after factoring out firstGCF·x^cXExp
    const cbA = t1.coefficient / firstGCFNum;
    const cbB = t2.coefficient / firstGCFNum;
    const commonBinomial  = formatSecondFactor(cbA, aXExponent, cbB, 0);
    const firstPairResult = `${firstGCFText}(${commonBinomial})`;

    // Derive second pair GCF: gcd(t3,t4) with y component, sign chosen to match binomial
    const secondGCFNum = gcdList([Math.abs(t3.coefficient), Math.abs(t4.coefficient)]);
    const testA = t3.coefficient / secondGCFNum;
    const testB = t4.coefficient / secondGCFNum;
    const secondGCFCoeff = (testA === cbA && testB === cbB) ? secondGCFNum : -secondGCFNum;
    const secondGCFAbs   = Math.abs(secondGCFCoeff);
    const dYPart = dYExponent === 0 ? '' : dYExponent === 1 ? 'y' : `y^${dYExponent}`;
    const secondGCFText  = secondGCFCoeff >= 0
      ? (secondGCFAbs === 1 && !dYPart ? '1' : `${secondGCFAbs === 1 ? '' : secondGCFAbs}${dYPart}`)
      : `-${secondGCFAbs === 1 ? '' : secondGCFAbs}${dYPart}`;
    const secondPairResult = `${secondGCFText}(${commonBinomial})`;

    // Hints — single source of truth for all grouping problems
    const firstPairTerms  = formatPolynomial([t1, t2]);
    const secondPairTerms = formatPolynomial([t3, t4]);
    const hint1 = `The first two terms are ${firstPairTerms}. Factor out their GCF and write the full result in the form GCF(binomial).`;
    const hint2 = `The last two terms are ${secondPairTerms}. Factor out their GCF and write the full result in the form GCF(binomial). The binomial inside must match the first pair's binomial.`;
    const hint3 = `Both pairs share a common binomial factor. Look at what's inside the parentheses — what binomial appears in both?`;
    const hint4 = `Write the common binomial (${commonBinomial}) times the remaining factor (${factor2}).`;

    // Combined pairs step: write both factored pairs joined by operator
    // Sign comes from secondGCFCoeff — positive → '+', negative → '−'
    const combinedSign       = secondGCFCoeff >= 0 ? '+' : '−';
    const combinedPairs      = `${firstPairResult} ${combinedSign} ${secondGCFCoeff < 0 ? secondGCFText.slice(1) : secondGCFText}(${commonBinomial})`;
    const hint2b = `Write both factored pairs next to each other, separated by the appropriate sign. You should see the same binomial appearing in both.`;

    const groupingWorkflow = [
      { id: 'first-pair-gcf',  label: 'Factor the GCF from the first two terms — write as GCF(binomial)', hint: hint1,  expected: firstPairResult },
      { id: 'second-pair-gcf', label: 'Factor the GCF from the last two terms — write as GCF(binomial)',  hint: hint2,  expected: secondPairResult },
      { id: 'combined-pairs',  label: 'Write both factored pairs together',                                hint: hint2b, expected: combinedPairs },
      { id: 'common-binomial', label: 'Identify the common binomial factor',                               hint: hint3,  expected: commonBinomial },
      { id: 'final',           label: 'Write the factored form',                                           hint: hint4,  expected: answer }
    ];

    const groupingSteps = [{
      expression,
      rule: 'grouping',
      output: answer,
      explanation: `Group: (${firstPairTerms}) + (${secondPairTerms}) → ${firstPairResult} + ${secondPairResult} → ${answer}`
    }];

    return {
      a, b, c, d,
      factor1, factor2,
      expression, terms, answer,
      commonBinomial, firstPairResult, secondPairResult,
      groupingWorkflow, groupingSteps
    };
  }

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

    // Standalone grouping: (x+a)(bx^n+c) — first factor always linear (aXExponent=1)
    // aRange=constant in first factor, bRange=x-coeff in second, cRange=constant in second
    // Renamed to match new layer: a→a(const), b→c(x-coeff), c→d(const), bXExponent→cXExponent
    const configs = {
      emerging:   { aRange:[1,1], bRange:[2,6],  cRange:[1,1], cXExponent:2, dRange:[2,8],  dYExponent:0, allowNegativeBorD:false },
      developing: { aRange:[1,1], bRange:[2,8],  cRange:[1,1], cXExponent:2, dRange:[2,8],  dYExponent:0, allowNegativeBorD:true  },
      proficient: { aRange:[1,1], bRange:[2,6],  cRange:[2,4], cXExponent:2, dRange:[2,8],  dYExponent:0, allowNegativeBorD:false },
      extending:  { aRange:[1,1], bRange:[2,8],  cRange:[2,5], cXExponent:2, dRange:[2,10], dYExponent:0, allowNegativeBorD:true  }
    };

    const config = configs[proficiency];

    // 50% chance of two-variable form at Extending: (x+b)(cx+dy)
    if (proficiency === 'extending' && choice([true, false])) {
      config.cXExponent = 1;
      config.dYExponent = 1;
    }

    const layer = generateGroupingLayer({
      aRange:        [1, 1],
      aXExponent:    1,
      allowNegativeA: false,
      bRange:        config.bRange,
      allowNegativeB: config.allowNegativeBorD,
      cRange:        config.cRange,
      cXExponent:    config.cXExponent,
      dRange:        config.dRange,
      allowNegativeD: config.allowNegativeBorD,
      dYExponent:    config.dYExponent
    });

    return {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'grouping',
      proficiency,
      expression: layer.expression,
      factors: [layer.factor1, layer.factor2],
      answer: layer.answer,
      steps: layer.groupingSteps,
      workflow: layer.groupingWorkflow
    };
  }


  // ---------------------------------------------------------------------------
  // generateTrinomialLayer({ aRange, bRange, cRange, dRange,
  //                          allowNegativeB, allowNegativeD })
  //
  // Generates a trinomial from two linear factors (ax + b)(cx + d), handling
  // both simple trinomials (a=c=1) and general trinomials (a or c > 1).
  //
  // Expands to: Ax² + Bx + C  where A=ac, B=ad+bc, C=bd
  // Split values: p=ad, q=bc  so p+q=B and p*q=A*C
  //
  // If a=1 AND c=1 (simple trinomial territory):
  //   - If aRange/cRange could produce >1: notes that coefficient of x² is 1,
  //     allowing grouping to be skipped → writes (x+b)(x+d) directly
  //   - Otherwise: pure simple trinomial, just writes (x+b)(x+d)
  //
  // If a>1 OR c>1 (general trinomial):
  //   - Calls generateGroupingLayer internally with pinned values
  //   - Appends grouping workflow steps after trinomial steps
  //
  // Parameters:
  //   aRange, cRange    [min,max] for x-coefficients in each factor
  //   bRange, dRange    [min,max] for constants in each factor
  //   allowNegativeB/D  whether constants can be negative
  //
  // Returns:
  //   a, b, c, d        raw factor values (for pinning into another layer)
  //   trinomialTerms    [{A,exp:2},{B,exp:1},{C,exp:0}] for chaining into GCF
  //   expression        formatted trinomial string
  //   answer            formatted fully factored string
  //   workflow, steps
  // ---------------------------------------------------------------------------
  function generateTrinomialLayer({
    aRange, bRange, cRange, dRange,
    allowNegativeB = false, allowNegativeD = false,
    skipValidation = false
  }) {
    const couldBeGeneral = aRange[1] > 1 || cRange[1] > 1;

    // Generate factors — retry until no hidden GCF in trinomial
    let a, b, c, d, attempts = 0;
    do {
      attempts++;
      if (attempts > 200) { a = 1; b = 2; c = 1; d = 3; break; }
      a = randInt(aRange[0], aRange[1]);
      b = randInt(bRange[0], bRange[1]) * (allowNegativeB ? choice([1, -1]) : 1);
      c = randInt(cRange[0], cRange[1]);
      d = randInt(dRange[0], dRange[1]) * (allowNegativeD ? choice([1, -1]) : 1);
    } while (!skipValidation && (
      b === 0 || d === 0 ||
      gcdList([Math.abs(a * c), Math.abs(a * d + b * c), Math.abs(b * d)]) !== 1 ||
      (a * d) === (b * c) ||
      (a * d) === -(b * c)
    ));

    // Trinomial coefficients
    const A = a * c;
    const B = a * d + b * c;
    const C = b * d;
    const p = a * d;   // split value 1
    const q = b * c;   // split value 2

    // Trinomial terms (for chaining into GCF layer)
    const trinomialTerms = [
      { coefficient: A, exponent: 2 },
      { coefficient: B, exponent: 1 },
      { coefficient: C, exponent: 0 }
    ];

    const expression = formatPolynomial(trinomialTerms);

    // Factor strings for answer and hints
    const factor1 = formatSecondFactor(a, 1, b, 0);  // ax + b
    const factor2 = formatSecondFactor(c, 1, d, 0);  // cx + d
    const answer  = `(${factor1})(${factor2})`;

    // --- Workflow steps 1-5 (identification + pair finding) ---
    const workflow = [];
    const steps    = [];

    // Step: identify A (only if could be general)
    if (couldBeGeneral) {
      workflow.push({
        id: 'identify-a',
        label: 'Identify the coefficient of x²',
        hint: `Look at the first term. What number multiplies x²?`,
        expected: String(A)
      });
    }

    // Step: identify B
    workflow.push({
      id: 'identify-b',
      label: 'Identify the coefficient of x',
      hint: `Look at the middle term. What number multiplies x?`,
      expected: String(B)
    });

    // Step: identify C
    workflow.push({
      id: 'identify-c',
      label: 'Identify the constant term',
      hint: `Look at the last term. What is the number with no variable?`,
      expected: String(C)
    });

    // Step: compute A×C (only if could be general)
    if (couldBeGeneral) {
      workflow.push({
        id: 'compute-ac',
        label: 'Multiply the coefficient of x² by the constant term',
        hint: `Multiply ${A} × ${C}. This is the product your factor pair must equal.`,
        expected: String(A * C)
      });
    }

    // Step: find the pair
    const product   = couldBeGeneral ? A * C : C;
    const pairSorted = [p, q].slice().sort((x, y) => x - y).join(', ');
    const cSign     = product >= 0 ? 'positive' : 'negative';
    const findHint  = `You need two integers that multiply to ${product} and add to ${B}. ` +
      `Think about factor pairs of ${Math.abs(product)}.` +
      (product > 0 && B > 0 ? ` Since the product is positive and the sum is positive, both integers are positive.` : '') +
      (product > 0 && B < 0 ? ` Since the product is positive and the sum is negative, both integers are negative.` : '') +
      (product < 0 ? ` Since the product is negative, the integers have opposite signs. The one with the larger absolute value has the same sign as the sum (${B > 0 ? 'positive' : 'negative'}).` : '');

    workflow.push({
      id: 'find-factors',
      label: couldBeGeneral
        ? `Find two integers: product = (coefficient of x²) × (constant term), sum = coefficient of x`
        : 'Find two integers: product = constant term, sum = coefficient of x',
      hint: findHint,
      expected: pairSorted,
      inputType: 'pair'
    });

    // --- Branch: simple path vs grouping path ---
    if (a === 1 && c === 1) {
      // Simple trinomial — write factors directly
      const finalLabel = couldBeGeneral
        ? `The coefficient of x² is 1, so we can write the factored form directly as (x + first integer)(x + second integer)`
        : `Write the factored form`;
      const finalHint = `Use your two integers as the constants in each factor. ` +
        `Remember: (x + negative number) writes as (x − positive number).`;
      workflow.push({
        id: 'final',
        label: finalLabel,
        hint: finalHint,
        expected: answer
      });
      steps.push({
        expression,
        rule: 'st',
        output: answer,
        explanation: `Find p,q where p×q=${C} and p+q=${B}: p=${p}, q=${q}. So ${answer}.`
      });

    } else {
      // General trinomial — split middle term then group.
      // Call the unified generateGroupingLayer with pinned values from (ax+b)(cx+d).
      // aXExponent=1, cXExponent=1 since both factors are linear after the split.
      // Pass (c,d) as first factor and (a,b) as second so the layer produces
      // the correct term order: acx² + adx + bcx + bd (p=ad first, q=bc second).
      // allowNegative flags must be false when passing pinned values — the sign
      // is already baked into the value, and the flag would randomly flip it.
      const groupLayer = generateGroupingLayer({
        aRange: [c, c], aXExponent: 1, allowNegativeA: false,
        bRange: [d, d],                allowNegativeB: false,
        cRange: [a, a], cXExponent: 1,
        dRange: [b, b],                allowNegativeD: false, dYExponent: 0,
        skipValidation: true   // values come from trinomial generator, already valid
      });

      const splitExpr = groupLayer.expression;

      workflow.push({
        id: 'rewrite',
        label: `Rewrite the middle term using your two integers as separate x-terms`,
        hint: `Replace ${B}x with your two integers as separate x-terms: ${p}x + ${q}x.`,
        expected: splitExpr
      });

      // Append grouping workflow with grp- prefix to avoid id collisions
      groupLayer.groupingWorkflow.forEach(step => {
        workflow.push({ ...step, id: `grp-${step.id}` });
      });

      steps.push({
        expression,
        rule: 'gt',
        output: answer,
        explanation: `A×C=${A*C}, find p,q: p=${p}, q=${q}. Split: → group → ${answer}.`
      });
    }

    return {
      a, b, c, d,
      trinomialTerms,
      expression,
      answer,
      workflow,
      steps
    };
  }

  // ---------------------------------------------------------------------------
  // generateGeneralTrinomialProblem(proficiency)
  //
  // ax² + bx + c where a > 1 — uses generateTrinomialLayer internally.
  //
  // Proficiency levels:
  //   emerging:   small a,c (2-3), positive b,d, small products
  //   developing: a,c (2-3), b,d can be negative
  //   proficient: larger a,c (2-5), mixed signs, more demanding A×C
  //   extending:  larger a,c (2-6), mixed signs, highly composite A×C
  // ---------------------------------------------------------------------------
  function generateGeneralTrinomialProblem(proficiency) {
    const configs = {
      emerging:   { aRange:[2,3], bRange:[1,6],  cRange:[2,3], dRange:[1,6],  allowNegativeB:false, allowNegativeD:false },
      developing: { aRange:[2,3], bRange:[1,8],  cRange:[2,3], dRange:[1,8],  allowNegativeB:true,  allowNegativeD:true  },
      proficient: { aRange:[2,5], bRange:[1,8],  cRange:[2,5], dRange:[1,8],  allowNegativeB:true,  allowNegativeD:true  },
      extending:  { aRange:[2,6], bRange:[1,10], cRange:[2,6], dRange:[1,10], allowNegativeB:true,  allowNegativeD:true  }
    };

    const config = configs[proficiency];
    const layer  = generateTrinomialLayer(config);

    return {
      id: `gt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'gt',
      proficiency,
      expression: layer.expression,
      answer:     layer.answer,
      steps:      layer.steps,
      workflow:   layer.workflow
    };
  }


  // ---------------------------------------------------------------------------
  // generateMixedMethodProblem(proficiency)
  //
  // Picks a random factoring method, generates a problem using the existing
  // generator for that method, then prepends a method-identification step
  // to the workflow.
  //
  // Method weights (out of 20):
  //   GCF: 5  DoS: 3  PST: 3  ST: 4  Grouping: 2  GT: 3
  //
  // The identification step uses inputType: 'radio' — the student selects
  // the method name from a list. Correct selection immediately unlocks the
  // remaining workflow steps. Wrong selection shows feedback but doesn't
  // advance.
  //
  // In Final Answer mode the identification step is skipped entirely —
  // the student just enters the factored form directly.
  // ---------------------------------------------------------------------------
  function generateMixedMethodProblem(proficiency) {
    const methodPool = [
      'gcf', 'gcf', 'gcf', 'gcf', 'gcf',
      'dos', 'dos', 'dos',
      'pst', 'pst', 'pst',
      'st',  'st',  'st',  'st',
      'grouping', 'grouping',
      'gt',  'gt',  'gt'
    ];

    const method = choice(methodPool);
    const inner  = generateProblem({ method, difficulty: proficiency });

    if (!inner) return null;

    // Method display names and hint text for the identification step
    const methodNames = {
      gcf:      'GCF (Greatest Common Factor)',
      dos:      'Difference of Squares',
      pst:      'Perfect Square Trinomial',
      st:       'Simple Trinomial',
      grouping: 'Grouping',
      gt:       'General Trinomial'
    };

    const identHint =
      `Count the terms first:
` +
      `• 2 terms → likely Difference of Squares
` +
      `• 3 terms → check if it's a Perfect Square Trinomial (first and last terms are perfect squares, middle = 2·√first·√last). If not, is the leading coefficient 1? → Simple Trinomial. Greater than 1? → General Trinomial.
` +
      `• 4 terms → Grouping
` +
      `• Any → always check for a GCF first!`;

    const identStep = {
      id:        'identify-method',
      label:     'Identify the factoring method',
      hint:      identHint,
      expected:  method,
      inputType: 'radio',
      options:   Object.entries(methodNames).map(([value, label]) => ({ value, label }))
    };

    // Add gatedBy to all inner steps so they stay locked until
    // the identification step is answered correctly
    const gatedWorkflow = inner.workflow.map(step => ({
      ...step,
      gatedBy: 'identify-method'
    }));

    return {
      id:          `mixed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method:      'mixed',
      innerMethod: method,
      proficiency,
      expression:  inner.expression,
      answer:      inner.answer,
      steps:       inner.steps,
      workflow:    [identStep, ...gatedWorkflow]
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
    if (settings.method === 'gt') {
      return generateGeneralTrinomialProblem(settings.difficulty);
    }
    if (settings.method === 'mixed') {
      return generateMixedMethodProblem(settings.difficulty);
    }
    return null;
  }

  return { generateProblem };
})();