/* This file mirrors the practical Monochat auth flow for Kolorlando's
landing page while keeping every auth-specific behavior isolated from the
rest of the menu code. The page already loads the shared Supabase client
first, so we reuse that global database connection here instead of creating
another one. */

const authIdentity = document.getElementById("authIdentity")
const authPassword = document.getElementById("authPassword")
const authMessage = document.getElementById("authMessage")
const authUserDisplay = document.getElementById("authUserDisplay")
const kAuthForm = document.getElementById("kAuthForm")
const kAuthSubmit = document.getElementById("kAuthSubmit")
const kAuthLogout = document.getElementById("kAuthLogout")
const idDiv = document.getElementById("idDiv")

let kolorlandoAuthUser = null
let kolorlandoUserProfile = null

/* These small text helpers keep the UI copy consistent every time auth
state changes, whether that change comes from a page load, sign in, sign up,
or sign out. */
function setAuthMessage(message, isError) {
    authMessage.textContent = message
    authMessage.style.color = isError ? "rgb(255, 165, 165)" : "rgb(255, 238, 174)"
}

function setIdentityVisual(username, isLoggedIn) {
    /* The landing page only has a small floating identity widget, so we use
    its tooltip and image filter to signal login state without redesigning
    the page. */
    authUserDisplay.textContent = username
    idDiv.title = isLoggedIn ? `Logged in as ${username}` : "Anonymous user"
    idDivIcon.style.filter = isLoggedIn ? "invert(0)" : "invert(1)"
}

function setAuthMode(isLoggedIn) {
    /* The same modal handles both anonymous and authenticated users, so we
    hide the credential fields once a session exists and swap the action
    buttons instead of opening a second account panel. */
    authIdentity.disabled = isLoggedIn
    authPassword.disabled = isLoggedIn
    authIdentity.style.display = isLoggedIn ? "none" : "block"
    authPassword.style.display = isLoggedIn ? "none" : "block"
    document.querySelector('label[for="authIdentity"]').style.display = isLoggedIn ? "none" : "block"
    document.querySelector('label[for="authPassword"]').style.display = isLoggedIn ? "none" : "block"
    kAuthSubmit.classList.toggle("invisible", isLoggedIn)
    kAuthLogout.classList.toggle("invisible", !isLoggedIn)
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
    const { data, error } = await database.auth.getUser()

    if (error) {
        throw error
    }

    const user = data.user

    if (!user) {
        kolorlandoAuthUser = null
        kolorlandoUserProfile = null
        window.kolorlandoAuthUser = null
        window.kolorlandoUserProfile = null
        authIdentity.value = ""
        authPassword.value = ""
        setIdentityVisual("Anonymous", false)
        setAuthMode(false)
        setAuthMessage("Save and keep your data by logging in", false)
        return null
    }

    const confirmedProfile = await ensureConfirmedProfile(user)
    const username = confirmedProfile?.username || user.email.split("@")[0]

    kolorlandoAuthUser = user
    kolorlandoUserProfile = confirmedProfile

    /* These globals make the current authenticated user easy to reuse from
    future Kolorlando scripts, including multiplayer and world ownership. */
    window.kolorlandoAuthUser = user
    window.kolorlandoUserProfile = confirmedProfile

    authIdentity.value = ""
    authPassword.value = ""
    setIdentityVisual(username, true)
    setAuthMode(true)
    setAuthMessage(`You are logged as ${username}`, false)

    return user
}

async function signUpWithEmail(email, password) {
    /* The signup branch deliberately follows Monochat's current rule:
    if the `users` row does not exist yet, create the auth account and then
    create the profile row with the email prefix as username. */
    const { data, error } = await database.auth.signUp({
        email: email,
        password: password
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
    const { error } = await database.auth.signInWithPassword({
        email: email,
        password: password
    })

    if (error) {
        throw error
    }

    await refreshAuthState()
}

async function handleAuthSubmit(event) {
    event.preventDefault()

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
            await logInWithEmail(existingProfile.email, password)
        } else if (identity.includes("@")) {
            await signUpWithEmail(identity.toLowerCase(), password)
        } else {
            setAuthMessage("Use an email to create a new account.", true)
        }
    } catch (error) {
        setAuthMessage(error.message || "Auth error", true)
    } finally {
        kAuthSubmit.disabled = false
    }
}

async function handleLogOut() {
    try {
        kAuthLogout.disabled = true
        const { error } = await database.auth.signOut()

        if (error) {
            throw error
        }

        authPassword.value = ""
        await refreshAuthState()
        setAuthMessage("You are anonymous again.", false)
    } catch (error) {
        setAuthMessage(error.message || "Log out error", true)
    } finally {
        kAuthLogout.disabled = false
    }
}

kAuthForm.addEventListener("submit", handleAuthSubmit)
kAuthLogout.addEventListener("click", handleLogOut)

/* This listener keeps the landing page identity widget synced when another
tab signs in or out using the same Supabase session storage. */
database.auth.onAuthStateChange(() => {
    refreshAuthState().catch((error) => {
        setAuthMessage(error.message || "Could not refresh auth", true)
    })
})

refreshAuthState().catch((error) => {
    setAuthMessage(error.message || "Could not load auth", true)
})
