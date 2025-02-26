let counter = 0
let itsme = document.getElementById("itsme")

itsme.onclick = function(){
    counter++
    if (counter > 20){
        alert("okay its you")
        localStorage.setItem("luantiguideLocalVisits", -999999999)
    }
}