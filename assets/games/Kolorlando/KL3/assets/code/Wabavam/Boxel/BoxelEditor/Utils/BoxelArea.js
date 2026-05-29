export class BoxelArea {
    constructor(options = {}) {
        this.start = this.clonePosition(options.start);
        this.end = this.clonePosition(options.end ?? options.start);
    }

    static fromSingle(position) {
        if (!position) return null;

        return new BoxelArea({
            start: position,
            end: position,
        });
    }

    static fromPositions(start, end = start) {
        if (!start || !end) return null;

        return new BoxelArea({ start, end });
    }

    setEnd(position) {
        if (!position) return this;

        this.end = this.clonePosition(position);

        return this;
    }

    clonePosition(position = {}) {
        return {
            x: Math.floor(position.x ?? 0),
            y: Math.floor(position.y ?? 0),
            z: Math.floor(position.z ?? 0),
        };
    }

    getMin() {
        return {
            x: Math.min(this.start.x, this.end.x),
            y: Math.min(this.start.y, this.end.y),
            z: Math.min(this.start.z, this.end.z),
        };
    }

    getMax() {
        return {
            x: Math.max(this.start.x, this.end.x),
            y: Math.max(this.start.y, this.end.y),
            z: Math.max(this.start.z, this.end.z),
        };
    }

    getSize() {
        const min = this.getMin();
        const max = this.getMax();

        return {
            x: max.x - min.x + 1,
            y: max.y - min.y + 1,
            z: max.z - min.z + 1,
        };
    }

    clampToWoxel(woxel) {
        if (!woxel?.size) return this;

        this.start = this.clampPosition(this.start, woxel);
        this.end = this.clampPosition(this.end, woxel);

        return this;
    }

    clampPosition(position, woxel) {
        return {
            x: this.clamp(position.x, 0, woxel.size.x - 1),
            y: this.clamp(position.y, 0, woxel.size.y - 1),
            z: this.clamp(position.z, 0, woxel.size.z - 1),
        };
    }

    forEachPosition(callback) {
        const min = this.getMin();
        const max = this.getMax();

        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    callback({ x, y, z }, this);
                }
            }
        }
    }

    contains(position = {}) {
        const min = this.getMin();
        const max = this.getMax();

        return position.x >= min.x && position.x <= max.x
            && position.y >= min.y && position.y <= max.y
            && position.z >= min.z && position.z <= max.z;
    }

    key() {
        const min = this.getMin();
        const size = this.getSize();

        return `${min.x},${min.y},${min.z}|${size.x},${size.y},${size.z}`;
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

export default BoxelArea;
