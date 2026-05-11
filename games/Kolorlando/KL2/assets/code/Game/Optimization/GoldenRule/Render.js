export class Render {
    constructor({ threeD = null, chunkVisibility = null, raycastTargets = null } = {}) {
        this.threeD = threeD;
        this.chunkVisibility = chunkVisibility;
        this.raycastTargets = raycastTargets;
    }

    shouldQueue(boxel, playerPosition) {
        if (!this.isInRange(boxel, playerPosition)) return false;
        if (this.chunkVisibility?.mapper?.isSurfaceBoxel?.(boxel)) return true;

        const culling = this.chunkVisibility?.culling;

        return culling ? culling.shouldKeepLoaded(boxel, playerPosition) : true;
    }

    shouldKeepMesh(boxel, playerPosition) {
        return this.shouldQueue(boxel, playerPosition);
    }

    canRender(boxel, key, playerPosition) {
        const culling = this.chunkVisibility?.culling;

        if (!this.isInRange(boxel, playerPosition)) {
            culling?.forget(key);
            return false;
        }

        if (this.chunkVisibility?.mapper?.isSurfaceBoxel?.(boxel)) return true;

        return culling ? culling.canRender(boxel, key) : true;
    }

    canRaycast(boxel, key, playerPosition, mesh = null) {
        return this.chunkVisibility?.interactionBudgeter?.canRaycast?.(boxel, key, playerPosition, mesh)
            ?? false;
    }

    isInRange(boxel, playerPosition) {
        const chunks = this.chunkVisibility;

        return chunks.renderDistanceSq(boxel, playerPosition) <= chunks.renderDistance * chunks.renderDistance;
    }

    isInRaycastRange(boxel, playerPosition) {
        return this.chunkVisibility?.interactionBudgeter?.isInRaycastRange?.(boxel, playerPosition)
            ?? false;
    }

    profile({ fps = 0, frameMs = 0 } = {}) {
        const renderer = this.threeD?.renderer;
        const memory = renderer?.info?.memory || {};
        const render = renderer?.info?.render || {};
        const visibleChunks = this.chunkVisibility?.visible.size ?? 0;

        return {
            fps,
            frameMs,
            renderCount: this.threeD?.renderCount ?? 0,
            visibleChunks,
            calls: render.calls ?? 0,
            triangles: render.triangles ?? 0,
            geometries: memory.geometries ?? 0,
            textures: memory.textures ?? 0,
            raycastTargets: this.raycastTargets?.length ?? 0,
            interaction: this.chunkVisibility?.interactionBudgeter?.profile?.() ?? {},
            pressure: frameMs > 16.7
        };
    }
}

export default Render;
