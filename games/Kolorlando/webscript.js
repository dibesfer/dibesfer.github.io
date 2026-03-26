
let mainMenu = document.getElementById("mainMenu")

let avatarMenu = document.getElementById("avatarMenu")

let yourWorldsMenu = document.getElementById("yourWorldsMenu")

let galaxyMenu = document.getElementById("galaxyMenu")

let idDivIcon = document.getElementById("idDiv_icon")

let authModal = document.getElementById("authModal")

let authModalPanel = document.getElementById("authModal_panel")

function setAuthModalState(shouldOpen){
    /* One helper keeps every open/close path in sync so touch, click, escape,
    and future auth actions all update visibility and accessibility together. */
    authModal.classList.toggle("invisible", !shouldOpen)
    authModal.setAttribute("aria-hidden", String(!shouldOpen))
}

function toggleAuthModal(){
    setAuthModalState(authModal.classList.contains("invisible"))
}

function changePage(string){
    /* A tiny view switcher keeps the landing page lightweight while letting
    each menu section behave like its own screen without leaving the page. */
    mainMenu.classList.add("invisible")
    avatarMenu.classList.add("invisible")
    yourWorldsMenu.classList.add("invisible")
    //galaxyMenu.classList.add("invisible")

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

/* A single pointer handler covers mouse and touch, so the icon toggle stays
simple and does not need separate click and touch listeners. */
idDivIcon.addEventListener("pointerdown", (event) => {
    /* Stopping propagation prevents the outside-close listener from seeing
    this same interaction and instantly undoing the toggle. */
    event.stopPropagation()
    toggleAuthModal()
})

authModalPanel.addEventListener("pointerdown", (event) => {
    /* Any interaction inside the dialog should stay inside the dialog. */
    event.stopPropagation()
})

document.addEventListener("pointerdown", (event) => {
    /* One outside listener is enough: if the modal is open and the pointer
    lands anywhere beyond the panel, the modal should close. */
    if (authModal.classList.contains("invisible")){
        return
    }

    if (!authModalPanel.contains(event.target) && event.target !== idDivIcon){
        setAuthModalState(false)
    }
})

document.addEventListener("keydown", (event) => {
    /* Escape gives keyboard users a quick and familiar way to dismiss the
    auth modal without needing an extra visible close button right now. */
    if (event.key === "Escape"){
        setAuthModalState(false)
    }
})
