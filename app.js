(() => {
  const { compareFactored, normalizeRaw, rawToPretty, generateSeed, setSeed, clearSeed } = window.Utils;
  const { generateProblem } = window.Generators;
  const { insertIntoActiveInput, selectInput } = window.InputController;
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

  // Evaluates the full guided workflow in a single pass.
  // Returns a result object — does NOT modify state.
  // Statuses: 'correct' | 'incorrect' | 'empty' | 'partial' | 'downstream' | 'locked'
  // - partial: pair step with only one field filled
  // - downstream: filled but after the first wrong step (may be wrong for unrelated reasons)
  // firstNeedsAttention: first step in workflow order that is not 'correct' or 'locked'
  // shouldRedirect: true when firstNeedsAttention is wrong (not empty/partial) and not active
  function evaluateWorkflow() {
    const workflow = state.currentProblem?.workflow;
    if (!workflow) return null;

    const stepStatuses = {};
    const pairFieldStatuses = {};
    let firstWrong = null;
    let firstNeedsAttention = null;

    workflow.forEach((step) => {
      // Locked steps — gating step not yet correct
      if (step.gatedBy && (stepStatuses[step.gatedBy] ?? state.stepStatuses[step.gatedBy]) !== 'correct') {
        stepStatuses[step.id] = 'locked';

      // Radio steps — status managed on click
      } else if (step.inputType === 'radio') {
        stepStatuses[step.id] = state.stepStatuses[step.id] ?? 'empty';

      // Pair steps
      } else if (step.inputType === 'pair') {
        const { stepCorrect, fieldStatuses } = checkPairStep(step);
        Object.assign(pairFieldStatuses, fieldStatuses);
        const rawA = state.inputValues[`${step.id}-a`]?.raw?.trim();
        const rawB = state.inputValues[`${step.id}-b`]?.raw?.trim();
        const partial = (!!rawA) !== (!!rawB); // exactly one filled

        if (!rawA && !rawB)   stepStatuses[step.id] = 'empty';
        else if (partial)     stepStatuses[step.id] = 'partial';
        else if (firstWrong)  stepStatuses[step.id] = 'downstream';
        else if (stepCorrect) stepStatuses[step.id] = 'correct';
        else                  stepStatuses[step.id] = 'incorrect';

      // Standard text input
      } else {
        const raw = state.inputValues[step.id]?.raw?.trim() || '';
        if (!raw)                                    stepStatuses[step.id] = 'empty';
        else if (firstWrong)                         stepStatuses[step.id] = 'downstream';
        else if (compareAnswers(raw, step.expected)) stepStatuses[step.id] = 'correct';
        else                                         stepStatuses[step.id] = 'incorrect';
      }

      // Track first wrong step
      if (stepStatuses[step.id] === 'incorrect') {
        firstWrong = firstWrong ?? step;
      }

      // Track first step needing attention — any non-correct, non-locked step
      if (stepStatuses[step.id] !== 'correct' && stepStatuses[step.id] !== 'locked' && !firstNeedsAttention) {
        firstNeedsAttention = step;
      }
    });

    const allCorrect = Object.values(stepStatuses).every(s => s === 'correct' || s === 'locked');
    const shouldRedirect = firstWrong !== null &&
      firstWrong === firstNeedsAttention &&
      !stepIsActive(firstWrong);

    return { stepStatuses, pairFieldStatuses, firstWrong, firstNeedsAttention, allCorrect, shouldRedirect };
  }

  // Returns true if the given step is the currently active input.
  function stepIsActive(step) {
    return state.activeInputId === step.id ||
      state.activeInputId === `${step.id}-a` ||
      state.activeInputId === `${step.id}-b`;
  }

  // Commits evaluated statuses to state and triggers a render.
  function commitAndRender(result) {
    Object.assign(state.stepStatuses, result.stepStatuses);
    Object.assign(state.pairFieldStatuses, result.pairFieldStatuses);
    render();
  }

  // Redirects attention to the first step needing attention.
  function redirectToStep(step) {
    const inputId = step.inputType === 'pair' ? `${step.id}-a` : step.id;
    selectInput(state, inputId, render);
    setFeedback('There is an error in an earlier step — it has been highlighted.', 'error');
    setTimeout(() => pulseStep(step.id), 50);
  }

  function checkAnswers() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'final') {
      checkFinalAnswer();
      return;
    }

    const result = evaluateWorkflow();
    if (!result) return;
    commitAndRender(result);

    if (result.allCorrect) {
      setFeedback('Excellent! Every step is correct.', 'success');
      return;
    }

    const target = result.firstNeedsAttention;
    if (!target) return;
    const isWrong = result.firstWrong !== null;
    selectInput(state, target.inputType === 'pair' ? `${target.id}-a` : target.id, render);
    setFeedback(isWrong ? 'One step needs attention — check the highlighted field.' : 'Looking good so far — keep going!', isWrong ? 'error' : 'info');
    setTimeout(() => pulseStep(target.id), 50);
  }

  function showHint() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'final') {
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
      return;
    }

    const result = evaluateWorkflow();
    if (!result) return;
    commitAndRender(result);

    if (result.allCorrect) {
      setFeedback('Excellent! Every step is correct.', 'success');
      return;
    }

    const target = result.firstNeedsAttention;
    if (!target) return;

    if (result.shouldRedirect) {
      redirectToStep(result.firstWrong);
      return;
    }

    // Reveal/progress hint on target step
    const hintLevels = target.hints?.length ?? 1;
    const current = state.revealedHints[target.id] || 0;
    if (current < hintLevels) {
      state.revealedHints[target.id] = current + 1;
      state.justRevealedHintFor = target.id;
    }
    render();
    state.justRevealedHintFor = null;
    const isWrong = result.stepStatuses[target.id] === 'incorrect';
    selectInput(state, target.inputType === 'pair' ? `${target.id}-a` : target.id, render);
    setFeedback(isWrong ? 'Hint added to the incorrect step.' : 'Looking good so far! Hint added to the next step.', 'info');
    setTimeout(() => pulseStep(target.id), 50);
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

    const result = evaluateWorkflow();
    if (!result) return;
    commitAndRender(result);

    if (result.allCorrect) {
      setFeedback('All guided fields are already filled.', 'info');
      return;
    }

    if (result.shouldRedirect) {
      redirectToStep(result.firstWrong);
      return;
    }

    const nextStep = result.firstNeedsAttention;
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