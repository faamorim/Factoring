(() => {
  const { normalizeRaw, rawToPretty } = window.Utils;
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
    exponentMode: false,
    feedback: {
      message: 'Generate a problem to start.',
      type: 'info'
    },
    revealedSteps: 0,
    stepStatuses: {},
    revealedHints: {}
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
    dockShowSolutionBtn: document.getElementById('dockShowSolutionBtn')
  };

  function setFeedback(message, type = 'info') {
    state.feedback = { message, type };
    renderFeedback(state, elements);
  }

  function compareAnswers(studentRaw, expectedRaw) {
    return normalizeRaw(studentRaw) === normalizeRaw(expectedRaw);
  }

  function generateNewProblem() {
    state.currentProblem = generateProblem(state.settings);
    state.inputValues = {};
    state.activeInputId = null;
    state.exponentMode = false;
    state.revealedSteps = 0;
    state.stepStatuses = {};
    state.revealedHints = {};
    setFeedback('New problem generated.', 'info');
    render();
    setTimeout(() => {
      const el = document.getElementById('problemDisplay');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
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

  function evaluateGuidedSteps(revealHint) {
    const workflow = state.currentProblem.workflow;
    let firstWrongIndex = -1;

    // Pass 1: find the first filled+wrong step
    workflow.forEach((step, index) => {
      const raw = state.inputValues[step.id]?.raw || '';
      if (raw.trim() !== '' && !compareAnswers(raw, step.expected)) {
        if (firstWrongIndex === -1) firstWrongIndex = index;
      }
    });

    // Pass 2: assign statuses
    workflow.forEach((step, index) => {
      const raw = state.inputValues[step.id]?.raw || '';
      const filled = raw.trim() !== '';

      if (!filled) {
        state.stepStatuses[step.id] = 'empty';
        return;
      }

      if (firstWrongIndex === -1) {
        // No wrong steps — everything filled is correct
        state.stepStatuses[step.id] = 'correct';
      } else if (index < firstWrongIndex) {
        state.stepStatuses[step.id] = 'correct';
      } else if (index === firstWrongIndex) {
        state.stepStatuses[step.id] = 'incorrect';
      } else {
        // Filled steps after the first wrong one are downstream casualties
        state.stepStatuses[step.id] = 'downstream';
      }
    });

    const blankSteps = workflow.filter((step) => !(state.inputValues[step.id]?.raw?.trim()));
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
        state.revealedHints[firstBlank.id] = true;
        render();
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
      state.revealedHints[wrongStep.id] = true;
    }
    render();
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

    const nextStep = state.currentProblem.workflow.find((step) => !(state.inputValues[step.id]?.raw));
    if (!nextStep) {
      setFeedback('All guided fields are already filled.', 'info');
      return;
    }

    state.inputValues[nextStep.id] = {
      raw: nextStep.expected,
      display: rawToPretty(nextStep.expected)
    };
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
      state.inputValues[step.id] = {
        raw: step.expected,
        display: rawToPretty(step.expected)
      };
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
    state.exponentMode = false;
    render();
  });

  elements.generateBtn.addEventListener('click', generateNewProblem);
  elements.dockCheckBtn.addEventListener('click', checkAnswers);
  elements.dockHintBtn.addEventListener('click', showHint);
  elements.dockSolveBtn.addEventListener('click', solveNextStep);
  elements.dockShowSolutionBtn.addEventListener('click', showFullSolution);

  render();
})();
