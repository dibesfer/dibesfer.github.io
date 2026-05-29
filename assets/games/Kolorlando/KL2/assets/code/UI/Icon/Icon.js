export class Icon {
    static templatePath = "./icon.html";
    static template = null;
    static templateRequest = null;

    constructor(data = {}) {
        this.data = data;
        this.element = null;
    }

    static async loadTemplate() {
        if (this.template) return this.template;
        if (this.templateRequest) return this.templateRequest;

        this.templateRequest = fetch(this.templatePath, { cache: "no-store" })
            .then(response => response.text())
            .then(html => {
                const template = document.createElement("template");

                template.innerHTML = html.trim();
                this.template = template;
                return template;
            });

        return this.templateRequest;
    }

    async render() {
        const template = await this.constructor.loadTemplate();

        this.element = template.content.firstElementChild.cloneNode(true);
        this.applyData();
        return this.element;
    }

    async mount(target) {
        if (!target) return null;

        const element = await this.render();

        target.replaceChildren(element);
        return element;
    }

    applyData() {
        if (!this.element) return;

        const name = this.element.querySelector("[data-icon=\"name\"]");
        const count = this.element.querySelector("[data-icon=\"count\"]");
        const image = this.element.querySelector("[data-icon=\"image\"]");

        if (name && this.data.name !== undefined) name.textContent = this.data.name;
        if (count && this.data.count !== undefined) count.textContent = this.data.count;
        if (image) {
            if (this.data.image !== undefined) image.src = this.data.image;
            if (this.data.name !== undefined) image.alt = this.data.name;
        }
    }
}

export default Icon;

