// Supabase operations for the Webochi Supabase Expert page.
const SupabaseExpert = (() => {
    const supabaseUrl = 'https://kalidybwmoxhcwlfeftc.supabase.co'
    const supabaseKey = 'sb_publishable__jr8YglR8G9zZQQfLPLzqw_GxL2RA-A'
    const database = supabase.createClient(supabaseUrl, supabaseKey)

    const edgeFunctionName = "fortress_ping"
    const chatTableName = "supabase_expert"

    function subscribeToChat({ onInsert, onDelete }) {
        return database
            .channel(chatTableName)
            .on('postgres_changes',
                { schema: 'public', table: chatTableName, event: '*' },
                (payload) => {
                    if (payload.eventType === 'INSERT') onInsert(payload.new)
                    if (payload.eventType === 'DELETE') onDelete(payload)
                }
            )
            .subscribe()
    }

    async function readChatRows() {
        return await database
            .from(chatTableName)
            .select()
    }

    async function insertChatMessage({ message, timezone, username }) {
        return await database
            .from(chatTableName)
            .insert({
                message,
                timezone,
                username
            })
    }

    async function getUser() {
        const { data: { user }, error } = await database.auth.getUser()
        return { user, error }
    }

    async function login(email, password) {
        return await database.auth.signInWithPassword({
            email,
            password
        })
    }

    async function logout() {
        return await database.auth.signOut()
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

    function subscribeToPresence(onCountChange) {
        const channel = database.channel("online-users", {
            config: {
                presence: { key: 0 }
            }
        })

        channel
            .on("presence", { event: "sync" }, () => {
                const count = Object.keys(channel.presenceState()).length
                onCountChange(count)
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({
                        user_id: "Anonymous",
                        username: "Anonymous"
                    })
                }
            })

        return channel
    }

    return {
        subscribeToChat,
        readChatRows,
        insertChatMessage,
        getUser,
        login,
        logout,
        callEdge,
        subscribeToPresence
    }
})()
