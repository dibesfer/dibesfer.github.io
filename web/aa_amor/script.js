
let menuBar = document.getElementById("menuBar")

let menuAbout = document.getElementById("menuAbout")

let menuBtn = document.getElementById("menuBtn")

let menuBtnAbout = document.getElementById("menuBtnAbout")

function openMenuBar() {
    menuBar.classList.toggle("closedMenuBar")
    menuBtn.classList.toggle("rotateRight")
}

function openMenuAbout() {
    menuAbout.classList.toggle("closedMenuAbout")
    menuBtnAbout.classList.toggle("rotateLeft")
}


menuBtn.onclick = openMenuBar
menuBtnAbout.onclick = openMenuAbout


// LOAD DECORATIVE BAR IMAGES "FRANJA"
let arrayFranjas = [
    "/assets/deco/franja.png",
    "/assets/deco/franja1.png",
    "/assets/deco/franja2.png",
    "/assets/deco/franja3.png",
    "/assets/deco/franja4.png",
    "/assets/deco/franja5.png",
    "/assets/deco/franja6.png",
    "/assets/deco/franja7.png",
    "/assets/deco/franja8.png",
    "/assets/deco/franja9.png",
    "/assets/deco/franja10.png",
    "/assets/deco/franja11.png",
]

let imgFranjas = getclass("franja")
//console.log(imgFranjas)
let franja
arrayFranjas = shuffle(arrayFranjas)
for (let i = 0; i < imgFranjas.length; i++) {
    imgFranjas[i].src = arrayFranjas[i]
}

let scrollBottom = getid("scrollBottom")

function scrollToBottom() {

    if (scrollBottom.classList.contains("rotated180")) {
        window.scrollTo(0, 0);
    }
    else {
        window.scrollTo(0, document.body.scrollHeight);
    }

}

document.body.onscroll = function () { scrollFunction() }

function scrollFunction() {
    if (document.documentElement.scrollTop > 100) {

        scrollBottom.classList.add("rotated180")

    } else {
        scrollBottom.classList.remove("rotated180")
    }
    //console.log(document.documentElement.scrollTop)
}

let header = getclass("superTitle")[0]

window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
        header.classList.add('superTitleShrink');
    } else {
        header.classList.remove('superTitleShrink');
    }
});

let description = getid("description")
let descriptions = [
    "<<<---··· /// wOwOw \\\ ###--->>>",
    "<b>Dib</b>ujos y <i>es</i>critos de <u>Fer</u>",
    "<b>Dev</b> <i>Illustr</i><u>author</u>",
    "No <b>space</b> is <i>limited</i> if <u>ideas</u> fit in.",
    "What I enjoy the <b>most</b> and do <u>the best</u> is <i>creating</i>",
    "Creer o crear, tú eliges",
    "No es la <b>forma</b> ni el <i>mensaje</i>, es el <u>tono</u>",
    "It is not the <b>shape</b>, nor the <u>message</u>, it is the <i>tone</i>"
    //"Be <b class='red'>aggresive</b> defending your <i>quality</i> of <u>existing</u>. For <b>you</b>, for <i>us</i>",
]


function changeDescription() {
    let random = randomInt(0, descriptions.length - 1);
    description.innerHTML = descriptions[random]
}
changeDescription()


function instantiateAppearingItems() {
    const items = document.querySelectorAll(".appear");
    const active = function (entries) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("inview");
            } else {
                entry.target.classList.remove("inview");
            }
        });
    };
    const io2 = new IntersectionObserver(active);
    for (let i = 0; i < items.length; i++) {
        io2.observe(items[i]);
    }
}
/*
function fetchFooter() {
  fetch("/Assets/Components/footer.html")
    .then((response) => response.text())
    .then((data) => {
      console.log(data);
      portada.innerHTML += data;
    });
}*/
instantiateAppearingItems();
