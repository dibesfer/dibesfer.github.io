/* This file mirrors the practical Monochat auth flow for Kolorlando's
landing page while keeping every auth-specific behavior isolated from the
rest of the menu code. The page already loads the shared Supabase client
first, so we reuse that global database connection here instead of creating
another one. */

const authIdentity = document.getElementById("authIdentity")
const authPassword = document.getElementById("authPassword")
const authMessage = document.getElementById("authMessage")
const authUserDisplay = document.getElementById("authUserDisplay")
const authModalTitle = document.getElementById("authModal_title")
const authStatusBadge = document.getElementById("authStatusBadge")
const authIconButton = document.getElementById("idDiv_icon")
const kAuthForm = document.getElementById("kAuthForm")
const kAuthSubmit = document.getElementById("kAuthSubmit")
const kAuthAcknowledge = document.getElementById("kAuthAcknowledge")
const kAuthLogout = document.getElementById("kAuthLogout")
const idDiv = document.getElementById("idDiv")
const idDivUsername = document.getElementById("idDiv_username")
const idDivIconWrapper = document.getElementById("idDiv_icon_wrapper")
const authStatusModalPanel = document.getElementById("authModal_panel")
const authMainMenuWorldsCard = document.getElementById("mainMenu_worldsCard")
const authYourWorldsIntroBox = document.getElementById("yourWorldsIntroBox")
const authYourWorldsSingleplayerCard = document.getElementById("yourWorldsSingleplayerCard")
const authYourWorldsMultiplayerCard = document.getElementById("yourWorldsMultiplayerCard")
const AUTH_PLAYER_NAME_STORAGE_KEY = "kolorlando.playerName"
const AUTH_ACCOUNT_SESSION_STORAGE_KEY = "kolorlando.accountSessionId"
const AUTH_ACCOUNT_CLAIMED_STORAGE_KEY = "kolorlando.accountClaimed"
const AUTH_BROWSER_OWNERSHIP_STORAGE_KEY = "kolorlando.browserOwnedAccounts"
const AUTH_ACCOUNT_SESSIONS_TABLE = "active_account_sessions"
const AUTH_ACCOUNT_SESSION_HEARTBEAT_MS = 8000
const AUTH_ACCOUNT_BLOCKED_MESSAGE = "This account is already active in another tab/window."

let kolorlandoAuthUser = null
let kolorlandoUserProfile = null
let kolorlandoLoginReloadPending = false
let kolorlandoAuthRefreshToken = 0
let kolorlandoForcedSignedOutMessage = ""
let kolorlandoAuthIsBlocked = false
let kolorlandoBlockedDisplayName = "Anonymous"
let kolorlandoBlockedReason = ""
let kolorlandoManualLoginAttempt = false
let kolorlandoAccountSessionId = ""
let kolorlandoClaimedAccountSessionId = ""
let kolorlandoAccountHeartbeatIntervalId = 0
let kolorlandoAccountHeartbeatInFlight = false
let kolorlandoClaimProbeRequested = false
const kolorlandoRedirectedBlockedHint = new URLSearchParams(window.location.search).get("session_blocked") === "1"

function logKolorlandoAuthDebug(label, extra = {}) {
    /* Keep a tiny symbolic trace for auth/session flow so future debugging can
    follow the path without the previous full-state console flood. */
    window.kolorlandoDebugConsole?.logState?.(label, {
        blockedReason: kolorlandoBlockedReason || "",
        authBlocked: kolorlandoAuthIsBlocked,
        claimedState: hasKolorlandoClaimedState(),
        ...extra,
    })
}

window.kolorlandoAuthIsBlocked = false
window.kolorlandoBlockedReason = ""

/* The landing page should always start from a neutral modal shell. Any real
blocked state must be re-established by fresh auth + lock checks, not stale
DOM classes or leftover per-tab storage from an older navigation. */
authStatusBadge?.classList.add("invisible")
authStatusModalPanel?.classList.remove("is-session-blocked")
if (authModalTitle) {
    authModalTitle.textContent = "Sign / Log in"
}
authUserDisplay.textContent = "Anonymous"

/* These small text helpers keep the UI copy consistent every time auth
state changes, whether that change comes from a page load, sign in, sign up,
or sign out. */
function setAuthMessage(message, isError) {
    authMessage.textContent = message
    authMessage.style.color = isError ? "rgb(255, 82, 82)" : "rgb(255, 238, 174)"
    authMessage.style.fontWeight = isError ? "700" : "400"
    authMessage.classList.toggle("is-session-blocked", Boolean(isError && kolorlandoAuthIsBlocked))
}

function setKolorlandoBlockedReason(nextReason = "") {
    kolorlandoBlockedReason = nextReason
    window.kolorlandoBlockedReason = nextReason
}

function isKolorlandoBlockedReasonAcknowledgable(reason = kolorlandoBlockedReason) {
    /* Some blocked states should let this browser step back into anonymous mode
    so the player can immediately try a different account. */
    return reason === "login-attempt" || reason === "restore-conflict"
}

