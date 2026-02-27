const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

let canvasWidth = 192/4
let canvasHeight = 108/4

canvas.width = canvasWidth
canvas.height = canvasHeight

ctx.fillStyle = "green";
ctx.fillRect(0, 0, 192, 108);

ctx.fillStyle = "blue";
ctx.fillRect(Math.round(canvasWidth/2),Math.round(canvasHeight/2), 1, 1);
console.log(Math.round(canvasWidth/2),Math.round(canvasHeight/2))