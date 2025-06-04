
var bccounter = document.getElementById("bc-counter")

fetch("../assets/json/beauticard.json")
  .then(response => response.json())
  .then(elements => {
    
    const contenedor = document.getElementById("bc-container");
   
    elements.forEach(element => {
      const card = document.createElement("div");
      card.classList.add("beauticard");

      card.innerHTML = `
        <div class="bc-wrapper">
            <div class="beauticard-title">
                <div id="bt-1">${element.level}</div>
                <div id="bt-2"><b>${element.name}</b></div>
                <div id="bt-3">
                    <img
                        src="${element.icon}"
                        alt="">
                </div>

                <!-- 1. "Exodia" (エクゾディア, Ekuzodia)  -->
            </div>

            <div class="beauticard-stars">
                <img src="https://static.vecteezy.com/system/resources/previews/022/133/469/non_2x/star-shape-star-icon-yellow-star-in-rating-symbol-free-png.png"
                    alt="">
                <img src="https://static.vecteezy.com/system/resources/previews/022/133/469/non_2x/star-shape-star-icon-yellow-star-in-rating-symbol-free-png.png"
                    alt="">
                <img src="https://static.vecteezy.com/system/resources/previews/022/133/469/non_2x/star-shape-star-icon-yellow-star-in-rating-symbol-free-png.png"
                    alt="">
                <img src="https://static.vecteezy.com/system/resources/previews/022/133/469/non_2x/star-shape-star-icon-yellow-star-in-rating-symbol-free-png.png"
                    alt="">
                <img src="https://static.vecteezy.com/system/resources/previews/022/133/469/non_2x/star-shape-star-icon-yellow-star-in-rating-symbol-free-png.png"
                    alt="">
            </div>

            <div class="beauticard-image">
                <img src="${element.image}"
                    alt="">
            </div>

            <div class="beauticard-description">
                <h3>[${element.type}]</h3>
                <p>${element.desc}</p>
                <div id="bt-d-under">
                    <hr style="border: solid 1px black; margin: 0;">
                    <p style="text-align: right;">ATK/3000 DEF/2500 </p>
                </div>

            </div>
            <div class="beauticard-extra">
                9196 1ª Edition &copy; Ferrán Minero 1996
            </div>
        </div>
      `;
      contenedor.appendChild(card);
      bccounter.textContent = " - " + elements.length + " cards to discover!"
    });
  })
  .catch(error => {
    console.error("Error cargando Pokémones:", window.location.href + error);
  });