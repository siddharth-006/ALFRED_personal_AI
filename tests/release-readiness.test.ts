import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { DEFAULT_ALFRED_SETTINGS } from "../electron/services/settings.types";
import { SettingsService } from "../electron/services/settings.service";
import { toolRegistry } from "../electron/agent/tools/tool-registry";
import { registerDefaultTools } from "../electron/agent/tools";

async function runReleaseReadinessTests() {
    console.log("==========================================================");
    console.log("   ALFRED RELEASE READINESS & PRODUCTIZATION TEST SUITE   ");
    console.log("==========================================================\n");

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => void | Promise<void>) {
        try {
            await fn();
            console.log(`  [PASS] ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`  [FAIL] ${name}: ${err?.message}`);
            if (err?.stack) console.error(err.stack);
            failed++;
        }
    }

    const testDir = path.join(process.cwd(), ".alfred-release-test");
    const testSettingsPath = path.join(testDir, "settings.json");

    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    registerDefaultTools();

    // Test 1: Onboarding Settings Schema
    await test("1. Settings schema includes onboarding configuration with correct defaults", () => {
        assert.ok(DEFAULT_ALFRED_SETTINGS.onboarding, "Onboarding object must exist in default settings");
        assert.strictEqual(DEFAULT_ALFRED_SETTINGS.onboarding.completed, false, "Onboarding must default to false");
    });

    // Test 2: SettingsService Load & Update
    await test("2. SettingsService loads onboarding state and saves updates cleanly", () => {
        const service = new SettingsService(testSettingsPath);
        const initial = service.getSettings();
        assert.strictEqual(initial.onboarding.completed, false);

        const updated = service.updateSettings({
            onboarding: {
                completed: true,
                completedAt: new Date().toISOString(),
            },
        });
        assert.strictEqual(updated.onboarding.completed, true);
        assert.ok(updated.onboarding.completedAt);

        // Reload from disk to verify persistence
        const reloadedService = new SettingsService(testSettingsPath);
        const reloaded = reloadedService.getSettings();
        assert.strictEqual(reloaded.onboarding.completed, true);
    });

    // Test 3: Deep Merge Safety
    await test("3. Deep merge in updateSettings preserves other sections when updating partial settings", () => {
        const service = new SettingsService(testSettingsPath);
        assert.strictEqual(service.getSettings().voice.language, "en");

        const updated = service.updateSettings({
            voice: {
                enabled: false,
                language: "en",
            },
        });
        assert.strictEqual(updated.voice.enabled, false);
        assert.strictEqual(updated.voice.language, "en");
        assert.strictEqual(updated.onboarding.completed, true); // Onboarding preserved
    });

    // Test 4: Corrupted Persistence Recovery
    await test("4. Corrupted settings recovery preserves valid default onboarding state", () => {
        fs.writeFileSync(testSettingsPath, "{ corrupted json !!!", "utf-8");
        const service = new SettingsService(testSettingsPath);
        const recovered = service.getSettings();
        assert.strictEqual(recovered.onboarding.completed, false);
        assert.strictEqual(recovered.aiProvider.activeProvider, "mock");
    });

    // Test 5: Packaging & Installer Configuration
    await test("5. Package.json electron-builder configuration meets production installer standards", () => {
        const pkgPath = path.join(process.cwd(), "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

        assert.ok(pkg.build, "build configuration must exist");
        assert.strictEqual(pkg.build.appId, "com.alfred.app");
        assert.strictEqual(pkg.build.productName, "ALFRED");

        // NSIS configuration
        assert.ok(pkg.build.nsis, "NSIS configuration must exist");
        assert.strictEqual(pkg.build.nsis.deleteAppDataOnUninstall, false, "Must preserve user data");
        assert.strictEqual(pkg.build.nsis.createDesktopShortcut, "always");
        assert.strictEqual(pkg.build.nsis.createStartMenuShortcut, true);
        assert.strictEqual(pkg.build.nsis.shortcutName, "ALFRED");

        // Targets include NSIS and Portable x64
        const winTargets = pkg.build.win.target;
        const targetNames = winTargets.map((t: any) => (typeof t === "string" ? t : t.target));
        assert.ok(targetNames.includes("nsis"), "Must target NSIS installer");
        assert.ok(targetNames.includes("portable"), "Must target Portable");

        // Files packaged
        assert.ok(pkg.build.files.includes("dist-electron/**/*"));
        assert.ok(pkg.build.files.includes("out/**/*"));
        assert.ok(pkg.build.files.includes("package.json"));
        assert.ok(!pkg.build.files.includes("tests/**/*"), "Must not package test files");
        assert.ok(!pkg.build.files.includes(".env"), "Must not package .env files");
    });

    // Test 6: Icon Assets
    await test("6. Production icon assets exist and meet size requirements", () => {
        const buildIcon = path.join(process.cwd(), "build", "icon.ico");
        const publicFavicon = path.join(process.cwd(), "public", "favicon.ico");

        assert.ok(fs.existsSync(buildIcon), "build/icon.ico must exist");
        assert.ok(fs.existsSync(publicFavicon), "public/favicon.ico must exist");

        const buildIconStats = fs.statSync(buildIcon);
        const publicFaviconStats = fs.statSync(publicFavicon);

        assert.ok(buildIconStats.size > 10000, "build/icon.ico must be a real high-res icon > 10KB");
        assert.ok(publicFaviconStats.size > 10000, "public/favicon.ico must be a real high-res icon > 10KB");
    });

    // Test 7: Voice Worker Assets
    await test("7. Voice worker assets are staged in dist-electron/voice/", () => {
        const distVoiceDir = path.join(process.cwd(), "dist-electron", "voice");
        assert.ok(fs.existsSync(distVoiceDir), "dist-electron/voice directory must exist");

        const requiredFiles = [
            "wake_word_server.py",
            "whisper_server.py",
            "tts_worker.ps1",
            "hey_alfred.tflite",
        ];

        for (const f of requiredFiles) {
            const p = path.join(distVoiceDir, f);
            assert.ok(fs.existsSync(p), `Missing worker asset: ${f}`);
            assert.ok(fs.statSync(p).size > 0, `Worker asset is empty: ${f}`);
        }
    });

    // Test 8: Security Boundary
    await test("8. Security: ToolRegistry remains the exclusive execution authority", () => {
        assert.strictEqual(toolRegistry.has("launch_application"), true);
        assert.strictEqual(toolRegistry.has("launch_workspace"), true);
        assert.strictEqual(toolRegistry.has("create_task"), true);
        assert.strictEqual(toolRegistry.has("create_goal"), true);
        assert.strictEqual(toolRegistry.has("update_project"), true);

        // Verify arbitrary execution tools are NOT registered
        assert.strictEqual(toolRegistry.has("exec_shell"), false);
        assert.strictEqual(toolRegistry.has("eval"), false);
        assert.strictEqual(toolRegistry.has("run_powershell_arbitrary"), false);
    });

    // Test 9: Documentation
    await test("9. Professional documentation files exist and are populated", () => {
        const readmePath = path.join(process.cwd(), "README.md");
        const demoPath = path.join(process.cwd(), "DEMO_WALKTHROUGH.md");

        assert.ok(fs.existsSync(readmePath), "README.md must exist");
        assert.ok(fs.existsSync(demoPath), "DEMO_WALKTHROUGH.md must exist");

        const readmeContent = fs.readFileSync(readmePath, "utf-8");
        const demoContent = fs.readFileSync(demoPath, "utf-8");

        assert.ok(readmeContent.includes("ALFRED"), "README must document ALFRED");
        assert.ok(readmeContent.includes("Architecture Overview"), "README must document Architecture");
        assert.ok(readmeContent.includes("ToolRegistry"), "README must document ToolRegistry");
        assert.ok(readmeContent.includes("Windows Production Installer"), "README must document Windows installer");

        assert.ok(demoContent.includes("Executive Demonstration"), "DEMO must document showcase flow");
        assert.ok(demoContent.includes("Step 1: System Boot & First-Launch Onboarding"));
        assert.ok(demoContent.includes("Step 4: Multi-Step Objective"));
    });

    // Cleanup
    try {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    } catch {}

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runReleaseReadinessTests().catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
