// let vowels = ["a", "e", "i", "o", "u","a", "e", "i", "o", "u","a", "e", "i", "o", "u", "ae"]
// let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "þ", "ch", "sh",]

let vowels = ["a", "e", "i", "o", "u"]
let consonants = ["b", "c", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "z"]

let emojis = ["🖌️", "✏️", "🛠️", "⚒️", "⛏️", "🔨", "🗝️", "🔑", "🌀", "📡", "⚖️", "⚜️", "🔱", "🔆", "⚕️", "💠", "✳️", "✴️", "❇️"]
let textConsole = getid("textConsole")
let mySentence = ""

let languageMode = "alien"

function fillASentence(words, wordLength) {
    mySentence = ""
    for (let i = 0; i < words; i++) {
        let probabilidadComa = randomInt(1, 10)
        let probabilidadSigno = randomInt(1, 10)

        mySentence += generateWord(wordLength)

        if (i < words - 1) {
            if (probabilidadComa < 10) {
                mySentence += " "
            }
            else {
                mySentence += ", "
            }
        }
        else {
            if (probabilidadSigno < 9) {
                mySentence += "."
            } else if (probabilidadSigno == 9) {
                mySentence += "!"
            } else if (probabilidadSigno == 10) {
                mySentence += "?"
            }
            //mySentence += " " + emojis[randomInt(0,emojis.length-1)]

            mySentence = capitalizeFirstLetter(mySentence)
            if (textConsole) {
                mySentence += "<br><br>"
                textConsole.innerHTML += mySentence
            }
            return mySentence
        }
    }
}
generate()

// https://stackoverflow.com/questions/1026069/how-do-i-make-the-first-letter-of-a-string-uppercase-in-javascript
function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function generate() {
    if (textConsole) textConsole.innerHTML = "<br>"

    switch (languageMode) {
        case "alien":
            fillASentence(14)
            fillASentence(14)
            fillASentence(14)
            break;

        case "poetry":
            poetry()
            break;

        case "africanus":

            fillASentence(10, 4)

            fillASentence(10, 4)

            fillASentence(10, 4)


            break;

        case "word":
            textConsole.innerHTML = `
            <h2 style="text-align: center">${capitalizeFirstLetter(generateWord(8))}</h2>
            <h2 style="text-align: center">${capitalizeFirstLetter(generateWord(8))}</h2>
            <h2 style="text-align: center">${capitalizeFirstLetter(generateWord(8))}</h2>
            
            `

            break;

        case "emojis":

            getAllEmojis().then((emojis) => {
                emojis = emojis.split(" ")
                textConsole.innerHTML = ""
                
                for (let i = 0; i < 200; i++) {
                    textConsole.textContent += emojis[randomInt(0,emojis.length-1)]
                    
                }
                
            })


            break;

        default:
            break;
    }


}

