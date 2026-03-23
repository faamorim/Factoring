window.InputController = (() => {
  const { rawToPretty } = window.Utils;

  const keypadButtons = [
    { label: '7',    value: '7' },
    { label: '8',    value: '8' },
    { label: '9',    value: '9' },
    { label: '⌫',   value: 'backspace', className: 'key-utility' },
    { label: 'Clear', value: 'clear',   className: 'key-utility' },
    { label: '4',    value: '4' },
    { label: '5',    value: '5' },
    { label: '6',    value: '6' },
    { label: '+',    value: '+',        className: 'key-operator' },
    { label: '−',    value: '-',        className: 'key-operator' },
    { label: '1',    value: '1' },
    { label: '2',    value: '2' },
    { label: '3',    value: '3' },
    { label: '(',    value: '(',        className: 'key-operator' },
    { label: ')',    value: ')',        className: 'key-operator' },
    { label: '0',    value: '0' },
    { label: 'x',    value: 'x',       className: 'key-variable' },
    { label: 'y',    value: 'y',       className: 'key-variable' },
    { label: 'exp',  value: '^',       className: 'key-exp' },
    { label: '',     value: '',        className: 'key-spacer', disabled: true }
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

  // Returns true if a caret (^) can be inserted at the end of raw.
  // Valid after: a variable (x, y), a closing parenthesis, or a digit
  // (to allow things like 2^3 even if unusual in our context).
  function canInsertCaret(raw) {
    return /[xy0-9)]$/.test(raw);
  }

  // Returns true if raw ends with a bare caret with no digit yet entered.
  // In this state only digits are valid — anything else is blocked.
  // Once a digit follows the caret the exponent is open; subsequent
  // non-digits naturally end it and are appended normally.
  function afterBareCaret(raw) {
    return raw.endsWith('^');
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
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    if (value === 'backspace') {
      record.raw = record.raw.slice(0, -1);
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    // Caret: only allowed after x, y, digit, or closing parenthesis
    if (value === '^') {
      if (!canInsertCaret(record.raw)) {
        setFeedback('Exponent can only follow a variable, digit, or closing parenthesis.', 'error');
        return;
      }
      // Prevent double caret
      if (record.raw.endsWith('^')) return;
      record.raw += '^';
      syncDisplay(state, state.activeInputId);
      render();
      return;
    }

    // Prevent non-digit immediately after a bare ^ (no digit entered yet)
    if (afterBareCaret(record.raw) && !/^[0-9]$/.test(value)) {
      setFeedback('Enter a digit for the exponent first.', 'error');
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