function persistKolorlandoClaimedState(isClaimed) {
    /* Shared Supabase auth can exist in many tabs, but only the claimed tab
    should behave like an authenticated Kolorlando owner. */
    if (isClaimed) {
        window.sessionStorage.setItem(AUTH_ACCOUNT_CLAIMED_STORAGE_KEY, "1")
    } else {
        window.sessionStorage.removeItem(AUTH_ACCOUNT_CLAIMED_STORAGE_KEY)
    }

    window.dispatchEvent(new CustomEvent("kolorlando:account-claimed-change", {
        detail: {
            isClaimed
        }
    }))
}

function readKolorlandoBrowserOwnershipMap() {
    /* Same-browser tabs share localStorage, so ownership history that should
    survive opening a new tab belongs in one browser-scoped registry. */
    try {
        const rawValue = window.localStorage.getItem(AUTH_BROWSER_OWNERSHIP_STORAGE_KEY)

        if (!rawValue) {
            return {}
        }

        const parsedValue = JSON.parse(rawValue)
        return parsedValue && typeof parsedValue === "object" ? parsedValue : {}
    } catch (error) {
        console.warn("Could not read Kolorlando browser ownership history.", error)
        return {}
    }
}

function writeKolorlandoBrowserOwnershipMap(nextMap) {
    try {
        window.localStorage.setItem(AUTH_BROWSER_OWNERSHIP_STORAGE_KEY, JSON.stringify(nextMap))
    } catch (error) {
        console.warn("Could not write Kolorlando browser ownership history.", error)
    }
}

function persistKolorlandoBrowserOwnership(userId, sessionId = "") {
    if (!userId) {
        return
    }

    const ownershipMap = readKolorlandoBrowserOwnershipMap()
    ownershipMap[String(userId)] = {
        sessionId: String(sessionId || ""),
        updatedAt: Date.now(),
    }
    writeKolorlandoBrowserOwnershipMap(ownershipMap)
}

function clearKolorlandoBrowserOwnership(userId) {
    if (!userId) {
        return
    }

    const ownershipMap = readKolorlandoBrowserOwnershipMap()
    delete ownershipMap[String(userId)]
    writeKolorlandoBrowserOwnershipMap(ownershipMap)
}

function hasKolorlandoBrowserOwnership(userId) {
    if (!userId) {
        return false
    }

    const ownershipMap = readKolorlandoBrowserOwnershipMap()
    return Boolean(ownershipMap[String(userId)])
}

function hasKolorlandoClaimedState() {
    return window.sessionStorage.getItem(AUTH_ACCOUNT_CLAIMED_STORAGE_KEY) === "1"
}

function requestKolorlandoClaimProbe() {
    /* Landing should stay anonymous on passive load, but explicit account
    actions like opening auth or entering Worlds should verify ownership now. */
    kolorlandoClaimProbeRequested = true
}

function openAuthModalIfAvailable() {
    /* The landing page owns the account modal, so redirect targets can ask it
    to open from auth logic without duplicating visibility code here. */
    if (typeof setAuthModalState === "function") {
        setAuthModalState(true)
    }
}

async function prepareAuthModalForOpen() {
    /* The modal should resolve auth and duplicate-session state before it
    becomes visible, so blocked tabs never flash the default blue shell. */
    try {
        await refreshAuthState()
    } catch (error) {
        setAuthMessage(error.message || "Could not refresh auth", true)
    }
}

function resolveKolorlandoDisplayName(user, profile = null) {
    if (typeof profile?.username === "string" && profile.username.trim()) {
        return profile.username.trim()
    }

    if (typeof user?.email === "string" && user.email.includes("@")) {
        return user.email.split("@")[0]
    }

    return "Anonymous"
}

function applyBlockedWorldEntryState() {
    /* Blocking world entry at the menu level keeps the landing page truthful:
    when an account lock is owned elsewhere, no local card should suggest the
    player can still enter a world from this tab. */
    const shouldHideWorldEntry = kolorlandoAuthIsBlocked

    authMainMenuWorldsCard?.classList.toggle("invisible", shouldHideWorldEntry)
    authYourWorldsIntroBox?.classList.toggle("invisible", shouldHideWorldEntry)
    authYourWorldsSingleplayerCard?.classList.toggle("invisible", shouldHideWorldEntry)
    authYourWorldsMultiplayerCard?.classList.toggle("invisible", shouldHideWorldEntry)

    if (shouldHideWorldEntry && typeof renderPage === "function") {
        renderPage("home")
    }
}

