let listOfAudiovisuals = [

    "https://upload.wikimedia.org/wikipedia/commons/7/7d/Lepsius-Projekt_tw_1-2-108.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/c/c4/Al-Attarine_Madrasa_%288753601695%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/8/8a/Vertical_Japanese_Lord_Prayer.png",
    "https://upload.wikimedia.org/wikipedia/commons/7/75/Aleppo_Codex_Joshua_1_1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/8/88/Greek_signature_of_Anthim_the_Iberian%2C_1715.svg",
]

changeImage()
setInterval("changeImage()", 750)

function changeImage(){
    audiovisuals.src = listOfAudiovisuals[randomInt(0,listOfAudiovisuals.length-1)]
    
}
