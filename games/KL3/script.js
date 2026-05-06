import { Collision } from "/assets/code/Game/Collision.js";
import { Debug } from "/assets/code/Game/Debug.js";
import { Input } from "/assets/code/Input/Input.js";
import { Mapper } from "/assets/code/Game/Mapper.js";
import { Player } from "/assets/code/Player/Player.js";
import { Settings } from "/assets/code/Game/Settings.js";
import { ThreeD } from "/assets/code/ThreeD/ThreeD.js";
import { UI } from "/assets/code/UI/UI.js";

const consolaElement = document.querySelector("#consola");
const threeDCanvas = document.querySelector("#threeDCanvas");

const threeD = new ThreeD({
    canvas: threeDCanvas,
});
threeD.start();

const mapper = new Mapper();
const woxel = mapper.createDemoWoxel();
const woxelObject3D = mapper.createWoxelObject3D(woxel);

threeD.setWorld(woxelObject3D);

const collision = new Collision({
    woxel,
    boundaryAsSolid: true,
});

const player = new Player({
    camera: threeD.getCamera(),
    collision,
    gravity: 9.807,
    body: {
        width: 0.8,
        height: 1.8,
        depth: 0.8,
    },
    cameraPosition: 1.7,
});

player.spawnInWoxel(woxel);

const settings = new Settings({
    threeD,
    mapper,
});
settings.start();

const debug = new Debug({
    consolaElement,
    drawThrottleMs: 250,
});

const ui = new UI({
    settings,
});
ui.start();

const input = new Input({
    ui,
    canvas: threeDCanvas,
    player,
});

player.setInput(input);

window.KL3 = {
    threeD,
    mapper,
    woxel,
    collision,
    player,
    input,
};

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        debug.reset();
        threeD.resize();
    }
});

let lastTime = performance.now();

function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    player.update(dt);

    const feet = player.getFeetPosition();

    debug.setCoords(feet.x, feet.y, feet.z);
    debug.update(now);

    threeD.update();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
