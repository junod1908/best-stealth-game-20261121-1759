// Sound, synthesised with WebAudio: no audio files, nothing fetched. Footsteps are short
// filtered noise bursts, the alert is a rising two-note sting, pickups chime, and the win
// is a small arpeggio. The context is created on the first user gesture, so browsers that
// block autoplay never complain; every call before that is a silent no-op.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') void context.resume();
      return context !== null;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, seconds, type, volume, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo > 0) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function noiseBurst(seconds, volume, filterFrequency) {
    if (!ensure() || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** Call from any key or pointer press so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    footstep(sneaking, distanceToListener) {
      // Quieter the further the steps are from the camera (always the player here,
      // so distance only softens guard steps the caller passes in).
      const volume = sneaking ? 0.05 : 0.11 * Math.max(0.25, 1 - distanceToListener / 700);
      noiseBurst(0.07, volume, sneaking ? 500 : 900);
    },
    pickup() {
      tone(880, 0.14, 'sine', 0.16);
      tone(1318, 0.2, 'sine', 0.14, 0.07);
    },
    alert() {
      tone(220, 0.22, 'sawtooth', 0.14, 0, 330);
      tone(330, 0.3, 'sawtooth', 0.12, 0.16, 440);
    },
    suspicious() {
      tone(196, 0.18, 'triangle', 0.12, 0, 262);
    },
    caught() {
      noiseBurst(0.25, 0.25, 300);
      tone(110, 0.4, 'sawtooth', 0.16, 0, 55);
    },
    levelClear() {
      tone(523, 0.16, 'sine', 0.16);
      tone(659, 0.16, 'sine', 0.16, 0.12);
      tone(784, 0.16, 'sine', 0.16, 0.24);
      tone(1046, 0.3, 'sine', 0.18, 0.36);
    },
    gameOver() {
      tone(392, 0.25, 'triangle', 0.14, 0, 294);
      tone(294, 0.4, 'triangle', 0.14, 0.22, 196);
    },
  };
}
