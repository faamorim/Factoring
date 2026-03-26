(() => {
  const { compareFactored, normalizeRaw, rawToPretty, generateSeed, setSeed, clearSeed } = window.Utils;
  const { generateProblem } = window.Generators;
  const { insertIntoActiveInput } = window.InputController;
  const {
    renderFeedback,
    renderKeypad,
    renderKeypadStatus,
    renderProblem,
    renderStepsOutput,
    renderWorkArea
  } = window.Renderer;

  const state = {
    settings: {
      method: 'gcf',
      difficulty: 'emerging',
      mode: 'final'
    },
    currentProblem: null,
    activeInputId: null,
    inputValues: {},
    feedback: {
      message: 'Generate a problem to start.',
      type: 'info'
    },
    seed: null,
    lastGenerationParams: null,
    revealedSteps: 0,
    stepStatuses: {},
    pairFieldStatuses: {},
    revealedHints: {},
    justRevealedHintFor: null
  };

  const elements = {
    methodSelect: document.getElementById('methodSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    modeSelect: document.getElementById('modeSelect'),
    generateBtn: document.getElementById('generateBtn'),
    problemDisplay: document.getElementById('problemDisplay'),
    workArea: document.getElementById('workArea'),
    feedbackBox: document.getElementById('feedbackBox'),
    keypadStatus: document.getElementById('keypadStatus'),
    keypadGrid: document.getElementById('keypadGrid'),
    stepsOutput: document.getElementById('stepsOutput'),
    dockCheckBtn: document.getElementById('dockCheckBtn'),
    dockHintBtn: document.getElementById('dockHintBtn'),
    dockSolveBtn: document.getElementById('dockSolveBtn'),
    dockShowSolutionBtn: document.getElementById('dockShowSolutionBtn'),
    copyLinkBtn: document.getElementById('copyLinkBtn')
  };

  function setFeedback(message, type = 'info') {
    state.feedback = { message, type };
    renderFeedback(state, elements);
  }

  function compareAnswers(studentRaw, expectedRaw) {
    // Use factor-order-insensitive comparison when the expected answer
    // looks like a factored product (contains parentheses)
    if (expectedRaw && expectedRaw.includes('(')) {
      return compareFactored(studentRaw, expectedRaw);
    }
    return normalizeRaw(studentRaw) === normalizeRaw(expectedRaw);
  }

  function generateNewProblem(seed = null) {
    state.seed = seed !== null ? seed : generateSeed();
    state.lastGenerationParams = { ...state.settings, seed: state.seed };
    const p = [state.settings.method, state.settings.difficulty, state.settings.mode, state.seed].join('.');
    history.replaceState(null, '', `?p=${p}`);
    setSeed(state.seed);
    state.currentProblem = generateProblem(state.settings);
    clearSeed();
    state.inputValues = {};
    state.activeInputId = null;
    state.revealedSteps = 0;
    state.stepStatuses = {};
    state.pairFieldStatuses = {};
    state.revealedHints = {};
    setFeedback('New problem generated.', 'info');
    render();
    setTimeout(() => {
      const el = document.getElementById('problemDisplay');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function copyLink() {
    const { method, difficulty, mode, seed } = state.lastGenerationParams;
    const p = [method, difficulty, mode, seed].join('.');
    const url = `${location.origin}${location.pathname}?p=${p}`;
    navigator.clipboard.writeText(url).then(() => {
      const btn = elements.copyLinkBtn;
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1800);
    });
  }

  function readUrlParams() {
    const params = new URLSearchParams(location.search);
    const p = params.get('p');
    if (!p) return false;
    const parts = p.split('.');
    if (parts.length !== 4) return;
    const [method, difficulty, mode, seedStr] = parts;
    const seed = parseInt(seedStr, 10);
    if (isNaN(seed)) return;
    // Apply settings to selects
    state.settings.method = method;
    state.settings.difficulty = difficulty;
    state.settings.mode = mode;
    if (elements.methodSelect) elements.methodSelect.value = method;
    if (elements.difficultySelect) elements.difficultySelect.value = difficulty;
    if (elements.modeSelect) elements.modeSelect.value = mode;
    // Generate the problem with the exact seed
    generateNewProblem(seed);
    return true;
  }

  function checkFinalAnswer() {
    const record = state.inputValues['final-answer'];
    if (!record || !record.raw.trim()) {
      setFeedback('Enter an answer first.', 'error');
      return;
    }

    const correct = compareAnswers(record.raw, state.currentProblem.answer);
    setFeedback(correct ? 'Correct!' : 'Not quite. Try again or use Hint / Solve Step.', correct ? 'success' : 'error');
  }

  function pulseStep(id) {
    const el = document.querySelector(`[data-step-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      el.classList.remove('step-pulse');
      void el.offsetWidth;
      el.classList.add('step-pulse');
      el.addEventListener('animationend', () => el.classList.remove('step-pulse'), { once: true });
    }, 400);
  }

  // Check a pair step — each field is matched against the expected set greedily.
  // Once a value is matched it is consumed, preventing double-matching (e.g. 4,4 vs 4,7).
  // Returns { stepCorrect, fieldStatuses: { 'id-a': 'correct'|'incorrect'|'empty', ... } }
  function checkPairStep(step) {
    const rawA = state.inputValues[`${step.id}-a`]?.raw?.trim() || '';
    const rawB = state.inputValues[`${step.id}-b`]?.raw?.trim() || '';

    // Parse expected as two sorted integers e.g. "-5, 7" → [-5, 7]
    const expectedValues = step.expected.split(',').map(s => parseInt(s.trim(), 10));
    const remaining = [...expectedValues];

    const fieldStatuses = {};
    for (const [slot, raw] of [['a', rawA], ['b', rawB]]) {
      const subId = `${step.id}-${slot}`;
      if (!raw) { fieldStatuses[subId] = 'empty'; continue; }
      const val = parseInt(raw, 10);
      const idx = remaining.indexOf(val);
      if (idx !== -1) {
        fieldStatuses[subId] = 'correct';
        remaining.splice(idx, 1); // consume matched value
      } else {
        fieldStatuses[subId] = 'incorrect';
      }
    }

    const stepCorrect = fieldStatuses[`${step.id}-a`] === 'correct' &&
                        fieldStatuses[`${step.id}-b`] === 'correct';
    const stepFilled  = rawA !== '' && rawB !== '';

    return { stepCorrect, stepFilled, fieldStatuses };
  }

  function evaluateGuidedSteps(revealHint) {
    const workflow = state.currentProblem.workflow;
    let firstWrongIndex = -1;

    // Pass 1: find the first filled+wrong step (skip locked and radio steps)
    workflow.forEach((step, index) => {
      if (step.gatedBy && state.stepStatuses[step.gatedBy] !== 'correct') return;
      if (step.inputType === 'pair') {
        const { stepCorrect, stepFilled } = checkPairStep(step);
        if (stepFilled && !stepCorrect && firstWrongIndex === -1) firstWrongIndex = index;
        return;
      }
      if (step.inputType === 'radio') {
        return; // handled on click
      }
      const raw = state.inputValues[step.id]?.raw || '';
      if (raw.trim() !== '' && !compareAnswers(raw, step.expected)) {
        if (firstWrongIndex === -1) firstWrongIndex = index;
      }
    });

    // Pass 2: assign statuses (skip locked and radio steps)
    workflow.forEach((step, index) => {
      if (step.gatedBy && state.stepStatuses[step.gatedBy] !== 'correct') return;
      if (step.inputType === 'radio') {
        return; // handled on click
      }
      if (step.inputType === 'pair') {
        const { stepCorrect, stepFilled, fieldStatuses } = checkPairStep(step);
        Object.assign(state.pairFieldStatuses, fieldStatuses);
        if (!stepFilled) {
          state.stepStatuses[step.id] = 'empty';
        } else if (firstWrongIndex === -1 || index < firstWrongIndex) {
          state.stepStatuses[step.id] = stepCorrect ? 'correct' : 'incorrect';
          if (!stepCorrect && firstWrongIndex === -1) firstWrongIndex = index;
        } else if (index === firstWrongIndex) {
          state.stepStatuses[step.id] = 'incorrect';
        } else {
          state.stepStatuses[step.id] = 'downstream';
        }
        return;
      }

      const raw = state.inputValues[step.id]?.raw || '';
      const filled = raw.trim() !== '';

      if (!filled) {
        state.stepStatuses[step.id] = 'empty';
        return;
      }

      if (firstWrongIndex === -1) {
        state.stepStatuses[step.id] = 'correct';
      } else if (index < firstWrongIndex) {
        state.stepStatuses[step.id] = 'correct';
      } else if (index === firstWrongIndex) {
        state.stepStatuses[step.id] = 'incorrect';
      } else {
        state.stepStatuses[step.id] = 'downstream';
      }
    });

    const blankSteps = workflow.filter((step) => {
      // Locked steps don't count as blank — student can't fill them yet
      if (step.gatedBy && state.stepStatuses[step.gatedBy] !== 'correct') return false;
      if (step.inputType === 'pair') {
        const rawA = state.inputValues[`${step.id}-a`]?.raw?.trim();
        const rawB = state.inputValues[`${step.id}-b`]?.raw?.trim();
        return !rawA && !rawB;
      }
      if (step.inputType === 'radio') {
        return state.stepStatuses[step.id] !== 'correct';
      }
      return !(state.inputValues[step.id]?.raw?.trim());
    });
    const allFilled = blankSteps.length === 0;

    if (firstWrongIndex === -1 && allFilled) {
      // Everything correct and complete
      render();
      setFeedback('Excellent! Every step is correct.', 'success');
      return;
    }

    if (firstWrongIndex === -1 && !allFilled) {
      // Everything filled so far is correct, but some steps are still blank
      render();
      if (revealHint) {
        const firstBlank = blankSteps[0];
        const hintLevels = firstBlank.hints?.length ?? 1;
        const current = state.revealedHints[firstBlank.id] || 0;
        if (current < hintLevels) {
          state.revealedHints[firstBlank.id] = current + 1;
          state.justRevealedHintFor = firstBlank.id;
        }
        render();
        state.justRevealedHintFor = null;
        setFeedback(`Looking good so far! Hint added to the next step.`, 'info');
        setTimeout(() => pulseStep(firstBlank.id), 50);
      } else {
        const remaining = blankSteps.length;
        setFeedback(`Looking good so far — ${remaining} step${remaining > 1 ? 's' : ''} still to go.`, 'info');
      }
      return;
    }

    // There is a wrong step
    const wrongStep = workflow[firstWrongIndex];
    if (revealHint) {
      const hintLevels = wrongStep.hints?.length ?? 1;
      const current = state.revealedHints[wrongStep.id] || 0;
      if (current < hintLevels) {
        state.revealedHints[wrongStep.id] = current + 1;
        state.justRevealedHintFor = wrongStep.id;
      }
    }
    render();
    state.justRevealedHintFor = null;
    if (revealHint) {
      setFeedback('Hint added to the incorrect step.', 'info');
    } else {
      setFeedback('One step needs attention — check the highlighted field.', 'error');
    }
    setTimeout(() => pulseStep(wrongStep.id), 50);
  }

  function checkAnswers() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'final') {
      checkFinalAnswer();
    } else {
      evaluateGuidedSteps(false);
    }
  }

  function showHint() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'guided') {
      evaluateGuidedSteps(true);
      return;
    }

    // Final answer mode: progressive hints, one per click, in workflow order
    const workflow = state.currentProblem.workflow;
    const hintsShown = state.revealedHints['final-answer'] || 0;
    if (hintsShown >= workflow.length) {
      setFeedback('All hints have been shown. Try Show Solution if you are still stuck.', 'info');
      return;
    }
    state.revealedHints['final-answer'] = hintsShown + 1;
    render();
    setFeedback(`Hint ${hintsShown + 1} of ${workflow.length} added below.`, 'info');
  }

  function solveNextStep() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'final') {
      state.revealedSteps = Math.min(state.revealedSteps + 1, state.currentProblem.steps.length);
      render();
      setFeedback('Revealed one saved factoring step.', 'info');
      return;
    }

    const nextStep = state.currentProblem.workflow.find((step) => {
      if (step.gatedBy && state.stepStatuses[step.gatedBy] !== 'correct') return false;
      if (step.inputType === 'radio') return state.stepStatuses[step.id] !== 'correct';
      if (step.inputType === 'pair') {
        return !(state.inputValues[`${step.id}-a`]?.raw) || !(state.inputValues[`${step.id}-b`]?.raw);
      }
      return !(state.inputValues[step.id]?.raw);
    });
    if (!nextStep) {
      setFeedback('All guided fields are already filled.', 'info');
      return;
    }

    if (nextStep.inputType === 'radio') {
      // Auto-answer radio step with the correct option
      const correctOpt = nextStep.options.find(o => o.value === nextStep.expected);
      state.inputValues[nextStep.id] = { raw: nextStep.expected, display: correctOpt?.label || nextStep.expected };
      state.stepStatuses[nextStep.id] = 'correct';
    } else if (nextStep.inputType === 'pair') {
      const [valA, valB] = nextStep.expected.split(',').map(s => s.trim());
      state.inputValues[`${nextStep.id}-a`] = { raw: valA, display: rawToPretty(valA) };
      state.inputValues[`${nextStep.id}-b`] = { raw: valB, display: rawToPretty(valB) };
      state.pairFieldStatuses[`${nextStep.id}-a`] = 'correct';
      state.pairFieldStatuses[`${nextStep.id}-b`] = 'correct';
    } else {
      state.inputValues[nextStep.id] = { raw: nextStep.expected, display: rawToPretty(nextStep.expected) };
    }
    state.stepStatuses[nextStep.id] = 'correct';
    render();
    setFeedback(`Filled: ${nextStep.label}.`, 'info');
  }

  function showFullSolution() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    state.currentProblem.workflow.forEach((step) => {
      if (step.inputType === 'radio') {
        const correctOpt = step.options?.find(o => o.value === step.expected);
        state.inputValues[step.id] = { raw: step.expected, display: correctOpt?.label || step.expected };
      } else if (step.inputType === 'pair') {
        const [valA, valB] = step.expected.split(',').map(s => s.trim());
        state.inputValues[`${step.id}-a`] = { raw: valA, display: rawToPretty(valA) };
        state.inputValues[`${step.id}-b`] = { raw: valB, display: rawToPretty(valB) };
        state.pairFieldStatuses[`${step.id}-a`] = 'correct';
        state.pairFieldStatuses[`${step.id}-b`] = 'correct';
      } else {
        state.inputValues[step.id] = { raw: step.expected, display: rawToPretty(step.expected) };
      }
      state.stepStatuses[step.id] = 'correct';
    });

    if (state.settings.mode === 'final') {
      state.inputValues['final-answer'] = {
        raw: state.currentProblem.answer,
        display: rawToPretty(state.currentProblem.answer)
      };
    }

    state.revealedSteps = state.currentProblem.steps.length;
    render();
    setFeedback('Full solution revealed.', 'info');
  }

  function render() {
    renderProblem(state, elements);
    renderWorkArea(state, elements, render);
    renderFeedback(state, elements);
    renderKeypad(state, elements, (value) => insertIntoActiveInput(state, value, { render, setFeedback }));
    renderKeypadStatus(state, elements);
    renderStepsOutput(state, elements);
    if (elements.copyLinkBtn) {
      elements.copyLinkBtn.style.display = state.currentProblem ? 'inline-block' : 'none';
    }
  }

  elements.methodSelect.addEventListener('change', (event) => {
    state.settings.method = event.target.value;
  });

  elements.difficultySelect.addEventListener('change', (event) => {
    state.settings.difficulty = event.target.value;
  });

  elements.modeSelect.addEventListener('change', (event) => {
    state.settings.mode = event.target.value;
    state.activeInputId = null;
    render();
  });

  elements.generateBtn.addEventListener('click', () => generateNewProblem());
  elements.dockCheckBtn.addEventListener('click', checkAnswers);
  elements.dockHintBtn.addEventListener('click', showHint);
  elements.dockSolveBtn.addEventListener('click', solveNextStep);
  elements.dockShowSolutionBtn.addEventListener('click', showFullSolution);
  elements.copyLinkBtn.addEventListener('click', copyLink);

  readUrlParams() || render();
})();