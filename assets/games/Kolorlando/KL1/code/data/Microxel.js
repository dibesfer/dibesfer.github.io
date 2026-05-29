export class Microxel {
  constructor({
    x = 0,
    y = 0,
    z = 0,
    color = '#ffffff',
    active = true,
  } = {}) {
    // Microxel stays intentionally tiny: position, color and edit state.
    this.x = Number.isFinite(Number(x)) ? Number(x) : 0;
    this.y = Number.isFinite(Number(y)) ? Number(y) : 0;
    this.z = Number.isFinite(Number(z)) ? Number(z) : 0;
    this.color = typeof color === 'string' && color.trim() ? color.trim() : '#ffffff';
    this.active = Boolean(active);
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.x = Number.isFinite(Number(x)) ? Number(x) : 0;
    this.y = Number.isFinite(Number(y)) ? Number(y) : 0;
    this.z = Number.isFinite(Number(z)) ? Number(z) : 0;
    return this;
  }

  setColor(color = '#ffffff') {
    this.color = typeof color === 'string' && color.trim() ? color.trim() : this.color;
    return this;
  }

  destroy() {
    this.active = false;
    return this;
  }

  revive() {
    this.active = true;
    return this;
  }

  clone() {
    return new Microxel({
      x: this.x,
      y: this.y,
      z: this.z,
      color: this.color,
      active: this.active,
    });
  }
}
