const supabaseUrl = 'https://qugihsopwjemzakhrbvw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1Z2loc29wd2plbXpha2hyYnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg0OTQxMDksImV4cCI6MjAxNDA3MDEwOX0.1q5fBic1cjueaiP2-p6W19C68ye8FTPLFne2a-fKwZ8'
const database = supabase.createClient(supabaseUrl, supabaseKey)

const userEmail = document.getElementById("userEmail")
const userPass = document.getElementById("userPass")
const userNameDisplay = document.getElementById("userNameDisplay")
const logOutBtn = document.getElementById("logOutBtn")
const signInDiv = document.getElementById("signInDiv")
const signUpBtn = document.getElementById("signUpBtn")
const identifyBtn = document.getElementById("identifyBtn")
//const signInForm = document.getElementById("signInForm")
const signInMain = document.getElementById("signInMain")
const checkIn = document.getElementById("checkIn")
let usernameString
let myUserTable
let usersOnline = document.getElementById("usersOnline")

// IMPORTANT
identifyBtn.addEventListener("click", toggleSignInMain)

function toggleSignInMain(e) {

    e.preventDefault()
    if (signInMain.style.display == "none") {

        // SHOW SIGN IN MAIN
        signInMain.style.display = "block"
        identifyBtn.style.backgroundColor = "darkgray"
    }
    else {

        if (!userEmail.value || !userPass.value) {
            signInAdvice.textContent = "Please fill both fields"
        }
        else {
            getUsersTable(userEmail.value)
        }
        // HIDE SIGN IN MAIN
        //signInMain.style.display = "none"
        //identifyBtn.style.backgroundColor = "blue"

    }
    console.log(signInMain.style)
}

function showSignUpDiv() {

    signInDiv.classList.remove("invisible")

    setTimeout(() => {
        window.addEventListener('click', handleClick)
    }, 1);
}

function handleClick(event) {
    if (!document.getElementById('signInDiv').contains(event.target)) {

        window.removeEventListener('click', handleClick)
        signInDiv.classList.add("invisible")
        console.log("heeey")
    }
}




let myUser
async function getUser() {
    const { data: { user } } = await database.auth.getUser()
    if (user) {

        usernameString = user.email.split("@")[0]
        console.log(user.email)
        signInAdvice.textContent = "You are logged as " + usernameString
        userNameDisplay.innerHTML = `<a href="user/###${usernameString}">${usernameString}</a>`

        signInDiv.style.display = "none"
        myUser = user
       
        const channel = database.channel("online-users", {
            config: {
                presence: { key: myUser.id }
            }
        })

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState()
                console.log("Online users:", state)
                const count = Object.keys(channel.presenceState()).length
                usersOnline.textContent = count
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({
                        user_id: myUser.id,
                        username: myUser.email
                    })
                }
            })

        
        console.log(myUser)
        let myEmail = user.email
        const res = await database.from("users").select("*").eq('email', myEmail)//.range(3000,5000)
        //console.log(res.data[0].dibesfer)
        let result = res.data

        if (result.length > 0) {

            if (!res.data[0].confirmed) {

                const { data, error } = await database
                    .from('users')
                    .update({ confirmed: true })
                    .eq('email', myEmail)
                    .select()

                if (!error) {
                    alert("Your account is now confirmed")
                }
            }
        }

        console.log(myUser.last_sign_in_at)
        return user
    }

    else {
        console.log("no user logged in")
        logOutBtn.style.display = "none"
        logOutBtnWrapper.style.display = "none"
        userNameDisplay.addEventListener("click", showSignUpDiv)
        

        const channel = database.channel("online-users", {
            config: {
                presence: { key: 0 }
            }
        })

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState()
                console.log("Online users:", state)
                const count = Object.keys(channel.presenceState()).length
                usersOnline.textContent = count
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({
                        
                    })
                }
            })

        
        return null
    }
}
getUser()




async function loadUserTable() {
    const res = await database.from("users").select("*")
    //console.log(res.data[0].dibesfer)
    let result = res.data

    if (result.length > 0) {
        //EMAIL ALREADY REGISTERED, LOG IN
        myUserTable = result
        console.log(result)
        getFullTable("chat")
    }

}

loadUserTable()
async function getUsersTable(myEmail) {

    const res = await database.from("users").select("*").eq('email', myEmail)//.range(3000,5000)
    //console.log(res.data[0].dibesfer)
    let result = res.data

    if (result.length > 0) {
        //EMAIL ALREADY REGISTERED, LOG IN
        logIn()
    }
    else {
        //ELSE, SIGN IN

        signUp()

    }

    console.log(result)
    //RECIEVED DATA SUPER IMPORTANT
    //console.log(result)

    //result.forEach(element => {
    //let myTime = new Date(element.created_at)
    //createMsg(myTime, element.author, element.message)
    //});

    //chatScreen.scrollTo(0, chatScreen.scrollHeight)
    // console.log(result)
    // //currentVisits++
    // //insertResources("visits")
    // if (res.data[0] != undefined) {

    //     chatScreen.textContent = result
    // }
}
//getUsersTable()

