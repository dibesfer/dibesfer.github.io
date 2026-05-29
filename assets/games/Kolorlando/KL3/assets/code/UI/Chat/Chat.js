export class Chat {
    constructor(options = {}) {
        this.chatBoxElement = options.chatBoxElement ?? document.querySelector("#chatBox");
        this.chatInputElement = options.chatInputElement ?? document.querySelector("#chatInput");
        this.commands = options.commands ?? null;

        this.author = options.author ?? "Anon";
        this.maxChars = options.maxChars ?? 150;

        this.onOpen = options.onOpen ?? null;
        this.onClose = options.onClose ?? null;

        this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
    }

    start() {
        this.hideInput();
        this.scrollDownNextFrame();

        this.chatInputElement?.addEventListener("keydown", this.handleInputKeyDown);
    }

    stop() {
        this.chatInputElement?.removeEventListener("keydown", this.handleInputKeyDown);
    }

    setCommands(commands) {
        this.commands = commands ?? null;
    }

    open(prefix = "") {
        if (!this.chatInputElement) return;

        this.showInput();

        this.chatInputElement.value = prefix;
        this.chatInputElement.focus();
        this.chatInputElement.setSelectionRange(
            this.chatInputElement.value.length,
            this.chatInputElement.value.length
        );

        this.onOpen?.();
    }

    close() {
        if (!this.chatInputElement) return;

        this.chatInputElement.value = "";
        this.chatInputElement.blur();
        this.hideInput();

        this.onClose?.();
    }

    showInput() {
        if (!this.chatInputElement) return;

        this.chatInputElement.style.display = "block";
    }

    hideInput() {
        if (!this.chatInputElement) return;

        this.chatInputElement.style.display = "none";
    }

    isOpen() {
        if (!this.chatInputElement) return false;

        return this.chatInputElement.style.display !== "none";
    }

    handleInputKeyDown(event) {
        if (event.key !== "Enter") return;

        event.preventDefault();
        event.stopPropagation();

        this.submit();
    }

    submit() {
        const message = this.readMessage();

        if (this.isEmptyMessage(message)) {
            this.close();
            return;
        }

        if (message.startsWith("/")) {
            this.commands?.handle(message);
            this.close();
            return;
        }

        this.appendMessage(message);
        this.close();
    }

    readMessage() {
        if (!this.chatInputElement) return "";

        return this.chatInputElement.value.trim().slice(0, this.maxChars);
    }

    isEmptyMessage(message = "") {
        return message === "" || message === "/";
    }

    appendMessage(message = "") {
        if (!this.chatBoxElement) return;

        const line = document.createElement("p");
        line.textContent = `${this.getTimeText()} ${this.author}: ${message}`;

        this.chatBoxElement.appendChild(line);
        this.scrollDownNextFrame();
    }

    getTimeText(date = new Date()) {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${hours}:${minutes}`;
    }

    scrollDown() {
        if (!this.chatBoxElement) return;

        this.chatBoxElement.scrollTop = this.chatBoxElement.scrollHeight;
    }

    scrollDownNextFrame() {
        requestAnimationFrame(() => {
            this.scrollDown();
        });
    }
}

export default Chat;
