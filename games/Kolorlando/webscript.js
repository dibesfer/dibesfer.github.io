
let mainMenu = document.getElementById("mainMenu")

let avatarMenu = document.getElementById("avatarMenu")

let yourWorldsMenu = document.getElementById("yourWorldsMenu")

let galaxyMenu = document.getElementById("galaxyMenu")

function changePage(string){
    /* A tiny view switcher keeps the landing page lightweight while letting
    each menu section behave like its own screen without leaving the page. */
    mainMenu.classList.add("invisible")
    avatarMenu.classList.add("invisible")
    yourWorldsMenu.classList.add("invisible")
    galaxyMenu.classList.add("invisible")

    if (string == "avatar"){
        avatarMenu.classList.remove("invisible")
    }
    else if (string == "yourWorlds"){
        yourWorldsMenu.classList.remove("invisible")
    }
    else if (string == "galaxy"){
        galaxyMenu.classList.remove("invisible")
    }
    else {
        mainMenu.classList.remove("invisible")
    }
}
