function mixColorChannel(channel, target, amount) {
    return Math.round(channel + (target - channel) * amount);
}

function tintHexColor(hexColor, amount) {
    const cleanHex = String(hexColor || '').replace('#', '');
    const parsed = Number.parseInt(cleanHex, 16);
    if (!Number.isFinite(parsed)) return hexColor;

    const r = (parsed >> 16) & 0xff;
    const g = (parsed >> 8) & 0xff;
    const b = parsed & 0xff;
    const tinted = (
        (mixColorChannel(r, 255, amount) << 16)
        | (mixColorChannel(g, 255, amount) << 8)
        | mixColorChannel(b, 255, amount)
    );

    return '#' + tinted.toString(16).padStart(6, '0');
}

function projectVoxelPoint(position, tileWidth, tileHeight, cubeHeight) {
    const x = Number(position?.x) || 0;
    const y = Number(position?.y) || 0;
    const z = Number(position?.z) || 0;

    return {
        x: (x - z) * tileWidth * 0.5,
        y: (x + z) * tileHeight * 0.5 - y * cubeHeight,
    };
}

function drawPolygon(context, points, fillStyle) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i += 1) {
        context.lineTo(points[i].x, points[i].y);
    }

    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
    context.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    context.lineWidth = 1.5;
    context.lineJoin = 'round';
    context.stroke();
}

function normalizeBoxelVoxels(boxelData) {
    return Array.isArray(boxelData?.voxels)
        ? boxelData.voxels
            .map(voxel => ({
                color: typeof voxel?.color === 'string' ? voxel.color : '#4a90ff',
                position: {
                    x: Math.round(Number(voxel?.position?.x) || 0),
                    y: Math.round(Number(voxel?.position?.y) || 0),
                    z: Math.round(Number(voxel?.position?.z) || 0),
                },
            }))
            .sort((left, right) => (
                (left.position.x + left.position.z + left.position.y * 2)
                - (right.position.x + right.position.z + right.position.y * 2)
            ))
        : [];
}

function measureBoxelBounds(voxels, tileWidth, tileHeight, cubeHeight) {
    const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
    };

    voxels.forEach(voxel => {
        const origin = projectVoxelPoint(voxel.position, tileWidth, tileHeight, cubeHeight);
        const points = [
            { x: origin.x, y: origin.y - tileHeight * 0.5 },
            { x: origin.x + tileWidth * 0.5, y: origin.y },
            { x: origin.x + tileWidth * 0.5, y: origin.y + cubeHeight },
            { x: origin.x, y: origin.y + cubeHeight + tileHeight * 0.5 },
            { x: origin.x - tileWidth * 0.5, y: origin.y + cubeHeight },
            { x: origin.x - tileWidth * 0.5, y: origin.y },
        ];

        points.forEach(point => {
            bounds.minX = Math.min(bounds.minX, point.x);
            bounds.minY = Math.min(bounds.minY, point.y);
            bounds.maxX = Math.max(bounds.maxX, point.x);
            bounds.maxY = Math.max(bounds.maxY, point.y);
        });
    });

    return bounds;
}

function drawIsoVoxel(context, voxel, tileWidth, tileHeight, cubeHeight) {
    const origin = projectVoxelPoint(voxel.position, tileWidth, tileHeight, cubeHeight);
    const top = [
        { x: origin.x, y: origin.y - tileHeight * 0.5 },
        { x: origin.x + tileWidth * 0.5, y: origin.y },
        { x: origin.x, y: origin.y + tileHeight * 0.5 },
        { x: origin.x - tileWidth * 0.5, y: origin.y },
    ];
    const left = [
        top[3],
        top[2],
        { x: origin.x, y: origin.y + cubeHeight + tileHeight * 0.5 },
        { x: origin.x - tileWidth * 0.5, y: origin.y + cubeHeight },
    ];
    const right = [
        top[1],
        { x: origin.x + tileWidth * 0.5, y: origin.y + cubeHeight },
        { x: origin.x, y: origin.y + cubeHeight + tileHeight * 0.5 },
        top[2],
    ];

    drawPolygon(context, left, tintHexColor(voxel.color, 0.06));
    drawPolygon(context, right, voxel.color);
    drawPolygon(context, top, tintHexColor(voxel.color, 0.22));
}

export async function loadBoxel(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load Boxel: ${url}`);
    }

    return response.json();
}

export function drawBoxelIsometric(canvas, boxelData) {
    const context = canvas?.getContext?.('2d');
    if (!context) return;

    const voxels = normalizeBoxelVoxels(boxelData);
    const canvasSize = 320;
    const tileWidth = 42;
    const tileHeight = 22;
    const cubeHeight = 34;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (voxels.length === 0) return;

    const bounds = measureBoxelBounds(voxels, tileWidth, tileHeight, cubeHeight);
    const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(1.7, (canvasSize * 0.78) / Math.max(contentWidth, contentHeight));

    context.save();
    context.translate(
        canvasSize * 0.5 - (bounds.minX + contentWidth * 0.5) * scale,
        canvasSize * 0.5 - (bounds.minY + contentHeight * 0.5) * scale
    );
    context.scale(scale, scale);

    voxels.forEach(voxel => {
        drawIsoVoxel(context, voxel, tileWidth, tileHeight, cubeHeight);
    });

    context.restore();
}
