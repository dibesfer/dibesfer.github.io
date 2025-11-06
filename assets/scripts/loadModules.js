// requires /ferscript.js
// it takes header and footer and fills them with html content
let header = gettag("header")
let footer = gettag("footer")
let visitsCounter

async function getalluseragents(tableName, rowName) {
    const res = await database.from(tableName).select(rowName)//.range(1000,1500)
    //console.log(res.data)
    let visits = res.data

    // visits = visits.sort(function (a, b) {
    //     if (a.id > b.id) {
    //         return -1;
    //     }
    //     if (a.id < b.id) {
    //         return 1;
    //     }
    //     // a must be equal to b
    //     return 0;
    // });
    
    visitsCounter.textContent = visits.length
    
    return res.data

}

// we already have a visitsCounter id element
//let currentVisits = 0





async function setVisits() {
    const { data, error } = await database
        .from('visits')
        .update({ dibesfer: currentVisits })
        .eq('id', 1)
        .select()
    visitsCounter.textContent = data[0].dibesfer
}


async function getVisits(tableName, rowName) {
    const res = await database.from(tableName).select(rowName)
    currentVisits = res.data[0].dibesfer
    currentVisits++
    setVisits()
}




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
                .then(
                    () => {
                        // VISITS COUNTER
                        visitsCounter = getid("visitsCounter")
                        getVisits("visits", "dibesfer")
                        //getalluseragents("userAgents", "*")
                        
                    }
                )
                .catch(function (err) {
                    console.log('Failed to fetch page: ', err);
                });
        })
        .catch(function (err) {
            console.log('Failed to fetch page: ', err);
        });
}
insertHTML()
