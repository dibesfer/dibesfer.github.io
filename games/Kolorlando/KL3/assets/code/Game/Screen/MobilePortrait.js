export class MobilePortrait {
    constructor(options = {}) {
        this.mode = options.mode ?? "mobile-portrait";
    }

    getPolicy() {
        return {
            mode: this.mode,
            ui: {
                crosshair: false,
                playerHUD: false,
                targetName: false,
                hotbar: false,
            },
            input: {
                cursorLock: false,
                pointerActions: false,
                keyboardGameplay: false,
                keyboardEditing: false,
                hotbarKeys: false,
                mobileGameplay: true,
                mobileVoxelActions: false,
                mobileChatWithMenu: true,
            },
            services: {
                raycast: false,
                voxelHighlight: false,
                boxelEditor: false,
            },
        };
    }
}

export default MobilePortrait;