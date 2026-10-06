const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 180; // 3 minutes
const CROSSFADE_SECONDS = 4; // 4s seamless loop crossfade

const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
const CROSSFADE_SAMPLES = Math.floor(SAMPLE_RATE * CROSSFADE_SECONDS);
const TOTAL_RAW_SAMPLES = NUM_SAMPLES + CROSSFADE_SAMPLES;

function createPrng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeWavFile(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // 16-bit

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.floor(s < 0 ? s * 32768 : s * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}

function applySeamlessCrossfade(rawSamples) {
  const result = new Float32Array(NUM_SAMPLES);
  // Copy base region [0, NUM_SAMPLES - CROSSFADE_SAMPLES]
  for (let i = 0; i < NUM_SAMPLES - CROSSFADE_SAMPLES; i++) {
    result[i] = rawSamples[i];
  }

  // Crossfade region: blend tail overlap [NUM_SAMPLES, NUM_SAMPLES + CROSSFADE_SAMPLES] into head [0, CROSSFADE_SAMPLES]
  for (let i = 0; i < CROSSFADE_SAMPLES; i++) {
    const progress = i / CROSSFADE_SAMPLES;
    const fadeOut = Math.cos((progress * Math.PI) / 2);
    const fadeIn = Math.sin((progress * Math.PI) / 2);

    const headIndex = i;
    const tailOverlapIndex = NUM_SAMPLES + i;

    // Head of loop blends from tail overlap
    result[headIndex] = rawSamples[headIndex] * fadeIn + rawSamples[tailOverlapIndex] * fadeOut;
  }

  // Preserve rest of loop
  for (let i = CROSSFADE_SAMPLES; i < NUM_SAMPLES; i++) {
    result[i] = rawSamples[i];
  }

  return result;
}

// 1. DEEP SPACE: Slowly evolving layered cosmic drone with non-periodic LFOs
function generateDeepSpace() {
  const rand = createPrng(42001);
  const raw = new Float32Array(TOTAL_RAW_SAMPLES);

  // Frequencies: F1 (43.65 Hz), C2 (65.41 Hz), F2 (87.31 Hz), C3 (130.81 Hz), A3 (220 Hz)
  const baseFreqs = [43.65, 65.41, 87.31, 130.81, 220.0];
  const lfoPeriods = [37.0, 53.0, 71.0, 97.0, 113.0];
  const phases = baseFreqs.map(() => rand() * Math.PI * 2);

  // Subtle noise buffer for space breath
  let filterState = 0;

  for (let i = 0; i < TOTAL_RAW_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;

    for (let k = 0; k < baseFreqs.length; k++) {
      const f = baseFreqs[k];
      const lfo = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / lfoPeriods[k]);
      const slowDrift = 1 + 0.002 * Math.sin((2 * Math.PI * t) / (lfoPeriods[k] * 1.7));
      const osc = Math.sin(2 * Math.PI * f * slowDrift * t + phases[k]);
      sample += osc * (0.28 / (k + 1)) * (0.6 + 0.4 * lfo);
    }

    // Subtle filtered cosmic dust breath
    const white = rand() * 2 - 1;
    filterState += 0.04 * (white - filterState);
    const breathLfo = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 47.0);
    sample += filterState * 0.08 * breathLfo;

    raw[i] = sample * 0.75;
  }

  return applySeamlessCrossfade(raw);
}

// 2. RAIN: Multi-band shaped continuous rainfall with slow natural intensity swell
function generateRain() {
  const rand = createPrng(99102);
  const raw = new Float32Array(TOTAL_RAW_SAMPLES);

  let lowPass = 0;
  let midPass = 0;
  let highPass = 0;

  for (let i = 0; i < TOTAL_RAW_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const white = rand() * 2 - 1;

    // Slow atmospheric gusts (periods 43s, 67s)
    const swell = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 53.0) * Math.cos((2 * Math.PI * t) / 31.0);

    // Low rumble (distant rain hitting roof / pavement)
    lowPass += 0.03 * (white - lowPass);

    // Mid continuous rainfall texture
    midPass += 0.18 * (white - midPass);

    // High subtle droplet mist
    highPass += 0.45 * (white - highPass);

    // Occasional subtle droplet tap
    let drop = 0;
    if (rand() < 0.0008) {
      drop = (rand() * 2 - 1) * 0.12;
    }

    const sample = (lowPass * 0.45 + midPass * 0.35 + (highPass - midPass) * 0.2 + drop) * swell;
    raw[i] = sample * 0.7;
  }

  return applySeamlessCrossfade(raw);
}

