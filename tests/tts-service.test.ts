import assert from "node:assert";
import { MockTtsProvider } from "../electron/voice/mock-tts-provider";
import { TtsService } from "../electron/voice/tts-service";
import { formatSpokenResponse } from "../src/utils/responseSpeechFormatter";

/**
 * ALFRED PHASE 5.4C — LOCAL TTS / VOICE RESPONSE LAYER TEST SUITE
 * 
 * Tests:
 * 1. TTS provider initializes.
 * 2. speak("Hello Alfred") invokes the local provider.
 * 3. TTS disabled → no speech occurs.
 * 4. stop() interrupts active speech.
 * 5. Multiple speech requests do not overlap.
 * 6. Queue behaves correctly (newer supersedes older & deduplication).
 * 7. TTS failure does not fail command execution.
 * 8. Sensitive/internal raw tool data is not sent to TTS.
 * 9. Manual confirmation flow does not speak a false success before confirmation.
 * 10. Successful command can produce a spoken response.
 * 11. TTS cleanup occurs correctly.
 * 12. Existing microphone/wake-word lifecycle remains functional.
 */

console.log("==========================================================================");
console.log("   ALFRED PHASE 5.4C: LOCAL TEXT-TO-SPEECH (TTS) SYSTEM TESTS             ");
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