function poetry() {

    let poetry_last_two_vowels_1 = ""
    let poetry_last_two_vowels_2 = ""
    console.log("poetry")

    //generate 4 words
    //save two last vowels from 4th word
    //generate 4 words
    //save two last vowels from 4th word
    //generate 4 words
    //use 2 last vowels
    //generate 4 words
    //use 2 last vowels
    words = 4
    mySentence = ""
    for (let i = 0; i < words; i++) {
        let wordlength = randomInt(1, 3)

        let probabilidadComa
        let probabilidadSigno

        for (let j = 0; j < wordlength; j++) {

            let probabilidad = randomInt(1, 2)
            probabilidadComa = randomInt(1, 10)
            probabilidadSigno = randomInt(1, 10)

            switch (probabilidad) {
                case 1:
                    mySentence += vowels[randomInt(0, vowels.length - 1)]
                    mySentence += consonants[randomInt(0, consonants.length - 1)]



                    break;

                case 2:
                    mySentence += consonants[randomInt(0, consonants.length - 1)]
                    mySentence += vowels[randomInt(0, vowels.length - 1)]
                    break;

                default:
                    break;
            }

        }
        if (i < words - 1) {
            if (probabilidadComa < 10) {
                mySentence += " "
            }
            else {
                mySentence += ", "
            }
        }
        else {
            if (probabilidadSigno < 9) {
                mySentence += "."
            } else if (probabilidadSigno == 9) {
                mySentence += "!"
            } else if (probabilidadSigno == 10) {
                mySentence += "?"
            }
            //mySentence += " " + emojis[randomInt(0,emojis.length-1)]
            mySentence += "<br><br>"
            mySentence = capitalizeFirstLetter(mySentence)

            // lets take the two last vowels
            mySentence = strip(mySentence)
            for (let i = mySentence.length - 1; i > 0 && poetry_last_two_vowels_1.length < 2; i--) {

                if (vowels.includes(mySentence[i])) {
                    mySentence += "<br>" + mySentence[i] + "<br>"
                    poetry_last_two_vowels_1 += mySentence[i]
                }
            }

            textConsole.innerHTML += mySentence
        }
    }

    words = 4
    mySentence = ""
    for (let i = 0; i < words; i++) {
        let wordlength = randomInt(1, 3)

        let probabilidadComa
        let probabilidadSigno

        for (let j = 0; j < wordlength; j++) {

            let probabilidad = randomInt(1, 2)
            probabilidadComa = randomInt(1, 10)
            probabilidadSigno = randomInt(1, 10)

            switch (probabilidad) {
                case 1:
                    mySentence += vowels[randomInt(0, vowels.length - 1)]
                    mySentence += consonants[randomInt(0, consonants.length - 1)]
                    break;

                case 2:
                    mySentence += consonants[randomInt(0, consonants.length - 1)]
                    mySentence += vowels[randomInt(0, vowels.length - 1)]
                    break;

                default:
                    break;
            }

        }
        if (i < words - 1) {
            if (probabilidadComa < 10) {
                mySentence += " "
            }
            else {
                mySentence += ", "
            }
        }
        else {
            if (probabilidadSigno < 9) {
                mySentence += "."
            } else if (probabilidadSigno == 9) {
                mySentence += "!"
            } else if (probabilidadSigno == 10) {
                mySentence += "?"
            }
            //mySentence += " " + emojis[randomInt(0,emojis.length-1)]
            mySentence += "<br><br>"
            mySentence = capitalizeFirstLetter(mySentence)

            // lets take the two last vowels
            mySentence = strip(mySentence)
            for (let i = mySentence.length - 1; i > 0 && poetry_last_two_vowels_2.length < 2; i--) {

                if (vowels.includes(mySentence[i])) {
                    mySentence += "<br>" + mySentence[i] + "<br>"
                    poetry_last_two_vowels_2 += mySentence[i]
                }
            }

            textConsole.innerHTML += mySentence
        }
    }
}

changeLanguageMode()
function changeLanguageMode() {
    if (document.getElementById("mySelect")) {
        let x = document.getElementById("mySelect").value;
        languageMode = x
        generate()
    }
}

function strip(html) {
    return html.replace(/<\s*[^>]*>/gi, '');
}

function generateWord(length) {
    if (length == null) {
        length = randomInt(1, 7)
    }
    if (length == 1) return randomVowel()
    return randomSequence(length)
}

function randomVowel() {
    return vowels[randomInt(0, vowels.length - 1)]
}

function randomConsonant() {
    return consonants[randomInt(0, consonants.length - 1)]
}

function randomSequence(length) {
    let sequence = ""
    let bool = randomInt(0, 1)
    let lever = true
    if (bool) {
        for (let i = 0; i < length; i++) {
            if (lever) {
                sequence += randomVowel()
                lever = false
            }
            else if (!lever) {
                sequence += randomConsonant()
                lever = true
            }
        }
    }
    else {
        for (let i = 0; i < length; i++) {
            if (lever) {
                sequence += randomConsonant()
                lever = false
            }
            else if (!lever) {
                sequence += randomVowel()
                lever = true
            }
        }
    }
    return sequence
}

/*     OLD GENERATOR
for (let j = 0; j < wordlength; j++) {

    let probabilidad = randomInt(1, 3)
    probabilidadComa = randomInt(1, 10)
    probabilidadSigno = randomInt(1, 10)


    switch (probabilidad) {
        case 1:
            if (wordlength == 1) {

                mySentence += vowels[randomInt(0, vowels.length - 1)]

            }
            else {

                mySentence += vowels[randomInt(0, vowels.length - 1)]
                mySentence += consonants[randomInt(0, consonants.length - 1)]

            }
            break;

        case 2:
            mySentence += vowels[randomInt(0, vowels.length - 1)]
            mySentence += consonants[randomInt(0, consonants.length - 1)]
            break;

        case 3:
            mySentence += consonants[randomInt(0, consonants.length - 1)]
            mySentence += vowels[randomInt(0, vowels.length - 1)]
            break;

        default:
            break;
    }

}
            */