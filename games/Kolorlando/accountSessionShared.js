const KOLORLANDO_ACCOUNT_SESSION_STORAGE_KEY = "kolorlando.accountSessionId";
const KOLORLANDO_ACCOUNT_SESSION_PROBE_KEY = "kolorlando.accountSessionProbe";
const KOLORLANDO_ACCOUNT_SESSION_CONFLICT_KEY = "kolorlando.accountSessionConflict";
const KOLORLANDO_TAB_RUNTIME_ID = typeof crypto?.randomUUID === "function"
  ? crypto.randomUUID()
  : `runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const KOLORLANDO_TAB_STARTED_AT = Date.now();

let kolorlandoResolvedAccountSessionId = "";
let kolorlandoSessionProbeAttached = false;

function logSharedSessionDebug(label, extra = {}) {
  window.kolorlandoDebugConsole?.logState?.(label, {
    runtimeId: KOLORLANDO_TAB_RUNTIME_ID,
    sessionId: kolorlandoResolvedAccountSessionId || "",
    startedAt: KOLORLANDO_TAB_STARTED_AT,
    ...extra,
  });
}

function generateKolorlandoAccountSessionId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `kolorlando-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function writeKolorlandoAccountSessionId(nextSessionId) {
  kolorlandoResolvedAccountSessionId = nextSessionId;
  window.sessionStorage.setItem(KOLORLANDO_ACCOUNT_SESSION_STORAGE_KEY, nextSessionId);
}

function announceKolorlandoAccountSessionId() {
  if (!kolorlandoResolvedAccountSessionId) {
    return;
  }

  const probePayload = JSON.stringify({
    runtimeId: KOLORLANDO_TAB_RUNTIME_ID,
    sessionId: kolorlandoResolvedAccountSessionId,
    startedAt: KOLORLANDO_TAB_STARTED_AT,
    sentAt: Date.now(),
  });

  window.localStorage.setItem(KOLORLANDO_ACCOUNT_SESSION_PROBE_KEY, probePayload);
  window.localStorage.removeItem(KOLORLANDO_ACCOUNT_SESSION_PROBE_KEY);
}

function announceKolorlandoAccountSessionConflict(targetRuntimeId) {
  if (!targetRuntimeId || !kolorlandoResolvedAccountSessionId) {
    return;
  }

  const conflictPayload = JSON.stringify({
    targetRuntimeId,
    keeperRuntimeId: KOLORLANDO_TAB_RUNTIME_ID,
    sessionId: kolorlandoResolvedAccountSessionId,
    sentAt: Date.now(),
  });

  window.localStorage.setItem(KOLORLANDO_ACCOUNT_SESSION_CONFLICT_KEY, conflictPayload);
  window.localStorage.removeItem(KOLORLANDO_ACCOUNT_SESSION_CONFLICT_KEY);
}

function attachKolorlandoAccountSessionProbe() {
  if (kolorlandoSessionProbeAttached) {
    return;
  }

  kolorlandoSessionProbeAttached = true;

  window.addEventListener("storage", (event) => {
    if (!event.newValue) {
      return;
    }

    try {
      if (event.key === KOLORLANDO_ACCOUNT_SESSION_PROBE_KEY) {
        const payload = JSON.parse(event.newValue);

        if (!payload?.sessionId || payload.runtimeId === KOLORLANDO_TAB_RUNTIME_ID) {
          return;
        }

        if (payload.sessionId !== kolorlandoResolvedAccountSessionId) {
          return;
        }

        /* When another tab announces the same session id, the older/original
        tab keeps the id and explicitly tells the newer tab to yield. */
        if (typeof payload.startedAt !== "number" || payload.startedAt <= KOLORLANDO_TAB_STARTED_AT) {
          return;
        }

        announceKolorlandoAccountSessionConflict(payload.runtimeId);
        return;
      }

      if (event.key === KOLORLANDO_ACCOUNT_SESSION_CONFLICT_KEY) {
        const payload = JSON.parse(event.newValue);

        if (payload?.targetRuntimeId !== KOLORLANDO_TAB_RUNTIME_ID) {
          return;
        }

        if (payload.sessionId !== kolorlandoResolvedAccountSessionId) {
          return;
        }

        writeKolorlandoAccountSessionId(generateKolorlandoAccountSessionId());
        announceKolorlandoAccountSessionId();
        logSharedSessionDebug("Session: rotated");
      }
    } catch (error) {
      console.warn("Could not parse Kolorlando tab session probe.", error);
    }
  });
}

function ensureKolorlandoUniqueAccountSessionId() {
  if (!kolorlandoResolvedAccountSessionId) {
    const storedSessionId = window.sessionStorage.getItem(KOLORLANDO_ACCOUNT_SESSION_STORAGE_KEY);
    writeKolorlandoAccountSessionId(storedSessionId || generateKolorlandoAccountSessionId());
    attachKolorlandoAccountSessionProbe();
    announceKolorlandoAccountSessionId();
  }

  return kolorlandoResolvedAccountSessionId;
}

window.ensureKolorlandoUniqueAccountSessionId = ensureKolorlandoUniqueAccountSessionId;
