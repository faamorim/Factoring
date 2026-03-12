window.InputController = (() => {
  const { rawToPretty } = window.Utils;

  const keypadButtons = [
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '⌫', value: 'backspace', className: 'key-special' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: 'Clear', value: 'clear', className: 'key-special' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: 'exp', value: 'exp', className: 'key-special key-exp' },
    { label: '0', value: '0' },
    { label: 'x', value: 'x' },
    { label: '+', value: '+' },
    { label: '−', value: '-' },
    { label: '(', value: '(' },
    { label: ')', value: ')' }
  ];

  function ensureInputRecord(state, id) {
    if (!state.inputValues[id]) {
      state.inputValues[id] = { raw: '', display: '' };
    }
  }

  function syncDisplay(state, id) {
    ensureInputRecord(state, id);
    state.inputValues[id].display = rawToPretty(state.inputValues[id].raw);
  }

  function canUseExponentAfter(raw) {
    return /x$/.test(raw);
  }

  function selectInput(state, id, render) {
    state.activeInputId = id;
    render();
  }

  function insertIntoActiveInput(state, value, callbacks) {
    const { render, setFeedback } = callbacks;

    if (!state.activeInputId) {
      setFeedback('Tap an answer field first.', 'error');
      return;
    }

    ensureInputRecord(state, state.activeInputId);
    const record = state.inputValues[state.activeInputId];

    if (value === 'clear') {
      record.raw = '';
      state.exponentMode = false;
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    if (value === 'backspace') {
      if (/\^[0-9]$/.test(record.raw)) {
        record.raw = record.raw.slice(0, -2);
      } else {
        record.raw = record.raw.slice(0, -1);
      }
      state.exponentMode = false;
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    if (value === 'exp') {
      if (!canUseExponentAfter(record.raw)) {
        setFeedback('Exponent can only be added right after a variable.', 'error');
        return;
      }
      state.exponentMode = !state.exponentMode;
      render();
      return;
    }

    if (state.exponentMode) {
      if (!/^[0-9]$/.test(value)) return;
      record.raw += `^${value}`;
      state.exponentMode = false;
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    record.raw += value;
    syncDisplay(state, state.activeInputId);
    render();
  }

  return {
    ensureInputRecord,
    insertIntoActiveInput,
    keypadButtons,
    selectInput,
    syncDisplay
  };
})();
