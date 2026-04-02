const KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY = "kolorlando.accountClaimed";

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

function persistKolorlandoClaimedState(isClaimed) {
  /* Runtime pages and landing auth must agree on whether this specific tab
  owns the Kolorlando session, independent from shared Supabase auth. */
  if (isClaimed) {
    window.sessionStorage.setItem(KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY, "1");
  } else {
    window.sessionStorage.removeItem(KOLORLANDO_ACCOUNT_CLAIMED_STORAGE_KEY);
  }
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
        return true;
      }

      throw authError;
    }

    if (!authData?.user?.id) {
      persistKolorlandoClaimedState(false);
      return true;
    }

    const { error: claimError } = await window.database.rpc("claim_active_account_session", {
      incoming_session_id: ensureKolorlandoAccountSessionId(),
      stale_after_seconds: 20,
    });

    if (!claimError) {
      persistKolorlandoClaimedState(true);
      return true;
    }

    if (isAccountSessionAlreadyActiveError(claimError)) {
      persistKolorlandoClaimedState(false);
      const blockedLandingUrl = new URL("./index.html?session_blocked=1", window.location.href);
      window.location.replace(blockedLandingUrl.href);
      return false;
    }

    throw claimError;
  } catch (error) {
    console.error("Could not validate the Kolorlando account session on this page.", error);
    return true;
  }
}
