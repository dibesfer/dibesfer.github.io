export class Memory {
    constructor() {
    }

    load (where){
        return localStorage.getItem(where)
    }

    save(where, what) {
        return localStorage.setItem(where, what)
    }
}
