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
      difficulty: 'easy',
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
    stepStatuses: {}
  };

  const elements = {
    methodSelect: document.getElementById('methodSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    modeSelect: document.getElementById('modeSelect'),
    generateBtn: document.getElementById('generateBtn'),
    problemDisplay: document.getElementById('problemDisplay'),
    workArea: document.getElementById('workArea'),
    checkBtn: document.getElementById('checkBtn'),
    hintBtn: document.getElementById('hintBtn'),
    solveStepBtn: document.getElementById('solveStepBtn'),
    showSolutionBtn: document.getElementById('showSolutionBtn'),
    feedbackBox: document.getElementById('feedbackBox'),
    keypadStatus: document.getElementById('keypadStatus'),
    keypadGrid: document.getElementById('keypadGrid'),
    stepsOutput: document.getElementById('stepsOutput')
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
    setFeedback('New problem generated.', 'info');
    render();
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

  function checkGuidedAnswers() {
    let allCorrect = true;

    state.currentProblem.workflow.forEach((step) => {
      const record = state.inputValues[step.id];
      const raw = record?.raw || '';
      const correct = raw.trim() !== '' && compareAnswers(raw, step.expected);
      state.stepStatuses[step.id] = raw.trim() === '' ? 'empty' : (correct ? 'correct' : 'incorrect');
      if (!correct) allCorrect = false;
    });

    render();
    setFeedback(allCorrect ? 'Excellent. Every guided step is correct.' : 'Some steps are still incorrect or blank.', allCorrect ? 'success' : 'error');
  }

  function checkAnswers() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }

    if (state.settings.mode === 'final') {
      checkFinalAnswer();
    } else {
      checkGuidedAnswers();
    }
  }

  function showHint() {
    if (!state.currentProblem) {
      setFeedback('Generate a problem first.', 'error');
      return;
    }
    const firstUnfilled = state.currentProblem.workflow.find((step) => !(state.inputValues[step.id]?.raw));
    const hintStep = firstUnfilled || state.currentProblem.workflow[0];
    setFeedback(`Hint: ${hintStep.label}.`, 'info');
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
  elements.checkBtn.addEventListener('click', checkAnswers);
  elements.hintBtn.addEventListener('click', showHint);
  elements.solveStepBtn.addEventListener('click', solveNextStep);
  elements.showSolutionBtn.addEventListener('click', showFullSolution);

  render();
})();
