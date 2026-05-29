export class Chat {
    constructor(chatElement, inputElement, limit = 150) {
        this.chatElement = chatElement;
        this.inputElement = inputElement;
        this.limit = limit;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onInput = this.onInput.bind(this);
    }

    start(input) {
        if (!this.chatElement || !this.inputElement || !input) return;

        this.input = input;
        this.inputElement.maxLength = this.limit;
        this.hideInput();
        this.scrollToBottom();
        this.input.on("keyDown", this.onKeyDown);
        this.inputElement.addEventListener("input", this.onInput);
    }

    stop() {
        this.input?.off("keyDown", this.onKeyDown);
        this.inputElement?.removeEventListener("input", this.onInput);
    }

    onKeyDown(event) {
        if (event.key !== "Enter" || event.repeat) return;

        event.preventDefault();

        if (document.activeElement !== this.inputElement) {
            this.showInput();
            return;
        }

        this.submit();
    }

    onInput() {
        if (this.inputElement.value.length <= this.limit) return;

        this.inputElement.value = this.inputElement.value.slice(0, this.limit);
    }

    submit() {
        const message = this.inputElement.value.trim();
        if (!message) {
            this.hideInput();
            return;
        }

        this.appendMessage(`Anonymous: ${message}`);
        this.inputElement.value = "";
        this.hideInput();
    }

    showInput() {
        this.inputElement.hidden = false;
        this.inputElement.focus();
    }

    hideInput() {
        this.inputElement.value = "";
        this.inputElement.blur();
        this.inputElement.hidden = true;
    }

    appendMessage(message) {
        const line = `${this.time()} ${message}`;
        this.chatElement.textContent = `${this.chatElement.textContent.trim()}\n${line}`;
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatElement.scrollTop = this.chatElement.scrollHeight;
    }

    time(date = new Date()) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }
}

export default Chat;
