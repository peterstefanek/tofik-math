const AUDIO_KEY = 'tofik-audio-v1';

export const audio = (() => {
  let _initialized = false;
  let _muted = false;
  let _volume = 0.6;
  let poly, membrane, metal, noise;
  let tiltOsc, tiltGain;

  function _load() {
    try {
      const d = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
      if (typeof d.muted  === 'boolean') _muted  = d.muted;
      if (typeof d.volume === 'number')  _volume = d.volume;
    } catch(e) {}
  }
  function _save() {
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted: _muted, volume: _volume })); } catch(e) {}
  }
  function _applyVolume(v) {
    const db = 20 * Math.log10(Math.max(v, 0.0001));
    if (poly)     poly.volume.value     = db;
    if (membrane) membrane.volume.value = db;
    if (metal)    metal.volume.value    = db;
    if (noise)    noise.volume.value    = db;
    // tiltGain is intentionally not touched here — it is controlled only by tiltStart/tiltStop
  }

  const _sounds = {
    tap()           { poly.triggerAttackRelease('C5', '64n'); },
    pop()           { const t = Tone.now(); poly.triggerAttackRelease('E5', '32n', t); poly.triggerAttackRelease('A5', '32n', t + 0.04); },
    correct()       { const t = Tone.now(); poly.triggerAttackRelease('C5','8n',t); poly.triggerAttackRelease('E5','8n',t+0.1); poly.triggerAttackRelease('G5','8n',t+0.2); },
    wrong()         { const t = Tone.now(); poly.triggerAttackRelease('G4','8n',t); poly.triggerAttackRelease('E4','8n',t+0.15); },
    star(idx)       { const freqs=[400,500,630]; metal.triggerAttackRelease(freqs[idx??0]??400,'16n'); },
    'level-complete'() { const t=Tone.now(); ['C5','E5','G5','C6'].forEach((n,i)=>poly.triggerAttackRelease(n,'8n',t+i*0.15)); },
    'game-complete'()  {
      const t=Tone.now();
      ['C5','E5','G5','C6','E6','G6'].forEach((n,i)=>poly.triggerAttackRelease(n,'8n',t+i*0.12));
      ['C7','E7','G7','C8'].forEach((n,i)=>poly.triggerAttackRelease(n,'32n',t+0.8+i*0.06));
    },
    'pet-greet'()   { const t=Tone.now(); poly.triggerAttackRelease('D4','8n',t); poly.triggerAttackRelease('F4','8n',t+0.15); },
    'shake-rattle'(){ noise.triggerAttackRelease('16n'); },
    'bean-drop'()   { membrane.triggerAttackRelease('C2','16n'); },
  };

  return {
    init() { _load(); },

    unlock() {
      if (_initialized) return;
      if (typeof Tone === 'undefined') return;
      Tone.start().then(() => {
        poly = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 },
        }).toDestination();
        membrane = new Tone.MembraneSynth({
          pitchDecay: 0.05, octaves: 4,
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        }).toDestination();
        metal = new Tone.MetalSynth({
          frequency: 400,
          envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
          harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        }).toDestination();
        noise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.05 },
        }).toDestination();
        tiltOsc  = new Tone.Oscillator({ type: 'sine', frequency: 220 });
        tiltGain = new Tone.Gain(0).toDestination();
        tiltOsc.connect(tiltGain);
        tiltOsc.start();
        _applyVolume(_volume);
        _initialized = true;
      }).catch(() => {});
    },

    play(name, param) {
      if (_muted || !_initialized || _volume === 0) return;
      const fn = _sounds[name];
      if (fn) { try { fn(param); } catch(e) {} }
    },

    tiltStart()          { if (!tiltGain || _muted) return; tiltGain.gain.rampTo(_volume * 0.25, 0.1); },
    tiltUpdate(progress) { if (!tiltOsc  || _muted) return; tiltOsc.frequency.rampTo(220 + progress * 220, 0.05); },
    tiltStop()           { if (!tiltGain) return; tiltGain.gain.rampTo(0, 0.1); },

    isMuted:   () => _muted,
    getVolume: () => _volume,
    setMuted(b)  { _muted = b; _save(); },
    setVolume(v) { _volume = v; _applyVolume(v); _save(); },
  };
})();
