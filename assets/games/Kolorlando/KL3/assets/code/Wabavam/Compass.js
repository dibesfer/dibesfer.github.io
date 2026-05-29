export const Compass = Object.freeze({
    NORTH: 0,
    EAST: 1,
    SOUTH: 2,
    WEST: 3,

    names: ["NORTH", "EAST", "SOUTH", "WEST"],

    normalize(orientation = null) {
        if (orientation === null || orientation === undefined || orientation === "") return null;

        if (typeof orientation === "number") {
            return ((Math.floor(orientation) % 4) + 4) % 4;
        }

        if (typeof orientation === "string") {
            const upper = orientation.trim().toUpperCase();
            const index = this.names.indexOf(upper);
            return index >= 0 ? index : null;
        }

        return null;
    },

    name(orientation = null) {
        const normalized = this.normalize(orientation);
        return normalized === null ? null : this.names[normalized];
    },

    isOriented(orientation = null) {
        return this.normalize(orientation) !== null;
    },

    fromYaw(yaw = 0) {
        const x = -Math.sin(yaw);
        const z = -Math.cos(yaw);

        return this.fromDirection({ x, z });
    },

    fromDirection(direction = {}) {
        const x = Number(direction.x ?? 0);
        const z = Number(direction.z ?? 0);

        if (Math.abs(x) > Math.abs(z)) {
            return x >= 0 ? this.EAST : this.WEST;
        }

        return z >= 0 ? this.SOUTH : this.NORTH;
    },

    opposite(orientation = null) {
        const normalized = this.normalize(orientation);
        return normalized === null ? null : (normalized + 2) % 4;
    },

    delta(from = this.NORTH, to = this.NORTH) {
        const start = this.normalize(from) ?? this.NORTH;
        const end = this.normalize(to) ?? this.NORTH;

        return (end - start + 4) % 4;
    },

    combine(orientation = null, delta = 0) {
        const normalized = this.normalize(orientation);
        if (normalized === null) return null;

        const amount = this.normalize(delta) ?? this.NORTH;
        return (normalized + amount) % 4;
    },

    rotateSize(size = {}, delta = 0) {
        const amount = this.normalize(delta) ?? this.NORTH;
        const x = Math.max(0, Math.floor(size.x ?? 0));
        const y = Math.max(0, Math.floor(size.y ?? 0));
        const z = Math.max(0, Math.floor(size.z ?? 0));

        if (amount % 2 === 1) return { x: z, y, z: x };
        return { x, y, z };
    },

    rotatePositionInSize(position = {}, size = {}, delta = 0) {
        const amount = this.normalize(delta) ?? this.NORTH;
        const x = Math.floor(position.x ?? 0);
        const y = Math.floor(position.y ?? 0);
        const z = Math.floor(position.z ?? 0);
        const sx = Math.max(1, Math.floor(size.x ?? 1));
        const sz = Math.max(1, Math.floor(size.z ?? 1));

        if (amount === this.EAST) {
            return { x: sz - 1 - z, y, z: x };
        }

        if (amount === this.SOUTH) {
            return { x: sx - 1 - x, y, z: sz - 1 - z };
        }

        if (amount === this.WEST) {
            return { x: z, y, z: sx - 1 - x };
        }

        return { x, y, z };
    },
});

export default Compass;
