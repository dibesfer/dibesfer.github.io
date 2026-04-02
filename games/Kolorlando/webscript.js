
let mainMenu = document.getElementById("mainMenu")

let avatarMenu = document.getElementById("avatarMenu")

let yourWorldsMenu = document.getElementById("yourWorldsMenu")

let galaxyMenu = document.getElementById("galaxyMenu")

let idDivIcon = document.getElementById("idDiv_icon")

let authModal = document.getElementById("authModal")

let authModalPanel = document.getElementById("authModal_panel")

let currentPage = "home"
const navigablePages = new Set(["home", "avatar", "yourWorlds"])

function isAuthModalLockedOpen(){
    /* Duplicate-session state is a stop-state, so the shared shell should not
    let outside click or Escape dismiss the modal until the user leaves. */
    return window.kolorlandoAuthIsBlocked === true && window.kolorlandoBlockedReason !== "login-attempt"
}

function setAuthModalState(shouldOpen){
    /* One helper keeps every open/close path in sync so touch, click, escape,
    and future auth actions all update visibility and accessibility together. */
    authModal.classList.toggle("invisible", !shouldOpen)
    authModal.setAttribute("aria-hidden", String(!shouldOpen))
}

function toggleAuthModal(){
    setAuthModalState(authModal.classList.contains("invisible"))
}

function renderPage(string){
    /* A tiny view switcher keeps the landing page lightweight while letting
    each menu section behave like its own screen without leaving the page. */
    mainMenu.classList.add("invisible")
    avatarMenu.classList.add("invisible")
    yourWorldsMenu.classList.add("invisible")
    //galaxyMenu.classList.add("invisible")

    currentPage = string

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

function getHistoryUrlForPage(string){
    /* Keeping URLs centralized makes it easy to add more in-page sections
    without scattering hash rules across the navigation logic. */
    if (string === "avatar"){
        return "#avatar"
    }

    if (string === "yourWorlds"){
        return "#worlds"
    }

    return window.location.pathname + window.location.search
}

function syncPageHistory(string){
    /* Each submenu behaves like its own in-page screen, so pushing a
    dedicated history entry lets Back return to the main menu first. */
    if (string !== "home" && navigablePages.has(string) && currentPage !== string){
        window.history.pushState({ kolorlandoPage: string }, "", getHistoryUrlForPage(string))
        return
    }

    if (string === "home" && currentPage !== "home" && navigablePages.has(currentPage)){
        window.history.back()
    }
}

function changePage(string){
    syncPageHistory(string)
    renderPage(string)
}

window.addEventListener("popstate", (event) => {
    /* Replaying the visible menu from history state keeps Back and Forward
    aligned with the current in-page panel instead of only changing the URL. */
    const historyPage = navigablePages.has(event.state?.kolorlandoPage)
        ? event.state.kolorlandoPage
        : "home"
    renderPage(historyPage)
})

/* Seeding the initial entry gives the landing screen a stable known state,
so the first Avatar push has somewhere valid to return. */
const initialHash = window.location.hash

window.history.replaceState({ kolorlandoPage: "home" }, "", window.location.pathname + window.location.search)

if (initialHash === "#avatar"){
    window.history.replaceState({ kolorlandoPage: "avatar" }, "", "#avatar")
    renderPage("avatar")
}
else if (initialHash === "#worlds"){
    window.history.replaceState({ kolorlandoPage: "yourWorlds" }, "", "#worlds")
    renderPage("yourWorlds")
}
else {
    renderPage("home")
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

    if (isAuthModalLockedOpen()){
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
        if (isAuthModalLockedOpen()){
            return
        }
        setAuthModalState(false)
    }
})
