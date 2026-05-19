// Using Supabase Webochi project.
const supabaseUrl = 'https://kalidybwmoxhcwlfeftc.supabase.co'
const supabaseKey = 'sb_publishable__jr8YglR8G9zZQQfLPLzqw_GxL2RA-A'
const database = supabase.createClient(supabaseUrl, supabaseKey)

let tableRows = 1
let TheUser

// REALTIME
const handleInserts = (payload) => {
    getOnlyLastMessage(payload.new)
}

const handleDeletes = () => {
    readTable()
}

database
    .channel('supabase_expert')
    .on('postgres_changes',
        { schema: 'public', table: 'supabase_expert', event: '*' },
        (payload) => {
            if (payload.eventType === 'INSERT') handleInserts(payload)
            if (payload.eventType === 'DELETE') handleDeletes(payload)
        }
    )
    .subscribe()

function formatMessage(time, message, timezone, username) {
    if (!username) {
        username = "Anonymous"
    }
    else username = username.split("@")[0]

    const myDate = new Date(time).toISOString().slice(0, 10) + " " + new Date(time).toISOString().slice(11, 19)

    return `
        <div class="message">
            <div class="message_img">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRxJpQCWWBAh3ksKDVo-QPx2obmf8QlmSvUsg&s">
            </div>
            <div class="message_text">
                <p>(${tableRows}) ${myDate} (${timezone})<br><b>${username}</b>: ${message}</p>
            </div>
        </div>
    `
}

async function readTable() {
    const { data, error } = await database
        .from('supabase_expert')
        .select()

    if (error) {
        console.error(error)
        return
    }

    let myHTML = ""
    tableRows = 1

    for (let i = 0; i < data.length; i++) {
        const element = data[i]
        myHTML += formatMessage(element.created_at, element.message, element.timezone, element.username)
        tableRows++
    }

    demo.innerHTML = myHTML
    demo.scrollTo(0, demo.scrollHeight)
}

function getOnlyLastMessage(newInsert) {
    demo.innerHTML += formatMessage(newInsert.created_at, newInsert.message, newInsert.timezone, newInsert.username)
    tableRows++
    demo.scrollTo(0, demo.scrollHeight)
}

async function writeTable() {
    let myUsername = "Anonymous"
    if (TheUser) {
        myUsername = TheUser.email
    }

    const myMessage = myInput.value

    if (myMessage != "") {
        const { error } = await database
            .from('supabase_expert')
            .insert({
                message: myMessage,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                username: myUsername
            })

        if (!error) {
            myInput.value = ""
        }
    }
}

// AUTH
async function getUser() {
    const { data: { user } } = await database.auth.getUser()

    if (user) {
        displayUsername.textContent = user.email
        consola.textContent = "Logged in"
        loginDiv.classList.toggle("invisible")
        logoutDiv.classList.toggle("invisible")
        return user
    }
}

async function setUser() {
    TheUser = await getUser()
    prepareEdgePayload()
}

async function login() {
    let { data, error } = await database.auth.signInWithPassword({
        email: userEmail.value,
        password: userPass.value
    })

    if (error) {
        consola.textContent = error.message
    }
    else {
        setUser()
    }
}

async function logout() {
    let { error } = await database.auth.signOut()
    if (!error) location.reload()
}

// EDGE FUNCTIONS
const edgeFunctionName = "fortress_ping"
const restrictedSlug = "private-test"

function buildEdgePayload(attempt = "[hidden]") {
    return {
        mission: "website_fortress_checkpoint",
        attempt,
        canonical_site: "https://dibesfer.github.io",
        user: TheUser ? TheUser.email : "Anonymous",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local_visits: Number(localStorage.getItem("sb_LocalVisits") || 0),
        browser_time: new Date().toISOString()
    }
}

function prepareEdgePayload() {
    const payload = buildEdgePayload()
    edgePayload.textContent = JSON.stringify(payload, null, 2)
    edgeStatus.textContent = "checkpoint ready"
    return payload
}