function setBlockedModalState(isBlocked) {
    /* The modal needs its own blocked presentation so duplicate sessions read
    as a hard account state, not like a generic form validation error. */
    authStatusBadge?.classList.add("invisible")
    authStatusModalPanel?.classList.toggle("is-session-blocked", isBlocked)
    if (authModalTitle) {
        authModalTitle.textContent = isBlocked ? "Session Blocked" : "Sign / Log in"
    }
    if (isBlocked) {
        authUserDisplay.textContent = kolorlandoBlockedDisplayName || "Anonymous"
    } else if (!kolorlandoAuthUser) {
        authUserDisplay.textContent = "Anonymous"
    }

    kAuthAcknowledge?.classList.toggle("invisible", !(isBlocked && isKolorlandoBlockedReasonAcknowledgable()))
    applyBlockedWorldEntryState()
}

function applyKolorlandoBlockedState(message = AUTH_ACCOUNT_BLOCKED_MESSAGE, displayName = "Anonymous", reason = "shared-session") {
    stopKolorlandoAccountHeartbeat()
    kolorlandoForcedSignedOutMessage = message
    kolorlandoLoginReloadPending = false
    kolorlandoAuthIsBlocked = true
    window.kolorlandoAuthIsBlocked = true
    kolorlandoBlockedDisplayName = displayName || "Anonymous"
    setKolorlandoBlockedReason(reason)
    if (reason === "login-attempt") {
        /* A rejected manual login should end here and stay dismissible. */
        kolorlandoClaimProbeRequested = false
    }
    persistKolorlandoClaimedState(false)
    kolorlandoAuthUser = null
    kolorlandoUserProfile = null
    window.kolorlandoAuthUser = null
    window.kolorlandoUserProfile = null
    authIdentity.value = ""
    authPassword.value = ""
    setIdentityVisual(displayName, false)
    setBlockedModalState(true)
    setAuthMode(false)
    setAuthMessage(message, true)
    logKolorlandoAuthDebug("Blocked state applied", {
        displayName,
        message,
        reason,
    })
    openAuthModalIfAvailable()
}

function clearKolorlandoBlockedState() {
    kolorlandoForcedSignedOutMessage = ""
    kolorlandoAuthIsBlocked = false
    window.kolorlandoAuthIsBlocked = false
    kolorlandoBlockedDisplayName = "Anonymous"
    setKolorlandoBlockedReason("")
    setBlockedModalState(false)
    applyBlockedWorldEntryState()
    logKolorlandoAuthDebug("Blocked state cleared")
}

function ensureKolorlandoAccountSessionId() {
    /* A per-tab session id lets refreshes reclaim the same account lock while
    a second tab still gets a genuinely different identity and is blocked. */
    if (typeof window.ensureKolorlandoUniqueAccountSessionId === "function") {
        kolorlandoAccountSessionId = window.ensureKolorlandoUniqueAccountSessionId()
        return kolorlandoAccountSessionId
    }

    if (kolorlandoAccountSessionId) {
        return kolorlandoAccountSessionId
    }

    const existingSessionId = window.sessionStorage.getItem(AUTH_ACCOUNT_SESSION_STORAGE_KEY)

    if (existingSessionId) {
        kolorlandoAccountSessionId = existingSessionId
        return kolorlandoAccountSessionId
    }

    const generatedSessionId = typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `kolorlando-${Date.now()}-${Math.random().toString(16).slice(2)}`

    kolorlandoAccountSessionId = generatedSessionId
    window.sessionStorage.setItem(AUTH_ACCOUNT_SESSION_STORAGE_KEY, generatedSessionId)
    return kolorlandoAccountSessionId
}

function clearKolorlandoAccountSessionId() {
    /* A browser that acknowledged a restore-conflict should not keep reusing a
    stale local session id on the next passive auth restore. */
    kolorlandoAccountSessionId = ""
    kolorlandoClaimedAccountSessionId = ""
    window.sessionStorage.removeItem(AUTH_ACCOUNT_SESSION_STORAGE_KEY)
}

function clearSupabaseLocalAuthStorage() {
    /* Some blocked restore paths can keep the persisted auth token even after a
    failed or partial sign-out attempt, so we explicitly remove the local auth
    cache keys owned by this browser profile. */
    const authStorageKeys = []
    const configuredStorageKey = window.database?.auth?.storageKey

    if (typeof configuredStorageKey === "string" && configuredStorageKey.trim()) {
        authStorageKeys.push(configuredStorageKey)
    }

    Object.keys(window.localStorage).forEach((key) => {
        if (/^sb-.*-auth-token$/.test(key)) {
            authStorageKeys.push(key)
        }
    })

    Object.keys(window.sessionStorage).forEach((key) => {
        if (/^sb-.*-auth-token$/.test(key)) {
            authStorageKeys.push(key)
        }
    })

    Array.from(new Set(authStorageKeys)).forEach((key) => {
        window.localStorage.removeItem(key)
        window.sessionStorage.removeItem(key)
    })
}

function readStoredKolorlandoAccountSessionId() {
    /* Passive restore checks should inspect existing local tab identity without
    creating a brand-new session id that changes how conflicts are classified. */
    if (typeof kolorlandoAccountSessionId === "string" && kolorlandoAccountSessionId.trim()) {
        return kolorlandoAccountSessionId
    }

    const storedSessionId = window.sessionStorage.getItem(AUTH_ACCOUNT_SESSION_STORAGE_KEY)
    return typeof storedSessionId === "string" ? storedSessionId.trim() : ""
}

