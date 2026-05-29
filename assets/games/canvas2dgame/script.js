const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

let canvasWidth = 192 / 2;
let canvasHeight = 108 / 2;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

// 🌍 mundo
const WORLD_SIZE = 1000;
const BORDER = 1;

// 🎮 player world space
class Player {
    constructor() {
        this.pos = [WORLD_SIZE / 2, WORLD_SIZE / 2];
        this.size = [2, 2];
        this.color = "blue";
    }
}

let myPlayer = new Player();

// 📷 cámara
let camera = { x: 0, y: 0 };

// 🧠 input
const keys = {};

document.addEventListener("keydown", (e) => {
    keys[e.key.toUpperCase()] = true;
});

document.addEventListener("keyup", (e) => {
    keys[e.key.toUpperCase()] = false;
});

// 🎨 draw helper
function paintSquare(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

// 🌲 pseudo random
function rand(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return (n ^ (n >> 16)) >>> 0;
}

// 🌲 bosque
function paintForest() {
    const cell = 10;

    for (let y = BORDER; y < WORLD_SIZE - BORDER; y += cell) {
        for (let x = BORDER; x < WORLD_SIZE - BORDER; x += cell) {

            let r = rand(x, y);

            if (r % 13 === 0) {
                let sx = x - camera.x + canvasWidth / 2;
                let sy = y - camera.y + canvasHeight / 2;

                if (
                    sx >= -cell && sy >= -cell &&
                    sx <= canvasWidth + cell &&
                    sy <= canvasHeight + cell
                ) {
                    paintSquare("darkgreen", sx, sy, cell, cell);
                }
            }
        }
    }
}

// 🧱 borde del mundo
function paintBorders() {
    const halfW = canvasWidth / 2;
    const halfH = canvasHeight / 2;

    let left = BORDER - camera.x + halfW;
    let top = BORDER - camera.y + halfH;
    let right = (WORLD_SIZE - BORDER) - camera.x + halfW;
    let bottom = (WORLD_SIZE - BORDER) - camera.y + halfH;

    paintSquare("gray", left, top, WORLD_SIZE, BORDER);   // top
    paintSquare("gray", left, bottom, WORLD_SIZE, BORDER); // bottom
    paintSquare("gray", left, top, BORDER, WORLD_SIZE);    // left
    paintSquare("gray", right, top, BORDER, WORLD_SIZE);    // right
}

// 🎮 update player con colisión
let stepCooldown = 0;
const stepDelay = 2;

function update() {
    let dx = 0;
    let dy = 0;

    if (keys["W"]) dy -= 1;
    if (keys["S"]) dy += 1;
    if (keys["A"]) dx -= 1;
    if (keys["D"]) dx += 1;

    if (stepCooldown <= 0 && (dx !== 0 || dy !== 0)) {

        let newX = myPlayer.pos[0] + dx;
        let newY = myPlayer.pos[1] + dy;

        // 🧱 colisión con borde del mundo
        if (
            newX >= BORDER &&
            newX <= WORLD_SIZE - BORDER - myPlayer.size[0] &&
            newY >= BORDER &&
            newY <= WORLD_SIZE - BORDER - myPlayer.size[1]
        ) {
            myPlayer.pos[0] = newX;
            myPlayer.pos[1] = newY;
        }

        stepCooldown = stepDelay;
    }

    if (stepCooldown > 0) stepCooldown--;
}

// 📷 cámara sigue al player
function updateCamera() {
    camera.x = myPlayer.pos[0];
    camera.y = myPlayer.pos[1];
}

// 🎬 render mundo
function paintCanvas() {
    // 🌑 exterior del mundo
    paintSquare("black", 0, 0, canvasWidth, canvasHeight);

    // 🌿 fondo del mundo (verde)
    let worldScreenX = -camera.x + canvasWidth / 2;
    let worldScreenY = -camera.y + canvasHeight / 2;

    paintSquare(
        "green",
        worldScreenX,
        worldScreenY,
        WORLD_SIZE,
        WORLD_SIZE
    );

    paintForest();
    paintBorders();

    // 🎮 player centrado
    paintSquare(
        myPlayer.color,
        canvasWidth / 2,
        canvasHeight / 2,
        myPlayer.size[0],
        myPlayer.size[1]
    );
}
function loop() {
    update();
    updateCamera();
    paintCanvas();
    requestAnimationFrame(loop);
}

loop();