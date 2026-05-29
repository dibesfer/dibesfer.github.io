var click = new Audio('/art/sound/blp8.wav');
var coin = new Audio('/art/sound/8-bit-coin.wav')
var levelup = new Audio('/art/sound/8-bit-arcade-start-sound.wav')
var shoot = new Audio('/art/sound/shoot.wav')
function playSound(sound) {
    if (sound == "click")
        sound = click
    if (sound == "coin")
        sound = coin
    if (sound == "levelup")
        sound = levelup
    if (sound == "shoot")
        sound = shoot
    sound.play();
}

// CANVAS MANAGEMENT

const canvas = getid("myCanvas")
const ctx = canvas.getContext("2d")
canvas.width = canvas.offsetWidth
canvas.height = canvas.offsetHeight
let position = getid("position")
let middle = canvas.width / 2
let playerX = middle
let playerY = middle
let secondsPassed;
let oldTimeStamp;
let fps;
let maplimit = 1000
let playervelocity = 10
let angle
mapX = 0
mapY = 0
let playervelocityX = 0
let playervelocityY = 0
let cursorX
let cursorY

const playerProfile = new Image(); // Create new img element
playerProfile.src ="assets/UlfricStormcloak.png" ; // Set source path
//"assets/Spaceship.png"
class Player {
    constructor(posX, posY, width,image){
        this.posX = posX
        this.posY = posY
        this.width = width
        this.image = image        
    }

    start() {
        drawImage(this.image, -this.width/2, -this.width/2, this.width, this.width+100)
    }

}
let myPlayer = new Player(0, 0, 150, playerProfile)

function drawImage(img, posX, posY, width, height){
    ctx.drawImage(img, posX, posY, width, height);
}

class Enemy {
    constructor(posX, posY, radius,color){
        this.posX = posX
        this.posY = posY
        this.radius = radius
        this.color = color        
    }

    velocity = 10
    velX = 0
    velY = 0
    interval = null

    draw(){
        drawCircle(this.posX, this.posY, this.radius, this.scolor)
    }

    move(){
        this.draw()
        //console.log(this.velocity)
        //middle - maplimit, maplimit + middle
        if (this.posX + this.velX < maplimit + middle  &&
             this.posY +this.velY < maplimit + middle &&
              this.posX +this.velX > middle-maplimit &&
               this.posY +this.velY > middle-maplimit) {
                this.posX += this.velX
                this.posY += this.velY
        }
        else {
            this.velX = -this.velX
            this.velY = -this.velY
        } 

        //this.interval = setInterval(getRandomPos,2000)
        
    }
/*     getRandomPos()


function moveRandom(){
    
    console.log("interval")
} */
    
}

class Bullet {

    velY = 10
    posY = 10

    start(){
        drawSquare(0,this.posY,5,15,"gold")
        this.posY -= this.velY
    }
    


}
let interval = setInterval(getRandomPos,2000)

myEnemies = []
function getRandomPos() {
    
    myEnemies.forEach(enemy => {
        enemy.velX = randomInt(-enemy.velocity, enemy.velocity)
        enemy.velY = randomInt(-enemy.velocity, myEnemy.velocity)
    });
    
    
    //console.log(myEnemy.velX)
    
}


function drawCircle(x, y, width, color) {
    ctx.fillStyle = color
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(x, y, width, 0, Math.PI * 2)
    //ctx.fill()
    ctx.strokeStyle = color
    ctx.stroke();
    ctx.closePath()
}

let randomsMatrix = []

for (let index = 0; index < 400; index++) {
    let randoms = [
        randomInt(middle - maplimit, maplimit + middle),
        randomInt(middle - maplimit, maplimit + middle),
        randomInt(10, 50),
        randomInt(10, 50)
    ]
    randomsMatrix.push(randoms)
}

function landscape() {
    ctx.fillStyle = "lime";
    for (let i = 0; i < randomsMatrix.length; i++) {
        ctx.fillRect(randomsMatrix[i][0], randomsMatrix[i][1], randomsMatrix[i][2], randomsMatrix[i][3])
    }
}

function drawSquare(x, y, width, height, color, stroke) {
    if (stroke) {
        ctx.strokeStyle = color
        ctx.lineWidth = 5
        ctx.strokeRect(x, y, width, height)
    }
    else {
        ctx.fillStyle = color
        ctx.fillRect(x, y, width, height)
    }
}