//console.log(myUser)

if (signUpBtn) signUpBtn.addEventListener("click", signUp)

logOutBtn.addEventListener("click", logOut)

// var localVisits = localStorage.getItem("dibesferLocalVisits")
// if (localVisits == null) {
//   localVisits = 1
// }
// else {
//   localVisits++
// }
// localStorage.setItem("dibesferLocalVisits", localVisits)
//console.log(localVisits)

function setLocalVisits() {
    localVisitsDisplay.textContent = localVisits
}

// Registro de nuevo usuario
async function signUp() {
    let { data, error } = await database.auth.signUp({
        email: userEmail.value,
        password: userPass.value,
        // options: { redirectTo: "https://dibesfer.com/web/javascript/chat"  },
    })
    console.log("---SIGNUP---")
    console.log(data)
    const newUser = data.user

    if (error) {
        console.log(error)
        signInAdvice.style.color = "red"
        signInAdvice.textContent = error.message
    } else {

        console.log("We're gonna create a user profile")

        const { data, error } = await database
            .from("users")
            .insert([
                {
                    user_id: newUser.id,
                    email: userEmail.value,
                    username: userEmail.value.split("@")[0],
                    profilepicture: "https://upload.wikimedia.org/wikipedia/commons/4/40/Anonymous_mask.svg"


                },
            ])
            .select()
        if (!error) signInAdvice.textContent = "We sent a confirmation url to your email."
        else {
            console.log(error.message)
        }
    }



}
//signUp()

async function logIn() {
    let myEmail
    let { data, error } = await database.auth.signInWithPassword({
        email: userEmail.value,
        password: userPass.value
    })
    console.log(data)
    console.log(error)
    if (error) {
        signInAdvice.style.color = "red"
        signInAdvice.textContent = error.message
    }
    else {
        //getUser()
        myEmail = data.user.email
        const res = await database.from("users").select("*").eq('email', myEmail)//.range(3000,5000)
        //console.log(res.data[0].dibesfer)
        let result = res.data

        if (result.length > 0) {

            if (!res.data[0].confirmed) {

                const { data, error } = await database
                    .from('users')
                    .update({ confirmed: true })
                    .eq('email', myEmail)
                    .select()

                if (!error) {
                    alert("Your account is now confirmed")
                    location.reload()
                }
            }
            else {
                location.reload()
            }
        }
        else {
            location.reload()

        }
    }
}

async function logOut() {
    let { error } = await database.auth.signOut()
    location.reload()
}

async function magicLink() {
    let { data, error } = await database.auth.signInWithOtp({
        email: 'dibesfer@gmail.com'
    })
}
//magicLink()
//REALTIME 
// Create a function to handle inserts
const handleInserts = (payload) => {
    console.log('Change received!', payload)
    getOnlyLastMessage(payload.new)
    //getOnlyResources("chat", "dibesfer")
}

