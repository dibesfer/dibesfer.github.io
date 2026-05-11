export function getBoxel15Key(boxel15 = null) {
    return boxel15?.position
        ? `${boxel15.position.x},${boxel15.position.y},${boxel15.position.z}`
        : "";
}

export function normalizeBoxel15List(boxel15s = []) {
    const seen = new Set();

    return (Array.isArray(boxel15s) ? boxel15s : [boxel15s]).filter((boxel15) => {
        const key = getBoxel15Key(boxel15);
        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
    });
}

export function addUniqueBoxel15s(target = [], seen = new Set(), boxel15s = []) {
    normalizeBoxel15List(boxel15s).forEach((boxel15) => {
        const key = getBoxel15Key(boxel15);
        if (seen.has(key)) return;

        seen.add(key);
        target.push(boxel15);
    });

    return target;
}

export function createBoxel15Set(boxel15s = []) {
    return new Set(normalizeBoxel15List(boxel15s).map(getBoxel15Key));
}

export function normalizeBoxel15Limit(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? Math.floor(number) : Infinity;
}

export function normalizeBoxel15Milliseconds(value) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? Math.max(0.5, number) : Infinity;
}

export function normalizeBoxel15Distance(value, fallback = 60) {
    const number = Number(value);

    return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function normalizeBoxel15Budget(value, fallback = 48) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;

    return number > 0 ? Math.floor(number) : Infinity;
}

export function normalizeBoxel15Dot(value, fallback = -0.65) {
    const number = Number(value);

    return Number.isFinite(number) ? Math.min(Math.max(number, -1), 1) : fallback;
}

export function createEmptyBoxel15StreamResult() {
    return { loaded: [], unloaded: [], wantedBoxels: [], wantedCount: 0, loadedCount: 0 };
}

export function createEmptyDeferredRemeshingResult() {
    return { remeshed: [], deferred: [], dirtyBoxels: [], dirtyCount: 0 };
}
