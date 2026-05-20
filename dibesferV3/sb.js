const SB_ENDPOINT =
  "https://qugihsopwjemzakhrbvw.supabase.co/functions/v1/visit_v3";

const COUNT_ENDPOINT =
  "https://qugihsopwjemzakhrbvw.supabase.co/functions/v1/visit_v3_count";

// fire & forget write
function hit(path) {
  fetch(SB_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    keepalive: true,
  }).catch(() => {});
}

// read total count
async function getCount() {
  try {
    const res = await fetch(COUNT_ENDPOINT);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.count === "number" ? data.count : null;
  } catch {
    return null;
  }
}

// expose globally (NO modules, no import/export)
window.hit = hit;
window.getCount = getCount;