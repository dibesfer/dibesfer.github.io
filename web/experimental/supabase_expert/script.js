// UI operations for the Webochi Supabase Expert page.
let tableRows = 1
let TheUser

const restrictedSlug = "private-test"

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
    const { data, error } = await SupabaseExpert.readChatRows()

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
        const { error } = await SupabaseExpert.insertChatMessage({
            message: myMessage,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            username: myUsername
        })

        if (!error) {
            myInput.value = ""
        }
    }
}

async function getUser() {
    const { user } = await SupabaseExpert.getUser()

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
    updateJwtAwareness()
    prepareEdgePayload()
}

async function login() {
    let { data, error } = await SupabaseExpert.login(userEmail.value, userPass.value)

    if (error) {
        consola.textContent = error.message
    }
    else {
        setUser()
    }
}

async function logout() {
    let { error } = await SupabaseExpert.logout()
    if (!error) location.reload()
}

function buildEdgePayload(attempt = "[hidden]", slug = null) {
    return {
        mission: "website_fortress_checkpoint",
        attempt,
        slug,
        canonical_site: "https://dibesfer.github.io",
        user: TheUser ? TheUser.email : "Anonymous",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        local_visits: Number(localStorage.getItem("sb_LocalVisits") || 0),
        browser_time: new Date().toISOString()
    }
}

function prepareEdgePayload() {
    const payload = buildEdgePayload("[hidden]", restrictedSlug)
    edgePayload.textContent = JSON.stringify(payload, null, 2)
    edgeStatus.textContent = "anon checkpoint ready"
    return payload
}

function updateJwtAwareness() {
    const hasJwt = Boolean(TheUser)
    jwtStatus.textContent = hasJwt ? "present" : "none"

    if (hasJwt) {
        loggedPasswordButton.classList.remove("invisible")
    }
    else {
        loggedPasswordButton.classList.add("invisible")
    }
}

function mockLoggedPassword() {
    edgeStatus.textContent = "JWT detected"
    edgeResponse.textContent = "Logged Password route acknowledged. Not wired to Edge yet."
}

function showRestrictedArea() {
    restrictedSection.classList.remove("invisible")
    restrictedBreakA.classList.remove("invisible")
    restrictedBreakB.classList.remove("invisible")
    restrictedBreakC.classList.remove("invisible")
}

function renderValue(value) {
    if (value === null || value === undefined || value === "") return "—"
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

function renderRestrictedRecord(data) {
    restrictedContent.innerHTML = `
        <div class="restricted-resource-card">
            <p class="restricted-kicker">PRIVATE RESOURCE</p>
            <h4>${renderValue(data.title)}</h4>
            <p class="restricted-subtitle">${renderValue(data.slug)} · ${renderValue(data.type)}</p>

            <dl class="restricted-fields">
                <div><dt>slug</dt><dd>${renderValue(data.slug)}</dd></div>
                <div><dt>title</dt><dd>${renderValue(data.title)}</dd></div>
                <div><dt>type</dt><dd>${renderValue(data.type)}</dd></div>
                <div><dt>storage_path</dt><dd>${renderValue(data.storage_path)}</dd></div>
                <div><dt>required_role</dt><dd>${renderValue(data.required_role)}</dd></div>
                <div><dt>created_at</dt><dd>${renderValue(data.created_at)}</dd></div>
            </dl>

            <div class="restricted-html-block">
                <p class="restricted-kicker">HTML CONTENT</p>
                <div class="restricted-rendered-content">${data.content || "<p>—</p>"}</div>
            </div>
        </div>
    `
}

async function unlockRestrictedArea(resource) {
    showRestrictedArea()
    restrictedStatus.textContent = "resource loaded"
    renderRestrictedRecord(resource)
}

async function invokeEdgeFunction() {
    const attempt = prompt("Anon password?")

    if (attempt === null) {
        edgeStatus.textContent = "anon checkpoint cancelled"
        edgeResponse.textContent = "No request sent."
        return
    }

    if (attempt.trim() === "") {
        edgePayload.textContent = JSON.stringify(buildEdgePayload("[empty rejected locally]", restrictedSlug), null, 2)
        edgeStatus.textContent = "anon rejected locally"
        edgeResponse.textContent = "No. Empty or whitespace passwords are impossible."
        return
    }

    const payload = buildEdgePayload(attempt, restrictedSlug)
    edgePayload.textContent = JSON.stringify(buildEdgePayload("[hidden]", restrictedSlug), null, 2)
    edgeStatus.textContent = "sending anon password"
    edgeResponse.textContent = "Calling Edge Function..."

    try {
        const report = await SupabaseExpert.callEdge(payload)
        const accessGranted = report.ok && report.body.ok

        edgeStatus.textContent = accessGranted ? "ACCESS GRANTED" : "ACCESS DENIED"
        edgeResponse.textContent = JSON.stringify(report, null, 2)

        if (accessGranted && report.body.resource) {
            await unlockRestrictedArea(report.body.resource)
        }
        else if (accessGranted) {
            showRestrictedArea()
            restrictedStatus.textContent = "resource missing"
            restrictedContent.textContent = "ACCESS GRANTED, but Edge returned no resource."
        }
    }
    catch (error) {
        edgeStatus.textContent = "request blocked / network failed"
        edgeResponse.textContent = String(error)
    }
}

function setupKeyboardSubmit() {
    myInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault()
            writeTable()
        }
    })

    userEmail.addEventListener("keydown", submitLoginOnEnter)
    userPass.addEventListener("keydown", submitLoginOnEnter)
}

function submitLoginOnEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault()
        login()
    }
}

function setupLocalVisits() {
    let localVisits = localStorage.getItem("sb_LocalVisits")
    if (localVisits == null || localVisits <= 0) {
        localVisits = 1
    }
    else {
        localVisits++
    }

    displayLocalvisits.textContent = localVisits
    localStorage.setItem("sb_LocalVisits", localVisits)
}

function init() {
    SupabaseExpert.subscribeToChat({
        onInsert: getOnlyLastMessage,
        onDelete: readTable
    })

    SupabaseExpert.subscribeToPresence((count) => {
        displayUsersonline.textContent = count
    })

    setupKeyboardSubmit()
    setupLocalVisits()
    updateJwtAwareness()
    readTable()
    setUser()
    prepareEdgePayload()
}

init()
