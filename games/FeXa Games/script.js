let visitsCounter = document.getElementById("visitsCounter")

let clicks = localStorage.getItem("fexaClicks")
let clickerShow = document.getElementById("clickerShow")

if (clicks == null){
    localStorage.setItem("fexaClicks", 0)
    clicks = 0
}

clickerShow.textContent = clicks
console.log(clicks)

function clickSum(){
    clicks++
    localStorage.setItem("fexaClicks", clicks)
    clickerShow.textContent = clicks
}


// Counter
let outputSeconds = document.getElementById("outputSeconds")
let seconds = localStorage.getItem("fexaSeconds")

if (seconds == null){
    seconds = 0
}
outputSeconds.textContent = seconds 
function countSeconds(){
    seconds++
    localStorage.setItem("fexaSeconds", seconds)
    outputSeconds.textContent = seconds
}

setInterval(countSeconds,1000)