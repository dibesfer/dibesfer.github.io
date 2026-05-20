const SB_ENDPOINT =
  "https://qugihsopwjemzakhrbvw.supabase.co/functions/v1/visit_v3";

async function hit(path) {
  try {
    const res = await fetch(SB_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    });

    const data = await res.json().catch(() => null);

    return {
      ok: res.ok,
      count: data?.count ?? null,
    };
  } catch {
    return {
      ok: false,
      count: null,
    };
  }
}

window.hit = hit;