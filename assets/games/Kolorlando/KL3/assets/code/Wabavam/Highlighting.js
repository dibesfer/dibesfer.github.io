export class Highlighting {
    constructor(options = {}) {
        this.scale = options.scale ?? 1.1;
        this.opacity = options.opacity ?? 0.4;
        this.planeOpacity = options.planeOpacity ?? Math.min(this.opacity + 0.1, 1);
        this.planeOffset = options.planeOffset ?? 0.002;
        this.depthWrite = options.depthWrite ?? false;

        this.colors = {
            voxel: options.colors?.voxel ?? 0xffff00,
            redBoxel: options.colors?.redBoxel ?? 0xff2222,
            greenBoxel: options.colors?.greenBoxel ?? 0x22ff44,
            blueBoxel: options.colors?.blueBoxel ?? 0x2299ff,
            purpleBoxel: options.colors?.purpleBoxel ?? 0x9b35ff,
            axisX: options.colors?.axisX ?? 0xff3333,
            axisY: options.colors?.axisY ?? 0x33ff66,
            axisZ: options.colors?.axisZ ?? 0x3388ff,
        };
    }

    getVoxelOptions(options = {}) {
        return {
            color: options.color ?? this.colors.voxel,
            scale: options.scale ?? this.scale,
            opacity: options.opacity ?? this.opacity,
            planeOpacity: options.planeOpacity ?? this.planeOpacity,
            planeOffset: options.planeOffset ?? this.planeOffset,
            depthWrite: options.depthWrite ?? this.depthWrite,
        };
    }

    getBoxelOptions(colorName = "blueBoxel", options = {}) {
        return {
            color: options.color ?? this.colors[colorName] ?? this.colors.blueBoxel,
            scale: options.scale ?? this.scale,
            opacity: options.opacity ?? this.opacity,
            depthWrite: options.depthWrite ?? this.depthWrite,
        };
    }
}

export default Highlighting;
