const noteFrequencies = {
  "*C": 130.81,
  "*C#": 138.59,
  "*D": 146.83,
  "*D#": 155.56,
  "*E": 164.81,
  "*F": 174.61,
  "*F#": 185.0,
  "*G": 196.0,
  "*G#": 207.65,
  "*A": 220.0,
  "*A#": 233.08,
  "*B": 246.94,
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
  "^C": 523.25,
  "^C#": 554.37,
  "^D": 587.33,
  "^D#": 622.25,
  "^E": 659.25,
  "^F": 698.46,
  "^F#": 739.99,
  "^G": 783.99,
  "^G#": 830.61,
  "^A": 880.0,
  "^A#": 932.33,
  "^B": 987.77,
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
const volumeRange = document.querySelector("#volumeRange");
const volumeValue = document.querySelector("#volumeValue");
const noteDelayInput = document.querySelector("#noteDelay");
const noteDelayReaderInput = document.querySelector("#noteDelayReader");
const noteDelayBgMusicInput = document.querySelector("#noteDelayBgMusic");
const achordsCheckbox = document.querySelector("#achords");
const randomToggle = document.querySelector("#randomToggle");
const randomNowPlaying = document.querySelector("#randomNowPlaying");
const readerInput = document.querySelector("#readerInput");
const readerToggle = document.querySelector("#readerToggle");
const readerNowPlaying = document.querySelector("#readerNowPlaying");
const bgMusicToggle = document.querySelector("#bgMusicToggle");
const bgMusicNowPlaying = document.querySelector("#bgMusicNowPlaying");
const activeVoices = new Map();
const activePointers = new Map();
const allNotes = [...angloLabels, ...angloSharpLabels];
const calmBgMusicPalettes = [
  ["C", "D", "E", "G", "A", "^C"],
  ["D", "F", "G", "A", "^C", "^D"],
  ["E", "G", "A", "B", "^D", "^E"],
  ["A", "B", "^C", "^E", "^F#", "^A"],
];
let randomPlayerIntervalId = null;
let randomChordSet = [];
let randomChordIndex = 0;
let readerIntervalId = null;
let readerSequence = [];
let readerStepIndex = 0;
let bgMusicIntervalId = null;
let bgMusicPalette = null;
let bgMusicPreviousStep = [];

function createNoiseImpulse(ctx, seconds) {
  // A tiny generated impulse lets the synth use a lightweight reverb
  // tail without depending on external audio assets.
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * seconds));
  const impulseBuffer = ctx.createBuffer(2, frameCount, sampleRate);

  for (let channelIndex = 0; channelIndex < impulseBuffer.numberOfChannels; channelIndex += 1) {
    const channelData = impulseBuffer.getChannelData(channelIndex);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const decayCurve = (1 - frameIndex / frameCount) ** 2;
      channelData[frameIndex] = (Math.random() * 2 - 1) * decayCurve;
    }
  }

  return impulseBuffer;
}

function getVolumeLevel() {
  // The slider stores a human-friendly 0-100 value, so convert it to
  // the Web Audio gain range expected by each playing note.
  if (!volumeRange) return 0.25;
  return Number(volumeRange.value) / 100;
}

function updateVolumeDisplay() {
  // Keep the UI label in sync with the current slider position so the
  // musician can see the exact loudness setting at a glance.
  if (!volumeRange || !volumeValue) return;
  volumeValue.textContent = `${volumeRange.value}%`;
}

function updateActiveVoiceVolumes() {
  // When the slider changes while notes are already ringing, smoothly
  // retarget their gain so the instrument responds immediately.
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const targetVolume = Math.max(getVolumeLevel(), 0.0001);

  activeVoices.forEach(({ gainNode }) => {
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
    gainNode.gain.exponentialRampToValueAtTime(targetVolume, now + 0.03);
  });
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // The soft preset keeps the signal chain intentionally tiny so the
    // instrument stays gentle, dark, and synthetic without extra edge.
    const masterGain = audioContext.createGain();
    const masterFilter = audioContext.createBiquadFilter();
    const convolver = audioContext.createConvolver();
    const reverbGain = audioContext.createGain();
    const dryGain = audioContext.createGain();

    masterGain.gain.value = 0.68;
    masterFilter.type = "lowpass";
    masterFilter.frequency.value = 1500;
    masterFilter.Q.value = 0.7;
    convolver.buffer = createNoiseImpulse(audioContext, 0.45);
    reverbGain.gain.value = 0.035;
    dryGain.gain.value = 1;

    masterFilter.connect(dryGain);
    masterFilter.connect(convolver);
    convolver.connect(reverbGain);
    dryGain.connect(masterGain);
    reverbGain.connect(masterGain);
    masterGain.connect(audioContext.destination);

    audioContext.musicMakerNodes = {
      input: masterFilter,
    };
  }
  return audioContext;
}

