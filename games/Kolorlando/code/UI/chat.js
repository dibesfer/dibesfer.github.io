export function createChatUI(options) {
  const chatBox = options.chatBox;
  const chatBoxOutput = options.chatBoxOutput;
  const chatBoxInput = options.chatBoxInput;
  const onCommand = options.onCommand;
  const onShow = options.onShow;
  const onHide = options.onHide;

  function setElementHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function scrollToBottom() {
    if (!chatBoxOutput) return;
    chatBoxOutput.scrollTop = chatBoxOutput.scrollHeight;
  }

  function appendLine(message, speaker = 'System') {
    if (!chatBoxOutput) return;
    const line = document.createElement('div');
    line.textContent = `${speaker}: ${message}`;
    chatBoxOutput.appendChild(line);
    scrollToBottom();
  }

  function showInput() {
    if (!chatBoxInput) return;
    onShow?.();
    setElementHidden(chatBoxInput, false);
    chatBox?.classList.add('backgrounded');
    chatBoxInput.focus();
    chatBoxInput.select();
  }

  function hideInput() {
    if (!chatBoxInput) return;
    setElementHidden(chatBoxInput, true);
    chatBox?.classList.remove('backgrounded');
    chatBoxInput.blur();
    // Pointer-lock recovery and similar hide-side effects need the input to be
    // fully hidden and unfocused first, otherwise browsers may reject the
    // gameplay relock because the text field still owns the active focus state.
    onHide?.();
  }

  function submitInput() {
    if (!chatBoxInput || !chatBoxOutput) return false;
    const message = chatBoxInput.value.trim();
    if (!message) return false;

    if (onCommand?.(message)) {
      chatBoxInput.value = '';
      hideInput();
      scrollToBottom();
      return true;
    }

    const line = document.createElement('div');
    line.textContent = `You: ${message}`;
    chatBoxOutput.appendChild(line);
    chatBoxInput.value = '';
    hideInput();
    scrollToBottom();
    return true;
  }

  function handleAction() {
    if (!chatBoxInput) return false;
    if (chatBoxInput.hidden) {
      showInput();
      return true;
    }

    return submitInput();
  }

  function handleToggleAction() {
    if (!chatBoxInput) return false;
    if (chatBoxInput.hidden) {
      showInput();
      return true;
    }

    if (!chatBoxInput.value.trim()) {
      hideInput();
      return true;
    }

    return submitInput();
  }

  if (chatBoxInput) {
    chatBoxInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      handleAction();
    });
  }

  return {
    appendLine,
    handleAction,
    handleToggleAction,
    hideInput,
    isInputOpen() {
      return Boolean(chatBoxInput && !chatBoxInput.hidden);
    },
    scrollToBottom,
    showInput,
  };
}
