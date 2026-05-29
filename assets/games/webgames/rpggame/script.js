var displayUsername = getid("displayUsername")
var inputUsername = getid("inputUsername")
var buttonUsername = getid("buttonUsername")
var getUsername = getid("getUsername")
var userStats = getid("userStats")
var actions = getid("actions")
var clock = getid("clock")
buttonUsername.onclick = function () {
    if (inputUsername.value)
        displayUsername.textContent = inputUsername.value
    gameOn()

}

inputUsername.addEventListener("keypress", function (event) {
    // If the user presses the "Enter" key on the keyboard
    if (event.key === "Enter") {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the button element with a click
        buttonUsername.click();
    }
});

function gameOn() {
    getUsername.style.display = "none"
    userStats.style.display = "block"
    actions.style.display = "block"
    clock.style.display = "block"
}

var timePassing = setInterval(updateClock, 1000)
var timePassed = 0
function updateClock() {
    timePassed++
    clockValue.textContent = timePassed
}