function getRandomDelayMs() {
  // The random player is configured in seconds in the UI, so convert
  // that musician-facing value into milliseconds for the loop timer.
  if (!noteDelayInput) return 2000;

  const parsedValue = Number(noteDelayInput.value);
  if (!Number.isFinite(parsedValue)) return 2000;

  return Math.max(parsedValue, 0.1) * 1000;
}

function getReaderDelayMs() {
  // The reader has its own delay control so pasted notation can be
  // performed independently from the random generator timing.
  if (!noteDelayReaderInput) return 1200;

  const parsedValue = Number(noteDelayReaderInput.value);
  if (!Number.isFinite(parsedValue)) return 1200;

  return Math.max(parsedValue, 0.1) * 1000;
}

function getBgMusicDelayMs() {
  // Background music uses its own step duration so it can sit behind
  // the rest of the page independently from the other transports.
  if (!noteDelayBgMusicInput) return 1200;

  const parsedValue = Number(noteDelayBgMusicInput.value);
  if (!Number.isFinite(parsedValue)) return 1200;

  return Math.max(parsedValue, 0.1) * 1000;
}

function updateNowPlaying(element, noteNames) {
  // The transport feedback shows the current note or chord so the
  // player can see what the generator or reader is performing live.
  if (!element) return;

  if (!noteNames || noteNames.length === 0) {
    element.textContent = "-";
    return;
  }

  element.textContent = noteNames.join(" ");
}

function getRandomArrayItem(list) {
  // The background generator reuses this helper to keep note choices
  // compact and readable whenever it needs a random selection.
  return list[Math.floor(Math.random() * list.length)];
}

function getRandomNoteName() {
  // Each loop hit should choose freely from the full 12-note chromatic
  // set used by the instrument.
  const randomIndex = Math.floor(Math.random() * allNotes.length);
  return allNotes[randomIndex];
}

function getRandomPlayerKeys(amount) {
  // Chords need one dedicated synth voice per note so they can sound
  // together and still be stopped cleanly when the loop advances.
  return Array.from({ length: amount }, (_, index) => ({
    id: `random-player-key-${index}`,
  }));
}

function getReaderPlayerKeys(amount) {
  // The reader needs reserved voices too so it can play simple chords
  // or stacked notes from pasted text without colliding with UI notes.
  return Array.from({ length: amount }, (_, index) => ({
    id: `reader-player-key-${index}`,
  }));
}

function getBgMusicPlayerKeys(amount) {
  // Background music keeps a dedicated voice pool so its loop can play
  // chords without colliding with reader or random-player voices.
  return Array.from({ length: amount }, (_, index) => ({
    id: `bg-music-key-${index}`,
  }));
}

function stopRandomPlayerVoices() {
  // The random player may have several active notes in chord mode, so
  // stop every reserved loop voice before scheduling the next event.
  getRandomPlayerKeys(4).forEach((key) => {
    stopNote(key);
  });
}

function stopReaderVoices() {
  // Reader playback may leave several note voices active, so stop the
  // full reserved pool before advancing or when pausing playback.
  getReaderPlayerKeys(8).forEach((key) => {
    stopNote(key);
  });
}

function stopBgMusicVoices() {
  // Clearing the reserved background voices prevents old harmony notes
  // from hanging around when the loop advances or is paused.
  getBgMusicPlayerKeys(6).forEach((key) => {
    stopNote(key);
  });
}

