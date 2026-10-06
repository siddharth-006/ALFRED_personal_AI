import assert from "node:assert";

/**
 * Test Suite: ALFRED VAD & Automatic Silence Detection Regression Test
 * Proves:
 * 1. Speech begins -> detected by RMS time-domain analyser
 * 2. Speech ends -> energy drops below adaptive silence threshold
 * 3. Silence threshold is sustained for required window (~1350ms)
 * 4. VoiceInputService automatically stops recording (without manual click OFF)
 * 5. Whisper transcription is triggered via IPC
 * 6. Final transcript reaches subscriber (CommandTerminal input textbox)
 * 7. Manual click OFF remains available as fallback
 */

console.log("==========================================================================");
console.log("   ALFRED: VAD & AUTOMATIC SILENCE DETECTION REGRESSION TEST SUITE         ");
console.log("==========================================================================");

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      await res;
    }
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}: ${err?.message || err}`);
    testsFailed++;
  }
}

// Controllable audio signal generator
let currentSignalMode: "ambient" | "speech" | "silence" = "ambient";

function fillAudioSignal(arr: Float32Array) {
  if (currentSignalMode === "ambient" || currentSignalMode === "silence") {
    // Ambient noise floor with low amplitude (RMS ~ 0.005)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (Math.random() - 0.5) * 0.01;
    }
  } else if (currentSignalMode === "speech") {
    // Simulated speech waveform with high energy (RMS ~ 0.15)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.sin((i * Math.PI) / 8) * 0.22 + (Math.random() - 0.5) * 0.02;
    }
  }
}

// Setup Global Browser & Web Audio Mocks
(global as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

(global as any).CustomEvent = class {
  constructor(public type: string, public params: any = {}) {}
  get detail() {
    return this.params.detail;
  }
};

(global as any).window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
  electron: {
    voice: {
      getStatus: async () => ({
        available: true,
        engine: "faster-whisper",
        status: "READY",
        model: "base.en",
        detail: "Local Faster-Whisper active.",
      }),
      transcribe: async (buffer: Uint8Array) => ({
        success: true,
        transcript: "Open VS Code",
        duration: 0.85,
      }),
    },
    wakeWord: {
      getStatus: async () => ({
        available: true,
        engine: "openwakeword",
        status: "READY",
        phrase: "Hey Alfred",
      }),
      predict: async () => ({ detected: false }),
    },
  },
};

class MockMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;
  private listeners: Record<string, Function[]> = {};

  constructor(public stream: any, public options: any = {}) {}

  addEventListener(event: string, fn: Function) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event: string, fn: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
    }
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    if (this.ondataavailable) {
      const dummy = new Uint8Array(2048);
      dummy.fill(42);
      this.ondataavailable({ data: new Blob([dummy], { type: "audio/webm" }) });
    }
    const handlers = this.listeners["stop"] || [];
    handlers.forEach((h) => h());
    if (this.onstop) this.onstop();
  }
  static isTypeSupported() {
    return true;
  }
}
(global as any).MediaRecorder = MockMediaRecorder;

Object.defineProperty(globalThis, "navigator", {
  value: {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => {} }],
      }),
    },
  },
  configurable: true,
  writable: true,
});

class MockAudioContext {
  state = "suspended"; // starts suspended like in Chromium
  sampleRate = 16000;
  destination = {};
  currentTime = 0;

  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
    };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createMediaStreamSource() {
    return {
      connect: () => {},
      disconnect: () => {},
    };
  }
  createScriptProcessor() {
    return {
      connect: () => {},
      disconnect: () => {},
      onaudioprocess: null,
    };
  }
  createAnalyser() {
    return {
      fftSize: 512,
      frequencyBinCount: 256,
      smoothingTimeConstant: 0.2,
      getByteFrequencyData: (arr: Uint8Array) => arr.fill(10),
      getFloatTimeDomainData: (arr: Float32Array) => {
        fillAudioSignal(arr);
      },
      connect: () => {},
      disconnect: () => {},
    };
  }
}
(global as any).AudioContext = MockAudioContext;
(global as any).window.AudioContext = MockAudioContext;

async function runAll() {
  const { VoiceInputService } = await import("../src/utils/voiceInputService");

  // TEST 1: Full automatic speech -> silence -> stop -> transcribe -> textbox flow
  await runTest(
    "1. VAD end-to-end: Speech begins -> ends -> silence threshold auto-stops recording -> transcribes to textbox",
    async () => {
      let receivedTranscript = "";
      const unsub = VoiceInputService.subscribeTranscript((t) => {
        receivedTranscript = t;
      });

      // 1. Initial ambient state
      currentSignalMode = "ambient";
      await VoiceInputService.startListening();
      assert.strictEqual(VoiceInputService.getState(), "listening");
      assert.strictEqual(receivedTranscript, "");

      // Allow 250ms for ambient baseline calibration
      await new Promise((r) => setTimeout(r, 250));

      // 2. User begins speaking ("Open VS Code")
      currentSignalMode = "speech";
      // Allow 500ms of speech (frames will easily confirm speech onset)
      await new Promise((r) => setTimeout(r, 500));
      assert.strictEqual(VoiceInputService.getState(), "listening");

      // 3. User stops speaking -> signal drops to silence
      currentSignalMode = "silence";

      // 4. Wait up to 2500ms for VAD silence window (1.35s) to trigger and finish
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline && VoiceInputService.getState() !== "idle") {
        await new Promise((r) => setTimeout(r, 50));
      }

      // 5. Verify recording stopped automatically without any manual click
      assert.strictEqual(VoiceInputService.getState(), "idle");

      // 6. Verify Whisper transcript reached subscriber
      assert.strictEqual(receivedTranscript, "Open VS Code");
      assert.strictEqual(VoiceInputService.getTranscript(), "Open VS Code");

      unsub();
    }
  );

  // TEST 2: Active speech maintains recording and does not prematurely stop
  await runTest(
    "2. Ongoing speech prevents silence trigger and keeps VoiceInputService in listening state",
    async () => {
      currentSignalMode = "speech";
      await VoiceInputService.startListening();
      assert.strictEqual(VoiceInputService.getState(), "listening");

      // Stay speaking for 800ms
      await new Promise((r) => setTimeout(r, 800));
      assert.strictEqual(VoiceInputService.getState(), "listening");

      // Clean up manually
      await VoiceInputService.stopListening();
      assert.strictEqual(VoiceInputService.getState(), "idle");
    }
  );

  // TEST 3: Manual click OFF fallback remains fully functional
  await runTest(
    "3. Manual click OFF action remains available and immediately stops recording",
    async () => {
      let received = "";
      const unsub = VoiceInputService.subscribeTranscript((t) => {
        received = t;
      });

      currentSignalMode = "speech";
      await VoiceInputService.startListening();
      assert.strictEqual(VoiceInputService.getState(), "listening");

      // Manual click OFF right away
      const transcript = await VoiceInputService.stopListening();
      assert.strictEqual(transcript, "Open VS Code");
      assert.strictEqual(received, "Open VS Code");
      assert.strictEqual(VoiceInputService.getState(), "idle");

      unsub();
    }
  );

  console.log("==========================================================================");
  console.log(`SUMMARY: ${testsPassed} passed, ${testsFailed} failed (Total: ${testsPassed + testsFailed})`);
  console.log("==========================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
