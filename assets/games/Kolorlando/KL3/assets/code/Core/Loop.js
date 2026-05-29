import { Boxel15RenderDistanceGate } from "../Wabavam/Boxel/Boxel15/Boxel15RenderDistanceGate.js";

export class Loop {
    constructor(options = {}) {
        this.app = options.app ?? null;
        this.lastTime = performance.now();
        this.running = false;
        this.boxel15RenderDistanceGate = options.boxel15RenderDistanceGate
            ?? new Boxel15RenderDistanceGate({ app: this.app });

        this.tick = this.tick.bind(this);
    }

    start() {
        if (this.running) return;

        this.running = true;
        this.lastTime = performance.now();
        this.boxel15RenderDistanceGate.reset("loop-start");
        requestAnimationFrame(this.tick);
    }

    stop() {
        this.running = false;
    }

    tick(now) {
        if (!this.running) return;

        const app = this.app;
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        /*
        1. PLAYER
        Move player first so camera, visibility and raycast use the latest body position.
        */
        app.player.update(dt);
        app.maybeSchedulePlayerStateAutosave?.();

        /*
        2. BOXEL15 RENDER DISTANCE
        Render distance is state-driven, not frame-driven.
        It updates only when its inputs change: Boxel15 cell, camera bucket,
        Woxel identity, render settings or explicit dirty/reset.
        */
        this.boxel15RenderDistanceGate.setApp(app).updateIfNeeded();

        /*
        3. RAYCAST
        Read the current pointed voxel only when the active screen policy allows it.
        */
        const raycastEnabled = app.isScreenServiceEnabled?.("raycast") !== false;
        const voxelHighlightEnabled = app.isScreenServiceEnabled?.("voxelHighlight") !== false;
        const boxelEditorEnabled = app.isScreenServiceEnabled?.("boxelEditor") !== false;

        const target = raycastEnabled
            ? app.raycast.update(now)
            : null;

        if (!raycastEnabled) {
            app.raycast.setTarget?.(null);
            app.ui?.setTargetName?.("none");
        }

        /*
        4. EDITING OR HIGHLIGHT
        BoxelEditor owns previews while active; VoxelHighlight works only when policy allows it.
        */
        if (boxelEditorEnabled && app.boxelEditor.isActive()) {
            app.boxelEditor.update(target);
        } else if (voxelHighlightEnabled) {
            app.voxelHighlight.update(target);
        } else {
            app.voxelHighlight.hide?.();
        }

        /*
        5. DEBUG
        Refresh FPS and player coordinates with a throttled UI draw.
        */
        app.debug.update(now, app.player.position);

        /*
        6. THREED
        Resize if needed and render the frame.
        */
        app.threeD.update();

        requestAnimationFrame(this.tick);
    }
}

export default Loop;