function normalizeReaderToken(tokenPart) {
  // This parser keeps the notation flexible enough for prefixed octave
  // symbols while still reducing flats to the sharp names used inside
  // the synth frequency table.
  const upperToken = tokenPart.toUpperCase().trim();
  const matchedNote = upperToken.match(/^([\^*.]?)([A-G])(#|B)?$/);

  if (!matchedNote) return null;

  const [, rawOctavePrefix, noteLetter, accidental = ""] = matchedNote;
  const octavePrefix = rawOctavePrefix === "." ? "*" : rawOctavePrefix;
  const noteName = `${noteLetter}${accidental}`;
  const normalizedFlatMap = {
    CB: "B",
    DB: "C#",
    EB: "D#",
    FB: "E",
    GB: "F#",
    AB: "G#",
    BB: "A#",
    "E#": "F",
    "B#": "^C",
  };
  const normalizedNote = normalizedFlatMap[noteName] || noteName;

  if (normalizedNote.startsWith("^")) {
    return normalizedNote;
  }

  return `${octavePrefix}${normalizedNote}`;
}

function splitReaderTokenIntoNotes(token) {
  // Some song sheets glue notes together without spaces, so this walks
  // through one token and extracts each supported note chunk in order.
  const cleanedToken = token.toUpperCase().trim();
  const noteChunks = cleanedToken.match(/[\^*.]?[A-G](#|B)?/g);

  if (!noteChunks) return [];

  return noteChunks.map(normalizeReaderToken).filter(Boolean);
}

function extractReaderNotesFromLine(line) {
  // Mixed song sheets often alternate between notation lines and lyric
  // lines, so this keeps only tokens that look like supported notes.
  return line
    .replace(/[()]/g, " ")
    .trim()
    .split(/\s+/)
    .flatMap((token) =>
      token
        .split("-")
        .flatMap(splitReaderTokenIntoNotes)
        .filter(Boolean)
        .map((noteName) => [noteName]),
    );
}

function parseReaderSequence() {
  // The reader accepts mixed lyrics-plus-notes text by scanning line by
  // line, keeping only notation lines, and ignoring plain lyric lines.
  if (!readerInput) return [];

  return readerInput.value
    .split("\n")
    .flatMap((line) => extractReaderNotesFromLine(line));
}

function playReaderStep() {
  // Each parsed line becomes one timed event, playing either a single
  // note or a small chord depending on how many tokens were found.
  if (readerSequence.length === 0) {
    stopReaderPlayer();
    return;
  }

  const notes = readerSequence[readerStepIndex];
  const readerKeys = getReaderPlayerKeys(notes.length);
  const noteDurationMs = Math.min(getReaderDelayMs() * 0.7, 900);

  stopReaderVoices();
  updateNowPlaying(readerNowPlaying, notes);
  notes.forEach((noteName, index) => {
    startNote(noteName, readerKeys[index]);
  });

  window.setTimeout(() => {
    readerKeys.forEach((key) => {
      stopNote(key);
    });
  }, noteDurationMs);

  readerStepIndex = (readerStepIndex + 1) % readerSequence.length;
}

function updateReaderToggleUi(isPlaying) {
  // Matching toggle feedback keeps the reader transport consistent with
  // the random player transport already used in the page.
  if (!readerToggle) return;

  readerToggle.textContent = isPlaying ? "Pause" : "Play";
  readerToggle.classList.toggle("isPlaying", isPlaying);
}

function updateBgMusicToggleUi(isPlaying) {
  // Matching transport feedback keeps the new background section in the
  // same visual language as the other play/pause controls.
  if (!bgMusicToggle) return;

  bgMusicToggle.textContent = isPlaying ? "Pause" : "Play";
  bgMusicToggle.classList.toggle("isPlaying", isPlaying);
}

function stopReaderPlayer() {
  // Clearing the timer pauses the pasted notation playback cleanly and
  // silences any reserved reader voices immediately.
  if (readerIntervalId !== null) {
    window.clearInterval(readerIntervalId);
    readerIntervalId = null;
  }

  stopReaderVoices();
  updateNowPlaying(readerNowPlaying, []);
  updateReaderToggleUi(false);
}

function startReaderPlayer() {
  // Starting the reader parses the current text, resets the playback
  // position, and loops through the recognized note lines.
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  readerSequence = parseReaderSequence();
  readerStepIndex = 0;

  if (readerSequence.length === 0) {
    stopReaderPlayer();
    return;
  }

  stopReaderPlayer();
  playReaderStep();
  readerIntervalId = window.setInterval(playReaderStep, getReaderDelayMs());
  updateReaderToggleUi(true);
}

function toggleReaderPlayer() {
  // The reader transport is also a toggle so pasted note playback can
  // be started and paused with the same interaction pattern.
  if (readerIntervalId !== null) {
    stopReaderPlayer();
    return;
  }

  startReaderPlayer();
}

function pickRandomBgMusicPattern() {
  // Each session chooses a calm note palette so the random background
  // music feels coherent instead of jumping across all 12 notes.
  return [...getRandomArrayItem(calmBgMusicPalettes)];
}

function buildCalmBgMusicStep() {
  // The calm generator favors repeated neighboring tones and small
  // chords so the background feels softer and more wandering.
  if (!bgMusicPalette || bgMusicPalette.length === 0) {
    return [];
  }

  const shouldPlayChord = Math.random() < 0.35;
  const sourcePool =
    bgMusicPreviousStep.length > 1 && Math.random() < 0.55 ? bgMusicPreviousStep : bgMusicPalette;
  const maxStepSize = Math.min(sourcePool.length, bgMusicPalette.length, 2);
  const stepSize = shouldPlayChord ? Math.max(1, maxStepSize) : 1;
  const chosenNotes = [];
  const availableNotes = [...sourcePool];

  while (chosenNotes.length < stepSize && availableNotes.length > 0) {
    const noteIndex = Math.floor(Math.random() * availableNotes.length);
    const [noteName] = availableNotes.splice(noteIndex, 1);
    chosenNotes.push(noteName);
  }

  if (Math.random() < 0.45) {
    chosenNotes.sort((leftNote, rightNote) => noteFrequencies[leftNote] - noteFrequencies[rightNote]);
  }

  bgMusicPreviousStep = chosenNotes;
  return chosenNotes;
}

function playBgMusicStep() {
  // Each background step plays a lightly randomized calm fragment so
  // the loop drifts more like ambient game music than a rigid pattern.
  if (!bgMusicPalette || bgMusicPalette.length === 0) {
    stopBgMusicPlayer();
    return;
  }

  const notes = buildCalmBgMusicStep();
  const bgKeys = getBgMusicPlayerKeys(notes.length);
  const noteDurationMs = Math.min(getBgMusicDelayMs() * 0.92, 1400);

  stopBgMusicVoices();
  updateNowPlaying(bgMusicNowPlaying, notes);
  notes.forEach((noteName, index) => {
    startNote(noteName, bgKeys[index]);
  });

  window.setTimeout(() => {
    bgKeys.forEach((key) => {
      stopNote(key);
    });
  }, noteDurationMs);
}

function stopBgMusicPlayer() {
  // Pausing the background transport clears its interval, silences the
  // current harmony, and resets the status display.
  if (bgMusicIntervalId !== null) {
    window.clearInterval(bgMusicIntervalId);
    bgMusicIntervalId = null;
  }

  stopBgMusicVoices();
  updateNowPlaying(bgMusicNowPlaying, []);
  updateBgMusicToggleUi(false);
}

function startBgMusicPlayer() {
  // Starting the background transport chooses a calm note palette,
  // begins immediately, and then keeps drifting at the chosen rate.
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  stopBgMusicPlayer();
  bgMusicPalette = pickRandomBgMusicPattern();
  bgMusicPreviousStep = [];
  playBgMusicStep();
  bgMusicIntervalId = window.setInterval(playBgMusicStep, getBgMusicDelayMs());
  updateBgMusicToggleUi(true);
}

function toggleBgMusicPlayer() {
  // The background section also uses a play/pause toggle to match the
  // rest of the instrument UI.
  if (bgMusicIntervalId !== null) {
    stopBgMusicPlayer();
    return;
  }

  startBgMusicPlayer();
}

function getRandomChord() {
  // Each generated chord contains 3 or 4 unique notes chosen from the
  // chromatic set so the repeating loop has a stable harmonic shape.
  const availableNotes = [...allNotes];
  const chordSize = Math.random() < 0.5 ? 3 : 4;
  const chord = [];

  while (chord.length < chordSize && availableNotes.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableNotes.length);
    chord.push(availableNotes.splice(randomIndex, 1)[0]);
  }

  return chord;
}

function buildRandomChordSet() {
  // Chord mode reuses the same three random chords for the whole run so
  // the listener hears a looping progression instead of total chaos.
  randomChordSet = [getRandomChord(), getRandomChord(), getRandomChord()];
  randomChordIndex = 0;
}

function playRandomNote() {
  // Single-note mode keeps choosing one fresh chromatic pitch on every
  // pulse so the loop feels like a wandering melody generator.
  const randomNoteName = getRandomNoteName();
  const randomDurationMs = Math.min(getRandomDelayMs() * 0.7, 900);
  const [randomPlayerKey] = getRandomPlayerKeys(1);

  stopRandomPlayerVoices();
  updateNowPlaying(randomNowPlaying, [randomNoteName]);
  startNote(randomNoteName, randomPlayerKey);
  window.setTimeout(() => {
    stopNote(randomPlayerKey);
  }, randomDurationMs);
}

function playRandomChord() {
  // Chord mode steps through the three prepared chords in order and
  // voices all notes together on each loop hit.
  if (randomChordSet.length === 0) {
    buildRandomChordSet();
  }

  const chord = randomChordSet[randomChordIndex];
  const chordKeys = getRandomPlayerKeys(chord.length);
  const randomDurationMs = Math.min(getRandomDelayMs() * 0.7, 900);

  stopRandomPlayerVoices();
  updateNowPlaying(randomNowPlaying, chord);
  chord.forEach((noteName, index) => {
    startNote(noteName, chordKeys[index]);
  });

  window.setTimeout(() => {
    chordKeys.forEach((key) => {
      stopNote(key);
    });
  }, randomDurationMs);

  randomChordIndex = (randomChordIndex + 1) % randomChordSet.length;
}

function playRandomStep() {
  // The random player chooses between melody mode and chord mode based
  // on the current checkbox state each time the loop advances.
  if (achordsCheckbox && achordsCheckbox.checked) {
    playRandomChord();
    return;
  }

  playRandomNote();
}

function updateRandomToggleUi(isPlaying) {
  // The toggle text and active class make the current transport state
  // obvious without needing extra explanatory UI.
  if (!randomToggle) return;

  randomToggle.textContent = isPlaying ? "Pause" : "Play";
  randomToggle.classList.toggle("isPlaying", isPlaying);
}

function stopRandomPlayer() {
  // Clearing the timer fully pauses the routine so no additional random
  // notes are scheduled after the current state is stopped.
  if (randomPlayerIntervalId !== null) {
    window.clearInterval(randomPlayerIntervalId);
    randomPlayerIntervalId = null;
  }

  stopRandomPlayerVoices();
  updateNowPlaying(randomNowPlaying, []);
  updateRandomToggleUi(false);
}

function startRandomPlayer() {
  // Starting the routine resumes audio if needed, plays one note
  // immediately, and then keeps pulsing based on the chosen delay.
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  stopRandomPlayer();
  if (achordsCheckbox && achordsCheckbox.checked) {
    buildRandomChordSet();
  }
  playRandomStep();
  randomPlayerIntervalId = window.setInterval(playRandomStep, getRandomDelayMs());
  updateRandomToggleUi(true);
}

function toggleRandomPlayer() {
  // The play control is a transport toggle, so one click starts the
  // routine and the next click pauses it.
  if (randomPlayerIntervalId !== null) {
    stopRandomPlayer();
    return;
  }

  startRandomPlayer();
}

function startNote(noteName, key) {
  const frequency = noteFrequencies[noteName];
  if (!frequency || activeVoices.has(key)) return;

  const ctx = getAudioContext();
  const mainOscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const toneFilter = ctx.createBiquadFilter();
  const now = ctx.currentTime;
  const targetVolume = Math.max(getVolumeLevel(), 0.0001);

  // A single triangle oscillator keeps the voice synthetic but soft.
  mainOscillator.type = "triangle";
  mainOscillator.frequency.setValueAtTime(frequency, now);

  // The note filter stays mellow to avoid harsh or pointy highs.
  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(1300, now);
  toneFilter.Q.setValueAtTime(0.8, now);

  // The envelope rises more slowly and decays smoothly for a gentler
  // feel while staying responsive enough for the current UI.
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(targetVolume * 0.85, 0.0001), now + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(targetVolume, now + 0.09);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(targetVolume * 0.55, 0.0001), now + 0.24);

  mainOscillator.connect(gainNode);
  gainNode.connect(toneFilter);
  toneFilter.connect(ctx.musicMakerNodes.input);

  mainOscillator.start(now);
  activeVoices.set(key, {
    oscillators: [mainOscillator],
    gainNode,
  });
}

function stopNote(key) {
  const voice = activeVoices.get(key);
  if (!voice) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const echoOn = echoSelect && echoSelect.value === "on";
  const releaseTime = echoOn ? 0.6 : 0.22;
  const stopDelay = releaseTime + 0.03;

  voice.gainNode.gain.cancelScheduledValues(now);
  voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.0001), now);
  voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
  voice.oscillators.forEach((oscillator) => {
    oscillator.stop(now + stopDelay);
  });

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
  stopRandomPlayer();
  stopReaderPlayer();
  stopBgMusicPlayer();
});

