const noteFrequencies = {
  C: 261.63,
  "C#": 277.18,
  D: 293.66,
  "D#": 311.13,
  E: 329.63,
  F: 349.23,
  "F#": 369.99,
  G: 392.0,
  "G#": 415.3,
  A: 440.0,
  "A#": 466.16,
  B: 493.88,
};

let audioContext;
const angloLabels = ["C", "D", "E", "F", "G", "A", "B"];
const latinLabels = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const angloSharpLabels = ["C#", "D#", "F#", "G#", "A#"];
const latinSharpLabels = ["Do#", "Re#", "Fa#", "Sol#", "La#"];
const sevenKeys = Array.from(document.querySelectorAll(".sevenNotesNote"));
const fiveKeys = Array.from(document.querySelectorAll(".fiveNotesNote"));
const notationSelect = document.querySelector("#notationSelect");
const echoSelect = document.querySelector("#echoSelect");
const activeVoices = new Map();
const activePointers = new Map();

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function startNote(noteName, key) {
  const frequency = noteFrequencies[noteName];
  if (!frequency || activeVoices.has(key)) return;

  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const now = ctx.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.25, now + 0.01);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(now);
  activeVoices.set(key, { oscillator, gainNode });
}

function stopNote(key) {
  const voice = activeVoices.get(key);
  if (!voice) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const echoOn = echoSelect && echoSelect.value === "on";
  const releaseTime = echoOn ? 0.8 : 0.08;
  const stopDelay = releaseTime + 0.03;

  voice.gainNode.gain.cancelScheduledValues(now);
  voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.0001), now);
  voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
  voice.oscillator.stop(now + stopDelay);

  activeVoices.delete(key);
}

function applyNotation(notation) {
  const mainLabels = notation === "latin" ? latinLabels : angloLabels;
  const sharpLabels = notation === "latin" ? latinSharpLabels : angloSharpLabels;

  sevenKeys.forEach((key, index) => {
    key.textContent = mainLabels[index];
  });

  fiveKeys.forEach((key, index) => {
    key.textContent = sharpLabels[index];
  });
}

function bindKeys(keyList, noteList) {
  keyList.forEach((key, index) => {
    key.dataset.note = noteList[index];
    key.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();

      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      startNote(key.dataset.note, key);
      activePointers.set(event.pointerId, key);
    });
  });
}

bindKeys(sevenKeys, angloLabels);
bindKeys(fiveKeys, angloSharpLabels);

window.addEventListener("pointerup", (event) => {
  const key = activePointers.get(event.pointerId);
  if (!key) return;
  stopNote(key);
  activePointers.delete(event.pointerId);
});

window.addEventListener("pointercancel", (event) => {
  const key = activePointers.get(event.pointerId);
  if (!key) return;
  stopNote(key);
  activePointers.delete(event.pointerId);
});

window.addEventListener("blur", () => {
  activePointers.forEach((key) => {
    stopNote(key);
  });
  activePointers.clear();
});

if (notationSelect) {
  applyNotation(notationSelect.value);
  notationSelect.addEventListener("change", (event) => {
    applyNotation(event.target.value);
  });
}
