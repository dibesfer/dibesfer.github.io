const SB_ENDPOINT =
  "https://qugihsopwjemzakhrbvw.supabase.co/functions/v1/visit_v3";

async function hit(url) {
  try {
    const res = await fetch(SB_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url || window.location.href,
      }),
      keepalive: true,
    });

    return await res.json();
  } catch {
    return { count: null };
  }
}

window.hit = hit;