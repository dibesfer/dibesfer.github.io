let words = ["orarum",
    "ipsalom",
    "immanu",
    "eccisont",
    "acauda",
    "sore dillo",
    "cucum",
    "orottawa",
    "innamar",
    "dironesai",

    "accusant",
    "iauridisei",
    "tela da rassil",
    "icosaedro",
    "arauptaint",
    "ereudimos",
    "illodarta",
    "accunt ittaras",
    "onnoveno",
    "disse",

    "iaura sappirae",
    "okki dokki toriyoki",
    "eucotanto",
    "seudomisticismo",
    "ipsalaar araia",
    "ecunta allaras",
    "sabe dire di mans",
    "annem auntu",
    "jure pura juventus",
    "teressillae",

    "insa terra catastrofa",
    "eppaura",
    "insadait",
    "sharifela",
    "okkonama",
    "santurina",
    "shideila",
    "ununtuna",
    "ommonanti",
    "ecarisaia",

    "ialudera",
    "onno tapise suma",
    "sebanatia",
    "cari seli dema",
    "apa tari seda",
    "olo noresi tauri",
    "shadisennai",
    "ogoro sadite",
    "epi yidau",
    "auc erant",

    "update",
    "oustragonof",
    "minerov",
    "axauviram",
    "fostra erte",
    "ânimos",
    "cilo garam",
    "sanaderas gateo",
    "sokarimi ikkau sappa",
    "simulatione pensamento",

    "nostra famiglia",
    "wariod warafat",
    "enetece ne teri",
    "darugon buro zet",
    "maincraft uber ales",
    "satilin garudo",
    "iou tube ini vidius",
    "et iero uchom avix",
    "gaio sono et urufid",
    "oropot panalat",

    "netiramsa ucara",
    "olloderei eredaiu",
    "ufsant orucum origam",
    "canto te sento",
    "igod o celo made nagar!",
    "ipso facto",
    "dolorem psium",
    "ocunat sabide eferas?",
    "acta terandi saci",
    "- - - * - - -",

    "oroli ganmantam",
    "sumidei eieda godda sistae",
    "inna corasonai da lore",
    "sotira ucunat corini daglia",
    "exadecima lalalari",
    "esternocleidomaistoideo",
    "//||-oO*Oo-||\\",
    "uram imperio resurgitas",
    "rrraaawww",
    "wwwaaarrr",

    "dificultas meritoriasm sunit",
    "golegoit irocti epsi pizzawa",
    "oronut susi ina salmona",
    "eretuna umidaia recita",
    "liberitas nudiamer caia iselan",
    "~$~&~€~",
    "FUS RRO DAW!",
    "Land of Creators",
    "Creatore Terrae",
    "Tierra de Creadores"
]
let commandInput = document.getElementById("commandInput")
let levelOutput = document.getElementById("levelOutput")
let level = localStorage.getItem("commandGameLevel")
if (level == null){
    level = 0
}



levelOutput.textContent = level
let wordOutput = document.getElementById("wordOutput")
wordOutput.textContent = words[level]
let commandLine = document.getElementById("commandLine")
let youWonMessage = document.getElementById("youWonMessage")

if (level == words.length){
    youWonMessage.style.display = "block";
    commandLine.style.display = "none"
    console.log("hello")
}

function checkWord(){

    if (commandInput.value == words[level] && level < words.length-1){
        level++
        localStorage.setItem("commandGameLevel", level)
        levelOutput.textContent = level
        wordOutput.textContent = words[level]
        commandInput.value = ""
    } else if (commandInput.value == words[level] && level == words.length-1){
        level++
        localStorage.setItem("commandGameLevel", level)
        levelOutput.textContent = level
        commandLine.style.display = "none"
        youWonMessage.style.display = "block"
    }
}

commandInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        checkWord()
      }
    });

function restart(){
    localStorage.setItem("commandGameLevel", 0)
    level = 0
    levelOutput.textContent = 0
    wordOutput.textContent = words[level]
    youWonMessage.style.display = "none"
    commandLine.style.display = "block"
    commandInput.value = ""
}