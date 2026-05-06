export class Voxel {
    constructor(options = {}) {
        this.name = options.name ?? "Voxel";
        this.color = options.color ?? "#ffffff";
        this.active = options.active ?? true;
        this.microxels = options.microxels ?? null;
    }

    clone() {
        return new Voxel({
            name: this.name,
            color: this.color,
            active: this.active,
            microxels: this.microxels,
        });
    }

    isActive() {
        return this.active === true;
    }

    hasMicroxels() {
        return Array.isArray(this.microxels);
    }
}

export default Voxel;
