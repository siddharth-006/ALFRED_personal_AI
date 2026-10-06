import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { providerConfigService } from "../electron/agent/providers/config/provider-config.service";
import { ollamaAIProvider } from "../electron/agent/providers/impl/ollama-ai-provider";
import { SettingsService } from "../electron/services/settings.service";
import { getUserDataDirectory, getVoiceAssetPath } from "../electron/utils/paths";

let passedCount = 0;
let failedCount = 0;

async function test(name: string, fn: () => Promise<void> | void) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passedCount++;
    } catch (err: any) {
        console.error(`  [FAIL] ${name}: ${err?.message || err}`);
        failedCount++;
    }
}

async function run() {
    console.log("==========================================================");
    console.log("   ALFRED INSTALLED BUILD HARDENING & BUG FIX REGRESSION  ");
    console.log("==========================================================");

    // -------------------------------------------------------------------------
    // BUG 1: Startup & Onboarding Lifecycle Persistence
    // -------------------------------------------------------------------------
    await test("Bug 1.1: getUserDataDirectory returns stable path in AppData across environments", () => {
        const dir = getUserDataDirectory();
        assert.ok(dir, "userData directory must be non-empty");
        assert.ok(fs.existsSync(dir), "userData directory must exist on disk");
        assert.ok(!dir.includes("Program Files"), "userData directory must not be in read-only Program Files");
    });

    await test("Bug 1.2: SettingsService persists onboarding state correctly to disk", () => {
        const settingsService = SettingsService.getInstance();
        const settings = settingsService.getSettings();
        assert.ok(settings.onboarding, "Onboarding section must exist in settings");

        settingsService.updateSettings({
            onboarding: {
                completed: true,
                completedAt: new Date().toISOString(),
            },
        });

        const reloaded = settingsService.loadFromDisk();
        assert.strictEqual(reloaded.onboarding.completed, true, "Onboarding must persist completed: true");
    });

    await test("Bug 1.3: Deep merge in SettingsService preserves onboarding across unrelated updates", () => {
        const settingsService = SettingsService.getInstance();
        settingsService.updateSettings({
            voice: { enabled: true, language: "en" }
        });
        const current = settingsService.getSettings();
        assert.strictEqual(current.onboarding.completed, true, "Onboarding completed must remain true");
    });

    // -------------------------------------------------------------------------
    // BUG 2: Ollama Status & Availability
    // -------------------------------------------------------------------------
    await test("Bug 2.1: Ollama provider is enabled by default in ProviderConfigService", () => {
        const status = providerConfigService.getProviderStatus("ollama");
        assert.strictEqual(status.providerId, "ollama");
        assert.strictEqual(status.enabled, true, "Ollama must be marked enabled by default");
        assert.notStrictEqual(status.status, "disabled", "Ollama status must not be disabled");
    });

    await test("Bug 2.2: Ollama endpoint defaults to http://127.0.0.1:11434 to avoid IPv6 issues", () => {
        const config = ollamaAIProvider.getEffectiveClientConfig();
        assert.ok(
            config.endpointUrl.includes("127.0.0.1") || config.endpointUrl.includes("localhost"),
            "Ollama endpoint must point to local loopback"
        );
        assert.strictEqual(config.modelName, "qwen3:latest", "Default model must be qwen3:latest");
    });

    await test("Bug 2.3: ProviderConfigService reset preserves enabled state for Ollama", () => {
        providerConfigService.reset();
        const status = providerConfigService.getProviderStatus("ollama");
        assert.strictEqual(status.enabled, true, "Reset must keep Ollama enabled");
        assert.notStrictEqual(status.status, "disabled", "Reset must not disable Ollama");
    });

    await test("Bug 2.4: Active provider sync in SettingsService propagates to ProviderConfigService", () => {
        const settingsService = SettingsService.getInstance();
        settingsService.updateSettings({
            aiProvider: {
                activeProvider: "ollama",
                temperature: 0.7,
                hasConfiguredApiKey: true,
            }
        });
        assert.strictEqual(
            providerConfigService.getActiveProviderId(),
            "ollama",
            "ProviderConfigService active provider must be synced with SettingsService"
        );
    });

    // -------------------------------------------------------------------------
    // BUG 3: Wake Word Detection Assets & Pipeline
    // -------------------------------------------------------------------------
    await test("Bug 3.1: getVoiceAssetPath resolves real unpacked files outside app.asar", () => {
        const wakeScript = getVoiceAssetPath("wake_word_server.py");
        assert.ok(wakeScript, "wake_word_server.py path must be resolved");
        assert.ok(fs.existsSync(wakeScript), "wake_word_server.py must exist on disk");
        assert.ok(!wakeScript.includes("app.asar\\") && !wakeScript.includes("app.asar/"), "Script path must not be inside app.asar");

        const modelFile = getVoiceAssetPath("hey_alfred.tflite");
        assert.ok(modelFile, "hey_alfred.tflite path must be resolved");
        assert.ok(fs.existsSync(modelFile), "hey_alfred.tflite must exist on disk");
        assert.ok(!modelFile.includes("app.asar\\") && !modelFile.includes("app.asar/"), "Model path must not be inside app.asar");
    });

    await test("Bug 3.2: hey_alfred.tflite model file is non-empty and accessible", () => {
        const modelFile = getVoiceAssetPath("hey_alfred.tflite");
        const stats = fs.statSync(modelFile);
        assert.ok(stats.size > 50000, `Model file size (${stats.size} bytes) must be substantial`);
    });

    await test("Bug 3.3: wake_word_server.py Python script contains robust openwakeword logic", () => {
        const scriptPath = getVoiceAssetPath("wake_word_server.py");
        const content = fs.readFileSync(scriptPath, "utf-8");
        assert.ok(content.includes("openwakeword"), "Script must import openwakeword");
        assert.ok(content.includes("hey_alfred"), "Script must reference hey_alfred model");
        assert.ok(content.includes("predict"), "Script must implement predict protocol");
    });

    console.log(`\nResults: ${passedCount} passed, ${failedCount} failed\n`);
    if (failedCount > 0) {
        process.exit(1);
    }
}

run().catch((err) => {
    console.error("Test runner encountered fatal error:", err);
    process.exit(1);
});