function stopKolorlandoAccountHeartbeat() {
    /* The heartbeat must fully stop as soon as the tab loses ownership so a
    stale interval cannot keep touching an account row after logout. */
    if (kolorlandoAccountHeartbeatIntervalId) {
        window.clearInterval(kolorlandoAccountHeartbeatIntervalId)
        kolorlandoAccountHeartbeatIntervalId = 0
    }
}

function isAccountSessionAlreadyActiveError(error) {
    return /ACCOUNT_SESSION_ALREADY_ACTIVE/i.test(String(error?.message || error || ""))
}

function isMissingAuthSessionError(error) {
    return error?.name === "AuthSessionMissingError"
        || /auth session missing/i.test(String(error?.message || ""))
}

async function claimKolorlandoAccountSession() {
    /* Claiming the account lock belongs in one helper so startup restore,
    manual sign-in, and future protected pages all follow the same rule. */
    const sessionId = ensureKolorlandoAccountSessionId()
    const { data, error } = await database.rpc("claim_active_account_session", {
        incoming_session_id: sessionId,
        stale_after_seconds: 20
    })

    if (error) {
        logKolorlandoAuthDebug("Account session claim failed", {
            errorMessage: String(error?.message || error || ""),
            sessionId,
        })
        throw error
    }

    kolorlandoClaimedAccountSessionId = sessionId
    logKolorlandoAuthDebug("Account session claimed", {
        sessionId,
    })
    return data
}

async function hasKolorlandoSessionConflict(user) {
    /* Passive landing tabs should be able to detect that another tab already
    owns this account without claiming the lock or switching this tab into the
    logged-in owner state. */
    if (!user?.id) {
        return false
    }

    const { data: sessionRows, error: sessionError } = await database
        .from(AUTH_ACCOUNT_SESSIONS_TABLE)
        .select("session_id, status, last_seen_at, released_at")
        .eq("user_id", user.id)
        .limit(1)

    if (sessionError) {
        throw sessionError
    }

    const activeSessionRow = sessionRows?.[0]

    if (!activeSessionRow) {
        return false
    }

    const isLiveActiveSession =
        activeSessionRow.status === "active"
        && !activeSessionRow.released_at
        && typeof activeSessionRow.last_seen_at === "string"
        && Date.now() - new Date(activeSessionRow.last_seen_at).getTime() < 20000

    const localSessionId = readStoredKolorlandoAccountSessionId()

    if (!isLiveActiveSession) {
        return false
    }

    if (!localSessionId) {
        return true
    }

    const hasConflict = String(activeSessionRow.session_id || "") !== localSessionId
    return hasConflict
}

async function hasKolorlandoSessionConflictForUserId(userId) {
    /* Login attempts know the target account before sign-in succeeds, so we
    can detect a protected live session without first authenticating this tab. */
    if (!userId) {
        return false
    }

    const { data: sessionRows, error: sessionError } = await database
        .from(AUTH_ACCOUNT_SESSIONS_TABLE)
        .select("session_id, status, last_seen_at, released_at")
        .eq("user_id", userId)
        .limit(1)

    if (sessionError) {
        throw sessionError
    }

    const activeSessionRow = sessionRows?.[0]

    if (!activeSessionRow) {
        return false
    }

    const isLiveActiveSession =
        activeSessionRow.status === "active"
        && !activeSessionRow.released_at
        && typeof activeSessionRow.last_seen_at === "string"
        && Date.now() - new Date(activeSessionRow.last_seen_at).getTime() < 20000

    const localSessionId = readStoredKolorlandoAccountSessionId()

    if (!isLiveActiveSession) {
        return false
    }

    if (!localSessionId) {
        return true
    }

    return String(activeSessionRow.session_id || "") !== localSessionId
}

async function heartbeatKolorlandoAccountSession() {
    if (kolorlandoAccountHeartbeatInFlight || !kolorlandoAuthUser) {
        return
    }

    kolorlandoAccountHeartbeatInFlight = true

    try {
        const sessionId = ensureKolorlandoAccountSessionId()

        /* Duplicate-tab resolution can rotate the per-tab session id after the
        lock was first claimed. Re-claiming first keeps heartbeat aligned with
        the latest local tab identity instead of sending a stale/unknown id. */
        if (!kolorlandoClaimedAccountSessionId || kolorlandoClaimedAccountSessionId !== sessionId) {
            await claimKolorlandoAccountSession()
            return
        }

        await database.rpc("heartbeat_active_account_session", {
            incoming_session_id: sessionId
        })
    } catch (error) {
        /* A lost lock should surface quickly and clearly instead of silently
        leaving the page in a half-authenticated state. */
        if (isAccountSessionAlreadyActiveError(error)) {
            applyKolorlandoBlockedState()
            return
        }
        stopKolorlandoAccountHeartbeat()
        throw error
    } finally {
        kolorlandoAccountHeartbeatInFlight = false
    }
}

