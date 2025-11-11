let myInitialCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>dbf - try it</title>

    <style>

    body{
        background-color: black;
        color: white;
        font-family: sans-serif
    }

    </style>

</head>
<body>
    <header>
        <h1>dibesfer - try it</h1>
        <hr>
    </header>
    <main>
        <h2>Hello World!</h2>
        <p>How are you doing?</p>
    </main>
    <footer>
        <hr>
        <p>Made by dibesfer</p>
    </footer>
</body>
</html>`
myTextArea.value = myInitialCode
myIframe.srcdoc = myInitialCode
function run() {
    myIframe.srcdoc = ""
    let myCode = myTextArea.value
    myIframe.srcdoc = myCode
}

function save() {
    let fileName = "index.html";
    let fileContent = myTextArea.value;
    let myFile = new Blob([fileContent], { type: 'text/html' });

    window.URL = window.URL || window.webkitURL;
    
    saveLink.setAttribute("href", window.URL.createObjectURL(myFile));
    saveLink.setAttribute("download", fileName);
    //console.log("save")
}

function handleKeyDown(e) {
  if (e.key == "Tab") {
    e.preventDefault();

    const start = this.selectionStart;
    const end = this.selectionEnd;

    this.value =
      this.value.substring(0, start) + "\t" + this.value.substring(end);

    this.selectionStart = this.selectionEnd = start + 1;
  }
}