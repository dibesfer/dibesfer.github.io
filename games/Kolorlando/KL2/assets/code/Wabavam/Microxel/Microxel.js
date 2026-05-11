export class Microxel {
  constructor({
    x = 0,
    y = 0,
    z = 0,
    position = null,
    color = "#ffffff",
    active = undefined,
    filled = undefined
  } = {}) {
    const sourcePosition = position && typeof position === "object" ? position : null;

    this.x = toFiniteNumber(sourcePosition?.x ?? x, 0);
    this.y = toFiniteNumber(sourcePosition?.y ?? y, 0);
    this.z = toFiniteNumber(sourcePosition?.z ?? z, 0);
    this.position = { x: this.x, y: this.y, z: this.z };
    this.color = normalizeText(color, "#ffffff");
    this.active = Boolean(active === undefined && filled !== undefined ? filled : active ?? true);
    this.filled = this.active;
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = toFiniteNumber(x, 0);
    this.y = toFiniteNumber(y, 0);
    this.z = toFiniteNumber(z, 0);
    this.position = { x: this.x, y: this.y, z: this.z };
    return this;
  }

  setColor(color = "#ffffff") {
    this.color = normalizeText(color, this.color || "#ffffff");
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
    return new Microxel({
      position: { ...this.position },
      color: this.color,
      active: this.active
    });
  }

  toJSON() {
    return {
      position: { ...this.position },
      color: this.color,
      active: this.active
    };
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

export default Microxel;
