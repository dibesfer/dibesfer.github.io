import { Isometricon } from './Isometricon.js';

const palette = ['#7bd88f', '#6bb7ff', '#f7c948', '#f97068', '#b794f4', '#62d6d6', '#f4a261'];

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function randomColor() {
  return palette[randInt(palette.length)];
}

function randomVoxelSpec() {
  const useMicroxels = Math.random() > 0.35;
  if (!useMicroxels) {
    return { type: 'voxel', color: randomColor() };
  }

  const microxels = [];
  const size = 3;
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const shell = x === 0 || y === 0 || z === 0 || x === size - 1 || y === size - 1 || z === size - 1;
        if (shell && Math.random() > 0.42) microxels.push({ x, y, z, color: randomColor() });
      }
    }
  }

  return { type: 'voxel', microxels };
}

function randomBoxelSpec() {
  const voxels = [];
  const width = 4 + randInt(3);
  const depth = 4 + randInt(3);
  const height = 1 + randInt(4);

  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < depth; z += 1) {
      const columnHeight = 1 + randInt(height);
      for (let y = 0; y < columnHeight; y += 1) {
        const keep = y === 0 || Math.random() > 0.28;
        if (keep) voxels.push({ x, y, z, color: randomColor() });
      }
    }
  }

  return { type: 'boxel', voxels };
}

const boxelCanvas = document.querySelector('#boxelIcon');
const voxelCanvas = document.querySelector('#voxelIcon');
const boxelOutput = document.querySelector('#boxelData');
const voxelOutput = document.querySelector('#voxelData');
const rerollButton = document.querySelector('#reroll');

function drawDebug() {
  const boxelSpec = randomBoxelSpec();
  const voxelSpec = randomVoxelSpec();

  Isometricon.draw(boxelCanvas, boxelSpec, { size: 192, pixelRatio: 1 });
  Isometricon.draw(voxelCanvas, voxelSpec, { size: 192, pixelRatio: 1 });

  boxelOutput.textContent = JSON.stringify(boxelSpec, null, 2);
  voxelOutput.textContent = JSON.stringify(voxelSpec, null, 2);
}

rerollButton.addEventListener('click', drawDebug);
drawDebug();

window.Isometricon = Isometricon;
