import { Binarier } from "./Binarier.js";
import { IndexedDB } from "./IndexedDB.js";
import { Woxel } from "../Wabavam/Woxel/Woxel.js";
import { BoxelClipboard } from "../Wabavam/Boxel/BoxelEditor/Utils/BoxelClipboard.js";
export class Memory {
    constructor(options = {}) {
        this.store = options.store ?? new IndexedDB({
            databaseName: options.databaseName ?? "KL3Memory",
            storeName: options.storeName ?? "wabavams",
        });

        this.binarier = options.binarier ?? new Binarier();
    }

    async save(key, wabavam, options = {}) {
        if (!key || !wabavam) return false;

        const data = this.toMemoryData(wabavam, options);

        return this.saveData(key, data);
    }

    async saveData(key, data) {
        if (!key || !data) return false;

        const blob = await this.binarier.encode(data);

        await this.store.set(key, blob);

        return true;
    }


    async saveSettings(key = "mainSettings", settings = null) {
        if (!key || !settings) return false;

        const data = settings?.toMemoryData ? settings.toMemoryData() : {
            kind: "settings",
            version: 1,
            name: "KL3 Settings",
            values: { ...(settings.values ?? settings) },
        };

        return this.saveData(key, data);
    }

    async loadSettings(key = "mainSettings") {
        if (!key) return null;

        const data = await this.loadData(key);
        if (!data) return null;

        return data?.kind === "settings" ? data : null;
    }

    async saveSavedBoxels(key = "mainSavedBoxels", savedBoxels = []) {
        if (!key) return false;

        const data = this.savedBoxelsToMemoryData(savedBoxels);

        return this.saveData(key, data);
    }

    async loadSavedBoxels(key = "mainSavedBoxels") {
        if (!key) return [];

        const data = await this.loadData(key);
        if (!data) return [];

        return data?.kind === "savedBoxels"
            ? this.savedBoxelsFromMemoryData(data)
            : [];
    }

    async load(key) {
        if (!key) return null;

        const data = await this.loadData(key);
        if (!data) return null;

        return this.fromMemoryData(data);
    }

    async loadData(key) {
        if (!key) return null;

        const blob = await this.store.get(key);
        if (!blob) return null;

        return this.binarier.decode(blob);
    }

    async has(key) {
        if (!key) return false;

        return this.store.has(key);
    }

    async export(key) {
        if (!key) return false;

        const blob = await this.store.get(key);
        if (!blob) return false;

        const data = await this.binarier.decode(blob);
        const filename = this.createFilename(data);

        this.downloadBlob(blob, filename);

        return true;
    }

    async exportWoxel(woxel, options = {}) {
        if (!woxel) return false;

        const data = this.toMemoryData(woxel, {
            ...options,
            includePaletteSnapshot: options.includePaletteSnapshot ?? true,
        });
        const blob = await this.binarier.encode(data);

        this.downloadBlob(blob, this.createFilename(data));

        return true;
    }


    async exportBoxel(boxel, options = {}) {
        if (!boxel) return false;

        const serializer = new BoxelClipboard({
            name: options.name ?? boxel.name ?? "Boxel",
            boxel,
        });
        const data = serializer.toMemoryData();
        const blob = await this.binarier.encode(data);

        this.downloadBlob(blob, this.createFilename(data));

        return true;
    }

    async exportSavedBoxel(savedBoxel = null) {
        if (!savedBoxel?.boxel) return false;

        return this.exportBoxel(savedBoxel.boxel, {
            name: savedBoxel.name ?? savedBoxel.boxel?.name ?? "Boxel",
        });
    }

    async import(file) {
        if (!file) return null;

        return this.createWabavamFromBlob(file);
    }

    async createWabavamFromBlob(blob) {
        const data = await this.binarier.decode(blob);

        return this.fromMemoryData(data);
    }

    toMemoryData(wabavam, options = {}) {
        if (wabavam?.setPlayerState && options.player?.toMemoryData) {
            wabavam.setPlayerState(options.player.toMemoryData());
        }

        if (wabavam?.toMemoryData) {
            return wabavam.toMemoryData(options);
        }

        throw new Error("Memory cannot save this Wabavam yet.");
    }

    fromMemoryData(data) {
        if (data?.kind === "savedBoxels") {
            return this.savedBoxelsFromMemoryData(data);
        }

        if (data?.kind === "woxel") {
            return Woxel.fromMemoryData(data);
        }

        if (data?.kind === "boxelClipboard") {
            return BoxelClipboard.fromMemoryData(data);
        }

        if (data?.kind === "settings") {
            return data;
        }

        throw new Error(`Memory cannot load kind: ${data?.kind ?? "unknown"}`);
    }

    savedBoxelsToMemoryData(savedBoxels = []) {
        const serializer = new BoxelClipboard({ name: "SavedBoxelSerializer" });

        return {
            kind: "savedBoxels",
            version: 1,
            name: "Saved Boxels",
            boxels: savedBoxels.map((savedBoxel) => ({
                id: savedBoxel?.id ?? this.createSavedBoxelId(),
                name: Object.hasOwn(savedBoxel ?? {}, "name") ? savedBoxel.name : null,
                createdAt: savedBoxel?.createdAt ?? new Date().toISOString(),
                favorite: savedBoxel?.favorite === true,
                favoritedAt: savedBoxel?.favorite === true ? savedBoxel?.favoritedAt ?? savedBoxel?.createdAt ?? new Date().toISOString() : null,
                boxel: serializer.boxelToMemoryData(savedBoxel?.boxel ?? savedBoxel),
            })).filter((savedBoxel) => savedBoxel.boxel),
        };
    }

    savedBoxelsFromMemoryData(data = null) {
        const serializer = new BoxelClipboard({ name: "SavedBoxelSerializer" });
        const boxels = Array.isArray(data?.boxels) ? data.boxels : [];

        return boxels.map((savedBoxel) => {
            const boxel = serializer.boxelFromMemoryData(savedBoxel?.boxel);
            if (!boxel) return null;

            return {
                id: savedBoxel?.id ?? this.createSavedBoxelId(),
                name: Object.hasOwn(savedBoxel ?? {}, "name") ? savedBoxel.name : null,
                createdAt: savedBoxel?.createdAt ?? new Date().toISOString(),
                favorite: savedBoxel?.favorite === true,
                favoritedAt: savedBoxel?.favorite === true ? savedBoxel?.favoritedAt ?? savedBoxel?.createdAt ?? new Date().toISOString() : null,
                boxel,
            };
        }).filter(Boolean);
    }

    createSavedBoxelId() {
        if (globalThis.crypto?.randomUUID) return `boxel_${globalThis.crypto.randomUUID()}`;

        return `boxel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    createFilename(data = {}) {
        const extension = data.kind === "woxel" ? "woxel" : data.kind === "boxelClipboard" ? "boxel" : data.kind === "settings" ? "settings" : data.kind === "savedBoxels" ? "boxels" : "kl3";
        const name = this.sanitizeFilename(data.name ?? data.kind ?? "Wabavam");

        return `${name}.${extension}`;
    }

    sanitizeFilename(name = "Wabavam") {
        return String(name)
            .trim()
            .replace(/[^a-z0-9._-]+/gi, "_")
            .replace(/^_+|_+$/g, "")
            || "Wabavam";
    }

    downloadBlob(blob, filename = "Wabavam.kl3") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }
}

export default Memory;

