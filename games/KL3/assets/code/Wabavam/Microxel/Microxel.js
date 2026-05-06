export class Microxel {
    constructor(options = {}) {
        this.color = options.color ?? "#ffffff";
        this.active = options.active ?? true;
    }

    clone() {
        return new Microxel({
            color: this.color,
            active: this.active,
        });
    }
}

export default Microxel;
