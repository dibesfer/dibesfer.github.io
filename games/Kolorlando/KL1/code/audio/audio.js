import * as THREE from 'three';

const FOOTSTEP_BASE_INTERVAL = 0.42;
const FOOTSTEP_DOUBLE_TAP_GAP = 0.055;

export function createGameAudio() {
  let audioContext = null;
  let audioUnlocked = false;
  let audioUnlockPromise = null;
  let audioUnlockRequested = false;
  let footstepTimer = 0;
  let footstepSwap = false;
  const pendingAudioCallbacks = [];

  function ensureAudioContext() {
    if (!audioUnlocked || !audioContext || audioContext.state !== 'running') return null;
    return audioContext;
  }

  function flushPendingAudioCallbacks() {
    if (!pendingAudioCallbacks.length) return;
    const callbacks = pendingAudioCallbacks.splice(0, pendingAudioCallbacks.length);
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i]();
    }
  }

  function runWhenAudioReady(callback) {
    const ctx = ensureAudioContext();
    if (ctx) {
      callback();
      return true;
    }
    pendingAudioCallbacks.push(callback);
    return false;
  }

  function unlockAudio(fromGesture = false) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    audioUnlockRequested = true;
    const activation = navigator.userActivation;
    if (!fromGesture && activation && !activation.isActive) {
      return audioUnlockPromise;
    }

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }

    audioUnlockPromise = (audioContext.state === 'suspended' ? audioContext.resume() : Promise.resolve())
      .catch(() => null)
      .then(() => {
        audioUnlocked = audioContext?.state === 'running';
        if (audioUnlocked) {
          flushPendingAudioCallbacks();
        }
        return audioContext;
      });

    return audioUnlockPromise;
  }

  function playExplosionSound() {
    const ctx = ensureAudioContext();
    if (!ctx) {
      runWhenAudioReady(() => playExplosionSound());
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1300, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.25);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.26, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  function playFootstepSound(speedFactor = 1) {
    const ctx = ensureAudioContext();
    if (!ctx) {
      runWhenAudioReady(() => playFootstepSound(speedFactor));
      return;
    }

    const now = ctx.currentTime;
    const baseFreq = (footstepSwap ? 165 : 190) * THREE.MathUtils.clamp(speedFactor, 0.8, 2.2);
    const hitTimes = [0, FOOTSTEP_DOUBLE_TAP_GAP];

    for (let i = 0; i < hitTimes.length; i++) {
      const start = now + hitTimes[i];
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.58, start + 0.06);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(780, start);
      filter.Q.setValueAtTime(0.8, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.085, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.08);
    }

    footstepSwap = !footstepSwap;
  }

  function playJumpSound(isDoubleJump = false) {
    const ctx = ensureAudioContext();
    if (!ctx) {
      runWhenAudioReady(() => playJumpSound(isDoubleJump));
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    if (isDoubleJump) {
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
      osc.frequency.exponentialRampToValueAtTime(510, now + 0.16);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    } else {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    }

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isDoubleJump ? 1400 : 980, now);
    filter.Q.setValueAtTime(0.8, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  function playPunchSound() {
    const ctx = ensureAudioContext();
    if (!ctx) {
      runWhenAudioReady(() => playPunchSound());
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.09);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(0.75, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  function updateFootsteps(deltaTime, isMoving, sprintMultiplier, onGround) {
    if (!isMoving || !onGround) {
      footstepTimer = 0;
      return;
    }

    const speedFactor = THREE.MathUtils.clamp(sprintMultiplier, 1, 2);
    const interval = FOOTSTEP_BASE_INTERVAL / speedFactor;
    footstepTimer -= deltaTime;

    if (footstepTimer <= 0) {
      playFootstepSound(speedFactor);
      footstepTimer += interval;
    }
  }

  return {
    unlockAudio,
    playExplosionSound,
    playJumpSound,
    playPunchSound,
    updateFootsteps,
  };
}
