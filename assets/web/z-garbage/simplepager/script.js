var body = gettag("BODY")
var main = gettag("MAIN")
var counter = 0
var chapters = [
    
    `<h1>Chapter 1</h1>
    <h3>Description</h3>`
    ,
    `
    <h1>Chapter 2</h1>
    `,
    `
    <h1>Chapter 3</h1>
    <p>Podrías enrollarte</p>`
    
]

function changePage() {
    if (counter < chapters.length - 1) {
        counter++
        main.innerHTML = chapters[counter]
    }
    else {
        counter = 0;
        main.innerHTML = chapters[counter]
        
    }
    console.log(counter)
}