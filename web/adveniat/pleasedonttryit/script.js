const supabaseUrl = 'https://kalidybwmoxhcwlfeftc.supabase.co'
const supabaseKey = 'sb_publishable__jr8YglR8G9zZQQfLPLzqw_GxL2RA-A'
const database = supabase.createClient(supabaseUrl, supabaseKey)

async function getUser() {
    const { data: { user } } = await database.auth.getUser()
    if (user) {
        alert("Youre logged")
    }
}
getUser()

async function readContent() {
    let { data: pages, error } = await database
        .from('pages')
        .select('content')

    let myInitialCode = pages[0].content
    myTextArea.value = myInitialCode
    myIframe.srcdoc = myInitialCode

    return pages[0].content
}
readContent()

async function logIn() {
    let { data, error } = await database.auth.signInWithOtp({
        email: 'dibesfer@gmail.com'

    })

    if (!error) {
        alert("We sent a confirmation link")
    }
}

function run() {
    myIframe.srcdoc = ""
    let myCode = myTextArea.value
    myIframe.srcdoc = myCode
}

async function updateContent() {
    const { data, error } = await database
        .from('pages')
        .update({ content: myTextArea.value })
        .eq('id', '1')
        .select()
    if (!error){
        alert("Changes uploaded!")
        location.reload()
    }
}

function save() {
    updateContent()
    /*
    let fileName = "index.html";
    let fileContent = myTextArea.value;
    let myFile = new Blob([fileContent], { type: 'text/html' });

    window.URL = window.URL || window.webkitURL;

    saveLink.setAttribute("href", window.URL.createObjectURL(myFile));
    saveLink.setAttribute("download", fileName);
    */
    //console.log("save")
}
//https://stackoverflow.com/questions/67865463/disable-tabbing-out-of-textarea

// function handleTab(e) {
//   if (e.key == "Tab") {
//     e.preventDefault();

//     const start = this.selectionStart;
//     const end = this.selectionEnd;

//     this.value =
//       this.value.substring(0, start) + "\t" + this.value.substring(end);

//     this.selectionStart = this.selectionEnd = start + 1;
//   }
// }