function drawLine(x, y, toX, toY) {
    // Define a new path:
    ctx.beginPath();
    ctx.lineWidth = 3
    ctx.strokeStyle = "white"
    // Define a start point
    ctx.moveTo(x, y);

    // Define an end point
    ctx.lineTo(toX, toY);

    ctx.stroke()
}

function drawTriangle(x, y) {
    // Define a new path:
    ctx.beginPath();

    // Define a start point
    ctx.moveTo(x, y - 50);

    // Define points
    ctx.lineTo(x + 30, y + 30);
    ctx.lineTo(x - 30, y + 30);
    //ctx.lineTo(x+100,y+20);
    ctx.strokeStyle = "yellow"
    ctx.lineWidth = 3
    ctx.closePath()
    // Draw it
    ctx.stroke();
}

let myBullet = new Bullet();

let myEnemy = new Enemy(middle,middle-20,20,"red")
let myEnemy2 = new Enemy(middle,middle-20,20,"red")
let myEnemy3 = new Enemy(middle,middle-20,20,"red")
myEnemies.push(myEnemy2)
myEnemies.push(myEnemy3)
myEnemies.push(myEnemy)

function gameLoop(timeStamp) {

    // Calculate the number of seconds passed since the last frame
    secondsPassed = (timeStamp - oldTimeStamp) / 1000;
    oldTimeStamp = timeStamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Calculate fps
    fps = Math.round(1 / secondsPassed);
    consola.textContent = "FPS: " + fps

    ctx.save()
    ctx.translate(mapX, mapY)

    drawSquare(100, 100, 100, 100, "blue")
    drawSquare(middle - maplimit, middle - maplimit, maplimit * 2, maplimit * 2, "red", true)

    landscape()

    //enemy
    myEnemies.forEach(enemy => {
        enemy.move()    
    });



    ctx.restore()
    drawCircle(middle, middle, 10, "white")

    //var rad = 90 * Math.PI / 180;

    ctx.save()
    ctx.translate(middle, middle)
    myPlayer.start()
            

    ctx.rotate(Math.PI / 2); // correction for image starting position

    ctx.rotate(angle)
    drawTriangle(0, 0)
    myBullet.start()

    ctx.restore()


    drawLine(middle, middle, cursorX, cursorY)
    drawCircle(cursorX, cursorY, 10, "white")

    // The loop function has reached it's end. Keep requesting new frames
    window.requestAnimationFrame(gameLoop);
    move(playervelocityX, playervelocityY)

}

gameLoop()



function move(x, y) {
    if (mapX + x < maplimit && mapY + y < maplimit && mapX + x > -maplimit && mapY + y > -maplimit) {
        mapX += x
        mapY += y
    }

    if (position.textContent != "X: " + mapX + " Y: " + mapY) {
        position.textContent = "X: " + mapX + " Y: " + mapY
    }
}

var keys = []

window.addEventListener(
    "keydown",
    (event) => {
        if (event.defaultPrevented) {
            return; // Do nothing if the event was already processed
        }

        let key = event.key
        if (key == "W" || key == "w" || key == "ArrowUp") {
            playervelocityY = playervelocity
        }

        if (key == "A" || key == "a" || key == "ArrowLeft") {
            playervelocityX = playervelocity
        }

        if (key == "D" || key == "d" || key == "ArrowRight") {
            playervelocityX = -playervelocity
        }

        if (key == "S" || key == "s" || key == "ArrowDown") {
            playervelocityY = -playervelocity
        }


        // Cancel the default action to avoid it being handled twice        
        event.preventDefault();
    },
    true,
);
window.addEventListener("keyup", (event) => {
    if (event.defaultPrevented) {
        return; // Do nothing if the event was already processed
    }

    let key = event.key
    if (key == "W" || key == "w" || key == "ArrowUp") {
        playervelocityY = 0
    }

    if (key == "A" || key == "a" || key == "ArrowLeft") {
        playervelocityX = 0
    }

    if (key == "D" || key == "d" || key == "ArrowRight") {
        playervelocityX = 0
    }

    if (key == "S" || key == "s" || key == "ArrowDown") {
        playervelocityY = 0
    }


    // Cancel the default action to avoid it being handled twice        
    event.preventDefault();
},
    true,
)


