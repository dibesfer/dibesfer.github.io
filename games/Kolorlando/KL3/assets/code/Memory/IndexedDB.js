export class IndexedDB {
    constructor(options = {}) {
        this.databaseName = options.databaseName ?? "KL3Memory";
        this.storeName = options.storeName ?? "wabavams";
        this.version = options.version ?? 1;

        this.databasePromise = null;
    }

    open() {
        if (this.databasePromise) return this.databasePromise;

        this.databasePromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.databaseName, this.version);

            request.onupgradeneeded = () => {
                const database = request.result;

                if (!database.objectStoreNames.contains(this.storeName)) {
                    database.createObjectStore(this.storeName, {
                        keyPath: "key",
                    });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.databasePromise;
    }

    async set(key, value) {
        const database = await this.open();

        return this.runTransaction(database, "readwrite", (store) => {
            return store.put({
                key,
                value,
                updatedAt: Date.now(),
            });
        });
    }

    async get(key) {
        const database = await this.open();
        const record = await this.runTransaction(database, "readonly", (store) => {
            return store.get(key);
        });

        return record?.value ?? null;
    }

    async has(key) {
        const database = await this.open();
        const resultKey = await this.runTransaction(database, "readonly", (store) => {
            return store.getKey(key);
        });

        return resultKey !== undefined;
    }

    async delete(key) {
        const database = await this.open();

        return this.runTransaction(database, "readwrite", (store) => {
            return store.delete(key);
        });
    }

    async clear() {
        const database = await this.open();

        return this.runTransaction(database, "readwrite", (store) => {
            return store.clear();
        });
    }

    runTransaction(database, mode, action) {
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(this.storeName, mode);
            const store = transaction.objectStore(this.storeName);
            const request = action(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

export default IndexedDB;