async function callEdge(payload) {
    const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunctionName}`, {
        method: "POST",
        headers: {
            "apikey": supabaseKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    let responseBody = responseText

    try {
        responseBody = JSON.parse(responseText)
    }
    catch (error) {
        // Keep raw response text when Edge does not return JSON.
    }

    return {
        http_status: response.status,
        ok: response.ok,
        body: responseBody
    }
}

function showRestrictedArea() {
    restrictedSection.classList.remove("invisible")
    restrictedBreakA.classList.remove("invisible")
    restrictedBreakB.classList.remove("invisible")
    restrictedBreakC.classList.remove("invisible")
}

function renderRestrictedRecord(data) {
    const safeData = JSON.stringify(data, null, 2)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")

    restrictedContent.innerHTML = `
        <p><b>slug:</b> ${data.slug}</p>
        <p><b>title:</b> ${data.title}</p>
        <p><b>type:</b> ${data.type}</p>
        <p><b>storage_path:</b> ${data.storage_path || "null"}</p>
        <p><b>required_role:</b> ${data.required_role || "null"}</p>
        <p><b>created_at:</b> ${data.created_at}</p>
        <hr>
        <p><b>content render:</b></p>
        <div class="restricted-rendered-content">${data.content || "<p>null</p>"}</div>
        <p><b>raw record:</b></p>
        <pre>${safeData}</pre>
    `
}

async function loadRestrictedResource() {
    restrictedStatus.textContent = "loading resource"
    restrictedContent.innerHTML = "<p>Reading protected_resources...</p>"

    const { data, error } = await database
        .from("protected_resources")
        .select("*")
        .eq("slug", restrictedSlug)
        .single()

    if (error) {
        restrictedStatus.textContent = "resource read failed"
        restrictedContent.textContent = error.message
        return
    }

    restrictedStatus.textContent = "resource loaded"
    renderRestrictedRecord(data)
}

async function unlockRestrictedArea() {
    showRestrictedArea()
    await loadRestrictedResource()
}

async function invokeEdgeFunction() {
    const attempt = prompt("Which password opens the fortress?")

    if (attempt === null) {
        edgeStatus.textContent = "checkpoint cancelled"
        edgeResponse.textContent = "No signal sent."
        return
    }

    if (attempt.trim() === "") {
        edgePayload.textContent = JSON.stringify(buildEdgePayload("[empty rejected locally]"), null, 2)
        edgeStatus.textContent = "checkpoint rejected locally"
        edgeResponse.textContent = "No. Empty or whitespace passwords are impossible."
        return
    }

    const payload = buildEdgePayload(attempt)
    edgePayload.textContent = JSON.stringify(buildEdgePayload("[hidden]"), null, 2)
    edgeStatus.textContent = "transmitting password attempt"
    edgeResponse.textContent = "Calling Supabase Edge Function..."

    try {
        const report = await callEdge(payload)
        const accessGranted = report.ok && report.body.ok

        edgeStatus.textContent = accessGranted ? "ACCESS GRANTED" : "ACCESS DENIED / CHECK RESPONSE"
        edgeResponse.textContent = JSON.stringify(report, null, 2)

        if (accessGranted) {
            await unlockRestrictedArea()
        }
    }
    catch (error) {
        edgeStatus.textContent = "request blocked / network failed"
        edgeResponse.textContent = String(error)
    }
}

// PRESENCE
const channel = database.channel("online-users", {
    config: {
        presence: { key: 0 }
    }
})

channel
    .on("presence", { event: "sync" }, () => {
        const count = Object.keys(channel.presenceState()).length
        displayUsersonline.textContent = count
    })
    .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
            await channel.track({
                user_id: "Anonymous",
                username: "Anonymous"
            })
        }
    })

// LOCAL STORAGE
let localVisits = localStorage.getItem("sb_LocalVisits")
if (localVisits == null || localVisits <= 0) {
    localVisits = 1
}
else {
    localVisits++
}

displayLocalvisits.textContent = localVisits
localStorage.setItem("sb_LocalVisits", localVisits)

readTable()
setUser()
prepareEdgePayload()
