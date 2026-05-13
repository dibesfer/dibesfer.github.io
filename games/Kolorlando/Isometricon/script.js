import { Isometricon } from './Isometricon.js';

const palette = ['#7bd88f', '#6bb7ff', '#f7c948', '#f97068', '#b794f4', '#62d6d6', '#f4a261'];

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function randRange(min, max) {
  return min + randInt(max - min + 1);
}

function randomColor() {
  return palette[randInt(palette.length)];
}

function randomVoxelSpec() {
  const useMicroxels = Math.random() > 0.35;
  if (!useMicroxels) return { type: 'voxel', color: randomColor() };

  const microxels = [];
  const occupied = new Set();
  const size = randRange(2, 4);
  const targetCount = randRange(1, Math.min(64, size ** 3));

  while (microxels.length < targetCount) {
    const entry = { x: randInt(size), y: randInt(size), z: randInt(size), color: randomColor() };
    const key = `${entry.x}:${entry.y}:${entry.z}`;
    if (!occupied.has(key)) {
      occupied.add(key);
      microxels.push(entry);
    }
  }

  return { type: 'voxel', microxels };
}

function randomBoxelSpec() {
  const voxels = [];
  const targetCount = randRange(1, 64);
  let width = 1;
  let depth = 1;
  let maxHeight = 1;

  do {
    width = randRange(1, 8);
    depth = randRange(1, 8);
    const minHeight = Math.ceil(targetCount / Math.max(1, width * depth));
    if (minHeight > 8) continue;
    maxHeight = randRange(minHeight, 8);
  } while (width * depth * maxHeight < targetCount);

  const columns = Array.from({ length: width * depth }, () => 0);

  while (voxels.length < targetCount) {
    const x = randInt(width);
    const z = randInt(depth);
    const index = z * width + x;
    const y = columns[index];
    if (y >= maxHeight) continue;
    voxels.push({ x, y, z, color: randomColor() });
    columns[index] += 1;
  }

  return { type: 'boxel', voxels };
}

const options = {
  size: 192,
  pixelRatio: 1,
  pixelPerfect: true,
  cubeOutline: true,
  underlayGrid: true,
  hexOutline: true,
};

const boxelCanvas = document.querySelector('#boxelIcon');
const voxelCanvas = document.querySelector('#voxelIcon');
const singleCanvas = document.querySelector('#singleIcon');
const boxelOutput = document.querySelector('#boxelData');
const voxelOutput = document.querySelector('#voxelData');
const singleOutput = document.querySelector('#singleData');
const imageOutput = document.querySelector('#imageData');
const imageMount = document.querySelector('#imageMount');
const rerollButton = document.querySelector('#reroll');

function drawDebug() {
  const boxelSpec = randomBoxelSpec();
  const voxelSpec = randomVoxelSpec();
  const singleSpec = { type: 'voxel', color: '#f7c948' };

  Isometricon.draw(boxelCanvas, boxelSpec, options);
  Isometricon.draw(voxelCanvas, voxelSpec, options);
  Isometricon.draw(singleCanvas, singleSpec, options);

  imageMount.replaceChildren(Isometricon.toImage(boxelSpec, { ...options, size: 96 }));

  boxelOutput.textContent = JSON.stringify(boxelSpec, null, 2);
  voxelOutput.textContent = JSON.stringify(voxelSpec, null, 2);
  singleOutput.textContent = JSON.stringify(singleSpec, null, 2);
  imageOutput.textContent = `cache size: ${Isometricon.cache.size}\nIsometricon.toImage(boxelSpec, { size: 96 })`;
}

rerollButton.addEventListener('click', drawDebug);
drawDebug();

window.Isometricon = Isometricon;
