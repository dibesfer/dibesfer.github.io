class MyHeader extends HTMLElement {
    constructor(){
        super()
        this.innerHTML = `
        <h1>customElements</h1>
        <p>They allow you reuse components like in React</p>
        `
    }
}

class MyFooter extends HTMLElement {
    constructor(){
        super()
        this.innerHTML = `
        <p>made by <a href="https://dibesfer.github.io">dibesfer</a></p>
        `
    }
}

customElements.define("my-header", MyHeader)
customElements.define("my-footer", MyFooter)