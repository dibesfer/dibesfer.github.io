import { Isometricon } from "../../../../../Isometricon/Isometricon.js";
import { Compass } from "../../Wabavam/Compass.js";

function isActiveMicroxel(microxel = null) {
    if (!microxel) return false;
    if (microxel.active === false) return false;
    if (microxel.filled === false) return false;

    return true;
}

function microxelColor(microxel = null, fallback = "#ffffff") {
    return typeof microxel?.color === "string" && microxel.color.trim()
        ? microxel.color
        : fallback;
}

function microxelIconOrientation(voxel = null) {
    const voxelOrientation = voxel?.isOrientable?.()
        ? (Compass.normalize(voxel.orientation) ?? Compass.NORTH)
        : Compass.NORTH;

    return Compass.combine(voxelOrientation, Compass.SOUTH);
}

function rotateMicroxelPosition(position = {}, voxel = null) {
    const size = Math.max(1, Math.floor(voxel?.effectiveMicroxelSize?.() ?? voxel?.microxelSize ?? 1));

    return Compass.rotatePositionInSize(position, {
        x: size,
        y: size,
        z: size,
    }, microxelIconOrientation(voxel));
}

function voxelToIsometriconSpec(voxel = null, fallbackColor = "#ffffff") {
    if (!voxel) {
        return {
            type: "voxel",
            color: fallbackColor,
        };
    }

    if (!voxel.hasMicroxels?.()) {
        return {
            type: "voxel",
            color: voxel.color ?? fallbackColor,
        };
    }

    const microxels = [];

    voxel.forEachMicroxel((microxel, x, y, z) => {
        if (!isActiveMicroxel(microxel)) return;

        const position = rotateMicroxelPosition({ x, y, z }, voxel);

        microxels.push({
            x: position.x,
            y: position.y,
            z: position.z,
            color: microxelColor(microxel, voxel.color ?? fallbackColor),
        });
    });

    if (microxels.length === 0) {
        return {
            type: "voxel",
            color: voxel.color ?? fallbackColor,
        };
    }

    return {
        type: "voxel",
        color: voxel.color ?? fallbackColor,
        microxels,
    };
}

function createIsometriconImage(spec, alt = "Voxel") {
    const image = Isometricon.toImage(spec, {
        size: 256,
        pixelRatio: 3,
        pixelPerfect: true,
        cubeOutline: true,
        underlayGrid: true,
        hexOutline: true,
        gridStroke: "rgba(134,218,255,0.85)",
        hexFill: "rgba(255,255,255,0.10)",
        pixelLineWidth: 1,
    });

    image.classList.add("iconImageAsset");
    image.alt = alt;

    return image;
}

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

        const voxel = this.item.getVoxel?.() ?? null;
        const color = icon.color ?? voxel?.color ?? "#ffffff";

        if (voxel || this.item.kind === "voxel" || icon.type === "color") {
            imageElement.appendChild(createIsometriconImage(
                voxelToIsometriconSpec(voxel, color),
                this.item.name ?? "Voxel"
            ));
            return;
        }

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
