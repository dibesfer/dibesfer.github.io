function app() {

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


    document.body.onscroll = function () { scrollFunction() }

    function scrollFunction() {
        if (document.documentElement.scrollTop > 100) {

            scrollBottom.classList.add("rotated180")

        } else {
            scrollBottom.classList.remove("rotated180")
        }
        //console.log(document.documentElement.scrollTop)
    }

    // MAIN LOCATION
    let url = window.location.toString()
    let mainBool = false

    if (url.includes("/gallery"))
        leftMenuLinkGallery.classList.add("leftMenuLinkCurrent")
    if (url.includes("/games"))
        leftMenuLinkGames.classList.add("leftMenuLinkCurrent")
        if (url.includes("/web"))
        leftMenuLinkWeb.classList.add("leftMenuLinkCurrent")


    if (url == "http://127.0.0.1:5500/" ||
        url == "https://dibesfer.com/" ||
        url == "http://127.0.0.1:5500/index.html" ||
        url == "https://dibesfer.com/index.html"

    ) {
        mainBool = true
    }

    //console.log(url, url.length)

    if (mainBool) {

        let superTitle = getclass("superTitle")[1]
        let superTitleHtml = superTitle.innerHTML
        let superTitlePlacer = getid("superTitlePlacer")

        if (window.scrollY > 60) {

            superTitlePlacer.innerHTML = superTitleHtml
            superTitle.innerHTML = ""
            superTitle.classList.add('superTitleShrink');
            superTitlePlacer.classList.add('superTitleShrink');

        } else {

            superTitle.innerHTML = superTitleHtml
            superTitlePlacer.innerHTML = ""
            superTitle.classList.remove('superTitleShrink');
            superTitlePlacer.classList.remove('superTitleShrink');

        }

        window.addEventListener('scroll', () => {
            if (window.scrollY > 60) {

                superTitlePlacer.innerHTML = superTitleHtml
                superTitle.innerHTML = ""
                superTitle.classList.add('superTitleShrink');
                superTitlePlacer.classList.add('superTitleShrink');

            } else {

                superTitle.innerHTML = superTitleHtml
                superTitlePlacer.innerHTML = ""
                superTitle.classList.remove('superTitleShrink');
                superTitlePlacer.classList.remove('superTitleShrink');

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
    }
    else {
        console.log("SECONDARY")
    }


    async function setVisits() {
        const { data, error } = await database
            .from('visits')
            .update({ dibesfer: currentVisits })
            .eq('id', 1)
            .select()
        visitsCounter.textContent = data[0].dibesfer
    }


    async function getVisits(tableName, rowName) {
        const res = await database.from(tableName).select(rowName)
        currentVisits = res.data[0].dibesfer
        currentVisits++
        setVisits()
    }

    let visitsCounter = getid("visitsCounter")
    getVisits("visits", "dibesfer")

    setLocalVisits()

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

}

function scrollToBottom() {

    if (scrollBottom.classList.contains("rotated180")) {
        window.scrollTo(0, 0);
    }
    else {
        window.scrollTo(0, document.body.scrollHeight);
    }

}