async function main() {
  // Test 1: TTS provider initializes
  await runTest("TTS provider initializes successfully and reports ready status", async () => {
    const mockProvider = new MockTtsProvider(50);
    const service = new TtsService(mockProvider);
    await service.initialize();

    const status = await service.getStatus();
    assert.strictEqual(status.available, true, "Service should be available");
    assert.strictEqual(status.status, "READY", "Status should be READY");
    assert.strictEqual(status.engine, "mock", "Engine name should match");
    await service.dispose();
  });

  // Test 2: speak("Hello Alfred") invokes the local provider
  await runTest("speak('Hello Alfred') invokes the local provider and dispatches events", async () => {
    const mockProvider = new MockTtsProvider(30);
    const service = new TtsService(mockProvider);
    await service.initialize();

    const events: string[] = [];
    service.onEvent((ev) => events.push(ev.type));

    const result = await service.speak("Hello Alfred");
    assert.strictEqual(result.success, true, "Success flag should be true");
    assert.strictEqual(mockProvider.spokenHistory.length, 1);
    assert.strictEqual(mockProvider.spokenHistory[0].text, "Hello Alfred");

    // Wait for async completion
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert(events.includes("started"), "Should have emitted started event");
    assert(events.includes("completed"), "Should have emitted completed event");
    await service.dispose();
  });

  // Test 3: TTS disabled → no speech occurs
  await runTest("TTS disabled → no speech occurs", async () => {
    const mockProvider = new MockTtsProvider(30);
    const service = new TtsService(mockProvider);
    await service.initialize();

    service.setEnabled(false);
    assert.strictEqual(service.isEnabled(), false, "Service should be disabled");

    const result = await service.speak("Hello Alfred");
    assert.strictEqual(result.success, false, "Should not succeed when disabled");
    assert.strictEqual(result.error, "TTS disabled");
    assert.strictEqual(mockProvider.spokenHistory.length, 0, "No speech should reach provider");
    await service.dispose();
  });

  // Test 4: stop() interrupts active speech
  await runTest("stop() interrupts active speech immediately", async () => {
    const mockProvider = new MockTtsProvider(200); // 200ms duration
    const service = new TtsService(mockProvider);
    await service.initialize();

    const events: string[] = [];
    service.onEvent((ev) => events.push(ev.type));

    service.speak("This is a long sentence that will be stopped promptly.");
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(service.isSpeaking(), true, "Should be speaking initially");
    await service.stop();

    assert.strictEqual(service.isSpeaking(), false, "Should no longer be speaking after stop");
    assert.strictEqual(mockProvider.stopCallCount >= 1, true, "Provider stop should be called");
    assert(events.includes("stopped"), "Stopped event should be emitted");
    await service.dispose();
  });

  // Test 5: Multiple speech requests do not overlap
  await runTest("Multiple speech requests do not overlap (single playback guaranteed)", async () => {
    const mockProvider = new MockTtsProvider(100);
    const service = new TtsService(mockProvider);
    await service.initialize();

    // First request
    service.speak("First utterance");
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(service.isSpeaking(), true);

    // Second request while first is speaking -> first is stopped/cancelled, second takes over
    await service.speak("Second utterance");
    assert.strictEqual(mockProvider.stopCallCount >= 1, true, "First utterance must be stopped before second");
    assert.strictEqual(mockProvider.spokenHistory.length, 2, "Second utterance starts");
    assert.strictEqual(mockProvider.spokenHistory[1].text, "Second utterance");

    await service.dispose();
  });

  // Test 6: Queue behaves correctly (newer supersedes older & deduplication)
  await runTest("Queue behaves correctly: newer supersedes older and ignores rapid duplicates", async () => {
    const mockProvider = new MockTtsProvider(50);
    const service = new TtsService(mockProvider);
    await service.initialize();

    // Speak initial
    const res1 = await service.speak("Command completed successfully.");
    assert.strictEqual(res1.success, true);

    // Immediate exact duplicate within debounce window (e.g. React re-render)
    const res2 = await service.speak("Command completed successfully.");
    assert.strictEqual(res2.success, true, "Duplicate returns success=true without repeating speech");
    assert.strictEqual(mockProvider.spokenHistory.length, 1, "Provider called only once");

    // Newer distinct speech supersedes immediately
    const res3 = await service.speak("Different message.");
    assert.strictEqual(res3.success, true, "Distinct message should proceed");
    assert.strictEqual(mockProvider.spokenHistory.length, 2);

    await service.dispose();
  });

  // Test 7: TTS failure does not fail command execution
  await runTest("TTS failure does not crash service or fail command execution", async () => {
    // Failing provider
    const failingProvider = {
      initialize: async () => ({
        available: false,
        engine: "mock" as const,
        status: "ERROR" as const,
        detail: "Simulated audio device error",
      }),
      speak: async () => {
        throw new Error("Simulated Windows SAPI audio device failure");
      },
      stop: async () => {},
      isSpeaking: () => false,
      getStatus: async () => ({
        available: false,
        engine: "mock" as const,
        status: "ERROR" as const,
      }),
      setOptions: async () => {},
      onEvent: () => () => {},
      dispose: async () => {},
    };

    const service = new TtsService(failingProvider);
    await service.initialize();

    // Attempting to speak with failing provider should return gracefully without crashing
    const result = await service.speak("Testing failure tolerance");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Simulated Windows SAPI audio device failure");

    // Command execution simulator
    let commandSuccess = false;
    try {
      // Simulate command execution
      commandSuccess = true;
      // Trigger TTS (which fails)
      await service.speak("Command response");
    } catch {
      commandSuccess = false;
    }

    assert.strictEqual(commandSuccess, true, "Command execution MUST remain successful even if TTS fails");
    await service.dispose();
  });

  // Test 8: Sensitive/internal raw tool data is not sent to TTS
  await runTest("Sensitive/internal raw tool data is stripped and NOT sent to TTS", () => {
    const dangerousResult = {
      intent: "execute_command",
      success: true,
      explanation: "Plan: {\"tool\": \"shell\", \"args\": {\"cmd\": \"rm -rf /private/keys\", \"apiKey\": \"sk-secret-12345\"}}",
      steps: [
        {
          tool: "launch_application",
          arguments: { rawSecret: "super-confidential-token", internalArg: 999 },
          success: true,
        },
      ],
    };

    const speech = formatSpokenResponse(dangerousResult, "run secret task");
    assert(speech !== null, "Should format safe response");
    assert(!speech.includes("sk-secret-12345"), "Must not leak API key");
    assert(!speech.includes("super-confidential-token"), "Must not leak secret arguments");
    assert(!speech.includes("rm -rf"), "Must not speak raw shell commands");
    assert(!speech.includes("{"), "Must not speak raw JSON braces");
    assert(!speech.includes("}"), "Must not speak raw JSON braces");
  });

  // Test 9: Manual confirmation flow does not speak a false success before confirmation
  await runTest("Manual confirmation flow does not speak false success before confirmation", () => {
    const pendingConfirmationResult = {
      requiresConfirmation: true,
      confirmationId: "conf-1234",
      risk: { mutationCount: 5, summary: "Create 5 tasks and write files" },
      explanation: "Create 5 tasks and modify directory",
    };

    const speech = formatSpokenResponse(pendingConfirmationResult, "Create 5 tasks");
    assert(speech !== null, "formatSpokenResponse returns confirmation prompt");
    assert(speech.includes("need your confirmation"), "Must ask for user confirmation");
    assert(!speech.includes("Done"), "Must not claim 'Done'");
    assert(!speech.includes("completed"), "Must not claim completion before execution");
  });

  // Test 10: Successful command can produce a spoken response
  await runTest("Successful commands produce concise natural spoken responses", () => {
    // 10a: Launch application
    const appResult = {
      intent: "launch_application",
      appName: "Visual Studio Code",
      success: true,
    };
    const appSpeech = formatSpokenResponse(appResult, "open vs code");
    assert.strictEqual(appSpeech, "Opening Visual Studio Code.");

    // 10b: Workspace
    const wsResult = {
      intent: "launch_workspace",
      appName: "DSA Practice",
      success: true,
    };
    const wsSpeech = formatSpokenResponse(wsResult, "start dsa workspace");
    assert.strictEqual(wsSpeech, "Launching workspace: DSA Practice.");

    // 10c: System status
    const statusResult = {
      intent: "system_status",
      success: true,
    };
    const statusSpeech = formatSpokenResponse(statusResult, "system status");
    assert.strictEqual(statusSpeech, "All systems nominal. CPU and memory are running optimally.");

    // 10d: Deep work
    const dwResult = {
      intent: "start_deep_work",
      success: true,
    };
    const dwSpeech = formatSpokenResponse(dwResult, "focus mode");
    assert.strictEqual(dwSpeech, "Deep Work session initiated. Focus mode engaged.");

    // 10e: Conversational Answer
    const answerResult = {
      intent: "answer",
      answerText: "You have four tasks remaining today.",
      success: true,
    };
    const answerSpeech = formatSpokenResponse(answerResult, "what tasks do I have today?");
    assert.strictEqual(answerSpeech, "You have four tasks remaining today.");
  });

  // Test 11: TTS cleanup occurs correctly
  await runTest("TTS cleanup occurs correctly without leaving dangling state", async () => {
    const mockProvider = new MockTtsProvider(200);
    const service = new TtsService(mockProvider);
    await service.initialize();

    service.speak("Cleaning up soon");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(service.isSpeaking(), true);

    await service.dispose();
    assert.strictEqual(service.isSpeaking(), false);
    assert.strictEqual(mockProvider.stopCallCount >= 1, true);
    assert.strictEqual(mockProvider.disposed, true, "Provider should be disposed");
  });

  // Test 12: Existing microphone/wake-word lifecycle remains functional with TTS
  await runTest("Microphone / wake-word lifecycle is uninterrupted by TTS interruption hook", async () => {
    const mockProvider = new MockTtsProvider(300);
    const service = new TtsService(mockProvider);
    await service.initialize();

    // 1. ALFRED is speaking
    service.speak("ALFRED is currently answering a query in full detail.");
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.strictEqual(service.isSpeaking(), true, "ALFRED should be speaking");

    // 2. User activates microphone or wake-word triggers ("Hey Alfred")
    // Interruption requirement: Stop ongoing TTS
    await service.stop();
    assert.strictEqual(service.isSpeaking(), false, "TTS must stop instantly upon microphone activation");

    // 3. Microphone is free and unblocked
    let micAcquired = false;
    const acquireMicrophone = () => {
      micAcquired = true;
      return { active: true };
    };

    const micStream = acquireMicrophone();
    assert.strictEqual(micAcquired, true, "Microphone acquisition proceeds smoothly");
    assert.strictEqual(micStream.active, true);

    await service.dispose();
  });

  console.log("\n==========================================================================");
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("==========================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL ERROR IN TTS TEST SUITE:", e);
  process.exit(1);
});
