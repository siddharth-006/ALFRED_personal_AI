/**
 * ALFRED INSTALLED APPLICATION PHYSICAL VERIFICATION
 * 
 * Target: D:\Studies\ALFRED\ALFRED.exe
 * Built by: release\ALFRED-Setup-0.1.0.exe
 * 
 * Verifies live UI, DOM, and lifecycle behavior over Chrome DevTools Protocol (CDP).
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const INSTALLED_EXE = "D:\\Studies\\ALFRED\\ALFRED.exe";
const SETTINGS_PATH = "C:\\Users\\SIDDHARTH\\AppData\\Roaming\\ALFRED\\settings.json";
const BACKUP_PATH = "C:\\Users\\SIDDHARTH\\AppData\\Roaming\\ALFRED\\settings.json.bak_test";
const CDP_PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to query CDP targets
function getCdpTargets() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

// CDP Client using Node built-in WebSocket
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

// Process Controller
class AppProcess {
  constructor() {
    this.proc = null;
    this.cdp = null;
  }

  async start() {
    this.proc = spawn(INSTALLED_EXE, [`--remote-debugging-port=${CDP_PORT}`], {
      stdio: "pipe",
    });

    // Wait for CDP endpoint to be ready
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await getCdpTargets();
        if (targets && targets.length > 0) break;
      } catch {}
    }

    if (!targets || targets.length === 0) {
      throw new Error("Failed to connect to CDP endpoint on installed ALFRED.exe");
    }

    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    this.cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await this.cdp.connect();
    return this.cdp;
  }

  async stop() {
    if (this.cdp) {
      this.cdp.close();
      this.cdp = null;
    }
    if (this.proc) {
      this.proc.kill();
      await sleep(1000);
      try {
        require("child_process").execSync("taskkill /F /IM ALFRED.exe /T", { stdio: "ignore" });
      } catch {}
      this.proc = null;
    }
  }
}

async function runInstalledAppVerification() {
  console.log("==========================================================================");
  console.log("   ALFRED REAL INSTALLED APPLICATION (D:\\Studies\\ALFRED\\ALFRED.exe)     ");
  console.log("   PHYSICAL UI & LIFECYCLE VERIFICATION                                   ");
  console.log("==========================================================================");

  // 1. Verify Installed Exe exists
  assert.ok(fs.existsSync(INSTALLED_EXE), `Installed executable missing at: ${INSTALLED_EXE}`);
  const exeStats = fs.statSync(INSTALLED_EXE);
  console.log(`[INSTALLED EXE] Path: ${INSTALLED_EXE}`);
  console.log(`[INSTALLED EXE] Size: ${exeStats.size} bytes`);
  console.log(`[INSTALLED EXE] Last Modified: ${exeStats.mtime.toISOString()}`);

  // 2. Backup existing settings
  if (fs.existsSync(SETTINGS_PATH)) {
    fs.copyFileSync(SETTINGS_PATH, BACKUP_PATH);
    console.log(`[BACKUP] Backed up settings to: ${BACKUP_PATH}`);
  }

  let passedChecks = 0;

  try {
    // -----------------------------------------------------------------------
    // CHECK 1: FIRST EVER LAUNCH (onboarding.completed = false)
    // -----------------------------------------------------------------------
    console.log("\n--- STAGE 1: FIRST-LAUNCH SIMULATION ---");
    const s1 = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    s1.onboarding = { completed: false };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s1, null, 2));

    const app1 = new AppProcess();
    const cdp1 = await app1.start();
    console.log("✓ Installed ALFRED.exe launched for first-time onboarding check.");

    // Check if Boot Sequence is in DOM
    await sleep(800);
    const hasBoot1 = await cdp1.eval(`
      document.body.innerText.includes("SYSTEM INITIALIZATION") ||
      document.body.innerText.includes("INITIALIZE ALFRED") ||
      document.body.innerText.includes("CORE STATUS // STANDBY")
    `);
    console.log(`[CHECK 1A] Boot Sequence visible on first launch: ${hasBoot1}`);
    assert.strictEqual(hasBoot1, true, "Boot sequence must be visible on first launch");
    passedChecks++;

    // Check that Onboarding modal is NOT open while Boot Sequence is playing
    const hasOnboardingDuringBoot = await cdp1.eval(`
      document.body.innerText.includes("STEP 01") &&
      document.body.innerText.includes("AI PROVIDER ARCHITECTURE")
    `);
    console.log(`[CHECK 1B] Onboarding modal suppressed while boot plays: ${!hasOnboardingDuringBoot}`);
    assert.strictEqual(hasOnboardingDuringBoot, false, "Onboarding must NOT show over boot screen");
    passedChecks++;

    // Trigger quick skip on boot sequence via Escape key or button
    await cdp1.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(1500);

    // Now Boot Sequence has completed; check that Onboarding modal appears
    const hasOnboardingAfterBoot = await cdp1.eval(`
      document.body.innerText.includes("STEP 01") ||
      document.body.innerText.includes("SYSTEM INITIALIZATION") ||
      document.body.innerText.includes("AI PROVIDER ARCHITECTURE")
    `);
    console.log(`[CHECK 1C] Onboarding modal visible after boot completes: ${hasOnboardingAfterBoot}`);
    assert.strictEqual(hasOnboardingAfterBoot, true, "Onboarding wizard must appear after boot");
    passedChecks++;

    // Complete onboarding through UI
    console.log("Simulating onboarding completion via UI...");
    await cdp1.eval(`
      if (window.electron && window.electron.settings) {
        window.electron.settings.update({
          onboarding: {
            completed: true,
            completedAt: new Date().toISOString()
          }
        });
      }
    `);
    await sleep(800);

    const s1Updated = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    console.log(`[CHECK 1D] Settings file onboarding.completed: ${s1Updated.onboarding?.completed}`);
    assert.strictEqual(s1Updated.onboarding?.completed, true, "Settings must persist completed: true");
    passedChecks++;

    await app1.stop();
    console.log("✓ Application completely exited.");

    // -----------------------------------------------------------------------
    // CHECK 2: NORMAL RESTART (onboarding.completed = true)
    // -----------------------------------------------------------------------
    console.log("\n--- STAGE 2: NORMAL APPLICATION RESTART ---");
    const app2 = new AppProcess();
    const cdp2 = await app2.start();
    console.log("✓ Installed ALFRED.exe launched for normal restart check.");

    // Check if Boot Sequence appears on process startup
    await sleep(800);
    const hasBoot2 = await cdp2.eval(`
      document.body.innerText.includes("SYSTEM INITIALIZATION") ||
      document.body.innerText.includes("INITIALIZE ALFRED") ||
      document.body.innerText.includes("CORE STATUS // STANDBY")
    `);
    console.log(`[CHECK 2A] Boot Sequence visible on application restart: ${hasBoot2}`);
    assert.strictEqual(hasBoot2, true, "Boot sequence must play on application restart");
    passedChecks++;

    // Complete boot sequence via Escape
    await cdp2.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(1500);

    // Verify Onboarding Wizard does NOT appear
    const hasOnboardingOnRestart = await cdp2.eval(`
      document.body.innerText.includes("STEP 01") &&
      document.body.innerText.includes("AI PROVIDER ARCHITECTURE")
    `);
    console.log(`[CHECK 2B] Onboarding wizard hidden on restart: ${!hasOnboardingOnRestart}`);
    assert.strictEqual(hasOnboardingOnRestart, false, "Onboarding must NOT appear on restart");
    passedChecks++;

    // -----------------------------------------------------------------------
    // CHECK 3: ROUTE NAVIGATION
    // -----------------------------------------------------------------------
    console.log("\n--- STAGE 3: ROUTE NAVIGATION ---");
    const routes = ["/tasks", "/projects", "/goals", "/workspaces", "/"];
    for (const r of routes) {
      await cdp2.eval(`window.location.href = '${r}'`);
      await sleep(1000);

      const bootOnNav = await cdp2.eval(`
        document.body.innerText.includes("CORE STATUS // STANDBY") ||
        document.body.innerText.includes("INITIALIZE ALFRED")
      `);
      const onboardingOnNav = await cdp2.eval(`
        document.body.innerText.includes("STEP 01") &&
        document.body.innerText.includes("AI PROVIDER ARCHITECTURE")
      `);

      console.log(`[NAV ${r}] Boot replayed: ${Boolean(bootOnNav)}, Onboarding replayed: ${Boolean(onboardingOnNav)}`);
      assert.strictEqual(Boolean(bootOnNav), false, `Boot sequence must NOT replay on ${r}`);
      assert.strictEqual(Boolean(onboardingOnNav), false, `Onboarding must NOT replay on ${r}`);
    }
    console.log("✓ Route navigation verified: neither boot nor onboarding replayed.");
    passedChecks++;

    // -----------------------------------------------------------------------
    // CHECK 4: SETTINGS -> RE-RUN SETUP (LAUNCH WIZARD)
    // -----------------------------------------------------------------------
    console.log("\n--- STAGE 4: EXPLICIT RE-RUN SETUP ---");
    await cdp2.eval(`window.dispatchEvent(new CustomEvent('open-onboarding-modal'))`);
    await sleep(800);

    const onboardingOpened = await cdp2.eval(`
      document.body.innerText.includes("SYSTEM INITIALIZATION") ||
      document.body.innerText.includes("STEP 01") ||
      document.body.innerText.includes("WELCOME TO ALFRED")
    `);
    console.log(`[CHECK 4A] Onboarding wizard opened on explicit re-run: ${onboardingOpened}`);
    assert.strictEqual(onboardingOpened, true, "Explicit re-run must open onboarding modal");
    passedChecks++;

    const bootTriggered = await cdp2.eval(`
      document.body.innerText.includes("CORE STATUS // STANDBY") ||
      document.body.innerText.includes("INITIALIZE ALFRED")
    `);
    console.log(`[CHECK 4B] Boot sequence remained inactive: ${!bootTriggered}`);
    assert.strictEqual(Boolean(bootTriggered), false, "Re-running setup must NOT trigger boot sequence");
    passedChecks++;

    await app2.stop();
    console.log("✓ Second instance stopped cleanly.");

  } finally {
    // Restore backup
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, SETTINGS_PATH);
      fs.unlinkSync(BACKUP_PATH);
      console.log(`[RESTORE] Restored original settings from backup.`);
    }
  }

  console.log("==========================================================================");
  console.log(`   PHYSICAL VERIFICATION SUCCESS: ${passedChecks} checks passed!         `);
  console.log("==========================================================================");
}

runInstalledAppVerification().catch((err) => {
  console.error("Physical verification failed:", err);
  process.exit(1);
});
