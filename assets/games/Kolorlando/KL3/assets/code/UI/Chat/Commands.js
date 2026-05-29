export class Commands {
    constructor(options = {}) {
        this.player = options.player ?? null;
        this.woxel = options.woxel ?? null;
        this.collision = options.collision ?? null;
    }

    setPlayer(player) {
        this.player = player ?? null;
    }

    setWoxel(woxel) {
        this.woxel = woxel ?? null;
    }

    setCollision(collision) {
        this.collision = collision ?? null;
    }

    handle(text = "") {
        const commandText = text.trim();

        if (!commandText.startsWith("/")) return false;

        const command = commandText.slice(1).split(/\s+/)[0].toLowerCase();

        if (command === "spawn") {
            this.spawn();
            return true;
        }

        if (command === "noclip") {
            this.toggleNoClip();
            return true;
        }

        if (command === "fly") {
            this.toggleFly();
            return true;
        }

        return true;
    }

    spawn() {
        if (!this.player || !this.woxel) return;

        this.player.spawnInWoxel(this.woxel);
    }

    toggleNoClip() {
        if (!this.player) return;

        this.player.toggleNoClip?.();
    }

    toggleFly() {
        if (!this.player) return;

        this.player.toggleFlightMode?.();
    }
}

export default Commands;


