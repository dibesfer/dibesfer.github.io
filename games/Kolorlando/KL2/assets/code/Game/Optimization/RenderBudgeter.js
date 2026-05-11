const PRESETS = {
    LOW: {
        maxVisibleChunks: 32,
        meshBuildsPerFrame: 1
    },
    MEDIUM: {
        maxVisibleChunks: 48,
        meshBuildsPerFrame: 1
    },
    HIGH: {
        maxVisibleChunks: 64,
        meshBuildsPerFrame: 3
    }
};

export class RenderBudgeter {
    constructor(preset = "MEDIUM") {
        this.applyPreset(preset);
    }

    applyPreset(preset = "MEDIUM") {
        const key = String(preset).toUpperCase();
        const limits = PRESETS[key] || PRESETS.MEDIUM;

        this.preset = PRESETS[key] ? key : "MEDIUM";
        this.limits = { ...limits };
        return this.getLimits();
    }

    selectVisibleChunks(prioritizedChunks = []) {
        return prioritizedChunks.slice(0, this.limits.maxVisibleChunks);
    }

    getLimits() {
        return {
            preset: this.preset,
            ...this.limits
        };
    }
}

export default RenderBudgeter;
