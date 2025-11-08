// let vowels = ["a", "e", "i", "o", "u","a", "e", "i", "o", "u","a", "e", "i", "o", "u", "ae"]
// let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "þ", "ch", "sh",]

let vowels = ["a", "e", "i", "o", "u","a", "e", "i", "o", "u","a", "e", "i", "o", "u", "ae"]
let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "ch", "sh",]

let textConsole = getid("textConsole")
let words = 17
let mySentence = ""
function fillASentence(){
    mySentence = ""
for (let i = 0; i < words; i++) {
    let wordlength = randomInt(1, 3)
    let boleano = randomInt(0, 1);

    for (let j = 0; j < wordlength; j++) {
        if (boleano) {
            mySentence+=vowels[randomInt(0,vowels.length-1)]
            mySentence+=consonants[randomInt(0,consonants.length-1)]

        }
        else {
            mySentence+=consonants[randomInt(0,consonants.length-1)]
            mySentence+=vowels[randomInt(0,vowels.length-1)]

        }
        
    }
    if (i < words-1) mySentence+=" "
    else{
        mySentence+=".<br><br>"
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
