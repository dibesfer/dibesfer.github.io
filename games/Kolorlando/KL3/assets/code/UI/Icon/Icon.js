export class Icon {
    constructor(options = {}) {
        this.item = options.item ?? null;
        this.index = options.index ?? null;
        this.selected = options.selected ?? false;
        this.onClick = options.onClick ?? null;

        this.element = options.element ?? document.createElement("button");
        this.element.type = "button";

        this.handleClick = this.handleClick.bind(this);
        this.element.addEventListener("click", this.handleClick);

        this.render();
    }

    setItem(item = null) {
        this.item = item;
        this.render();
    }

    setIndex(index = null) {
        this.index = index;
        this.render();
    }

    setSelected(selected = false) {
        this.selected = Boolean(selected);
        this.render();
    }

    handleClick(event) {
        this.onClick?.(this.item, this.index, this, event);
    }

    render() {
        this.element.className = "icon uiGridItem";
        this.element.classList.toggle("isSelected", this.selected);
        this.element.classList.toggle("isEmpty", !this.item);
        this.element.innerHTML = "";

        const name = document.createElement("div");
        name.className = "iconName";
        name.textContent = this.item?.name ?? "";

        const image = document.createElement("div");
        image.className = "iconImage";
        this.renderImage(image);

        this.element.appendChild(name);
        this.element.appendChild(image);

        if (this.item?.hasCount?.()) {
            const count = document.createElement("div");
            count.className = "iconCount";
            count.textContent = String(this.item.count);
            this.element.appendChild(count);
        }

        return this.element;
    }

    renderImage(imageElement) {
        if (!this.item) return;

        const icon = this.item.icon ?? {};

        if (icon.type === "image" && icon.src) {
            const image = document.createElement("img");
            image.src = icon.src;
            image.alt = this.item.name;
            imageElement.appendChild(image);
            return;
        }

        const color = icon.color ?? this.item.getVoxel?.()?.color ?? "#ffffff";
        const colorBox = document.createElement("div");
        colorBox.className = "iconColor";
        colorBox.style.backgroundColor = color;

        imageElement.appendChild(colorBox);
    }

    destroy() {
        this.element.removeEventListener("click", this.handleClick);
    }
}

export default Icon;