function startKolorlandoAccountHeartbeat() {
    stopKolorlandoAccountHeartbeat()
    heartbeatKolorlandoAccountSession().catch((error) => {
        console.error("Could not refresh the Kolorlando account session lock.", error)
    })
    kolorlandoAccountHeartbeatIntervalId = window.setInterval(() => {
        heartbeatKolorlandoAccountSession().catch((error) => {
            console.error("Could not refresh the Kolorlando account session lock.", error)
        })
    }, AUTH_ACCOUNT_SESSION_HEARTBEAT_MS)
}

async function releaseKolorlandoAccountSession() {
    stopKolorlandoAccountHeartbeat()
    persistKolorlandoClaimedState(false)
    kolorlandoClaimedAccountSessionId = ""

    if (!kolorlandoAuthUser) {
        return
    }

    try {
        await database.rpc("release_active_account_session", {
            incoming_session_id: ensureKolorlandoAccountSessionId()
        })
    } catch (error) {
        console.warn("Could not release the Kolorlando account session lock.", error)
    }
}

function setIdentityVisual(username, isLoggedIn) {
    /* The landing page only has a small floating identity widget, so we use
    its tooltip and image filter to signal login state without redesigning
    the page. */
    authUserDisplay.textContent = username
    /* The compact header badge should surface the current username directly
    so the logged-in state is visible even when the auth modal is closed. */
    idDivUsername.textContent = isLoggedIn ? username : ""
    idDiv.title = isLoggedIn ? `Logged in as ${username}` : "Anonymous user"
    if (idDivIconWrapper) {
        idDivIconWrapper.style = isLoggedIn ? "background-color: green" : "background-color: gray"
    }
}

function persistKolorlandoPlayerName(username) {
    /* The game page is a separate document from the landing page auth modal, so
    we cache the resolved player name in localStorage where the game can read it
    later without needing to re-run this auth script on every scene page. */
    const safeUsername = typeof username === "string" ? username.trim() : ""

    if (!safeUsername) {
        window.localStorage.removeItem(AUTH_PLAYER_NAME_STORAGE_KEY)
        /* The landing page Presence card is a separate script, so we emit one
        tiny browser event whenever the cached public player name changes. This
        lets the roster re-track immediately on logout instead of waiting for a
        future reload or another Presence reconnect to fix stale labels. */
        window.dispatchEvent(new CustomEvent("kolorlando:player-name-change", {
            detail: {
                displayName: "Anon"
            }
        }))
        return
    }

    window.localStorage.setItem(AUTH_PLAYER_NAME_STORAGE_KEY, safeUsername)
    /* Login, signup confirmation, and future profile edits all flow through the
    same local cache helper, so a single event here keeps Presence metadata and
    any other identity-driven UI in sync without duplicating update calls. */
    window.dispatchEvent(new CustomEvent("kolorlando:player-name-change", {
        detail: {
            displayName: safeUsername
        }
    }))
}

function setAuthMode(isLoggedIn) {
    /* The same modal handles both anonymous and authenticated users, so we
    hide the credential fields once a session exists and swap the action
    buttons instead of opening a second account panel. */
    const shouldHideCredentials = isLoggedIn || kolorlandoAuthIsBlocked

    authIdentity.disabled = shouldHideCredentials
    authPassword.disabled = shouldHideCredentials
    authIdentity.style.display = shouldHideCredentials ? "none" : "block"
    authPassword.style.display = shouldHideCredentials ? "none" : "block"
    document.querySelector('label[for="authIdentity"]').style.display = shouldHideCredentials ? "none" : "block"
    document.querySelector('label[for="authPassword"]').style.display = shouldHideCredentials ? "none" : "block"
    kAuthSubmit.classList.toggle("invisible", shouldHideCredentials)
    kAuthAcknowledge?.classList.toggle("invisible", !(kolorlandoAuthIsBlocked && isKolorlandoBlockedReasonAcknowledgable()))
    kAuthLogout?.classList.toggle("invisible", !(isLoggedIn && !kolorlandoAuthIsBlocked))
}

function hasLocalKolorlandoAccountOwnershipHistory(userId = "") {
    /* Same-tab ownership still lives in sessionStorage, while same-browser new
    tabs need a browser-scoped marker to stay distinct from other devices. */
    if (kolorlandoClaimedAccountSessionId) {
        return true
    }

    if (hasKolorlandoClaimedState()) {
        return true
    }

    return hasKolorlandoBrowserOwnership(userId)
}

