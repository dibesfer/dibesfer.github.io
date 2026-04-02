const KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY = "kolorlando.accountClaimed";
const KOLORLANDO_ACCOUNT_SESSION_HEARTBEAT_MS = 8000;

let kolorlandoRuntimeHeartbeatIntervalId = 0;
let kolorlandoRuntimeHeartbeatInFlight = false;
let kolorlandoRuntimeReleaseAttached = false;
let kolorlandoRuntimeClaimedSessionId = "";

function ensureKolorlandoAccountSessionId() {
  if (typeof window.ensureKolorlandoUniqueAccountSessionId === "function") {
    return window.ensureKolorlandoUniqueAccountSessionId();
  }

  /* Runtime pages must reuse the same per-tab id as the landing page. */
  const existingSessionId = window.sessionStorage.getItem("kolorlando.accountSessionId");

  if (existingSessionId) {
    return existingSessionId;
  }

  const generatedSessionId = typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `kolorlando-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.sessionStorage.setItem("kolorlando.accountSessionId", generatedSessionId);
  return generatedSessionId;
}

function isMissingAuthSessionError(error) {
  return error?.name === "AuthSessionMissingError"
    || /auth session missing/i.test(String(error?.message || ""));
}

function isAccountSessionAlreadyActiveError(error) {
  return /ACCOUNT_SESSION_ALREADY_ACTIVE/i.test(String(error?.message || error || ""));
}

async function claimKolorlandoRuntimeAccountSession() {
  if (!window.database?.rpc) {
    return { error: null };
  }

  const sessionId = ensureKolorlandoAccountSessionId();
  const result = await window.database.rpc("claim_active_account_session", {
    incoming_session_id: sessionId,
    stale_after_seconds: 20,
  });

  if (!result?.error) {
    kolorlandoRuntimeClaimedSessionId = sessionId;
  }

  return result;
}

function persistKolorlandoClaimedState(isClaimed) {
  /* Runtime pages and landing auth must agree on whether this specific tab
  owns the Kolorlando session, independent from shared Supabase auth. */
  if (isClaimed) {
    window.sessionStorage.setItem(KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY, "1");
  } else {
    window.sessionStorage.removeItem(KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY);
  }
}

function stopKolorlandoRuntimeHeartbeat() {
  if (!kolorlandoRuntimeHeartbeatIntervalId) {
    return;
  }

  window.clearInterval(kolorlandoRuntimeHeartbeatIntervalId);
  kolorlandoRuntimeHeartbeatIntervalId = 0;
}

async function redirectToBlockedLanding() {
  persistKolorlandoClaimedState(false);
  stopKolorlandoRuntimeHeartbeat();
  kolorlandoRuntimeClaimedSessionId = "";
  const blockedLandingUrl = new URL("./index.html?session_blocked=1", window.location.href);
  window.location.replace(blockedLandingUrl.href);
}

async function heartbeatKolorlandoRuntimeAccountSession() {
  if (kolorlandoRuntimeHeartbeatInFlight) {
    return;
  }

  if (!window.database?.rpc) {
    return;
  }

  kolorlandoRuntimeHeartbeatInFlight = true;

  try {
    const sessionId = ensureKolorlandoAccountSessionId();

    /* Duplicate-tab resolution can rotate the per-tab session id after the
    runtime page already claimed ownership. Re-claiming first keeps heartbeat
    on the authoritative current id and avoids the normal 400 path. */
    if (!kolorlandoRuntimeClaimedSessionId || kolorlandoRuntimeClaimedSessionId !== sessionId) {
      const { error: claimError } = await claimKolorlandoRuntimeAccountSession();

      if (!claimError) {
        persistKolorlandoClaimedState(true);
        return;
      }

      if (isAccountSessionAlreadyActiveError(claimError)) {
        await redirectToBlockedLanding();
        return;
      }

      stopKolorlandoRuntimeHeartbeat();
      console.error("Could not re-claim the Kolorlando runtime account session lock before heartbeat.", claimError);
      return;
    }

    await window.database.rpc("heartbeat_active_account_session", {
      incoming_session_id: sessionId
    });
  } catch (error) {
    if (isAccountSessionAlreadyActiveError(error)) {
      await redirectToBlockedLanding();
      return;
    }

    /* A duplicated tab can rotate to a fresh per-tab session id after the
    initial page claim. In that case heartbeat no longer matches an existing
    lock row, so the runtime should re-claim with the latest tab id instead of
    failing the page on the first 400 response. */
    const { error: reclaimError } = await claimKolorlandoRuntimeAccountSession();

    if (!reclaimError) {
      persistKolorlandoClaimedState(true);
      return;
    }

    if (isAccountSessionAlreadyActiveError(reclaimError)) {
      await redirectToBlockedLanding();
      return;
    }

    stopKolorlandoRuntimeHeartbeat();
    console.error("Could not refresh the Kolorlando runtime account session lock.", error);
    console.error("Could not re-claim the Kolorlando runtime account session lock.", reclaimError);
  } finally {
    kolorlandoRuntimeHeartbeatInFlight = false;
  }
}

function attachKolorlandoRuntimeRelease() {
  if (kolorlandoRuntimeReleaseAttached) {
    return;
  }

  kolorlandoRuntimeReleaseAttached = true;

  const releaseRuntimeSession = () => {
    stopKolorlandoRuntimeHeartbeat();
    kolorlandoRuntimeClaimedSessionId = "";

    if (!window.database?.rpc) {
      return;
    }

    Promise.resolve(window.database.rpc("release_active_account_session", {
      incoming_session_id: ensureKolorlandoAccountSessionId()
    })).catch((error) => {
      console.warn("Could not release the Kolorlando runtime account session lock.", error);
    });
  };

  window.addEventListener("pagehide", releaseRuntimeSession);
  window.addEventListener("beforeunload", releaseRuntimeSession);
}

function startKolorlandoRuntimeHeartbeat() {
  stopKolorlandoRuntimeHeartbeat();
  attachKolorlandoRuntimeRelease();

  heartbeatKolorlandoRuntimeAccountSession().catch((error) => {
    console.error("Could not start the Kolorlando runtime account session heartbeat.", error);
  });

  kolorlandoRuntimeHeartbeatIntervalId = window.setInterval(() => {
    heartbeatKolorlandoRuntimeAccountSession().catch((error) => {
      console.error("Could not refresh the Kolorlando runtime account session lock.", error);
    });
  }, KOLORLANDO_ACCOUNT_SESSION_HEARTBEAT_MS);
}

export async function guardKolorlandoAccountSessionOrRedirect() {
  /* Runtime pages should only enforce the account lock for authenticated
  players; anonymous visitors can keep loading without a redirect. */
  if (!window.database?.auth?.getUser || !window.database?.rpc) {
    return true;
  }

  try {
    const { data: authData, error: authError } = await window.database.auth.getUser();

    if (authError) {
      if (isMissingAuthSessionError(authError)) {
        persistKolorlandoClaimedState(false);
        return true;
      }

      throw authError;
    }

    if (!authData?.user?.id) {
      persistKolorlandoClaimedState(false);
      return true;
    }

    const { error: claimError } = await claimKolorlandoRuntimeAccountSession();

    if (!claimError) {
      persistKolorlandoClaimedState(true);
      startKolorlandoRuntimeHeartbeat();
      return true;
    }

    if (isAccountSessionAlreadyActiveError(claimError)) {
      await redirectToBlockedLanding();
      return false;
    }

    throw claimError;
  } catch (error) {
    console.error("Could not validate the Kolorlando account session on this page.", error);
    return true;
  }
}
