import { Boxel } from "/assets/code/Wabavam/Boxel/Boxel.js";

export class Boxel15 extends Boxel {
    static size = 15;

    constructor(options = {}) {
        super({
            ...options,
            name: options.name ?? "Boxel15",
            size: {
                x: 15,
                y: 15,
                z: 15,
            },
        });
    }
}

export default Boxel15;