async function findUserByIdentity(identity) {
    /* Monochat signs up when an email is unknown and logs in when it already
    exists in the `users` table. Kolorlando keeps that same behavior, but it
    also accepts a username by resolving it back to the stored email first. */
    const trimmedIdentity = identity.trim().toLowerCase()

    if (!trimmedIdentity) {
        return null
    }

    if (trimmedIdentity.includes("@")) {
        const { data, error } = await database
            .from("users")
            .select("*")
            .eq("email", trimmedIdentity)
            .limit(1)

        if (error) {
            throw error
        }

        return data[0] || null
    }

    const { data, error } = await database
        .from("users")
        .select("*")
        .eq("username", trimmedIdentity)
        .limit(1)

    if (error) {
        throw error
    }

    return data[0] || null
}

async function ensureConfirmedProfile(user) {
    /* Monochat stores an extra `confirmed` flag in the public `users` table.
    We preserve that convention here so Kolorlando and Monochat read the same
    profile shape and status rules. */
    const { data, error } = await database
        .from("users")
        .select("*")
        .eq("email", user.email)
        .limit(1)

    if (error) {
        throw error
    }

    const userProfile = data[0] || null

    if (userProfile && !userProfile.confirmed) {
        const { data: updatedData, error: updateError } = await database
            .from("users")
            .update({ confirmed: true })
            .eq("email", user.email)
            .select()
            .limit(1)

        if (updateError) {
            throw updateError
        }

        return updatedData[0] || userProfile
    }

    return userProfile
}

async function createUserProfile(newUser) {
    /* A brand-new Supabase auth account also needs the companion row in the
    shared `users` table, matching the Monochat profile bootstrap behavior. */
    const email = newUser.email.toLowerCase()
    const username = email.split("@")[0]

    const { data, error } = await database
        .from("users")
        .insert([
            {
                user_id: newUser.id,
                email: email,
                username: username,
                profilepicture: "https://upload.wikimedia.org/wikipedia/commons/4/40/Anonymous_mask.svg"
            }
        ])
        .select()
        .limit(1)

    if (error) {
        throw error
    }

    return data[0] || null
}

async function refreshAuthState() {
    /* The page can be opened with an existing Supabase session already saved
    in the browser, so we always reconcile the modal state from auth first. */
    const refreshToken = ++kolorlandoAuthRefreshToken
    const { data, error } = await database.auth.getUser()

    if (error) {
        if (isMissingAuthSessionError(error)) {
            stopKolorlandoAccountHeartbeat()
            clearKolorlandoBlockedState()
            persistKolorlandoClaimedState(false)
            kolorlandoAuthUser = null
            kolorlandoUserProfile = null
            window.kolorlandoAuthUser = null
            window.kolorlandoUserProfile = null
            persistKolorlandoPlayerName("")
            authIdentity.value = ""
            authPassword.value = ""
            setIdentityVisual("Anonymous", false)
            setAuthMode(false)
            setAuthMessage("Join the adventure!", false)
            logKolorlandoAuthDebug("Auth: anonymous")
            return null
        }

        throw error
    }

    const user = data.user

    if (!user) {
        stopKolorlandoAccountHeartbeat()
        clearKolorlandoBlockedState()
        persistKolorlandoClaimedState(false)
        kolorlandoAuthUser = null
        kolorlandoUserProfile = null
        window.kolorlandoAuthUser = null
        window.kolorlandoUserProfile = null
        persistKolorlandoPlayerName("")
        authIdentity.value = ""
        authPassword.value = ""
        setIdentityVisual("Anonymous", false)
        setAuthMode(false)
        setAuthMessage("Join the adventure!", false)
        logKolorlandoAuthDebug("Auth: anonymous")
        return null
    }

    const shouldAttemptLocalClaim =
        kolorlandoLoginReloadPending ||
        hasKolorlandoClaimedState() ||
        kolorlandoClaimProbeRequested

    if (!shouldAttemptLocalClaim) {
        stopKolorlandoAccountHeartbeat()
        if (await hasKolorlandoSessionConflict(user)) {
            const passiveProfile = await ensureConfirmedProfile(user)
            const blockedReason = hasLocalKolorlandoAccountOwnershipHistory(user.id)
                ? "shared-session"
                : "restore-conflict"
            logKolorlandoAuthDebug("Auth: blocked", {
                blockedReason,
            })
            applyKolorlandoBlockedState(
                AUTH_ACCOUNT_BLOCKED_MESSAGE,
                resolveKolorlandoDisplayName(user, passiveProfile),
                blockedReason
            )
            return null
        }

        clearKolorlandoBlockedState()
        persistKolorlandoClaimedState(false)
        kolorlandoAuthUser = null
        kolorlandoUserProfile = null
        window.kolorlandoAuthUser = null
        window.kolorlandoUserProfile = null
        authIdentity.value = ""
        authPassword.value = ""
        setIdentityVisual("Anonymous", false)
        setAuthMode(false)
        setAuthMessage("Join the adventure!", false)
        logKolorlandoAuthDebug("Auth: passive")
        return null
    }

    try {
        await claimKolorlandoAccountSession()
    } catch (claimError) {
        if (isAccountSessionAlreadyActiveError(claimError)) {
            kolorlandoClaimProbeRequested = false
            const blockedReason = hasLocalKolorlandoAccountOwnershipHistory(user.id)
                ? "shared-session"
                : "login-attempt"
            logKolorlandoAuthDebug("Auth: blocked", {
                blockedReason,
            })
            applyKolorlandoBlockedState(AUTH_ACCOUNT_BLOCKED_MESSAGE, resolveKolorlandoDisplayName(user), blockedReason)
            return null
        } else {
            kolorlandoForcedSignedOutMessage = "Could not validate your Kolorlando session."
            console.error("Failed to claim the Kolorlando account session lock.", claimError)
            clearKolorlandoBlockedState()
        }

        throw claimError
    }

    if (refreshToken !== kolorlandoAuthRefreshToken) {
        return user
    }

    const confirmedProfile = await ensureConfirmedProfile(user)
    const username = confirmedProfile?.username || user.email.split("@")[0]

    kolorlandoAuthUser = user
    kolorlandoUserProfile = confirmedProfile

    /* These globals make the current authenticated user easy to reuse from
    future Kolorlando scripts, including multiplayer and world ownership. */
    window.kolorlandoAuthUser = user
    window.kolorlandoUserProfile = confirmedProfile

    clearKolorlandoBlockedState()
    persistKolorlandoClaimedState(true)
    kolorlandoClaimProbeRequested = false
    authIdentity.value = ""
    authPassword.value = ""
    persistKolorlandoPlayerName(username)
    setIdentityVisual(username, true)
    startKolorlandoAccountHeartbeat()
    persistKolorlandoBrowserOwnership(user.id, kolorlandoClaimedAccountSessionId || ensureKolorlandoAccountSessionId())

    /* A successful password login now reloads the page immediately after the
    session is created. While that handoff is in progress we deliberately keep
    the anonymous form mode instead of flashing the logged-in logout panel for
    a fraction of a second right before navigation restarts the page. */
    if (kolorlandoLoginReloadPending) {
        setAuthMode(false)
    } else {
        setAuthMode(true)
    }

    setAuthMessage(`You are logged as ${username}`, false)
    logKolorlandoAuthDebug("Auth: owner", {
        username,
    })

    return user
}