// 3. CAFE: Diffuse warm ambient room texture with gentle low-pass acoustic ambience
function generateCafe() {
  const rand = createPrng(77203);
  const raw = new Float32Array(TOTAL_RAW_SAMPLES);

  let roomTone = 0;
  let murmurTone = 0;
  let murmurFilter2 = 0;

  // Occasional warm cup / coaster touches (deterministic timestamps)
  const clinks = [];
  for (let sec = 5; sec < TOTAL_RAW_SAMPLES / SAMPLE_RATE - 5; sec += 18 + rand() * 25) {
    clinks.push(Math.floor(sec * SAMPLE_RATE));
  }

  for (let i = 0; i < TOTAL_RAW_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const white = rand() * 2 - 1;

    // Warm low room resonance (~150 Hz)
    roomTone += 0.04 * (white - roomTone);

    // Diffuse vocal-formant frequency zone (~350 - 700 Hz) - no decipherable words, purely warm chatter acoustics
    const murmurSource = (white * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3.2 * t))) * 0.3;
    murmurTone += 0.09 * (murmurSource - murmurTone);
    murmurFilter2 += 0.05 * (murmurTone - murmurFilter2);

    // Very soft coffee house hum LFO
    const cafeLfo = 0.8 + 0.2 * Math.sin((2 * Math.PI * t) / 61.0);

    let sample = (roomTone * 0.5 + murmurFilter2 * 0.35) * cafeLfo;

    // Check soft ceramic / spoon touch
    for (let c = 0; c < clinks.length; c++) {
      const dist = i - clinks[c];
      if (dist >= 0 && dist < 1200) {
        const decay = Math.exp(-dist / 220);
        const ring = Math.sin(2 * Math.PI * 1850 * (dist / SAMPLE_RATE)) * 0.06 * decay;
        sample += ring;
      }
    }

    raw[i] = sample * 0.65;
  }

  return applySeamlessCrossfade(raw);
}

// 4. FOCUS: Binaural alpha oscillation (10 Hz beat) over rich harmonic foundation
function generateFocus() {
  const rand = createPrng(33404);
  const raw = new Float32Array(TOTAL_RAW_SAMPLES);

  // 108.0 Hz (A2-ish) root, 136.1 Hz (Om/earth), 216.0 Hz (octave)
  const root = 108.0;
  let pinkState = 0;

  for (let i = 0; i < TOTAL_RAW_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // 10 Hz alpha entrainment rhythm with slow 6.5s breathing depth modulation
    const alphaRate = 10.0 + 0.8 * Math.sin((2 * Math.PI * t) / 83.0);
    const breath = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 6.5);
    const alphaMod = 0.8 + 0.2 * Math.sin(2 * Math.PI * alphaRate * t);

    // Harmonic layers
    const tone1 = Math.sin(2 * Math.PI * root * t);
    const tone2 = Math.sin(2 * Math.PI * (root * 1.5) * t) * 0.35; // fifth
    const tone3 = Math.sin(2 * Math.PI * (root * 2) * t) * 0.2; // octave
    const toneOm = Math.sin(2 * Math.PI * 136.1 * t) * 0.4;

    const tonalLayer = (tone1 * 0.4 + tone2 + tone3 + toneOm) * breath * alphaMod;

    // Soft warm filtered grounding layer
    const white = rand() * 2 - 1;
    pinkState += 0.025 * (white - pinkState);

    const sample = tonalLayer * 0.45 + pinkState * 0.12;
    raw[i] = sample * 0.65;
  }

  return applySeamlessCrossfade(raw);
}

// 5. NIGHT: Minimal dark atmospheric midnight room ambience with delicate high cicada pulse
function generateNight() {
  const rand = createPrng(88505);
  const raw = new Float32Array(TOTAL_RAW_SAMPLES);

  let airTone = 0;
  let cricketFilter = 0;

  for (let i = 0; i < TOTAL_RAW_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const white = rand() * 2 - 1;

    // Dark midnight room air tone (very low frequency filtered noise)
    airTone += 0.02 * (white - airTone);

    // Night wind breath LFO (long periods 41s, 79s)
    const windLfo = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 41.0);

    // Soft, distant cicada pulse (3.8 kHz harmonic ring pulsing at 4 Hz)
    const cicadaCarrier = Math.sin(2 * Math.PI * 3800 * t);
    const cicadaPulse = Math.max(0, Math.sin(2 * Math.PI * 4.2 * t));
    const cicadaActive = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 29.0); // swells in and out softly
    const cicada = cicadaCarrier * Math.pow(cicadaPulse, 4) * 0.04 * cicadaActive;

    const sample = airTone * 0.5 * windLfo + cicada;
    raw[i] = sample * 0.65;
  }

  return applySeamlessCrossfade(raw);
}

function generateAll() {
  const outDir = path.join(__dirname, "..", "public", "audio", "ambient");
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[Audio Generator] Synthesizing ${DURATION_SECONDS}s (3 min) seamless loops @ ${SAMPLE_RATE} Hz...`);

  console.log("-> 1/5: Deep Space...");
  const spaceSamples = generateDeepSpace();
  writeWavFile(path.join(outDir, "deep-space.wav"), spaceSamples);

  console.log("-> 2/5: Rain...");
  const rainSamples = generateRain();
  writeWavFile(path.join(outDir, "rain.wav"), rainSamples);

  console.log("-> 3/5: Cafe...");
  const cafeSamples = generateCafe();
  writeWavFile(path.join(outDir, "cafe.wav"), cafeSamples);

  console.log("-> 4/5: Focus...");
  const focusSamples = generateFocus();
  writeWavFile(path.join(outDir, "focus.wav"), focusSamples);

  console.log("-> 5/5: Night...");
  const nightSamples = generateNight();
  writeWavFile(path.join(outDir, "night.wav"), nightSamples);

  console.log("[Audio Generator] All 5 ambient tracks generated successfully!");
}

generateAll();
