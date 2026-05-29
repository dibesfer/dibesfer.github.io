let beauticards = [
    {
        title : "Game controller",
        description : "The device you control your character or avatar.",
        image : "https://cdn-icons-png.flaticon.com/512/5930/5930147.png"
    },
    {
        title : "Video game",
        description : "222",
        image : "https://cdn-icons-png.flaticon.com/512/2780/2780137.png"
    },
    {
        title : "Video gamer",
        description : "222",
        image : "https://cdn-icons-png.flaticon.com/512/3504/3504173.png"
    }
]
let mainSection = document.getElementById("mainSection")
let myString = ""
myString += "<div class='flexSection'>"

beauticards.forEach((e)=>{

 
    myString += `
    
            <div class="flexSectionDivContainer">
                <div class="flexSectionDiv">

                    <p>${e.title}</p>
                    <p>${e.description}</p>
                    <img src="${e.image}">

                </div>
            </div>
    
    `
})


myString += "</div>"
mainSection.innerHTML += myString