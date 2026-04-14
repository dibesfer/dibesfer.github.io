export class Microxel {
  constructor(color = "#ffffff") {
    // 🎨 único atributo real
    this.color = color;

    // 🧠 estado futuro (por si quieres simular destrucción parcial)
    this.active = true;
  }

  setColor(color) {
    this.color = color;
  }

  destroy() {
    this.active = false;
  }

  revive() {
    this.active = true;
  }
}