async function signUpWithEmail(email, password) {
    /* The signup branch deliberately follows Monochat's current rule:
    if the `users` row does not exist yet, create the auth account and then
    create the profile row with the email prefix as username. */
    const { data, error } = await database.auth.signUp({
        email: email,
        password: password,
        options: {
            emailRedirectTo: "https://dibesfer.com/games/Kolorlando"
        }
    })

    if (error) {
        throw error
    }

    if (data.user) {
        await createUserProfile(data.user)
    }

    setAuthMessage("We sent a confirmation url to your email.", false)
}

async function logInWithEmail(email, password) {
    /* The login branch keeps Monochat's password flow and then refreshes the
    local modal state from the newly created session. */
    kolorlandoLoginReloadPending = true

    const { error } = await database.auth.signInWithPassword({
        email: email,
        password: password
    })

    if (error) {
        kolorlandoLoginReloadPending = false
        throw error
    }

    const refreshedUser = await refreshAuthState()

    if (!refreshedUser || kolorlandoAuthIsBlocked) {
        kolorlandoLoginReloadPending = false
        return
    }

    /* A full reload right after a confirmed login makes the rest of the
    landing page boot again from the authenticated state, which is safer than
    expecting every already-mounted menu, presence, and game entry helper to
    react perfectly to the session swap in place. */
    window.location.reload()
}

async function handleAuthLogout() {
    /* Normal owner sessions can log out from the modal, but blocked tabs
    should never get a destructive account action here. */
    if (kolorlandoAuthIsBlocked) {
        return
    }

    try {
        kAuthLogout.disabled = true
        clearKolorlandoBrowserOwnership(kolorlandoAuthUser?.id)
        await releaseKolorlandoAccountSession()
        const { error } = await database.auth.signOut()

        if (error) {
            throw error
        }

        /* The shared Supabase auth cache can survive a nominal sign-out in the
        browser, so we explicitly clear the local persisted tokens here too. */
        clearSupabaseLocalAuthStorage()
        setAuthModalState?.(false)
    } catch (error) {
        setAuthMessage(error.message || "Could not log out", true)
    } finally {
        kAuthLogout.disabled = false
    }
}

async function clearBlockedBrowserAuthIfNeeded() {
    /* Any acknowledgeable blocked state should leave this browser in a truly
    local-anonymous mode. With local-only sign-out that no longer affects the
    real owner browser, and it prevents blocked retries from restoring auth on
    the next reload. */
    if (!isKolorlandoBlockedReasonAcknowledgable()) {
        return
    }

    try {
        logKolorlandoAuthDebug("Auth: OK clear", {
            reason: kolorlandoBlockedReason,
        })
        const { error } = await database.auth.signOut({
            scope: "local"
        })

        if (error) {
            throw error
        }
    } catch (error) {
        console.warn("Could not clear the blocked browser auth session.", error)
        logKolorlandoAuthDebug("Blocked OK failed local auth clear", {
            errorMessage: String(error?.message || error || ""),
        })
    } finally {
        clearSupabaseLocalAuthStorage()
        clearKolorlandoAccountSessionId()
        logKolorlandoAuthDebug("Auth: OK done")
    }
}

