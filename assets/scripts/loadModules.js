// requires /ferscript.js
// it takes header and footer and fills them with html content
let header = gettag("header")
let footer = gettag("footer")

function insertHTML() {

    fetch('/assets/modules/header.html')
        .then(function (response) {
            // When the page is loaded convert it to text
            return response.text()
        })
        .then(function (html) {
            header.innerHTML = html;
            fetch('/assets/modules/footer.html')
                .then(function (response) {
                    // When the page is loaded convert it to text
                    return response.text()
                })
                .then(function (html) {
                    footer.innerHTML = html
                })
                .catch(function (err) {
                    console.log('Failed to fetch page: ', err);
                });
        })
        .catch(function (err) {
            console.log('Failed to fetch page: ', err);
        });
}
insertHTML()
