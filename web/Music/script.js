let playBtn = document.getElementById("playBtn")
let stopBtn = document.getElementById("stopBtn")
let title = document.getElementById("title")
let playing = false
let music
let songs = []
let songCounter = 0

// --- AudioContext + MediaSession (Firefox background / iframe fix) ---
let audioCtx
let sourceNode

function initAudioContext() {
    if (audioCtx) return
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    sourceNode = audioCtx.createMediaElementSource(music)
    sourceNode.connect(audioCtx.destination)
}

function setupMediaSession() {
    if (!("mediaSession" in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
        title: songs[songCounter].name,
        artist: songs[songCounter].author,
        album: "Free Music Player"
    })
    navigator.mediaSession.setActionHandler("play", play)
    navigator.mediaSession.setActionHandler("pause", pause)
    navigator.mediaSession.setActionHandler("nexttrack", changeSong)
    navigator.mediaSession.setActionHandler("previoustrack", prevSong)
}
// --------------------------------------------------------------------

async function readJSON() {
    await fetch('assets/json/songs.json')
        .then((response) => response.json())
        .then((json) => {
            for (let i = 1; i < json.length; i++) {
                songs.push(json[i])
            }
            songs = shuffle(songs)

            music = new Audio(songs[0].src)
            music.controls = true
            music.addEventListener('ended', changeSong)

            fillUI({ author: songs[0].author, name: songs[0].name, link: songs[0].link })
        })
}

function changeSong() {
    songCounter = (songCounter < songs.length - 1) ? songCounter + 1 : 0
    music.src = songs[songCounter].src
    play()
    fillUI({ author: songs[songCounter].author, name: songs[songCounter].name, link: songs[songCounter].link })
    setupMediaSession()
    title.scrollLeft = 0
}

function prevSong() {
    songCounter = (songCounter > 0) ? songCounter - 1 : songs.length - 1
    music.src = songs[songCounter].src
    play()
    fillUI({ author: songs[songCounter].author, name: songs[songCounter].name, link: songs[songCounter].link })
    setupMediaSession()
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
    playing ? pause() : play()
}

function play() {
    initAudioContext()
    if (audioCtx.state === "suspended") audioCtx.resume()
    music.play()
    playBtn.src = "assets/icons/pause.svg"
    playBtn.style = "background-color:lime"
    playing = true
    setupMediaSession()
}

function pause() {
    music.pause()
    playBtn.src = "assets/icons/play.svg"
    playBtn.style = "background-color:limegreen"
    playing = false
}

function stop() {
    music.pause()
    playBtn.src = "assets/icons/play.svg"
    playBtn.style = "background-color:limegreen"
    playing = false
    music.currentTime = 0
}