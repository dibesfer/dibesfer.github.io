// --- CONFIG ---
const SB_URL = "https://qugihsopwjemzakhrbvw.supabase.co";
const SB_KEY = "sb_publishable_pjIVdSrJflHIiUvT-5WDog_dCUpU8DC";
const SB_ENDPOINT = `${SB_URL}/functions/v1/visit_v3`;
const MEMORY_KEY = "dibesferV3_localVisits";
const DEVICE_KEY = "dibesferV3_deviceId";

// --- URL ---
const url = new URLSearchParams(window.location.search).get("url")
  || window.location.href;

// --- VISITS ---
async function hit(url) {
  try {
    const res = await fetch(SB_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      keepalive: true,
    });
    return await res.json();
  } catch {
    return { count: null };
  }
}

// --- MEMORY ---
function loadLocal() { return localStorage.getItem(MEMORY_KEY); }
function saveLocal(val) { localStorage.setItem(MEMORY_KEY, val); }

// --- DEVICE ID ---
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// --- PRESENCE ---
function subscribeToPresence(onCountChange) {
  const client = supabase.createClient(SB_URL, SB_KEY);
  const channel = client.channel("online-users", {
    config: { presence: { key: getDeviceId() } }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const count = Object.keys(channel.presenceState()).length;
      onCountChange(count);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: getDeviceId() });
      }
    });

  return channel;
}

// --- INIT ---
hit(url).then(res => {
  const el = document.getElementById("display");
  if (typeof res.count === "number") el.textContent = res.count;
});

let local = parseInt(loadLocal()) || 0;
local++;
saveLocal(local);

subscribeToPresence((count) => {
  const el = document.getElementById("displayPresence");
  if (el && count > 1) el.textContent = "Online: " + count;
});