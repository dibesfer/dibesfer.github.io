let playBtn = document.getElementById("playBtn")
let stopBtn = document.getElementById("stopBtn")
let title = document.getElementById("title")
let playing = false
let music
let songs = []
let songCounter = 0

async function readJSON() {

    await fetch('assets/json/songs.json')
        .then((response) => response.json())
        .then((json) => {
            let songID
            //we start for 1 because 0 is a template entry
            for (let i = 1; i < json.length; i++) {
                console.log()
                songs.push(
                    json[i]
                )
            }

            songs = shuffle(songs)
            console.log(songs)

            music = new Audio(songs[0].src)
            music.controls = true
            
            music.addEventListener('ended', changeSong);

            let UIOptions = { author: songs[0].author, name: songs[0].name, link: songs[0].link }
            fillUI(UIOptions)


        });
}

function changeSong(){
    if (songCounter < songs.length-1){
        songCounter++
    }
    else {
        songCounter = 0
    }
    music.src = songs[songCounter].src
    play()
    let UIOptions = { author: songs[songCounter].author, name: songs[songCounter].name, link: songs[songCounter].link }
    fillUI(UIOptions)
 title.scrollLeft = 0
    
}

readJSON()

function fillUI(options = {}) {
    authorDisplay.textContent = options.author ?? "Unknown"
    nameDisplay.textContent = options.name ?? "Unknown"
    linkDisplay.href = options.link ?? "#unknown"
}


playBtn.addEventListener("click", playToggle)
stopBtn.addEventListener("click", stop)
skipBtn.addEventListener("click", changeSong)

function playToggle() {
    if (playing) {
        // pause
        pause()
    }
    else {
        play()
       
    }
}

function play(){
 music.play();
        playBtn.src = "assets/icons/pause.svg"
        playing = true
}

function pause(){
    music.pause();
    playBtn.src = "assets/icons/play.svg"
    playing = false
}

function stop(){
    music.pause();           // Stops the music
    playBtn.src = "assets/icons/play.svg"
    playing = false
    music.currentTime = 0;
}


