function mixColorChannel(channel, target, amount) {
  return Math.round(channel + (target - channel) * amount);
}

function tintHexColor(hexColor, amount) {
  const cleanHex = hexColor.replace('#', '');
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

export function createIcon(className = 'icon-chip') {
  const icon = document.createElement('span');
  icon.className = className;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

export function createSquareIcon(color = '#4a90ff') {
  const icon = createIcon('icon-chip item-slot-icon');
  const fill = document.createElement('span');
  fill.className = 'icon-chip__square';
  fill.style.background = color;
  icon.appendChild(fill);
  return icon;
}

export function createCircleIcon(color = '#d4af37', borderColor = '#ffe08a') {
  const icon = createIcon('icon-chip item-slot-icon');
  const fill = document.createElement('span');
  fill.className = 'icon-chip__square';

  // Reusing the existing square icon element and overriding it inline keeps the coin
  // icon compact while rendering as a simple golden circular token in the UI.
  fill.style.background = 'radial-gradient(circle at 30% 30%, ' + borderColor + ' 0%, ' + color + ' 58%, #9a7412 100%)';
  fill.style.borderRadius = '50%';
  fill.style.boxShadow = 'inset 0 0 0 2px rgba(255, 232, 138, 0.75)';
  icon.appendChild(fill);
  return icon;
}

export function createImageIcon(src, alt = '') {
  const icon = createIcon('icon-chip item-slot-icon image-icon');
  const image = document.createElement('img');
  image.className = 'image-icon__img';
  image.src = src;
  image.alt = alt;
  image.decoding = 'async';
  icon.appendChild(image);
  return icon;
}

export function createVoxelIcon(hexColor) {
  const icon = createIcon('icon-chip item-slot-icon voxel-icon');
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const top = document.createElementNS(svgNs, 'polygon');
  const left = document.createElementNS(svgNs, 'polygon');
  const right = document.createElementNS(svgNs, 'polygon');
  const edge = document.createElementNS(svgNs, 'path');

  svg.classList.add('voxel-icon__svg');
  svg.setAttribute('viewBox', '0 0 64 64');

  top.setAttribute('points', '32,6 56,18 32,30 8,18');
  top.setAttribute('fill', tintHexColor(hexColor, 0.22));
  left.setAttribute('points', '8,18 32,30 32,56 8,44');
  left.setAttribute('fill', tintHexColor(hexColor, 0.06));
  right.setAttribute('points', '56,18 32,30 32,56 56,44');
  right.setAttribute('fill', hexColor);
  edge.setAttribute('d', 'M32 6L56 18L32 30L8 18ZM32 30V56M8 18V44L32 56L56 44V18');
  edge.setAttribute('fill', 'none');
  edge.setAttribute('stroke', 'rgba(15,23,42,0.35)');
  edge.setAttribute('stroke-width', '3');
  edge.setAttribute('stroke-linejoin', 'round');

  svg.appendChild(top);
  svg.appendChild(left);
  svg.appendChild(right);
  svg.appendChild(edge);
  icon.appendChild(svg);
  return icon;
}