canvas.onclick = function (e) {

    cursorX = e.pageX - canvas.getBoundingClientRect().left
    cursorY = e.pageY - canvas.getBoundingClientRect().top

    var dx = cursorX - middle;
    var dy = cursorY - middle;
    angle = Math.atan2(dy, dx);

    console.log("hola")
    //console.log(dx, dy)//drawArrow(theta);
};

document.onmousemove = function (e) {

    cursorX = e.pageX - canvas.getBoundingClientRect().left
    cursorY = e.pageY - canvas.getBoundingClientRect().top

    var dx = cursorX - middle;
    var dy = cursorY - middle;
    angle = Math.atan2(dy, dx);

    //console.log(dx, dy)//drawArrow(theta);
};


function detectCollision() {

}
// TEST

/*


let variableWidth = 200
let variableHeight = 200
let orbitX = canvas.width/2
let orbitY = canvas.width/2
let angle = 0
let variableMiddlePoint = variableWidth / 2 
let rotation = 0
let limit = false
let background
let mapoffset = 0
function draw(){

    if (variableWidth > canvas.width){
       limit = true;
    }
    else if (variableWidth < 0) {
        limit = false;
    }

    if (limit) {
        variableWidth--
        variableHeight--
        //consola.textContent += limit
    }
    else {
        variableWidth++
        variableHeight++
        //consola.textContent += variableHeight
    }
    ctx.save()
    ctx.translate(100,0)
    ctx.fillRect(0, 0, 50, 50)
    ctx.restore()


    
    ctx.fillStyle = "blue";
    ctx.fillRect(canvas.width/2-variableWidth/2, canvas.height/2-variableHeight/2, variableWidth, variableHeight);

    ctx.strokeStyle = "yellow"
    ctx.lineWidth = "2px"
    ctx.stroke()

    ctx.save()
    ctx.translate(canvas.width/2, canvas.height/2); // set canvas context to center

    ctx.fillStyle = "rgb(0 200 0 / 50%)";
    ctx.rotate(Math.PI / 180 * rotation++); // 1/2 a degree

    ctx.fillRect(-50, -50, 100, 100);
   
    
    
    ctx.restore()


    ctx.fillStyle = "rgb(0 200 0 / 50%)";
    ctx.fillRect(canvas.width/2-(variableWidth-20)/2, canvas.height/2-(variableHeight-20)/2, variableWidth-60, variableHeight-60);

    ctx.save()
    ctx.translate(canvas.width/2, canvas.height/2); // set canvas context to center

    ctx.fillStyle = "rgb(200 0 0 / 50%)";
    ctx.rotate(Math.PI / 180 * -(rotation++)); // 1/2 a degree
    ctx.fillRect(-50, -50, 100, 100);
    ctx.fillStyle = "rgb(0 0 200 / 100%)";
    ctx.rotate(Math.PI / 180 * 50); // 1/2 a degree
    ctx.fillRect(50, 50, 20, 20);

    ctx.restore()



    ctx.fillStyle = "gold"
    ctx.strokeStyle = "red"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(orbitX,orbitY,20,0, Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    orbitX += 10 * Math.sin(angle)
    orbitY += -10 * Math.cos(angle)
    angle += 0.09
    ctx.save()
    ctx.translate(mapoffset+=0.1,0)
    ctx.fillRect(0, 0, 50, 50)
    ctx.restore()
}

function landscape(){
    ctx.fillStyle = "white";
    ctx.fillRect(randomInt(0,canvas.width), randomInt(0, canvas.height), randomInt(10,100) , randomInt(10,100)); 
}
for (let index = 0; index < 10; index++) {
    landscape()
}
background = canvas


 ctx.drawImage(background, 0, 0);
 ctx2.drawImage(background, 0, 0)

 ctx.clearRect(0, 0, canvas.width, canvas.height)
 
 let myImg = new Image()
 myImg.src  = "https://www.w3schools.com/tags/img_the_scream.jpg"

 ctx.drawImage(myCanvas2, 0, 0);
 ctx.drawImage(myImg, 30, 30);
 ctx.drawImage(myImg, 60, 60);

 var myCanvas2 = getid("myCanvas2")
var ctx2 = myCanvas2.getContext("2d")
myCanvas2.width = myCanvas2.offsetWidth
myCanvas2.height = myCanvas2.offsetHeight

*/