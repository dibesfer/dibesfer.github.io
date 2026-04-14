import { Microxel } from "./microxel.js";

export class Voxel {
  constructor(x = 0, y = 0, z = 0) {

    // 📍 position
    this.x = x;
    this.y = y;
    this.z = z;

    // ===== VISUAL (auto-detected by presence) =====
    this.color = null;
    this.texture = null;

    // 🧩 composed data (if exists → overrides simple rendering)
    this.microxels = null;

    // 🧱 state
    this.active = true;
  }

  // =========================
  // 📍 POSITION
  // =========================
  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // =========================
  // 🎨 SIMPLE VISUAL
  // =========================
  setColor(color) {
    this.color = color;
    this.texture = null;
    this.microxels = null; // optional: force simple mode
  }

  setTexture(texture) {
    this.texture = texture;
    this.color = null;
    this.microxels = null; // texture overrides everything
  }

  // =========================
  // 🧩 COMPOSED MODE
  // =========================
  addMicroxel(microxel) {
    if (!this.microxels) this.microxels = [];

    this.color = null;
    this.texture = null;

    this.microxels.push(microxel);
  }

  setMicroxels(microxelsArray) {
    this.microxels = microxelsArray;

    this.color = null;
    this.texture = null;
  }

  clearMicroxels() {
    this.microxels = null;
  }

  // =========================
  // 🧠 TYPE RESOLUTION (engine logic)
  // =========================
  getType() {
    if (this.microxels && this.microxels.length > 0) return "composed";
    if (this.texture) return "textured";
    if (this.color) return "colored";
    return "empty";
  }

  // =========================
  // 🧠 STATE
  // =========================
  destroy() {
    this.active = false;
  }

  revive() {
    this.active = true;
  }
}