async function acknowledgeKolorlandoBlockedState() {
    /* Every acknowledge path should clear the same local blocked/auth state so
    clicking OK, outside the modal, or Escape all behave identically. */
    await clearBlockedBrowserAuthIfNeeded()
    clearKolorlandoBlockedState()
    persistKolorlandoClaimedState(false)
    kolorlandoClaimProbeRequested = false
    kolorlandoManualLoginAttempt = false
    kolorlandoAuthUser = null
    kolorlandoUserProfile = null
    window.kolorlandoAuthUser = null
    window.kolorlandoUserProfile = null
    kolorlandoClaimedAccountSessionId = ""
    authIdentity.value = ""
    authPassword.value = ""
    persistKolorlandoPlayerName("")
    setIdentityVisual("Anonymous", false)
    setAuthMode(false)
    setAuthMessage("Join the adventure!", false)
    logKolorlandoAuthDebug("Blocked OK completed")
    if (typeof setAuthModalState === "function") {
        setAuthModalState(false)
    }
}

window.acknowledgeKolorlandoBlockedState = acknowledgeKolorlandoBlockedState

async function handleAuthSubmit(event) {
    event.preventDefault()
    clearKolorlandoBlockedState()
    requestKolorlandoClaimProbe()
    kolorlandoManualLoginAttempt = true

    const identity = authIdentity.value.trim()
    const password = authPassword.value

    if (!identity || !password) {
        setAuthMessage("Fill both fields", true)
        return
    }

    try {
        kAuthSubmit.disabled = true
        setAuthMessage("Checking user...", false)

        const existingProfile = await findUserByIdentity(identity)

        if (existingProfile) {
            if (await hasKolorlandoSessionConflictForUserId(existingProfile.user_id)) {
                kolorlandoClaimProbeRequested = false
                const blockedReason = hasLocalKolorlandoAccountOwnershipHistory(existingProfile.user_id)
                    ? "shared-session"
                    : "login-attempt"
                applyKolorlandoBlockedState(
                    AUTH_ACCOUNT_BLOCKED_MESSAGE,
                    existingProfile.username || "Anonymous",
                    blockedReason
                )
                return
            }
            await logInWithEmail(existingProfile.email, password)
        } else if (identity.includes("@")) {
            await signUpWithEmail(identity.toLowerCase(), password)
        } else {
            setAuthMessage("Use an email to create a new account.", true)
        }
    } catch (error) {
        setAuthMessage(error.message || "Auth error", true)
    } finally {
        kolorlandoManualLoginAttempt = false
        kAuthSubmit.disabled = false
    }
}

kAuthForm.addEventListener("submit", handleAuthSubmit)
kAuthLogout?.addEventListener("click", handleAuthLogout)
kAuthAcknowledge?.addEventListener("click", async () => {
    /* A blocked login attempt should dismiss back to an anonymous modal so the
    player can try another account without affecting the protected session. */
    await acknowledgeKolorlandoBlockedState()
})

authIconButton?.addEventListener("pointerdown", async (event) => {
    /* Opening through the identity icon is the main entry path, so we gate it
    here and let the shared shell open only after auth state is fully resolved. */
    if (typeof setAuthModalState !== "function") {
        return
    }

    if (!document.getElementById("authModal")?.classList.contains("invisible")) {
        return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    await prepareAuthModalForOpen()
    setAuthModalState(true)
}, true)

authMainMenuWorldsCard?.addEventListener("click", (event) => {
    /* Worlds is now a public landing route. Anonymous visitors can browse
    into the world choices, while blocked account sessions still stay gated. */
    event.preventDefault()
    event.stopImmediatePropagation()

    if (kolorlandoAuthIsBlocked) {
        openAuthModalIfAvailable()
        return
    }

    if (typeof changePage === "function") {
        changePage("yourWorlds")
    }
}, true)

/* This listener keeps the landing page identity widget synced when another
tab signs in or out using the same Supabase session storage. */
database.auth.onAuthStateChange(() => {
    refreshAuthState().catch((error) => {
        setAuthMessage(error.message || "Could not refresh auth", true)
    })
})

window.addEventListener("beforeunload", () => {
    stopKolorlandoAccountHeartbeat()
})

refreshAuthState().catch((error) => {
    setAuthMessage(error.message || "Could not load auth", true)
})

if (kolorlandoRedirectedBlockedHint) {
    /* A redirect from a protected page should only open the modal and seed the
    explanation. The real blocked state still depends on auth + lock claim. */
    openAuthModalIfAvailable()
    window.history.replaceState({}, "", window.location.pathname)
}
