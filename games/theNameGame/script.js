
let mySentences = {
    title : "Srasaui",
    desc : "Oredaianami sari tanta",
    img : `<img src="https://upload.wikimedia.org/wikipedia/commons/5/54/Galaxy_blue.jpg" alt="">`}

let myCards = document.getElementsByClassName("cardsContainer")[0]
let myString = ""
myCards.innerHTML += `

<div class="card">
                
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/54/Galaxy_blue.jpg" alt="">
                <h2 class="title">Heraudine</h2>
                <p>Di minish cap. Asouse saradam tarik.</p>
            </div>
            <div class="card">
                
                <h2 class="title">Sarasoi</h2>
                <p>In mauri trep on</p>
                <p>Oturep aunota sabe dii</p>
            </div>
            <div class="card">
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/80/Coiled_Galaxy.jpg">
                <h2 class="title">Aharam</h2>
                <p>Asaura dorea paritomo</p>
            </div>
            <div class="card">
                <h2 class="title">Aharam</h2>
                <p>Asaura dorea paritomo</p>
            </div>
            <div class="card">
                <h2 class="title">Araudaram</h2>
                <p>Aepisteto.</p>
            </div>
`

myString += `<div class="card">
    <img src="${mySentences.img}" alt="a Galaxy">
    <h2 class="title">${mySentences.title}</h2>
                <p>${mySentences.desc}</p>
            </div>
`

myCards.innerHTML += myString
