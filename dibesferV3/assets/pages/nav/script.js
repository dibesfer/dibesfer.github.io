let leftBar = document.getElementById("leftBar")
let leftBarBtn = document.getElementById("leftBarBtn")

leftBarBtn.addEventListener("click", leftBarToggle)



function leftBarToggle(){
    console.log("hey")
    leftBar.classList.toggle("leftBarOpen")
}

let rightBar = document.getElementById("rightBar")
let rightBarBtn = document.getElementById("rightBarBtn")

rightBarBtn.addEventListener("click", rightBarToggle)



function rightBarToggle(){
    console.log("hey")
    rightBar.classList.toggle("rightBarOpen")
}