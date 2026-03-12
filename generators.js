window.Generators = (() => {
  const {
    choice,
    formatFactorPiece,
    formatPolynomial,
    gcdList,
    isLikelyIrreducibleQuadratic,
    randInt
  } = window.Utils;

  function generateGCFProblem(difficulty) {
    let terms;
    let numericGCF;
    let variableGCFExponent;

    if (difficulty === 'easy') {
      numericGCF = choice([2, 3, 4, 5, 6, 7, 8, 9]);
      variableGCFExponent = 0;

      let c1, c2;
      do {
        c1 = randInt(2, 9);
        c2 = randInt(2, 9) * choice([1, -1]);
      } while (gcdList([c1, c2]) !== 1);

      const insideTerms = [
        { coefficient: c1, exponent: choice([1, 2]) },
        { coefficient: c2, exponent: 0 }
      ];

      terms = insideTerms.map((term) => ({
        coefficient: numericGCF * term.coefficient,
        exponent: term.exponent
      }));
    } else if (difficulty === 'medium') {
      numericGCF = choice([2, 3, 4, 5, 6, 8, 9, 10, 12]);
      variableGCFExponent = choice([1, 2]);

      let a, b, c;
      do {
        a = randInt(1, 4);
        b = randInt(-6, 6);
        c = randInt(-6, 6);
      } while (
        b === 0 ||
        c === 0 ||
        gcdList([a, b, c]) !== 1 ||
        !isLikelyIrreducibleQuadratic(a, b, c)
      );

      const insideTerms = [
        { coefficient: a, exponent: 2 },
        { coefficient: b, exponent: 1 },
        { coefficient: c, exponent: 0 }
      ];

      terms = insideTerms.map((term) => ({
        coefficient: numericGCF * term.coefficient,
        exponent: term.exponent + variableGCFExponent
      }));
    } else {
      numericGCF = choice([2, 3, 4, 5, 6, 8, 9, 10, 12]);
      variableGCFExponent = choice([1, 2, 3]);

      let a, b, c, leadingExponent;
      do {
        a = randInt(1, 5);
        b = randInt(-8, 8);
        c = randInt(-8, 8);
        leadingExponent = choice([2, 3]);
      } while (
        b === 0 ||
        c === 0 ||
        gcdList([a, b, c]) !== 1 ||
        !isLikelyIrreducibleQuadratic(a, b, c)
      );

      const insideTerms = [
        { coefficient: a, exponent: leadingExponent },
        { coefficient: b, exponent: 1 },
        { coefficient: c, exponent: 0 }
      ].sort((left, right) => right.exponent - left.exponent);

      terms = insideTerms.map((term) => ({
        coefficient: numericGCF * term.coefficient,
        exponent: term.exponent + variableGCFExponent
      }));
    }

    terms.sort((left, right) => right.exponent - left.exponent);

    const expression = formatPolynomial(terms);
    const insideTerms = terms.map((term) => ({
      coefficient: term.coefficient / numericGCF,
      exponent: term.exponent - variableGCFExponent
    }));
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

    const steps = [
      {
        expression,
        rule: 'gcf',
        output: answer,
        explanation: `The numeric GCF is ${numericGCF}, the variable GCF is ${variableGCFText}, so the total GCF is ${totalGCF}.`
      }
    ];

    const workflow = [
      { id: 'numeric-gcf', label: 'Find the numeric GCF', expected: String(numericGCF) },
      { id: 'variable-gcf', label: 'Find the variable GCF', expected: variableGCFText },
      { id: 'total-gcf', label: 'Multiply both to get the total GCF', expected: totalGCF },
      { id: 'inside', label: 'Write the expression left inside the parentheses', expected: insideExpression },
      { id: 'final', label: 'Write the factored form', expected: answer }
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
