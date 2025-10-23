let words = [
    "orarum",
    "ipsalom",
    "immanu",
    // "eccisont",
    // "acauda",
    // "sore dillo",
    // "cucum"
]
let commandInput = document.getElementById("commandInput")
let levelOutput = document.getElementById("levelOutput")
let level = localStorage.getItem("commandGameLevel")
if (level == null){
    level = 0
}



levelOutput.textContent = level
let wordOutput = document.getElementById("wordOutput")
wordOutput.textContent = words[level]
let commandLine = document.getElementById("commandLine")
let youWonMessage = document.getElementById("youWonMessage")

if (level == words.length){
    youWonMessage.style.display = "block";
    commandLine.style.display = "none"
    console.log("hello")
}

function checkWord(){

    if (commandInput.value == words[level] && level < words.length-1){
        level++
        localStorage.setItem("commandGameLevel", level)
        levelOutput.textContent = level
        wordOutput.textContent = words[level]
        commandInput.value = ""
    } else if (commandInput.value == words[level] && level == words.length-1){
        level++
        localStorage.setItem("commandGameLevel", level)
        levelOutput.textContent = level
        commandLine.style.display = "none"
        youWonMessage.style.display = "block"
    }
}

commandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        checkWord()
      }
    });

function restart(){
    localStorage.setItem("commandGameLevel", 0)
    level = 0
    levelOutput.textContent = 0
    wordOutput.textContent = words[level]
    youWonMessage.style.display = "none"
    commandLine.style.display = "block"
    commandInput.value = ""
}