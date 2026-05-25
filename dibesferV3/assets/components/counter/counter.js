// --- CONFIG ---
const SB_ENDPOINT = "https://qugihsopwjemzakhrbvw.supabase.co/functions/v1/visit_v3";
const MEMORY_KEY = "dibesferV3_localVisits";

// --- URL ---
const url = new URLSearchParams(window.location.search).get("url")
  || window.location.href;

  // --- SB ---
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
function loadLocal() {
  return localStorage.getItem(MEMORY_KEY);
}
function saveLocal(val) {
  localStorage.setItem(MEMORY_KEY, val);
}

// --- INIT ---
hit(url).then(res => {
  const el = document.getElementById("display");
  if (typeof res.count === "number") el.textContent = res.count;
});

let local = parseInt(loadLocal()) || 0;
local++;
console.log("Local visits: " + local)
saveLocal(local);