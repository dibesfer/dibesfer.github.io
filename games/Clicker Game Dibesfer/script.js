let myName
let myClicks = localStorage.getItem("clickerGameClicks")
let inputName = document.getElementById("inputName")
let outputName = document.getElementById("outputName")
let outputClicks = document.getElementById("outputClicks")
let main = document.getElementsByTagName("MAIN")[0]
let zeroScreen = document.getElementById("0screen")
let oneScreen = document.getElementById("1screen")

myName = localStorage.getItem("clickerGameName")
outputClicks.textContent = localStorage.getItem("clickerGameClicks")

if (myName != null){
    outputName.textContent = myName
    zeroScreen.style.display = "none"
    oneScreen.style.display = "block"
}

if (myClicks == null){
    myClicks = 0
}

function saveName(){
    myName = inputName.value
    localStorage.setItem("clickerGameName", myName)
    outputName.textContent = myName
    zeroScreen.style.display = "none"
    oneScreen.style.display = "block"
}

function firstScreen(){

}

function clickSum(){
    myClicks++
    localStorage.setItem("clickerGameClicks", myClicks)
    outputClicks.textContent = localStorage.getItem("clickerGameClicks")
}

function restart(){
    let message = "You are about to delete all your memory. Are you sure?"
    if (confirm(message)){
        myName = null
        myClicks = 0
        localStorage.setItem("clickerGameName", myName)
        localStorage.setItem("clickerGameClicks", myClicks)
        outputClicks.textContent = localStorage.getItem("clickerGameClicks")
        oneScreen.style.display = "none"
        zeroScreen.style.display = "block"
    }
}