if (notationSelect) {
  applyNotation(notationSelect.value);
  notationSelect.addEventListener("change", (event) => {
    applyNotation(event.target.value);
  });
}

if (volumeRange) {
  // Initialize the label once and keep the synth output tied to the
  // slider every time the player adjusts the control.
  updateVolumeDisplay();
  volumeRange.addEventListener("input", () => {
    updateVolumeDisplay();
    updateActiveVoiceVolumes();
  });
}

if (noteDelayInput) {
  // If the musician changes the delay while the random player is
  // already running, restart the timer so the new tempo applies at once.
  noteDelayInput.addEventListener("input", () => {
    if (randomPlayerIntervalId !== null) {
      startRandomPlayer();
    }
  });
}

if (achordsCheckbox) {
  // Switching chord mode while the transport is running rebuilds the
  // loop immediately so the new performance mode is heard right away.
  achordsCheckbox.addEventListener("change", () => {
    if (randomPlayerIntervalId !== null) {
      startRandomPlayer();
    }
  });
}

if (randomToggle) {
  // The random transport is intentionally click-based so the existing
  // "Play" text can act like a compact performance control.
  updateRandomToggleUi(false);
  randomToggle.addEventListener("click", toggleRandomPlayer);
}

updateNowPlaying(randomNowPlaying, []);
updateNowPlaying(readerNowPlaying, []);
updateNowPlaying(bgMusicNowPlaying, []);

