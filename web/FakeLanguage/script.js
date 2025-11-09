// let vowels = ["a", "e", "i", "o", "u","a", "e", "i", "o", "u","a", "e", "i", "o", "u", "ae"]
// let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "þ", "ch", "sh",]

let vowels = ["a", "e", "i", "o", "u", "a", "e", "i", "o", "u", "a", "e", "i", "o", "u", "ae"]
let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "ch", "sh"]

let textConsole = getid("textConsole")
let words = 17
let mySentence = ""

function fillASentence() {
    mySentence = ""
    for (let i = 0; i < words; i++) {
        let wordlength = randomInt(1, 3)
        let probabilidad = randomInt(1, 3)
        let probabilidadComa = randomInt(1,10)

        for (let j = 0; j < wordlength; j++) {

            switch (probabilidad) {
                case 1:
                    if (wordlength == 1)
                    mySentence += vowels[randomInt(0, vowels.length - 1)]
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
        if (i < words - 1) {
            if (probabilidadComa < 10){
                mySentence += " "
            }
            else {
                mySentence += ", "
            }
        } 
        else {
            mySentence += ".<br><br>"
            mySentence = capitalizeFirstLetter(mySentence)
            textConsole.innerHTML += mySentence
        }
    }
}
fillASentence()
fillASentence()
fillASentence()
// https://stackoverflow.com/questions/1026069/how-do-i-make-the-first-letter-of-a-string-uppercase-in-javascript
function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
