window.Renderer = (() => {
  const { rawToPretty, rawToPrettyHtml } = window.Utils;
  const { ensureInputRecord, keypadButtons, selectInput } = window.InputController;

  function renderFeedback(state, elements) {
    elements.feedbackBox.className = `feedback ${state.feedback.type}`;
    elements.feedbackBox.textContent = state.feedback.message;
  }

  function renderProblem(state, elements) {
    if (!state.currentProblem) {
      elements.problemDisplay.textContent = 'Press Generate Problem';
      return;
    }
    elements.problemDisplay.innerHTML = rawToPrettyHtml(state.currentProblem.expression);
  }

  function renderWorkArea(state, elements, render) {
    const container = elements.workArea;
    container.innerHTML = '';
    if (!state.currentProblem) return;

    if (state.settings.mode === 'final') {
      ensureInputRecord(state, 'final-answer');
      const record = state.inputValues['final-answer'];

      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<p class="subtle">Enter the full factored form:</p>';

      const display = document.createElement('div');
      const classes = ['input-display'];
      if (state.activeInputId === 'final-answer') classes.push('active');
      if (!record.display) classes.push('placeholder');
      display.className = classes.join(' ');
      if (record.display) {
        display.innerHTML = rawToPrettyHtml(record.display);
      } else {
        display.textContent = 'Tap here to type your answer';
      }
      display.addEventListener('click', () => selectInput(state, 'final-answer', render));

      wrapper.appendChild(display);

      // Progressive hints for final answer mode
      const hintsShown = state.revealedHints?.['final-answer'] || 0;
      if (hintsShown > 0) {
        const hintList = document.createElement('div');
        hintList.className = 'hint-list';
        state.currentProblem.workflow.slice(0, hintsShown).forEach((hintStep) => {
          const hintEl = document.createElement('div');
          hintEl.className = 'step-hint';
          hintEl.innerHTML = `💡 ${rawToPrettyHtml(hintStep.hint)}`;
          hintList.appendChild(hintEl);
        });
        wrapper.appendChild(hintList);
      }

      container.appendChild(wrapper);
      return;
    }

    const list = document.createElement('div');
    list.className = 'guided-list';

    state.currentProblem.workflow.forEach((step) => {
      ensureInputRecord(state, step.id);
      const record = state.inputValues[step.id];
      const status = state.stepStatuses[step.id];

      const item = document.createElement('div');
      item.className = 'guided-step';
      item.dataset.stepId = step.id;
      if (status === 'correct') item.classList.add('correct');
      if (status === 'incorrect') item.classList.add('incorrect');
      if (status === 'downstream') item.classList.add('downstream');

      const label = document.createElement('div');
      label.className = 'step-label';
      label.textContent = step.label;

      // Pair steps get two side-by-side input fields, each independently focusable
      if (step.inputType === 'pair') {
        const pairWrap = document.createElement('div');
        pairWrap.className = 'pair-input-wrap';

        ['a', 'b'].forEach((slot) => {
          const subId = `${step.id}-${slot}`;
          ensureInputRecord(state, subId);
          const subRecord = state.inputValues[subId];
          const subStatus = state.pairFieldStatuses?.[subId];

          const field = document.createElement('div');
          const classes = ['input-display', 'pair-field'];
          if (state.activeInputId === subId) classes.push('active');
          if (!subRecord.display) classes.push('placeholder');
          if (subStatus === 'correct')   classes.push('correct');
          if (subStatus === 'incorrect') classes.push('incorrect');
          field.className = classes.join(' ');
          if (subRecord.display) {
            field.innerHTML = rawToPrettyHtml(subRecord.display);
          } else {
            field.textContent = slot === 'a' ? 'First' : 'Second';
          }
          field.addEventListener('click', () => selectInput(state, subId, render));
          pairWrap.appendChild(field);
        });

        item.appendChild(label);
        item.appendChild(pairWrap);
      } else {
        const display = document.createElement('div');
        const classes = ['input-display'];
        if (state.activeInputId === step.id) classes.push('active');
        if (!record.display) classes.push('placeholder');
        display.className = classes.join(' ');
        if (record.display) {
          display.innerHTML = rawToPrettyHtml(record.display);
        } else {
          display.textContent = 'Tap here to type';
        }
        display.addEventListener('click', () => selectInput(state, step.id, render));

        item.appendChild(label);
        item.appendChild(display);
      }

      // Inline hint, shown only after student requests it
      if (state.revealedHints?.[step.id]) {
        const hintEl = document.createElement('div');
        hintEl.className = 'step-hint';
        hintEl.innerHTML = `💡 ${rawToPrettyHtml(step.hint)}`;
        item.appendChild(hintEl);
      }

      list.appendChild(item);
    });

    container.appendChild(list);
  }

  function renderKeypad(state, elements, onPress) {
    elements.keypadGrid.innerHTML = '';

    keypadButtons.forEach((buttonInfo) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = buttonInfo.label;
      if (buttonInfo.className) button.className = buttonInfo.className;
      if (buttonInfo.disabled) { button.disabled = true; return elements.keypadGrid.appendChild(button); }
      button.addEventListener('click', () => onPress(buttonInfo.value));
      elements.keypadGrid.appendChild(button);
    });
  }

  function renderKeypadStatus(state, elements) {
    if (!state.activeInputId) {
      elements.keypadStatus.textContent = 'Tap an answer field, then use the keypad.';
      return;
    }
    // Friendly label for pair sub-fields
    let label = state.activeInputId;
    if (state.activeInputId.endsWith('-a')) label = 'first number';
    if (state.activeInputId.endsWith('-b')) label = 'second number';
    elements.keypadStatus.textContent = `Typing into: ${label}`;
  }

  function renderStepsOutput(state, elements) {
    const container = elements.stepsOutput;
    container.innerHTML = '';

    if (!state.currentProblem) {
      container.innerHTML = '<p class="subtle">The saved factoring steps will appear here when requested.</p>';
      return;
    }

    const stepsToShow = state.revealedSteps;
    if (stepsToShow === 0) {
      container.innerHTML = '<p class="subtle">No steps revealed yet.</p>';
      return;
    }

    state.currentProblem.steps.slice(0, stepsToShow).forEach((step, index) => {
      const div = document.createElement('div');
      div.className = 'solution-step';
      div.innerHTML = `
        <strong>Step ${index + 1}: ${step.rule.replaceAll('_', ' ')}</strong>
        <div>${rawToPretty(step.expression)} → ${rawToPretty(step.output)}</div>
        <div style="margin-top:6px; color: var(--muted);">${rawToPretty(step.explanation)}</div>
      `;
      container.appendChild(div);
    });
  }

  return {
    renderFeedback,
    renderKeypad,
    renderKeypadStatus,
    renderProblem,
    renderStepsOutput,
    renderWorkArea
  };
})();