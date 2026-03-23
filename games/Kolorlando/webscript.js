
let mainMenu = document.getElementById("mainMenu")

let avatarMenu = document.getElementById("avatarMenu")

function changePage(string){
    if (string == "avatar"){
        mainMenu.classList.toggle("invisible")
        avatarMenu.classList.toggle("invisible")
    }
}