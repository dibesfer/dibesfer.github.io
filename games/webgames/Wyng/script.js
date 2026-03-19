var playerName = ""
var life = 100
var money = 0
var preparation = 0

var inputName = getid("inputName")
var displayName = getid("displayName")
var empezamos = getid("empezamos")
var mainMenu = getid("mainMenu")
var combatMenu = getid("combatMenu")

if (localStorage.getItem("wyngName") != ""){
    console.log("youve been here")
    playerName = localStorage.getItem("wyngName")
    displayName.textContent = playerName
    console.log(playerName)
    empezamos.classList.toggle("invisible")
    mainMenu.classList.toggle("invisible")
}

function sendName(){

    if (inputName.value != ""){
        playerName = inputName.value
        localStorage.setItem("wyngName", playerName)
        displayName.textContent = playerName
        empezamos.classList.toggle("invisible")
        mainMenu.classList.toggle("invisible")
    }

}

function goToCombat(){
    mainMenu.classList.toggle("invisible")
    combatMenu.classList.toggle("invisible")
}

function restart(){
    if (confirm("Are you sure to restart all game data?")){
        localStorage.setItem("wyngName", "")
        inputName.value = ""
        window.location.reload()
        
    }
    
}