import Chat from "./Chat.js";

export class Commands extends Chat {
    constructor(chatElement, inputElement, limit = 150) {
        super(chatElement, inputElement, limit);
        this.commands = new Map([
            ["/boxel", message => this.runBoxelCommand(message)],
            ["/noclip", () => this.emitCommand("noclip")],
            ["/spawn", () => this.emitCommand("spawn")],
            ["/teleport", message => this.runTeleportCommand(message)]
        ]);
        this.onCommandResult = this.onCommandResult.bind(this);
    }

    start(input) {
        super.start(input);
        this.input?.on("commandResult", this.onCommandResult);
    }

    stop() {
        this.input?.off("commandResult", this.onCommandResult);
        super.stop();
    }

    onKeyDown(event) {
        if (event.key === "/" && document.activeElement !== this.inputElement && !event.repeat) {
            event.preventDefault();
            this.showCommandInput();
            return;
        }

        super.onKeyDown(event);
    }

    submit() {
        const message = this.inputElement.value.trim();
        if (!message) {
            this.hideInput();
            return;
        }

        if (this.runCommand(message)) {
            this.inputElement.value = "";
            this.hideInput();
            return;
        }

        super.submit();
    }

    runCommand(message) {
        const [name] = message.toLowerCase().split(/\s+/);
        const command = this.commands.get(name);

        if (!command) return false;

        command(message);
        return true;
    }

    runBoxelCommand(message) {
        const [, action, ...nameParts] = message.split(/\s+/);

        if (!["load", "save"].includes(action?.toLowerCase()) || nameParts.length === 0) {
            this.appendMessage("System: usage /boxel save Name or /boxel load Name");
            return;
        }

        this.emitCommand(`boxel.${action.toLowerCase()}`, { boxelName: nameParts.join(" ") });
    }

    runTeleportCommand(message) {
        const [, x, y, z, ...extra] = message.split(/\s+/);
        const position = [x, y, z].map(value => this.floorCoordinate(value));

        if (extra.length > 0 || position.some(value => value === null)) {
            this.appendMessage("System: usage /teleport 7.55 60 -18.22");
            return;
        }

        this.emitCommand("teleport", {
            x: position[0],
            y: position[1],
            z: position[2]
        });
    }

    floorCoordinate(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) return null;

        return Math.floor(number * 100) / 100;
    }

    emitCommand(name, data = {}) {
        this.input?.emit("command", { name, ...data });
    }

    onCommandResult(result = {}) {
        if (!result.message) return;

        this.appendMessage(`System: ${result.message}`);
    }

    showCommandInput() {
        this.showInput();
        this.inputElement.value = "/";
    }
}

export default Commands;