if (noteDelayReaderInput) {
  // If the reader is already running, changing its delay should retime
  // the loop immediately instead of waiting for a manual restart.
  noteDelayReaderInput.addEventListener("input", () => {
    if (readerIntervalId !== null) {
      startReaderPlayer();
    }
  });
}

if (readerInput) {
  // Editing the pasted notation while it is playing should rebuild the
  // sequence right away so the loop matches the visible text.
  readerInput.addEventListener("input", () => {
    if (readerIntervalId !== null) {
      startReaderPlayer();
    }
  });
}

if (readerToggle) {
  // The reader reuses the same compact paragraph control pattern as the
  // random player to keep the UI simple for now.
  updateReaderToggleUi(false);
  readerToggle.addEventListener("click", toggleReaderPlayer);
}

if (noteDelayBgMusicInput) {
  // When the background loop is already playing, delay changes should
  // immediately retime the chosen pattern instead of waiting for pause.
  noteDelayBgMusicInput.addEventListener("input", () => {
    if (bgMusicIntervalId !== null) {
      startBgMusicPlayer();
    }
  });
}

if (bgMusicToggle) {
  // The new background music block follows the same compact transport
  // interaction style already used elsewhere on the page.
  updateBgMusicToggleUi(false);
  bgMusicToggle.addEventListener("click", toggleBgMusicPlayer);
}
