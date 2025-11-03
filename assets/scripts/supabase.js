const supabaseUrl = 'https://qugihsopwjemzakhrbvw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z2loc29wd2plbXpha2hyYnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg0OTQxMDksImV4cCI6MjAxNDA3MDEwOX0.1q5fBic1cjueaiP2-p6W19C68ye8FTPLFne2a-fKwZ8'
const database = supabase.createClient(supabaseUrl, supabaseKey)

var localVisits = localStorage.getItem("dibesferLocalVisits")
if(localVisits == null){
    localVisits = 1
}
else {
    localVisits++
}
localStorage.setItem("dibesferLocalVisits", localVisits)
//console.log(localVisits)

function setLocalVisits(){
    localVisitsDisplay.textContent = localVisits
}

//REALTIME 
// Create a function to handle inserts
const handleInserts = (payload) => {
    //console.log('Change received!', payload)
   getOnlyResources("visits", "dibesfer")
}

// Listen to inserts
database
   .channel('visits')
   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'visits' }, handleInserts)
   .subscribe()



async function insertUserAgent(){

    let myUserAgent = window.navigator.userAgent
    var userLang = navigator.language || navigator.userLanguage; 
    var userScreen = "Width: " + innerWidth + " Height: " + innerHeight
    var userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    if (localVisits >= 0){
    const { data, error } = await database
    .from("userAgents")
    .insert([
      {
            userAgent : myUserAgent,
            http : window.location.href,
            from : document.referrer,
            localVisits : localVisits,
            language : userLang,
            size : userScreen,
            timezone : userTimeZone
            //url: window.location.href
            //email: param1,
            //username: param1.split("@")[0]
        },
    ])
    .select()
    }
}
insertUserAgent()

/* if (document.referrer && document.referrer != "")
    //console.log('Thanks for visiting this site from ' + document.referrer);
 */

async function insertResources(tableName) {
    const { data, error } = await database
        .from(tableName)
        .update([
          {
                dibesfer : currentVisits
                //url: window.location.href
                //email: param1,
                //username: param1.split("@")[0]
            },
        ]).eq("id" , 1)
        .select()
    
    //getResources("visits", "dibesfer")
}



/* .from('visits')
.update({ other_column: 'otherValue' })

.select()
 */





//insertResources("visits")
//getResources("visits", "dibesfer")
var currentVisits = 0
async function getResources(tableName, rowName) {
    const res = await database.from(tableName).select(rowName )
    //console.log(res.data[0].dibesfer)
    currentVisits = res.data[0].dibesfer
    currentVisits++
    insertResources("visits")
    if (res.data[0] != undefined) {
        
        totalVisitsCounter.textContent = currentVisits
    }
}

async function getOnlyResources(tableName, rowName) {
    const res = await database.from(tableName).select(rowName )//.range(3000,5000)
    //console.log(res.data[0].dibesfer)

    if (res.data[0] != undefined) {
        
        totalVisitsCounter.textContent = res.data[0].dibesfer
    }
}