// Listen to inserts
database
    .channel('chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, handleInserts)
    .subscribe()

function createMsg(time, author, message) {
    let parahraphMsg = document.createElement("p")

    let myTime = document.createElement("span")
    myTime.classList = "displayTime"
    myTime.textContent = clockFormat(time)
    myTime.title = time
    let myProfilePicture = document.createElement("img")

    myProfilePicture.src = "https://upload.wikimedia.org/wikipedia/commons/a/a6/Anonymous_emblem.svg"
    if (author != "Anonymous") {
        myUserTable.forEach(
            usuario => {
                if (usuario.username == author) {
                    myProfilePicture.src = usuario.profilepicture
                }
            }

        )
    }

    myProfilePicture.style = `
            width: 1rem;
            height: 1rem;
            // background-color: white;
            // border-radius: 50%;
            object-fit: cover;
            // border: solid 1px white;
            margin: 0 5px;
            `
    let myAuthor = document.createElement("span")
    myAuthor.classList = "displayAuthor"
    myAuthor.textContent = "" + author
    if (author != "Anonymous") myAuthor.innerHTML = "<a href='user/###" + author + "'>" + author + "</a>"
    let myMessage = document.createElement("span")
    myAuthor.innerHTML += ": "
    myMessage.textContent = message
    parahraphMsg.appendChild(myTime)

    parahraphMsg.appendChild(myProfilePicture)
    parahraphMsg.appendChild(myAuthor)
    //parahraphMsg.innerHTML += "<br>"
    parahraphMsg.appendChild(myMessage)
    chatScreen.appendChild(parahraphMsg)
}


function getOnlyLastMessage(newInsert) {

    let myTime = new Date(newInsert.created_at)

    if (newInsert.length) {

        newInsert.forEach(element => {
            myTime = new Date(element.created_at)
            createMsg(myTime, element.author, element.message)

        });

    }

    else {

        createMsg(myTime, newInsert.author, newInsert.message)

        // chatScreen.innerHTML += `

        //     <p title="${myTime}"><span class="displayTime">${clockFormat(myTime)}</span> <span><b>${newInsert.author}</b>: </span><span>${newInsert.message}</span></p>

        //     `


    }

    chatScreen.scrollTo(0, chatScreen.scrollHeight)

}

async function insertUserAgent() {

    let myUserAgent = window.navigator.userAgent
    var userLang = navigator.language || navigator.userLanguage;
    var userScreen = "Width: " + innerWidth + " Height: " + innerHeight
    var userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    if (localVisits >= 0) {
        const { data, error } = await database
            .from("userAgents")
            .insert([
                {
                    userAgent: myUserAgent,
                    http: window.location.href,
                    from: document.referrer,
                    localVisits: localVisits,
                    language: userLang,
                    size: userScreen,
                    timezone: userTimeZone
                    //url: window.location.href
                    //email: param1,
                    //username: param1.split("@")[0]
                },
            ])
            .select()
    }
}
//insertUserAgent()

/* if (document.referrer && document.referrer != "")
    //console.log('Thanks for visiting this site from ' + document.referrer);
 */

async function signLogIn() {
    logIn()
}

if (checkIn) checkIn.addEventListener("click", signLogIn)
chatForm.addEventListener("submit", sendMessage)
loginForm.addEventListener("submit", toggleSignInMain)

async function sendMessage(e) {

    e.preventDefault()
    //Get parameters
    let myAuthor = "Anonymous"

    if (myUser) myAuthor = myUser.email.split("@")[0]
    let myMessage = userInput.value

    if (myMessage.trim() === "") return

    if (myAuthor && myMessage) {

        const { data, error } = await database
            .from("chat")
            .insert([
                {
                    user_id: myUser ? myUser.id : null,
                    author: myAuthor,
                    message: myMessage
                    //url: window.location.href
                    //email: param1,
                    //username: param1.split("@")[0]
                },
            ])//.select()

        console.log(error)

        userInput.value = ""
    }

    else {
        chatInputAdvice.style.color = "red"
        chatInputAdvice.textContent = "You can't send an empty message"

    }
    //getResources("visits", "dibesfer")
}

async function insertResources(tableName) {
    const { data, error } = await database
        .from(tableName)
        .insert([
            {
                author: "Eulalio",
                message: "Hola mundo!"
                //url: window.location.href
                //email: param1,
                //username: param1.split("@")[0]
            },
        ]).select()

    //getResources("visits", "dibesfer")
}


// INITIALIZE 
//insertResources("chat")



/* .from('visits')
.update({ other_column: 'otherValue' })
 
.select()
 */





//insertResources("visits")
//getResources("visits", "dibesfer")
var currentVisits = 0

async function getFullTable(tableName) {

    const res = await database.from(tableName).select("*").order('id', { ascending: true })//.range(3000,5000)
    //console.log(res.data[0].dibesfer)
    let result = res.data

    //RECIEVED DATA SUPER IMPORTANT
    //console.log(result)
    let oldTime = new Date(result[0].created_at)

    result.forEach(element => {
        let myTime = new Date(element.created_at)
        if (oldTime.getDate() != myTime.getDate()) {
            let myDate = document.createElement("p")
            myDate.textContent = "---" + myTime.getFullYear() + "/" + needsazero(myTime.getMonth() + 1) + "/" + needsazero(myTime.getDate()) + "---"
            myDate.classList = "displayTime"

            chatScreen.appendChild(myDate)
        }
        createMsg(myTime, element.author, element.message)
        oldTime = myTime
    });

    chatScreen.scrollTo(0, chatScreen.scrollHeight)
    // console.log(result)
    // //currentVisits++
    // //insertResources("visits")
    // if (res.data[0] != undefined) {

    //     chatScreen.textContent = result
    // }
}



function needsazero(number) {
    let result

    if (number < 10) {
        result = "0" + number
        return result
    }
    return number
}

function clockFormat(time) {

    let hours
    let minutes
    let seconds

    hours = time.getHours()
    minutes = time.getMinutes()
    seconds = time.getSeconds()

    hours = needsazero(hours)
    minutes = needsazero(minutes)
    seconds = needsazero(seconds)

    return hours + ":" + minutes + ":" + seconds

}

async function getResources(tableName, rowName) {
    const res = await database.from(tableName).select(rowName)//.range(3000,5000)
    //console.log(res.data[0].dibesfer)
    currentVisits = res.data[0].dibesfer
    currentVisits++
    insertResources("visits")
    if (res.data[0] != undefined) {

        totalVisitsCounter.textContent = currentVisits
    }
}

async function getOnlyResources(tableName, rowName) {
    const res = await database.from(tableName).select(rowName)//.range(3000,5000)
    //console.log(res.data[0].dibesfer)

    if (res.data[0] != undefined) {

        totalVisitsCounter.textContent = res.data[0].dibesfer
    }
}





//let myNewStyle = document.createElement("style")

/*
myNewStyle.innerHTML = `

                
                @font-face {
                font-family: UbuntuMono;
                src: url(/assets/fonts/UbuntuMono-Regular.ttf);
                }
                body {
                font-family: UbuntuMono, monospace;
                font-size: large;

                background-color: black;
                color: white
            }
        `
document.head.appendChild(myNewStyle)`*/
