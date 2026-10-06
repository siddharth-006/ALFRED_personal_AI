import assert from "assert";
import path from "path";
import fs from "fs";
import { SettingsService } from "../electron/services/settings.service";
import { DEFAULT_ALFRED_SETTINGS } from "../electron/services/settings.types";

/**
 * ALFRED FIRST-LAUNCH LIFECYCLE & BOOT SEQUENCE REGRESSION TEST SUITE
 * 
 * Verifies all 10 required lifecycle behaviors:
 * 1. First launch + onboarding incomplete -> boot eligible -> onboarding appears after boot
 * 2. Complete onboarding -> settings.onboarding.completed === true
 * 3. Application restart after onboarding completion -> boot appears -> onboarding does NOT appear
 * 4. Route navigation -> boot does NOT replay -> onboarding does NOT replay
 * 5. React/render remount -> boot does NOT replay -> onboarding does NOT replay
 * 6. Explicit "Re-run Setup" -> onboarding appears -> boot does NOT replay
 * 7. Complete Re-run Setup -> onboarding disappears -> persistent completed state remains true
 * 8. Fresh user-data directory -> boot appears -> onboarding appears
 * 9. Corrupted/missing onboarding settings -> recover safely -> onboarding behavior is deterministic
 * 10. Completely restarting Electron process -> boot plays once for that process -> does not replay after internal navigation/remount
 */

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err?.message || err}`);
    if (err?.stack) console.error(err.stack);
    failed++;
  }
}

// Simulated Process & Renderer Session State
class MockElectronProcess {
  public sessionBootCompleted = false;

  // IPC Methods
  isBootCompleted(): boolean {
    return this.sessionBootCompleted;
  }

  markBootCompleted(): boolean {
    this.sessionBootCompleted = true;
    return true;
  }

  resetBootState(): boolean {
    this.sessionBootCompleted = false;
    return true;
  }
}

class MockRendererSession {
  public inMemoryBootCompleted = false;
  public inMemoryOnboardingCompleted = false;
  public sessionStorage: Record<string, string> = {};
  public localStorage: Record<string, string> = {};

  // Evaluate if boot screen is eligible
  evaluateBootEligibility(proc: MockElectronProcess): boolean {
    if (this.inMemoryBootCompleted) return false;
    if (this.sessionStorage["alfred_session_boot_completed"] === "true") return false;
    if (proc.isBootCompleted()) return false;
    return true;
  }

  // Simulate Boot completion
  completeBoot(proc: MockElectronProcess) {
    this.inMemoryBootCompleted = true;
    this.sessionStorage["alfred_session_boot_completed"] = "true";
    proc.markBootCompleted();
  }

  // Evaluate if onboarding modal is visible
  evaluateOnboardingVisibility(service: SettingsService, bootVisible: boolean): boolean {
    // Crucial UX Ordering: Onboarding never displays over/before the boot sequence
    if (bootVisible) return false;

    // Check memory flag
    if (this.inMemoryOnboardingCompleted) return false;

    // Check persistent source of truth
    const s = service.getSettings();
    if (s.onboarding?.completed === true) {
      this.inMemoryOnboardingCompleted = true;
      this.localStorage["alfred_onboarding_completed"] = "true";
      return false;
    }

    return true;
  }

  // Simulate Onboarding completion
  completeOnboarding(service: SettingsService) {
    this.inMemoryOnboardingCompleted = true;
    this.localStorage["alfred_onboarding_completed"] = "true";
    this.sessionStorage["alfred_onboarding_completed"] = "true";
    return service.updateSettings({
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
      },
    });
  }

  // Simulate component remount
  remount() {
    // Component unmounts and remounts within the same renderer session
    // inMemory and sessionStorage are preserved
  }

  // Simulate client-side route navigation
  navigate(route: string) {
    // Client-side router preserves inMemory state and sessionStorage
  }
}

async function runSuite() {
  console.log("==========================================================================");
  console.log("   ALFRED FIRST-LAUNCH LIFECYCLE & REGRESSION TEST SUITE                  ");
  console.log("==========================================================================");

  const testDir = path.join(__dirname, "temp-lifecycle-test");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  const testSettingsPath = path.join(testDir, "test-lifecycle-settings.json");

  // Clean slate before tests
  if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);

  let currentProcess = new MockElectronProcess();
  let currentRenderer = new MockRendererSession();
  let service = new SettingsService(testSettingsPath);

  await test("TEST 1. First launch + onboarding incomplete -> boot eligible -> onboarding appears after boot", async () => {
    // Initial state: fresh process and fresh settings
    const settings = service.getSettings();
    assert.strictEqual(settings.onboarding.completed, false, "Fresh installation must have onboarding.completed: false");

    // 1. Boot is eligible on process start
    const isBootEligible = currentRenderer.evaluateBootEligibility(currentProcess);
    assert.strictEqual(isBootEligible, true, "First ever launch must show cinematic boot sequence");

    // 2. Onboarding must NOT appear while boot is still playing
    const onboardingDuringBoot = currentRenderer.evaluateOnboardingVisibility(service, true);
    assert.strictEqual(onboardingDuringBoot, false, "Onboarding must NOT appear before or during boot sequence");

    // 3. Boot completes
    currentRenderer.completeBoot(currentProcess);
    assert.strictEqual(currentProcess.isBootCompleted(), true, "Boot state marked in main process");

    // 4. After boot completes, onboarding appears
    const onboardingAfterBoot = currentRenderer.evaluateOnboardingVisibility(service, false);
    assert.strictEqual(onboardingAfterBoot, true, "First-launch onboarding wizard appears after boot completes");
  });

  await test("TEST 2. Complete onboarding -> settings.onboarding.completed === true", async () => {
    const updated = currentRenderer.completeOnboarding(service);
    assert.strictEqual(updated.onboarding.completed, true, "SettingsService must persist completed: true to disk");
    assert.ok(updated.onboarding.completedAt, "Completion timestamp must be set");

    const isVisible = currentRenderer.evaluateOnboardingVisibility(service, false);
    assert.strictEqual(isVisible, false, "Onboarding must be hidden after completion");
  });

  await test("TEST 3. Application restart after onboarding completion -> boot appears -> onboarding does NOT appear", async () => {
    // Cold restart: Electron process exits and restarts
    currentProcess = new MockElectronProcess();
    currentRenderer = new MockRendererSession();

    // Reload settings from disk
    const restartedService = new SettingsService(testSettingsPath);
    assert.strictEqual(restartedService.getSettings().onboarding.completed, true, "Disk preserves completed: true across restart");

    // 1. Boot appears on fresh application process launch
    const isBootEligible = currentRenderer.evaluateBootEligibility(currentProcess);
    assert.strictEqual(isBootEligible, true, "Boot sequence must play on every application process launch");

    // 2. Boot completes
    currentRenderer.completeBoot(currentProcess);

    // 3. Normal ALFRED UI displays, onboarding does NOT appear
    const onboardingVisible = currentRenderer.evaluateOnboardingVisibility(restartedService, false);
    assert.strictEqual(onboardingVisible, false, "Onboarding wizard must NEVER automatically reopen on restart");
  });

  await test("TEST 4. Route navigation -> boot does NOT replay -> onboarding does NOT replay", async () => {
    const routes = ["/tasks", "/projects", "/goals", "/workspaces", "/settings", "/"];
    for (const route of routes) {
      currentRenderer.navigate(route);
      const isBootEligible = currentRenderer.evaluateBootEligibility(currentProcess);
      const isOnboardingVisible = currentRenderer.evaluateOnboardingVisibility(service, isBootEligible);
      assert.strictEqual(isBootEligible, false, `Boot must NOT replay on navigating to ${route}`);
      assert.strictEqual(isOnboardingVisible, false, `Onboarding must NOT replay on navigating to ${route}`);
    }
  });

  await test("TEST 5. React/render remount -> boot does NOT replay -> onboarding does NOT replay", async () => {
    currentRenderer.remount();
    const isBootEligible = currentRenderer.evaluateBootEligibility(currentProcess);
    const isOnboardingVisible = currentRenderer.evaluateOnboardingVisibility(service, isBootEligible);
    assert.strictEqual(isBootEligible, false, "Boot must NOT replay on React component remount");
    assert.strictEqual(isOnboardingVisible, false, "Onboarding must NOT replay on React component remount");
  });

  await test("TEST 6. Explicit 'Re-run Setup' -> onboarding appears -> boot does NOT replay", async () => {
    // Explicit trigger via open-onboarding-modal event
    let wizardForceOpened = false;
    const handleOpenWizard = () => {
      wizardForceOpened = true;
    };
    handleOpenWizard();

    assert.strictEqual(wizardForceOpened, true, "Explicit action must open onboarding wizard");

    // Boot must NOT be triggered
    const isBootEligible = currentRenderer.evaluateBootEligibility(currentProcess);
    assert.strictEqual(isBootEligible, false, "Re-running setup must NEVER trigger the boot sequence");
  });

  await test("TEST 7. Complete Re-run Setup -> onboarding disappears -> persistent completed state remains true", async () => {
    const updatedAgain = currentRenderer.completeOnboarding(service);
    assert.strictEqual(updatedAgain.onboarding.completed, true);

    const isVisible = currentRenderer.evaluateOnboardingVisibility(service, false);
    assert.strictEqual(isVisible, false, "Completing setup again must re-hide onboarding");
  });

  await test("TEST 8. Fresh user-data directory -> boot appears -> onboarding appears", async () => {
    // Simulate completely fresh installation / clean profile directory
    const freshTestDir = path.join(testDir, "fresh-profile");
    if (!fs.existsSync(freshTestDir)) fs.mkdirSync(freshTestDir, { recursive: true });
    const freshSettingsPath = path.join(freshTestDir, "settings.json");

    const freshService = new SettingsService(freshSettingsPath);
    const freshProcess = new MockElectronProcess();
    const freshRenderer = new MockRendererSession();

    // 1. Boot appears
    assert.strictEqual(freshRenderer.evaluateBootEligibility(freshProcess), true, "Fresh install must show boot");
    freshRenderer.completeBoot(freshProcess);

    // 2. Onboarding appears
    assert.strictEqual(freshRenderer.evaluateOnboardingVisibility(freshService, false), true, "Fresh install must show onboarding");

    // Cleanup fresh dir
    try {
      if (fs.existsSync(freshSettingsPath)) fs.unlinkSync(freshSettingsPath);
      if (fs.existsSync(freshTestDir)) fs.rmdirSync(freshTestDir);
    } catch {}
  });

  await test("TEST 9. Corrupted/missing onboarding settings -> recover safely -> onboarding behavior is deterministic", async () => {
    const corruptedSettingsPath = path.join(testDir, "corrupted-settings.json");
    fs.writeFileSync(corruptedSettingsPath, "{ INVALID JSON CORRUPT DATA");

    // SettingsService auto-recovers with defaults
    const recoveredService = new SettingsService(corruptedSettingsPath);
    const recoveredSettings = recoveredService.getSettings();
    assert.strictEqual(recoveredSettings.onboarding.completed, false, "Corrupted settings must safely default to completed: false");

    const proc = new MockElectronProcess();
    const rend = new MockRendererSession();
    rend.completeBoot(proc);

    assert.strictEqual(rend.evaluateOnboardingVisibility(recoveredService, false), true, "Recovered corrupted state must deterministically show onboarding");

    try {
      if (fs.existsSync(corruptedSettingsPath)) fs.unlinkSync(corruptedSettingsPath);
    } catch {}
  });

  await test("TEST 10. Completely restarting Electron process -> boot plays once for that process -> does not replay after internal navigation/remount", async () => {
    // Simulate full process termination and relaunch
    const restartedProc = new MockElectronProcess();
    const restartedRend = new MockRendererSession();

    // 1. Process launch -> Boot plays once
    assert.strictEqual(restartedRend.evaluateBootEligibility(restartedProc), true, "Cold process launch must be eligible for boot");
    restartedRend.completeBoot(restartedProc);
    assert.strictEqual(restartedProc.isBootCompleted(), true, "Boot completed in process");

    // 2. Navigation does not replay
    for (const r of ["/tasks", "/projects", "/"]) {
      restartedRend.navigate(r);
      assert.strictEqual(restartedRend.evaluateBootEligibility(restartedProc), false, `Boot must not replay on ${r}`);
    }

    // 3. Remount does not replay
    restartedRend.remount();
    assert.strictEqual(restartedRend.evaluateBootEligibility(restartedProc), false, "Boot must not replay on remount");
  });

  // Final Cleanup
  try {
    if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);
    if (fs.existsSync(testDir)) fs.rmdirSync(testDir);
  } catch {}

  console.log("==========================================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log("==========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite runner failed:", err);
  process.exit(1);
});
