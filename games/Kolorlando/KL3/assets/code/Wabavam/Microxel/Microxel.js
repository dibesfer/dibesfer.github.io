export class Microxel {
    constructor(options = {}) {
        const sourcePosition = this.normalizePosition(options.position ?? options);

        this.x = sourcePosition.x;
        this.y = sourcePosition.y;
        this.z = sourcePosition.z;
        this.position = { x: this.x, y: this.y, z: this.z };
        this.color = this.normalizeText(options.color, "#ffffff");
        this.active = Boolean(options.active ?? options.filled ?? true);
        this.filled = this.active;
    }

    setPosition(x = 0, y = 0, z = 0) {
        this.x = this.toFiniteNumber(x, 0);
        this.y = this.toFiniteNumber(y, 0);
        this.z = this.toFiniteNumber(z, 0);
        this.position = { x: this.x, y: this.y, z: this.z };

        return this;
    }

    setColor(color = "#ffffff") {
        this.color = this.normalizeText(color, this.color);

        return this;
    }

    destroy() {
        this.active = false;
        this.filled = false;

        return this;
    }

    revive() {
        this.active = true;
        this.filled = true;

        return this;
    }

    clone() {
        return new Microxel(this.toMemoryData());
    }

    toJSON() {
        return this.toMemoryData();
    }

    toMemoryData() {
        return {
            position: { ...this.position },
            color: this.color,
            active: this.active,
        };
    }

    normalizePosition(position = {}) {
        return {
            x: this.toFiniteNumber(position.x, 0),
            y: this.toFiniteNumber(position.y, 0),
            z: this.toFiniteNumber(position.z, 0),
        };
    }

    toFiniteNumber(value, fallback = 0) {
        const number = Number(value);

        return Number.isFinite(number) ? number : fallback;
    }

    normalizeText(value, fallback = "") {
        if (typeof value !== "string") return fallback;

        const trimmed = value.trim();

        return trimmed || fallback;
    }
}

export default Microxel;