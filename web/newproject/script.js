var displayTime = document.getElementById("displayTime")
var myTime = localStorage.getItem("dibesfer_newproject_time")
if (!myTime) {
    myTime = 0
}
localStorage.setItem("dibesfer_newproject_time", myTime)
var myInterval = setInterval(countTime,1000)

function countTime(){
    myTime++
    localStorage.setItem("dibesfer_newproject_time", myTime)
    displayTime.textContent = myTime
}