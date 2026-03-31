window.Generators = (() => {
  const {
    buildFromPrimes,
    choice,
    formatFactorPiece,
    formatSecondFactor,
    formatPolynomial,
    gcdList,
    isPerfectSquare,
    pickNumbers,
    randInt
  } = window.Utils;


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
        hints: [
          `Find the largest integer that divides evenly into all the coefficients.`,
          `The coefficients are ${coefficients.join(', ')}. What is their GCF?`,
          `The GCF of ${coefficients.join(', ')} is ${numericGCF}.`
        ],
        expected: String(numericGCF)
      },
      {
        id: 'variable-gcf',
        label: 'Find the variable GCF',
        hints: [
          variableGCFText === '1' && !yAppearsInProblem
            ? `Check if any variable appears in every term — if not, the variable GCF is 1.`
            : `The variable GCF is the lowest power of each variable that appears in every term.`,
          variableGCFText === '1' && !yAppearsInProblem
            ? `No variable appears in all terms, so the variable GCF is 1.`
            : `X exponents: ${xExpList}.${yExpList}${yGCFNote} Take the lowest of each.`,
          `The variable GCF is ${variableGCFText}.`
        ],
        expected: variableGCFText
      },
      {
        id: 'total-gcf',
        label: 'Multiply the numeric and variable GCF to get the total GCF',
        hints: [
          `The total GCF is the product of the numeric GCF and the variable GCF.`,
          variableGCFText === '1'
            ? `The numeric GCF is ${numericGCF} and there is no variable GCF, so the total GCF is just ${numericGCF}.`
            : `Multiply the numeric GCF (${numericGCF}) by the variable GCF (${variableGCFText}).`,
          `The total GCF is ${totalGCF}.`
        ],
        expected: totalGCF
      },
      {
        id: 'inside',
        label: 'Divide the expression by the total GCF to find what goes inside the parentheses',
        hints: [
          `Divide every term of the expression by the total GCF. What is left inside the parentheses?`,
          `Take each term of ${expression} and divide its coefficient and variables by ${totalGCF}.`,
          `Dividing ${expression} by ${totalGCF} gives ${insideExpression}, so the answer is ${answer}.`
        ],
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

    if (termCount === 2) {
      // Generate two coefficients with no shared GCF
      const xExp = randInt(xExpRange[0], xExpRange[1]);
      const [c1, c2Raw] = pickNumbers([[1, 8], [1, 8]], { avoidGCD: true });
      const c2 = c2Raw * (allowNegative ? choice([1, -1]) : 1);
      terms = [
        { coefficient: c1, exponent: xExp },
        { coefficient: c2, exponent: 0 }
      ];
      // Optionally add y to first term only — constant term has no y
      if (allowY && choice([true, false])) {
        terms[0].yExponent = randInt(yExpRange[0], yExpRange[1]);
      }

    } else {
      // Three terms: generate coefficients with no shared GCF
      const leadExp = randInt(xExpRange[0], xExpRange[1]);
      const midExp  = leadExp > 1 ? randInt(1, leadExp - 1) : 1;
      const [a, bRaw, cRaw] = pickNumbers([[1, 5], [1, 8], [1, 6]], { avoidGCD: true });
      const b = bRaw * (allowNegative ? choice([1, -1]) : 1);
      const c = cRaw * (allowNegative ? choice([1, -1]) : 1);
      terms = [
        { coefficient: a, exponent: leadExp },
        { coefficient: b, exponent: midExp },
        { coefficient: c, exponent: 0 }
      ];
      // Optionally add y to some (not all) terms.
      // Each term independently gets a y exponent. Only constraint: at least
      // one term must end up with no y (so y can't be a common factor).
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

    return terms;
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

    const workflow = [
      ...layer.gcfWorkflow,
      {
        id: 'final',
        label: 'Write the factored form',
        hints: [
          `Write the total GCF outside the brackets, and the inside expression in parentheses.`,
          `The total GCF is ${layer.totalGCF} and the inside expression is ${layer.insideExpression}, giving ${layer.answer}.`
        ],
        expected: layer.answer
      }
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
      {
        id: 'first-root',
        label: 'Find the square root of the first term',
        hints: [
          `The first term is a perfect square. What expression, when squared, gives ${firstTermDesc}?`,
          `${firstTermDesc} = (${aRootTermText})². What is its square root?`,
          `The square root of ${firstTermDesc} is ${aRootTermText}.`
        ],
        expected: aRootTermText
      },
      {
        id: 'second-root',
        label: 'Find the square root of the second term',
        hints: [
          `The second term is also a perfect square. What number or expression, when squared, gives ${secondTermDesc}?`,
          useY
            ? `${secondTermDesc} = (${bRootTermText})². What is its square root?`
            : `${b} = ${bRootTermText}². What is the square root?`,
          `The square root of ${secondTermDesc} is ${bRootTermText}.`
        ],
        expected: bRootTermText
      },
      {
        id: 'final',
        label: 'Write the factored form (A + B)(A − B)',
        hints: [
          `A difference of squares A² − B² always factors as (A + B)(A − B).`,
          `Here A = ${aRootTermText} and B = ${bRootTermText}. Write (A + B)(A − B).`,
          `The factored form is (${aRootTermText} + ${bRootTermText})(${aRootTermText} − ${bRootTermText}).`
        ],
        expected: answer
      }
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
      {
        id: 'first-root',
        label: 'Find the square root of the first term',
        hints: [
          `The first term is a perfect square. What expression, when squared, gives ${firstTermDesc}?`,
          `${firstTermDesc} = (${aRootText})². What is its square root?`,
          `The square root of ${firstTermDesc} is ${aRootText}.`
        ],
        expected: aRootText
      },
      {
        id: 'last-root',
        label: 'Find the square root of the last term (always positive)',
        hints: [
          `The last term is a perfect square. Square roots are always positive here.`,
          useY
            ? `${lastTermDesc} = (${bRootText})². What is its square root?`
            : `${constCoeff} = ${bRootText}². What is the square root?`,
          `The square root of ${lastTermDesc} is ${bRootText}.`
        ],
        expected: bRootText
      },
      {
        id: 'verify-middle',
        label: 'Verify: 2 × first_root × last_root matches the middle term (ignore its sign)',
        hints: [
          `In a perfect square trinomial, the middle term is always 2 × first_root × last_root.`,
          `Calculate 2 × ${aRootText} × ${bRootText}. Enter the result as a positive value — we check the sign separately.`,
          `2 × ${aRootText} × ${bRootText} = ${expectedMiddleAbs}.`
        ],
        expected: expectedMiddleAbs
      },
      {
        id: 'middle-sign',
        label: 'What is the sign of the middle term?',
        hints: [
          `Look at the middle term of the original expression. Is it positive or negative? Enter + or −.`,
          `The middle term is ${middleTermDesc}. What is its sign?`,
          `The middle term is ${middleTermDesc}, so the sign is ${middleSign}.`
        ],
        expected: middleSign
      },
      {
        id: 'final',
        label: 'Write the factored form (first_root ± last_root)²',
        hints: [
          `A perfect square trinomial always factors as (first_root ± last_root)². Use the sign from the previous step.`,
          `The first root is ${aRootText}, the last root is ${bRootText}, and the sign is ${bSign}. Write (${aRootText} ${bSign} ${bRootText})².`,
          `The factored form is (${aRootText} ${bSign} ${bRootText})².`
        ],
        expected: answer
      }
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
    // varExponent is the degree of the expanded expression (must be even —
    // see roadmap: varExponent semantic rename deferred)
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
    if (proficiency === 'extending' && bRoot === aRoot) {
      bRoot = bRoot < config.bRootRange[1] ? bRoot + 1 : bRoot - 1;
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
    // would itself be a difference of squares — prevented by incrementing bRootAbs.
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

    // Generate two distinct roots — if equal, increment the smaller one.
    let pAbs = buildFromPrimes(config.pool, config.maxPrimeCount, config.maxFactor);
    let qAbs = buildFromPrimes(config.pool, config.maxPrimeCount, config.maxFactor);
    if (pAbs === qAbs) qAbs = qAbs + 1;

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
    // At proficient/extending: 33% chance of xExponent=2 (trinomial in x²)
    // skipValidation=true because p,q are already validated above.
    const xExp = (['proficient', 'extending'].includes(proficiency) && choice([true, false, false]))
      ? 2 : 1;
    const layer = generateTrinomialLayer({
      aRange: [1, 1], bRange: [p, p], allowNegativeB: false,
      cRange: [1, 1], dRange: [q, q], allowNegativeD: false,
      skipValidation: true, xExponent: xExp
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
  //   = acx^(n+1) + bcx^n + adx·y^m + bd·y^m    [when aXExponent=1]
  //   First pair:  acx^(n+1) + bcx^n  →  cx^n(ax + b)
  //   Second pair: adx·y^m   + bd·y^m →  dy^m(ax + b)
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
    // Generate a, b, c, d deterministically.
    // When skipValidation=true (pinned external values), use ranges directly.
    let a, b, c, d;
    if (skipValidation) {
      a = randInt(aRange[0], aRange[1]) * (allowNegativeA ? choice([1, -1]) : 1);
      b = randInt(bRange[0], bRange[1]) * (allowNegativeB ? choice([1, -1]) : 1);
      c = randInt(cRange[0], cRange[1]);
      d = randInt(dRange[0], dRange[1]) * (allowNegativeD ? choice([1, -1]) : 1);
    } else {
      // a: free (it's the constant in the linear factor, no constraints against others)
      a = randInt(aRange[0], aRange[1]);

      // c: free (x-coefficient of second factor)
      c = randInt(cRange[0], cRange[1]);

      // b: must not share GCF with c (so second pair GCF is exactly d, not a multiple)
      // avoidEqual prevents b=c=1 (trivial case)
      const [, bRaw] = pickNumbers([[c, c], bRange], { avoidGCD: true, avoidEqual: true });
      b = bRaw;

      // d: must not share GCF with b (so (cx^n+dy^m) has no GCF)
      // Also must not share GCF with a (so no overall GCF in full polynomial)
      // DoS prevention: if cXExponent is even, d must not be a negative perfect square
      // avoidAllPerfectSquares handles this when we later flip sign
      const [, dRaw] = pickNumbers([[b * a, b * a], dRange], {
        avoidGCD: true,
        avoidAllPerfectSquares: cXExponent % 2 === 0
      });
      d = dRaw;

      // Apply signs after generation (all pickNumbers values are positive)
      a *= allowNegativeA ? choice([1, -1]) : 1;
      b *= allowNegativeB ? choice([1, -1]) : 1;
      d *= allowNegativeD ? choice([1, -1]) : 1;
    }

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
    const t1Text          = formatPolynomial([t1]);
    const t3Text          = formatPolynomial([t3]);

    // Combined pairs step: write both factored pairs joined by operator
    // Sign comes from secondGCFCoeff — positive → '+', negative → '−'
    const combinedSign  = secondGCFCoeff >= 0 ? '+' : '−';
    const combinedPairs = `${firstPairResult} ${combinedSign} ${secondGCFCoeff < 0 ? secondGCFText.slice(1) : secondGCFText}(${commonBinomial})`;
    const addOrSubtract = secondGCFCoeff >= 0 ? 'addition' : 'subtraction';

    const groupingWorkflow = [
      {
        id: 'first-pair-gcf',
        label: 'Factor the GCF from the first two terms — write as GCF(binomial)',
        hints: [
          `The first pair is ${firstPairTerms}. Find its GCF.`,
          `The GCF follows the sign of the leading term of the pair, which is ${t1Text}.`,
          `Write your answer as GCF(binomial) — what do you get when you divide ${firstPairTerms} by ${firstGCFText}?`,
          `The GCF of ${firstPairTerms} is ${firstGCFText}. Dividing gives (${commonBinomial}), so the factored pair is ${firstPairResult}.`
        ],
        expected: firstPairResult
      },
      {
        id: 'second-pair-gcf',
        label: 'Factor the GCF from the last two terms — write as GCF(binomial)',
        hints: [
          `The second pair is ${secondPairTerms}. Find its GCF.`,
          `The GCF follows the sign of the leading term of the pair, which is ${t3Text}.`,
          `Write your answer as GCF(binomial) — what do you get when you divide ${secondPairTerms} by ${secondGCFText}?`,
          `The GCF of ${secondPairTerms} is ${secondGCFText}. Dividing gives (${commonBinomial}), so the factored pair is ${secondPairResult}.`
        ],
        expected: secondPairResult
      },
      {
        id: 'combined-pairs',
        label: 'Write both factored pairs together',
        hints: [
          `Write the two factored pairs side by side connected by a single sign. The GCF of the second pair is ${secondGCFText}, so we write it as an ${addOrSubtract}.`,
          `Because the two factored pairs are ${firstPairResult} and ${secondPairResult}, and the second GCF is ${secondGCFText}, we write it as an ${addOrSubtract}: ${combinedPairs}.`
        ],
        expected: combinedPairs
      },
      {
        id: 'common-binomial',
        label: 'Identify the common binomial factor',
        hints: [
          `Look at what the two factored pairs have in common. Is the expression inside the parentheses the same?`,
          `Both ${firstPairResult} and ${secondPairResult} contain the same binomial factor: ${commonBinomial}.`
        ],
        expected: commonBinomial
      },
      {
        id: 'final',
        label: 'Write the factored form',
        hints: [
          `The common binomial can be factored out, just like factoring out a GCF — the remaining terms become the second factor.`,
          `Think of (${commonBinomial}) as a single unit. Taking it out of ${firstPairResult} leaves ${firstGCFText}, and out of ${secondPairResult} leaves ${secondGCFText}.`,
          `Factoring out (${commonBinomial}) leaves (${firstGCFText} + ${secondGCFText}) as the second factor, giving the factored form ${answer}.`
        ],
        expected: answer
      }
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
    skipValidation = false,
    xExponent = 1
  }) {
    const couldBeGeneral = aRange[1] > 1 || cRange[1] > 1;

    // Generate factors deterministically using pool-based pickNumbers.
    // When skipValidation=true (pinned external values), use ranges directly.
    let a, b, c, d;
    if (skipValidation) {
      a = randInt(aRange[0], aRange[1]);
      b = randInt(bRange[0], bRange[1]) * (allowNegativeB ? choice([1, -1]) : 1);
      c = randInt(cRange[0], cRange[1]);
      d = randInt(dRange[0], dRange[1]) * (allowNegativeD ? choice([1, -1]) : 1);
    } else {
      // a: free
      a = randInt(aRange[0], aRange[1]);

      // c: free
      c = randInt(cRange[0], cRange[1]);

      // b: must not share GCF with a (so (ax+b) has no GCF)
      //    must not share GCF with c (so gcd(ac,bd)=1 — see algebraic proof)
      //    avoidAllPerfectSquares when xExponent even (prevents DoS-in-disguise)
      const [,, bRaw] = pickNumbers([[a, a], [c, c], bRange], {
        avoidGCD: true,
        avoidAllPerfectSquares: xExponent % 2 === 0
      });

      // d: must not share GCF with a*c (ensures gcd(A,C)=1)
      //    d_bad = bc/a would make p=q (PST) — exclude it
      //    avoidAllPerfectSquares for DoS-in-disguise prevention
      const d_bad = (bRaw * c) % a === 0 ? (bRaw * c) / a : null;
      const [, dRaw] = pickNumbers(
        [[a * c, a * c], { range: dRange, exclude: d_bad !== null ? [d_bad] : [] }],
        { avoidGCD: true, avoidAllPerfectSquares: xExponent % 2 === 0 }
      );

      // Apply signs after generation (pickNumbers returns positive values)
      b = bRaw * (allowNegativeB ? choice([1, -1]) : 1);
      d = dRaw * (allowNegativeD ? choice([1, -1]) : 1);
    }
    // Trinomial coefficients
    const A = a * c;
    const B = a * d + b * c;
    const C = b * d;
    const p = a * d;   // split value 1
    const q = b * c;   // split value 2

    // Trinomial terms (for chaining into GCF layer)
    const trinomialTerms = [
      { coefficient: A, exponent: 2 * xExponent },
      { coefficient: B, exponent: xExponent },
      { coefficient: C, exponent: 0 }
    ];

    const expression = formatPolynomial(trinomialTerms);

    // Factor strings for answer and hints
    const factor1 = formatSecondFactor(a, xExponent, b, 0);  // ax^n + b
    const factor2 = formatSecondFactor(c, xExponent, d, 0);  // cx^n + d
    const answer  = `(${factor1})(${factor2})`;

    // --- Workflow steps 1-5 (identification + pair finding) ---
    const workflow = [];
    const steps    = [];

    // Step: identify B (sum of factors)
    workflow.push({
      id: 'identify-b',
      label: 'What do the factors add to?',
      hints: [
        `In a trinomial, the coefficient of x is always the sum of the two factors.`,
        `Look at the x term. What is its coefficient?`,
        `The coefficient of x is ${B}, so the two factors must add to ${B}.`
      ],
      expected: String(B)
    });

    // Step: identify product (C for simple, A×C for general)
    if (couldBeGeneral) {
      const leadingVarText = xExponent === 1 ? 'x²' : `x^${2 * xExponent}`;
      workflow.push({
        id: 'identify-c',
        label: 'What do the factors multiply to?',
        hints: [
          `When the coefficient of ${leadingVarText} is not 1, the product of the factors is not just the constant term — it is the coefficient of ${leadingVarText} multiplied by the constant term.`,
          `The coefficient of ${leadingVarText} is ${A} and the constant term is ${C}. Multiply them together.`,
          `${A} × ${C} = ${A * C}, so the two factors must multiply to ${A * C}.`
        ],
        expected: String(A * C)
      });
    } else {
      workflow.push({
        id: 'identify-c',
        label: 'What do the factors multiply to?',
        hints: [
          `In a trinomial x² + bx + c, the constant term is always the product of the two factors.`,
          `Look at the term with no variable. What is that number?`,
          `The constant term is ${C}, so the two factors must multiply to ${C}.`
        ],
        expected: String(C)
      });
    }

    // Step: find the pair
    const product    = couldBeGeneral ? A * C : C;
    // Canonical order: larger absolute value first, to match the rewrite step convention.
    const pairSorted = [p, q].slice().sort((x, y) => Math.abs(y) - Math.abs(x)).join(', ');

    // Factor pair listing utility — returns all pairs [a,b] where a*b = |product|, a <= b
    function absFactorPairs(n) {
      const abs = Math.abs(n);
      const pairs = [];
      for (let i = 1; i <= Math.sqrt(abs); i++) {
        if (abs % i === 0) pairs.push([i, abs / i]);
      }
      return pairs;
    }

    // Build signed factor pairs list based on sign reasoning already established
    // After hint 3 (sum sign) we know the exact sign configuration
    function signedFactorPairs(product, sum) {
      const pairs = absFactorPairs(product);
      if (product > 0 && sum > 0) {
        // Both positive
        return pairs.map(([a, b]) => `(${a}, ${b})`).join(',  ');
      } else if (product > 0 && sum < 0) {
        // Both negative
        return pairs.map(([a, b]) => `(−${a}, −${b})`).join(',  ');
      } else {
        // Opposite signs — larger has sign of sum
        return pairs.map(([a, b]) => {
          const [small, large] = [a, b]; // a <= b always
          return sum > 0
            ? `(−${small}, ${large})`
            : `(${small}, −${large})`;
        }).join(',  ');
      }
    }

    // Hint 2 — product sign
    const hint2 = product < 0
      ? `The product is ${product} — since it is negative, the two factors have opposite signs.`
      : `The product is ${product} — since it is positive, the two factors have the same sign.`;

    // Hint 3 — sum sign (branches on same vs opposite)
    let hint3;
    if (product > 0 && B > 0) {
      hint3 = `The sum is ${B} — since it is positive and both factors share a sign, both factors are positive.`;
    } else if (product > 0 && B < 0) {
      hint3 = `The sum is ${B} — since it is negative and both factors share a sign, both factors are negative.`;
    } else if (product < 0 && B > 0) {
      hint3 = `The sum is ${B} — since it is positive and the factors have opposite signs, the larger factor is positive.`;
    } else {
      hint3 = `The sum is ${B} — since it is negative and the factors have opposite signs, the larger factor is negative.`;
    }

    // Hint 4 — signed factor pair list
    const hint4 = `With those signs, the factor pairs of ${Math.abs(product)} to check are: ${signedFactorPairs(product, B)}. Which pair adds to ${B}?`;

    // Hint 5 — verify (the 169 move — give the pair, let them confirm)
    // Order matches pairSorted: larger absolute value first.
    const [pSorted, qSorted] = [p, q].slice().sort((a, b) => Math.abs(b) - Math.abs(a));
    const hint5 = `Try the pair (${pSorted}, ${qSorted}): does ${pSorted} × ${qSorted} = ${product}? Does ${pSorted} + ${qSorted} = ${B}?`;

    // Hint 6 — reasoning → result
    const hint6 = `Since the product must equal ${product} and the sum must equal ${B}, the two factors are ${pSorted} and ${qSorted}.`;

    workflow.push({
      id: 'find-factors',
      label: `Find two integers: product = ${product}, sum = ${B}`,
      hints: [
        `Find two integers that multiply to ${product} and add to ${B}. Try listing the factor pairs of ${Math.abs(product)} systematically.`,
        hint2,
        hint3,
        hint4,
        hint5,
        hint6
      ],
      expected: pairSorted,
      inputType: 'pair'
    });

    // --- Branch: simple path vs grouping path ---
    if (a === 1 && c === 1) {
      // Simple trinomial — write factors directly
      const finalLabel = `Write the factored form`;
      const hasNegative = p < 0 || q < 0;
      const finalHints = hasNegative ? [
        `Each factor takes the form (x + integer). Use your two integers ${pSorted} and ${qSorted} as the constants.`,
        `When adding a negative number, you can write it as subtraction. For example, (x + −3) is written as (x − 3).`,
        `Your two integers are ${pSorted} and ${qSorted}, giving the factored form ${answer}.`
      ] : [
        `Each factor takes the form (x + integer). Use your two integers ${pSorted} and ${qSorted} as the constants.`,
        `Your two integers are ${pSorted} and ${qSorted}, giving the factored form ${answer}.`
      ];
      workflow.push({
        id: 'final',
        label: finalLabel,
        hints: finalHints,
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
      // Canonical split order: larger absolute value first.
      // This ensures the grouping hints always match the student's expected input.
      const [pFirst, qSecond] = Math.abs(p) >= Math.abs(q) ? [p, q] : [q, p];

      // groupLayer pins: pFirst = a*d comes from (cx+d)(ax+b) with c,d first.
      // If we swapped, pFirst is q = b*c, which comes from (ax+b)(cx+d) — swap the pairs.
      const groupLayer = Math.abs(p) >= Math.abs(q)
        ? generateGroupingLayer({
            aRange: [c, c], aXExponent: xExponent, allowNegativeA: false,
            bRange: [d, d],                         allowNegativeB: false,
            cRange: [a, a], cXExponent: xExponent,
            dRange: [b, b],                         allowNegativeD: false, dYExponent: 0,
            skipValidation: true
          })
        : generateGroupingLayer({
            aRange: [a, a], aXExponent: xExponent, allowNegativeA: false,
            bRange: [b, b],                         allowNegativeB: false,
            cRange: [c, c], cXExponent: xExponent,
            dRange: [d, d],                         allowNegativeD: false, dYExponent: 0,
            skipValidation: true
          });

      const splitExpr = groupLayer.expression;

      workflow.push({
        id: 'rewrite',
        label: `Rewrite the middle term using your two integers as separate x-terms (larger absolute value first)`,
        hints: [
          `The middle term can be split into two separate x-terms using the integers you found. The first and last terms stay unchanged.`,
          `Replace ${B}x with ${pFirst}x + ${qSecond}x, keeping the rest of the expression the same.`,
          `Splitting ${B}x into ${pFirst}x + ${qSecond}x gives you: ${splitExpr}.`
        ],
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
    // At extending: 33% chance of xExponent=2 (general trinomial in x²)
    if (proficiency === 'extending' && choice([true, false, false])) config.xExponent = 2;
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
  // generateFullFactoringProblem(proficiency)
  //
  // Chains multiple factoring layers into a single "factor completely" problem.
  // Workflow is flat but progressively revealed via gatedBy links.
  //
  // Proficiency structures:
  //   emerging:   GCF + [DoS | PST | ST]
  //   developing: GCF + [DoS | PST | ST | GT]
  //   proficient: GCF + [DoS | PST | GT] OR two-step no-GCF [DoS→DoS | Grp→DoS]
  //   extending:  GCF + two-step inner OR three-step [DoS→DoS with GCF]
  //
  // Generation strategy (backwards):
  //   1. Generate innermost layer → innerTerms
  //   2. Optionally compose with outer layer using innerTerms
  //   3. Optionally wrap everything with GCFLayer
  //   4. Build flat workflow with gatedBy links
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // buildMethodHints(method, isFactorable, expr)
  //
  // Shared hint builder for radio steps that ask the student to identify
  // a factoring method. Used by both Full Factoring and Mixed Method.
  // Returns a 3-level hints array: count terms → term count reasoning → method reasoning.
  // ---------------------------------------------------------------------------
  const methodTermCounts = { dos: 2, pst: 3, st: 3, gt: 3, grouping: 4 };

  const methodTermCountHints = {
    2: `With 2 terms, check if both could be perfect squares separated by a minus sign.`,
    3: `With 3 terms, check if it could be a Perfect Square Trinomial (first and last terms perfect squares, middle = 2·√first·√last). If not, look at the leading coefficient — it could point to a Simple or General Trinomial.`,
    4: `With 4 terms, check if they can be split into two pairs that share a common binomial factor.`
  };

  const methodReasoningHints = {
    dos:      `Both terms are perfect squares separated by a minus sign — this is a Difference of Squares.`,
    pst:      `The first and last terms are perfect squares and the middle term equals 2·√first·√last — this is a Perfect Square Trinomial.`,
    st:       `3 terms with a leading coefficient of 1 — this is a Simple Trinomial.`,
    gt:       `3 terms with a leading coefficient greater than 1 — this is a General Trinomial.`,
    grouping: `4 terms that split into two pairs with a common binomial — this is Grouping.`
  };

  const methodIrreducibleHints = {
    dos:      `This expression is not a difference of squares — check if both terms are perfect squares with a minus sign between them.`,
    pst:      `This expression is not a perfect square trinomial — check if the middle term equals 2·√first·√last.`,
    st:       `This trinomial cannot be factored over the integers.`,
    gt:       `This trinomial cannot be factored over the integers.`,
    grouping: `These 4 terms cannot be grouped into pairs with a common binomial factor.`
  };

  function buildMethodHints(method, isFactorable, expr) {
    const termCount = methodTermCounts[method] || 2;
    return [
      `Count the number of terms in ${expr}.`,
      methodTermCountHints[termCount] || `Look at the structure of ${expr}.`,
      isFactorable
        ? methodReasoningHints[method] || `This expression is factored using the ${method} method.`
        : methodIrreducibleHints[method] || `${expr} cannot be factored further over the integers.`
    ];
  }

  function generateFullFactoringProblem(proficiency) {

    // --- Helpers ---

    // Prefix all step ids and add gatedBy
    function gateSteps(steps, gateId, prefix) {
      return steps.map(s => ({ ...s, id: `${prefix}-${s.id}`, gatedBy: gateId }));
    }

    // Method-specific radio step for "can X be factored further?"
    // For GCF check: options are yes/no
    // For all others: options are the applicable method + "Can't be factored further"
    const methodLabels = {
      dos:      'Difference of Squares',
      pst:      'Perfect Square Trinomial',
      st:       'Simple Trinomial',
      gt:       'General Trinomial',
      grouping: 'Grouping',
      cant:     "Can't be factored further"
    };

    function methodOptions(methods) {
      return methods.map(m => ({ value: m, label: methodLabels[m] }));
    }

    function optionsForMethod(method) {
      if (method === 'dos')      return methodOptions(['dos', 'cant']);
      if (method === 'pst')      return methodOptions(['pst', 'st', 'gt', 'cant']);
      if (method === 'st')       return methodOptions(['pst', 'st', 'gt', 'cant']);
      if (method === 'gt')       return methodOptions(['pst', 'st', 'gt', 'cant']);
      if (method === 'grouping') return methodOptions(['grouping', 'cant']);
      return methodOptions(['dos', 'pst', 'st', 'gt', 'grouping', 'cant']);
    }

    function makeGCFRadio(id, expected, gatedBy) {
      const step = {
        id,
        inputType: 'radio',
        label: 'Is there a GCF (other than 1)?',
        expected,
        hints: [
          `Look at the coefficients of all terms and check if any variable appears in every term.`,
          `A GCF of 1 means nothing useful can be factored out — we only care about a GCF greater than 1. If no number greater than 1 divides all coefficients, and no variable appears in every term, the answer is no.`
        ],
        options: [{ value: 'yes', label: 'Yes — factor out the GCF' }, { value: 'no', label: 'No GCF (other than 1)' }]
      };
      if (gatedBy) step.gatedBy = gatedBy;
      return step;
    }

    function makeMethodRadio(id, expr, method, isFactorable, gatedBy) {
      const step = {
        id,
        inputType: 'radio',
        label: `How can ${expr} be factored?`,
        expected: isFactorable ? method : 'cant',
        hints: buildMethodHints(method, isFactorable, expr),
        options: optionsForMethod(method)
      };
      if (gatedBy) step.gatedBy = gatedBy;
      return step;
    }

    // "Write the full expression so far" step
    function makeWritten(id, label, expected, gatedBy) {
      return {
        id, label, gatedBy, expected,
        hints: [
          `Combine all the factors found so far into a single expression.`,
          `The completely factored form so far is: ${expected}.`
        ]
      };
    }

    // --- Proficiency configs ---
    const gcfRanges = {
      emerging:   { coeffRange: [2, 6],  xExpRange: [0, 0] },
      developing: { coeffRange: [2, 8],  xExpRange: [0, 1] },
      proficient: { coeffRange: [2, 12], xExpRange: [0, 1] },
      extending:  { coeffRange: [2, 12], xExpRange: [0, 1] }
    };

    const innerRanges = {
      emerging:   'emerging',
      developing: 'developing',
      proficient: 'developing',
      extending:  'proficient'
    };

    // --- Pick structure ---
    const structures = {
      emerging:   ['gcf-dos', 'gcf-pst', 'gcf-st', 'gcf-st', 'gcf-dos'],
      developing: ['gcf-dos', 'gcf-pst', 'gcf-st', 'gcf-gt', 'gcf-dos', 'gcf-pst'],
      proficient: ['gcf-dos', 'gcf-pst', 'gcf-gt', 'dos-dos', 'grp-dos'],
      extending:  ['gcf-dos-dos', 'gcf-grp-dos', 'gcf-gt', 'dos-dos', 'grp-dos']
    };

    const structure = choice(structures[proficiency]);
    const innerProf = innerRanges[proficiency];
    const workflow  = [];
    const steps     = [];

    // Track factors and GCF for "written so far" steps
    let gcfText        = null;
    let gcfInsideExpr  = null;
    let fullExpression = null;
    let finalAnswer    = null;

    // -------------------------------------------------------------------------
    // Build inner layer based on structure
    // -------------------------------------------------------------------------

    // DoS inner configs per proficiency
    const dosConfigs = {
      emerging:   { aRootRange:[1,1], bRootRange:[2,6],  varExponents:[2],    useY:false },
      developing: { aRootRange:[2,3], bRootRange:[2,8],  varExponents:[2],    useY:false },
      proficient: { aRootRange:[1,3], bRootRange:[2,9],  varExponents:[2,4],  useY:false },
    };
    const pstConfigs = {
      emerging:   { aRootRange:[1,1], bRootRange:[2,5],  varExponents:[2],    allowNegativeB:false, allowY:false },
      developing: { aRootRange:[1,2], bRootRange:[2,8],  varExponents:[2],    allowNegativeB:true,  allowY:false },
      proficient: { aRootRange:[1,3], bRootRange:[2,7],  varExponents:[2],    allowNegativeB:true,  allowY:false },
    };
    const stConfigs = {
      emerging:   { aRange:[1,1], bRange:[2,5],  cRange:[1,1], dRange:[2,5],  allowNegativeB:false, allowNegativeD:false },
      developing: { aRange:[1,1], bRange:[2,8],  cRange:[1,1], dRange:[2,8],  allowNegativeB:true,  allowNegativeD:true  },
      proficient: { aRange:[1,1], bRange:[2,10], cRange:[1,1], dRange:[2,10], allowNegativeB:true,  allowNegativeD:true  },
    };
    const gtConfigs = {
      developing: { aRange:[2,3], bRange:[1,6],  cRange:[2,3], dRange:[1,6],  allowNegativeB:true, allowNegativeD:true },
      proficient: { aRange:[2,4], bRange:[1,7],  cRange:[2,4], dRange:[1,7],  allowNegativeB:true, allowNegativeD:true },
    };

    // Generate inner content based on structure
    let innerLayer  = null;   // the main inner layer result
    let outerLayer  = null;   // a second layer wrapping the inner (for two-step)
    let innerMethod = null;
    let outerMethod = null;

    // Helper: pick DoS values cleanly (no further-factorable)
    function pickDoS(prof) {
      const cfg = dosConfigs[prof] || dosConfigs.proficient;
      // aRoot: free. bRoot: must not share GCF with aRoot.
      const [aRoot, bRoot] = pickNumbers([cfg.aRootRange, cfg.bRootRange], { avoidGCD: true });
      const varExponent = choice(cfg.varExponents);
      return generateDoSLayer({ aRoot, bRoot, varExponent, useY: false });
    }

    function pickPST(prof) {
      const cfg = pstConfigs[prof] || pstConfigs.proficient;
      // aRoot: free. bRootAbs: must not share GCF with aRoot.
      const [aRoot, bRootAbs] = pickNumbers([cfg.aRootRange, cfg.bRootRange], { avoidGCD: true });
      const bSign = cfg.allowNegativeB ? choice([1,-1]) : 1;
      const varExponent = choice(cfg.varExponents);
      // Prevent chained DoS: if bRoot negative and both roots are perfect squares at exp=2, increment bRootAbs
      const finalBRootAbs = (bSign < 0 && varExponent === 2 && isPerfectSquare(aRoot) && isPerfectSquare(bRootAbs))
        ? bRootAbs + 1 : bRootAbs;
      return generatePSTLayer({ aRoot, bRootAbs: finalBRootAbs, bRoot: finalBRootAbs * bSign, varExponent, useY: false });
    }

    function pickST(prof) {
      const cfg = stConfigs[prof] || stConfigs.proficient;
      const pool = [2,2,3,3,5];
      let pAbs = buildFromPrimes(pool,[1,2],[4,12]);
      let qAbs = buildFromPrimes(pool,[1,2],[4,12]);
      if (pAbs === qAbs) qAbs = qAbs + 1;  // deterministic fix: no retry
      const p = cfg.allowNegativeB ? pAbs*choice([1,-1]) : pAbs;
      const q = cfg.allowNegativeD ? qAbs*choice([1,-1]) : qAbs;
      return generateTrinomialLayer({ aRange:[1,1], bRange:[p,p], cRange:[1,1], dRange:[q,q], skipValidation:true });
    }

    function pickGT(prof) {
      const cfg = gtConfigs[prof] || gtConfigs.proficient;
      return generateTrinomialLayer(cfg);
    }

    // Build inner layer
    if (structure.includes('dos-dos')) {
      // Inner DoS at base exponent, outer DoS squares the roots and doubles the exponent.
      // outer rightFactor = aRoot²x^varExp - bRoot² = inner.expression ✓
      // outer leftFactor  = aRoot²x^varExp + bRoot² (irreducible sum of squares) ✓
      const cfg = dosConfigs['developing'];
      const [aRoot, bRoot] = pickNumbers([cfg.aRootRange, cfg.bRootRange], { avoidGCD: true });
      const varExp = choice(cfg.varExponents);
      innerLayer = generateDoSLayer({ aRoot, bRoot, varExponent: varExp, useY: false });
      innerMethod = 'dos';
      outerLayer  = generateDoSLayer({ aRoot: aRoot * aRoot, bRoot: bRoot * bRoot, varExponent: varExp * 2, useY: false });
      outerMethod = 'dos';
    } else if (structure.includes('grp-dos')) {
      // Grouping where second factor is a DoS: (x+a)(x²-b²)
      // Generate the DoS part first, then build grouping around it
      const dosInner = pickDoS('developing');
      // dosInner.innerTerms = [c²x², -d²] where varExponent=2
      // Use these as the "d" (constant) pinned to a DoS: d = -b², c=1, cXExponent=2
      const aVal = randInt(2, 8);
      outerLayer = generateGroupingLayer({
        aRange: [1,1], aXExponent: 1, allowNegativeA: false,
        bRange: [aVal, aVal], allowNegativeB: false,
        cRange: [dosInner.aRoot * dosInner.aRoot, dosInner.aRoot * dosInner.aRoot], cXExponent: 2,
        dRange: [-(dosInner.bRoot * dosInner.bRoot), -(dosInner.bRoot * dosInner.bRoot)],
        allowNegativeD: false, dYExponent: 0,
        skipValidation: true
      });
      innerLayer  = dosInner;
      innerMethod = 'dos';
      outerMethod = 'grouping';
    } else {
      // Single inner method
      const m = structure.replace('gcf-', '');
      if (m === 'dos')      { innerLayer = pickDoS(innerProf);  innerMethod = 'dos'; }
      else if (m === 'pst') { innerLayer = pickPST(innerProf);  innerMethod = 'pst'; }
      else if (m === 'st')  { innerLayer = pickST(innerProf);   innerMethod = 'st';  }
      else if (m === 'gt')  { innerLayer = pickGT(innerProf === 'emerging' ? 'developing' : innerProf); innerMethod = 'gt'; }
    }

    // --- Determine the "innermost" terms for GCF wrapping ---
    const hasGCF   = structure.startsWith('gcf-');
    const twoStep  = structure.includes('dos-dos') || structure.includes('grp-dos');

    // The terms we feed into the GCF layer are the outermost layer's terms
    const outerTerms = outerLayer
      ? (outerLayer.terms || outerLayer.innerTerms || outerLayer.trinomialTerms)
      : (innerLayer.innerTerms || innerLayer.trinomialTerms || innerLayer.terms);

    let gcfLayer = null;
    if (hasGCF) {
      const gcfCfg = gcfRanges[proficiency];
      gcfLayer = generateGCFLayer({ ...gcfCfg, insideTerms: outerTerms });
    }

    // --- Build expression and final answer ---
    const outerExpr = outerLayer ? outerLayer.expression
      : (innerLayer.expression);

    fullExpression = gcfLayer ? gcfLayer.expression : outerExpr;

    // Build final answer string
    const innerAnswer  = innerLayer.answer;
    const outerAnswer  = outerLayer ? outerLayer.answer : null;

    if (gcfLayer) {
      if (outerAnswer) {
        // GCF + two-step: e.g. 3(x²+4)(x+2)(x-2)
        // outerAnswer might be e.g. (x²+a²)(x²-a²), we need to replace the
        // inner DoS factor with its fully factored form
        const expandedOuter = outerAnswer.replace(innerLayer.expression, innerAnswer);
        // Strip outer parens if they wrap the whole thing (avoid double parens)
        finalAnswer = `${gcfLayer.totalGCF}${expandedOuter}`;
      } else {
        // GCF + single inner method: totalGCF × innerAnswer
        // innerAnswer is already wrapped in parens e.g. (x+3)(x-3) or (x+2)^2
        finalAnswer = `${gcfLayer.totalGCF}${innerAnswer}`;
      }
    } else if (outerAnswer) {
      // Replace the inner expression within the outer answer.
      // If the replacement creates double parens like ((a)(b)), flatten them.
      let replaced = outerAnswer.replace(innerLayer.expression, innerAnswer);
      // Fix double parens: X((A)(B)) → X(A)(B)
      replaced = replaced.replace(/\(\(/g, '(').replace(/\)\)/g, ')');
      finalAnswer = replaced;
    } else {
      finalAnswer = innerAnswer;
    }

    // -------------------------------------------------------------------------
    // Build workflow
    // -------------------------------------------------------------------------

    // Step 1: GCF check (always first)
    const gcfRadioId = 'ff-gcf-check';
    workflow.push(makeGCFRadio(gcfRadioId, hasGCF ? 'yes' : 'no', null));

    let lastGateId = gcfRadioId;

    if (hasGCF && gcfLayer) {
      // GCF steps
      const gcfSteps = gateSteps(gcfLayer.gcfWorkflow, gcfRadioId, 'ff-gcf');
      workflow.push(...gcfSteps);

      // "Write what you have so far" after GCF
      const gcfWrittenId = 'ff-gcf-written';
      // GCF answer: totalGCF(insideExpression) — standard format
      const gcfWrittenExpr = gcfLayer.answer;
      workflow.push(makeWritten(
        gcfWrittenId,
        'Write the expression with the GCF factored out',
        gcfWrittenExpr,
        `ff-gcf-${gcfLayer.gcfWorkflow[gcfLayer.gcfWorkflow.length - 1].id}`
      ));
      lastGateId = gcfWrittenId;

      steps.push(...gcfLayer.gcfSteps.map(s => ({
        ...s,
        expression: fullExpression,
        output: gcfWrittenExpr
      })));
    }

    // Step 2: Outer layer (if two-step)
    if (twoStep && outerLayer) {
      const outerExprToFactor = gcfLayer ? gcfLayer.insideExpression : outerExpr;
      const outerRadioId = 'ff-outer-check';
      workflow.push(makeMethodRadio(outerRadioId, outerExprToFactor, outerMethod, true, lastGateId));
      lastGateId = outerRadioId;

      // Outer layer steps
      const outerStepSrc = outerLayer.groupingWorkflow || outerLayer.dosWorkflow || outerLayer.pstWorkflow || outerLayer.workflow || [];
      const outerGated = gateSteps(outerStepSrc, outerRadioId, 'ff-outer');
      // Remove the 'final' step — we replace it with a "written so far" step
      const outerGatedNoFinal = outerGated.filter(s => !s.id.endsWith('-final'));
      workflow.push(...outerGatedNoFinal);

      // After outer factoring, write partial answer
      const outerWrittenId = 'ff-outer-written';
      const outerFactoredExpr = outerLayer.answer; // e.g. (x²+a²)(x²-a²)
      const outerWrittenFull = gcfLayer
        ? `${gcfLayer.totalGCF}(${outerFactoredExpr})`
        : outerFactoredExpr;
      const outerLastStep = outerGated[outerGated.length - 2]; // second to last (before final)
      workflow.push(makeWritten(
        outerWrittenId,
        'Write the full expression with this step factored',
        outerWrittenFull,
        outerLastStep?.id || lastGateId
      ));
      lastGateId = outerWrittenId;

      steps.push({
        expression: gcfLayer ? `${gcfLayer.totalGCF}(${outerExprToFactor})` : outerExprToFactor,
        rule: outerMethod,
        output: outerWrittenFull,
        explanation: `Factor ${outerExprToFactor} → ${outerFactoredExpr}`
      });
    }

    // Step 3: Inner layer check — can the inner factor be factored further?
    // For dos-dos: the factorable factor is outerLayer.rightFactor (e.g. 3x²-4)
    // not innerLayer.expression (e.g. 9x²-16, which is the pre-outer expression)
    const innerExprToCheck = (structure.includes('dos-dos') && outerLayer)
      ? outerLayer.rightFactor
      : twoStep
        ? innerLayer.expression
        : (gcfLayer ? gcfLayer.insideExpression : innerLayer.expression);

    // Only ask about inner if it's degree >= 2
    const innerTermsArr = innerLayer.innerTerms || innerLayer.trinomialTerms || innerLayer.terms || [];
    const maxExp = Math.max(...innerTermsArr.map(t => t.exponent || 0));

    if (maxExp >= 2) {
      // For dos-dos: the outer DoS produces two factors. The "sum" factor (x²+a²)
      // is irreducible — ask about it first, then ask about the factorable DoS factor.
      if (structure.includes('dos-dos') && outerLayer) {
        // outerLayer is a DoS: answer = (x²+a²)(x²-a²)
        // First factor is irreducible sum of squares
        const sumFactor = `${outerLayer.aRootTermText}² + ${outerLayer.bRootTermText}²`
          .replace('undefined²', outerLayer.expression.split('+')[0].trim())
          || `(${outerLayer.leftFactor})`;
        // Get the sum-of-squares expression from the outer DoS left factor
        const irreducibleExpr = outerLayer.leftFactor || outerLayer.factor1;
        const irreducibleRadioId = 'ff-irreducible-check';
        workflow.push(makeMethodRadio(irreducibleRadioId, irreducibleExpr, 'dos', false, lastGateId));
        lastGateId = irreducibleRadioId;
      }

      const innerRadioId = 'ff-inner-check';
      workflow.push(makeMethodRadio(innerRadioId, innerExprToCheck, innerMethod, true, lastGateId));
      lastGateId = innerRadioId;

      // Inner layer steps
      const innerStepSrc = innerLayer.dosWorkflow || innerLayer.pstWorkflow || innerLayer.workflow || [];
      const innerGated = gateSteps(innerStepSrc, innerRadioId, 'ff-inner');
      workflow.push(...innerGated);

      // Final answer step gated on last inner step
      const innerLastStep = innerGated[innerGated.length - 1];
      const finalWrittenId = 'ff-final-written';
      workflow.push(makeWritten(
        finalWrittenId,
        'Write the completely factored form',
        finalAnswer,
        innerLastStep?.id || lastGateId
      ));

      steps.push({
        expression: innerExprToCheck,
        rule: innerMethod,
        output: finalAnswer,
        explanation: `Factor ${innerExprToCheck} → ${innerLayer.answer}`
      });
    } else {
      // Inner factor is linear — just ask for final answer directly
      const finalWrittenId = 'ff-final-written';
      workflow.push(makeWritten(
        finalWrittenId,
        'Write the completely factored form',
        finalAnswer,
        lastGateId
      ));
    }

    return {
      id:          `ff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method:      'ff',
      proficiency,
      expression:  fullExpression,
      answer:      finalAnswer,
      steps,
      workflow
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

    const identStep = {
      id:        'identify-method',
      label:     'Identify the factoring method',
      hints:     buildMethodHints(method, true, inner.expression),
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
    if (settings.method === 'ff') {
      return generateFullFactoringProblem(settings.difficulty);
    }
    return null;
  }

  return { generateProblem };
})();