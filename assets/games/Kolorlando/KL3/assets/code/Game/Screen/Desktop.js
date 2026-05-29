export class Desktop {
    constructor(options = {}) {
        this.mode = options.mode ?? "desktop";
    }

    getPolicy() {
        return {
            mode: this.mode,
            ui: {
                crosshair: true,
                playerHUD: true,
                targetName: true,
                hotbar: true,
            },
            input: {
                cursorLock: true,
                pointerActions: true,
                keyboardGameplay: true,
                keyboardEditing: true,
                hotbarKeys: true,
            },
            services: {
                raycast: true,
                voxelHighlight: true,
                boxelEditor: true,
            },
        };
    }
}

export default Desktop;
