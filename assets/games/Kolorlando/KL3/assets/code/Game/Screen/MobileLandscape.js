export class MobileLandscape {
    constructor(options = {}) {
        this.mode = options.mode ?? "mobile-landscape";
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
                cursorLock: false,
                pointerActions: false,
                keyboardGameplay: false,
                keyboardEditing: false,
                hotbarKeys: false,
                mobileGameplay: true,
                mobileVoxelActions: true,
                mobileChatWithMenu: false,
            },
            services: {
                raycast: true,
                voxelHighlight: true,
                boxelEditor: false,
            },
        };
    }
}

export default MobileLandscape;