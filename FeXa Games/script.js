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