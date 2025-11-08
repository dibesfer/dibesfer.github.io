let vowels = ["a", "e", "i", "o", "u","a", "e", "i", "o", "u","a", "e", "i", "o", "u", "ae"]
let consonants = ["b", "c", "d", "f", "g", "h", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z", "þ", "ch", "sh",]
let textConsole = getid("textConsole")
let words = 100
let mySentence = ""
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
    else mySentence+="."
}


textConsole.innerText = mySentence