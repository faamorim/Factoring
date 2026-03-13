window.Generators = (() => {
  const {
    choice,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    randInt
  } = window.Utils;

  // ---------------------------------------------------------------------------
  // generateGCFLayer(difficulty)
  //
  // Shared primitive — returns ONLY the GCF components appropriate for the
  // given difficulty: a numeric GCF and a variable GCF exponent.
  //
  // Deliberately knows nothing about inside terms. The caller is responsible
  // for generating inside terms that suit its own purpose:
  //   - generateGCFProblem: inside terms must be irreducible
  //   - generateFullFactoringProblem (future): inside terms must be factorable
  //
  // Returns: { numericGCF, variableGCFExponent }
  // ---------------------------------------------------------------------------
  function generateGCFLayer(difficulty) {
    if (difficulty === 'emerging') {
      return {
        numericGCF: choice([2, 3, 4, 5]),
        variableGCFExponent: 0
      };
    }

    if (difficulty === 'developing') {
      return {
        numericGCF: choice([2, 3, 4, 5, 6]),
        variableGCFExponent: choice([1, 2])
      };
    }

    if (difficulty === 'proficient') {
      return {
        numericGCF: choice([2, 3, 4, 5, 6, 8, 9, 10, 12]),
        variableGCFExponent: choice([0, 1])
      };
    }

    // extending
    return {
      numericGCF: choice([2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16]),
      variableGCFExponent: choice([1, 2, 3])
    };
  }

  // ---------------------------------------------------------------------------
  // generateGCFProblem(difficulty)
  //
  // Assembles a full standalone GCF problem:
  //   1. Gets GCF components from generateGCFLayer
  //   2. Generates inside terms guaranteed to be irreducible (no further
  //      factoring possible), appropriate for the difficulty
  //   3. Builds the full polynomial, answer, steps, workflow, and hints
  // ---------------------------------------------------------------------------
  function generateGCFProblem(difficulty) {
    const { numericGCF, variableGCFExponent } = generateGCFLayer(difficulty);

    // --- Generate inside terms based on difficulty ---
    let insideTerms;

    if (difficulty === 'emerging') {
      // Two positive terms, no variable GCF, small coefficients
      let c1, c2;
      do {
        c1 = randInt(2, 6);
        c2 = randInt(2, 6);
      } while (gcdList([c1, c2]) !== 1);

      insideTerms = [
        { coefficient: c1, exponent: choice([1, 2]) },
        { coefficient: c2, exponent: 0 }
      ];

    } else if (difficulty === 'developing') {
      // Two positive terms, variable GCF exponent already 1 from layer
      let c1, c2;
      do {
        c1 = randInt(2, 8);
        c2 = randInt(2, 8);
      } while (gcdList([c1, c2]) !== 1);

      insideTerms = [
        { coefficient: c1, exponent: choice([1, 2]) },
        { coefficient: c2, exponent: 0 }
      ];

    } else if (difficulty === 'proficient') {
      // Three terms, b can be negative, c stays positive
      let a, b, c;
      do {
        a = randInt(1, 4);
        b = randInt(1, 6) * choice([1, -1]);
        c = randInt(1, 6);
      } while (
        gcdList([Math.abs(a), Math.abs(b), c]) !== 1 ||
        !isLikelyIrreducibleQuadratic(a, b, c)
      );

      insideTerms = [
        { coefficient: a, exponent: 2 },
        { coefficient: b, exponent: 1 },
        { coefficient: c, exponent: 0 }
      ];

    } else {
      // extending: three terms, full freedom, middle exponent randomized
      let a, b, c, leadingExponent, middleExponent;
      do {
        a = randInt(1, 5);
        b = randInt(-8, 8);
        c = randInt(-8, 8);
        leadingExponent = choice([2, 3, 4]);
        middleExponent = randInt(1, leadingExponent - 1);
      } while (
        b === 0 ||
        c === 0 ||
        gcdList([Math.abs(a), Math.abs(b), Math.abs(c)]) !== 1 ||
        !isLikelyIrreducibleQuadratic(a, b, c)
      );

      insideTerms = [
        { coefficient: a, exponent: leadingExponent },
        { coefficient: b, exponent: middleExponent },
        { coefficient: c, exponent: 0 }
      ].sort((left, right) => right.exponent - left.exponent);
    }

    // --- Build the full polynomial by scaling inside terms by the GCF ---
    const terms = insideTerms
      .map((term) => ({
        coefficient: numericGCF * term.coefficient,
        exponent: term.exponent + variableGCFExponent
      }))
      .sort((left, right) => right.exponent - left.exponent);

    // --- Derived values ---
    const expression = formatPolynomial(terms);
    const insideExpression = formatPolynomial(insideTerms);

    const totalGCF = variableGCFExponent === 0
      ? String(numericGCF)
      : formatFactorPiece(numericGCF, variableGCFExponent);

    const variableGCFText = variableGCFExponent === 0
      ? '1'
      : variableGCFExponent === 1
        ? 'x'
        : `x^${variableGCFExponent}`;

    const answer = `${totalGCF}(${insideExpression})`;

    // --- Steps ---
    const steps = [
      {
        expression,
        rule: 'gcf',
        output: answer,
        explanation: `The numeric GCF is ${numericGCF}, the variable GCF is ${variableGCFText}, so the total GCF is ${totalGCF}.`
      }
    ];

    // --- Hints built with actual problem values ---
    const coefficients = terms.map((t) => Math.abs(t.coefficient));
    const numericHint = `What is the GCF of ${coefficients.join(', ')}?`;

    const variableHint = variableGCFExponent === 0
      ? 'There is no variable factor shared by all terms — the variable GCF is 1.'
      : `What is the lowest power of x that appears in every term? The exponents present are: ${terms.map((t) => t.exponent === 1 ? 'x' : `x^${t.exponent}`).join(', ')}.`;

    const totalGCFHint = variableGCFExponent === 0
      ? `Multiply the numeric GCF (${numericGCF}) by the variable GCF (1). What do you get?`
      : `Multiply the numeric GCF (${numericGCF}) by the variable GCF (${variableGCFText}). What do you get?`;

    const insideHint = `Divide every term of ${expression} by the total GCF (${totalGCF}). What expression is left?`;
    const finalHint = `Write the total GCF (${totalGCF}) followed by the inside expression (${insideExpression}) in parentheses.`;

    // --- Workflow ---
    const workflow = [
      { id: 'numeric-gcf', label: 'Find the numeric GCF', hint: numericHint, expected: String(numericGCF) },
      { id: 'variable-gcf', label: 'Find the variable GCF', hint: variableHint, expected: variableGCFText },
      { id: 'total-gcf', label: 'Multiply the numeric and variable GCF to get the total GCF', hint: totalGCFHint, expected: totalGCF },
      { id: 'inside', label: 'Divide the expression by the total GCF to find what goes inside the parentheses', hint: insideHint, expected: insideExpression },
      { id: 'final', label: 'Write the factored form', hint: finalHint, expected: answer }
    ];

    return {
      id: `gcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method: 'gcf',
      difficulty,
      expression,
      factors: [totalGCF, insideExpression],
      answer,
      steps,
      workflow
    };
  }

  // ---------------------------------------------------------------------------
  // generateProblem(settings)
  //
  // Dispatcher — routes to the correct generator based on settings.method.
  // Future generators (trinomial, chained, etc.) get added here.
  // ---------------------------------------------------------------------------
  function generateProblem(settings) {
    if (settings.method === 'gcf') {
      return generateGCFProblem(settings.difficulty);
    }
    return null;
  }

  return {
    generateProblem
  };
})();
