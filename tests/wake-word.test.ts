import assert from "node:assert";

/**
 * Test Suite: ALFRED Local Wake Word Detection (Phase 5.4B)
 * Regression & Lifecycle Verification:
 * TEST A: Wake word disabled → normal microphone can capture/transcribe.
 * TEST B: Wake word enabled → wake detection → wake microphone fully released → command microphone successfully acquires microphone.
 * TEST C: Wake detection does not continue consuming microphone after handoff.
 * TEST D: After command capture completes, wake monitoring can resume.
 * TEST E: Disabling wake word releases all wake microphone resources.
 * TEST F: Repeated cycles work (enable wake → Hey Alfred → command → complete → wake monitoring → Hey Alfred → command) without microphone deadlock.
 * TEST G: Manual microphone continues working after several wake-word cycles.
 */

console.log("==========================================================================");
console.log("   ALFRED PHASE 5.4B: LOCAL WAKE WORD DETECTION & MIC LIFECYCLE TESTS     ");
console.log("==========================================================================");

let testsPassed = 0;
let testsFailed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as any).then === "function") {
      await result;
    }
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}: ${err?.message || err}`);
    testsFailed++;
  }
}

// Track microphone stream allocations
let activeMicrophoneTracks = 0;
let totalMicrophoneAcquisitions = 0;

class MockMediaStreamTrack {
  public stopped = false;
  constructor(public kind: string = "audio") {}
  stop() {
    if (!this.stopped) {
      this.stopped = true;
      activeMicrophoneTracks = Math.max(0, activeMicrophoneTracks - 1);
    }
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];
  constructor() {
    this.tracks = [new MockMediaStreamTrack("audio")];
    activeMicrophoneTracks++;
    totalMicrophoneAcquisitions++;
  }
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks;
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  public state: "inactive" | "recording" | "paused" = "inactive";
  public mimeType = "audio/webm;codecs=opus";
  public ondataavailable: ((e: any) => void) | null = null;
  public onstop: (() => void) | null = null;
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
  start(timeslice?: number) {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    if (this.ondataavailable) {
      const dummyData = new Uint8Array(2048);
      dummyData.fill(42);
      this.ondataavailable({
        data: new Blob([dummyData], { type: "audio/webm" }),
      });
    }
    const handlers = this.listeners["stop"] || [];
    handlers.forEach((h) => h());
    if (this.onstop) this.onstop();
  }
  static isTypeSupported(mime: string) {
    return true;
  }
}

(global as any).MediaRecorder = MockMediaRecorder;

// Mock localStorage
class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}
(global as any).localStorage = new MockLocalStorage();

// Mock CustomEvent
class MockCustomEvent {
  constructor(public type: string, public params: any = {}) {}
  get detail() {
    return this.params.detail;
  }
}
(global as any).CustomEvent = MockCustomEvent;

// Mock window and AudioContext
(global as any).window = {
  dispatchEvent: (event: any) => {},
  addEventListener: (name: string, cb: any) => {},
  removeEventListener: (name: string, cb: any) => {},
  btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
  electron: {
    wakeWord: {
      getStatus: async () => ({
        available: true,
        engine: "openwakeword",
        status: "READY",
        phrase: "Hey Alfred",
        model: "hey_alfred",
        detail: "Local openWakeWord active.",
      }),
      predict: async (audio: string, threshold = 0.5) => ({
        detected: false,
        score: 0.1,
        phrase: "Hey Alfred",
        model: "hey_alfred",
      }),
      setPhrase: async (phrase: string) => ({
        success: true,
        phrase,
      }),
    },
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
        transcript: "open vs code",
        duration: 0.8,
      }),
    },
  },
};

Object.defineProperty(globalThis, "navigator", {
  value: {
    mediaDevices: {
      getUserMedia: async (constraints: any) => new MockMediaStream(),
    },
  },
  configurable: true,
  writable: true,
});

class MockAudioContext {
  state = "running";
  sampleRate = 16000;
  destination = {};
  currentTime = 0;
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
      disconnect: () => {},
    };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: {
        setValueAtTime: () => {},
      },
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
      getByteFrequencyData: (arr: Uint8Array) => {
        arr.fill(0);
      },
      getFloatTimeDomainData: (arr: Float32Array) => {
        arr.fill(0);
      },
      connect: () => {},
      disconnect: () => {},
    };
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
}
(global as any).AudioContext = MockAudioContext;
if (typeof (global as any).window !== "undefined") {
  (global as any).window.AudioContext = MockAudioContext;
}

async function runAll() {
  const { WakeWordService } = await import("../src/utils/wakeWordService");
  const { VoiceInputService } = await import("../src/utils/voiceInputService");

  // 1. Initial State & Configuration
  await runTest("1. Initial state is conservative (disabled by default)", async () => {
    await WakeWordService.setEnabled(false);
    assert.strictEqual(WakeWordService.getStatusState(), "disabled");
    assert.strictEqual(WakeWordService.isFeatureEnabled(), false);
    assert.strictEqual(WakeWordService.getWakePhrase(), "Hey Alfred");
    assert.strictEqual(activeMicrophoneTracks, 0);
  });

  // 2. Initialize queries local wake engine
  await runTest("2. Initialize queries local wake-word engine", async () => {
    const status = await WakeWordService.initialize();
    assert.strictEqual(status.available, true);
    assert.strictEqual(status.engine, "openwakeword");
    assert.strictEqual(status.phrase, "Hey Alfred");
    assert.strictEqual(WakeWordService.getStatusState(), "ready");
  });

  // TEST A: Wake word disabled -> normal microphone can capture/transcribe
  await runTest("TEST A: Wake word disabled → normal microphone can capture/transcribe", async () => {
    await WakeWordService.setEnabled(false);
    assert.strictEqual(WakeWordService.isFeatureEnabled(), false);
    assert.strictEqual(WakeWordService.isListening(), false);

    // Click mic button
    await VoiceInputService.startListening();
    assert.strictEqual(VoiceInputService.getState(), "listening");
    assert.strictEqual(activeMicrophoneTracks, 1);

    // Speak command & stop listening
    const transcript = await VoiceInputService.stopListening();
    assert.strictEqual(transcript, "open vs code");
    assert.strictEqual(VoiceInputService.getTranscript(), "open vs code");
    assert.strictEqual(VoiceInputService.getState(), "idle");
    assert.strictEqual(activeMicrophoneTracks, 0); // Hardware cleanly released
  });

  // 3. User activation of wake word
  await runTest("3. Enabling wake word transitions to listening state", async () => {
    await WakeWordService.setEnabled(true);
    assert.strictEqual(WakeWordService.isFeatureEnabled(), true);
    assert.strictEqual(WakeWordService.getStatusState(), "listening");
    assert.strictEqual(WakeWordService.isListening(), true);
    assert.strictEqual(activeMicrophoneTracks, 1);
  });

  // TEST B: Wake word enabled → wake detection → wake mic released → command mic acquires
  await runTest("TEST B: Wake word enabled → wake detection → wake mic fully released → command mic acquires", async () => {
    assert.strictEqual(WakeWordService.isListening(), true);
    assert.strictEqual(activeMicrophoneTracks, 1);

    let wakeDetectedFired = false;
    const unsub = WakeWordService.subscribeWake(() => {
      wakeDetectedFired = true;
    });

    // Simulate "Hey Alfred" detection
    WakeWordService.pause(); // Handoff immediately releases wake mic
    assert.strictEqual(WakeWordService.isListening(), false);
    assert.strictEqual(activeMicrophoneTracks, 0); // Wake mic must be 0 before voice acquires

    // VoiceInput acquires microphone
    await VoiceInputService.startListening();
    assert.strictEqual(VoiceInputService.getState(), "listening");
    assert.strictEqual(activeMicrophoneTracks, 1); // Only VoiceInput owns mic now

    unsub();
  });

  // TEST C: Wake detection does not continue consuming microphone after handoff
  await runTest("TEST C: Wake detection does not continue consuming microphone after handoff", async () => {
    assert.strictEqual(WakeWordService.isListening(), false);
    // VoiceInput owns microphone
    assert.strictEqual(VoiceInputService.getState(), "listening");
    assert.strictEqual(activeMicrophoneTracks, 1);
  });

  // TEST D: After command capture completes, wake monitoring can resume
  await runTest("TEST D: After command capture completes, wake monitoring can resume", async () => {
    const transcript = await VoiceInputService.stopListening();
    assert.strictEqual(transcript, "open vs code");
    assert.strictEqual(VoiceInputService.getState(), "idle");

    // Command finished; resume wake monitoring
    await WakeWordService.resume();
    assert.strictEqual(WakeWordService.isListening(), true);
    assert.strictEqual(activeMicrophoneTracks, 1);
  });

  // TEST E: Disabling wake word releases all wake microphone resources
  await runTest("TEST E: Disabling wake word releases all wake microphone resources", async () => {
    await WakeWordService.setEnabled(false);
    assert.strictEqual(WakeWordService.isFeatureEnabled(), false);
    assert.strictEqual(WakeWordService.isListening(), false);
    assert.strictEqual(activeMicrophoneTracks, 0); // Zero active microphone streams
  });

  // TEST F: Repeated cycles work without deadlock
  await runTest("TEST F: Repeated cycles work (enable wake → Hey Alfred → command → complete → resume) without deadlock", async () => {
    for (let cycle = 1; cycle <= 3; cycle++) {
      // 1. Enable wake monitoring
      await WakeWordService.setEnabled(true);
      assert.strictEqual(WakeWordService.isListening(), true);
      assert.strictEqual(activeMicrophoneTracks, 1);

      // 2. "Hey Alfred" detected -> pause wake mic
      WakeWordService.pause();
      assert.strictEqual(WakeWordService.isListening(), false);
      assert.strictEqual(activeMicrophoneTracks, 0);

      // 3. Command mic acquires
      await VoiceInputService.startListening();
      assert.strictEqual(VoiceInputService.getState(), "listening");
      assert.strictEqual(activeMicrophoneTracks, 1);

      // 4. Command complete -> VoiceInput finishes
      const transcript = await VoiceInputService.stopListening();
      assert.strictEqual(transcript, "open vs code");
      assert.strictEqual(activeMicrophoneTracks, 0);

      // 5. Wake resumes
      await WakeWordService.resume();
      assert.strictEqual(WakeWordService.isListening(), true);
      assert.strictEqual(activeMicrophoneTracks, 1);
    }

    // Clean up to disabled at end of cycle test
    await WakeWordService.setEnabled(false);
    assert.strictEqual(activeMicrophoneTracks, 0);
  });

  // TEST G: Manual microphone continues working after several wake-word cycles
  await runTest("TEST G: Manual microphone continues working after several wake-word cycles", async () => {
    assert.strictEqual(WakeWordService.isFeatureEnabled(), false);
    assert.strictEqual(activeMicrophoneTracks, 0);

    // Cycle manual mic 3 times
    for (let i = 1; i <= 3; i++) {
      await VoiceInputService.startListening();
      assert.strictEqual(VoiceInputService.getState(), "listening");
      assert.strictEqual(activeMicrophoneTracks, 1);

      const transcript = await VoiceInputService.stopListening();
      assert.strictEqual(transcript, "open vs code");
      assert.strictEqual(activeMicrophoneTracks, 0);
    }
  });

  // 14. Error recovery
  await runTest("14. Failed microphone access recovers safely to error state without trapping", async () => {
    const originalGetUserMedia = (global as any).navigator.mediaDevices.getUserMedia;
    (global as any).navigator.mediaDevices.getUserMedia = async () => {
      const err = new Error("Device busy");
      err.name = "NotAllowedError";
      throw err;
    };

    await WakeWordService.setEnabled(true);
    assert.strictEqual(WakeWordService.getStatusState(), "error");
    // Cleanup back to disabled
    await WakeWordService.setEnabled(false);
    assert.strictEqual(WakeWordService.getStatusState(), "disabled");

    // Restore original getUserMedia
    (global as any).navigator.mediaDevices.getUserMedia = originalGetUserMedia;
  });

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

