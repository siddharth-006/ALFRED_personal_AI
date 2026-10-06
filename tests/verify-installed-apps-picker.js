/**
 * ALFRED INSTALLED BUILD: APPS PICKER & WORKSPACE INTEGRATION VERIFICATION
 *
 * Target: D:\Studies\ALFRED\ALFRED.exe
 * Port: 9222 (CDP)
 */

const { spawn } = require("child_process");
const http = require("http");
const assert = require("assert");

const INSTALLED_EXE = "D:\\Studies\\ALFRED\\ALFRED.exe";
const CDP_PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }
}

async function runInstalledAppsVerification() {
  console.log("==========================================================================");
  console.log("   ALFRED INSTALLED APPLICATION: APPS & WORKSPACE LIVE VERIFICATION        ");
  console.log("==========================================================================");

  let passed = 0;
  const child = spawn(INSTALLED_EXE, [`--remote-debugging-port=${CDP_PORT}`], {
    detached: false,
    stdio: "ignore",
  });

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      try {
        targets = await getCdpTargets();
        if (targets && targets.length > 0) break;
      } catch {}
    }
    assert(targets && targets.length > 0, "Failed to connect to CDP target");

    const pageTarget = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://")) || targets[0];
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    // 1. Bypass boot screen if active
    await client.eval(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(1200);

    // 2. Check window.electron.apps API existence
    const hasAppsApi = await client.eval(`
      Boolean(window.electron && window.electron.apps && window.electron.apps.getApproved)
    `);
    console.log(`[CHECK 1] window.electron.apps API exists in installed build: ${hasAppsApi}`);
    assert.strictEqual(hasAppsApi, true);
    passed++;

    // 3. Check approved applications list from installed process
    const approvedList = await client.eval(`
      window.electron.apps.getApproved().then(list => list.map(a => a.name))
    `);
    console.log(`[CHECK 2] Approved applications retrieved: ${JSON.stringify(approvedList)}`);
    assert(Array.isArray(approvedList) && approvedList.length >= 6);
    assert(approvedList.includes("Visual Studio Code"));
    assert(approvedList.includes("Google Chrome"));
    passed++;

    // 4. Navigate to Workspaces page
    await client.eval(`window.location.href = '/workspaces'`);
    await sleep(1500);

    const workspacesLoaded = await client.eval(`
      document.body.innerText.includes("DIGITAL ENVIRONMENTS") ||
      document.body.innerText.includes("Workspaces")
    `);
    console.log(`[CHECK 3] Workspaces page active: ${workspacesLoaded}`);
    assert.strictEqual(workspacesLoaded, true);
    passed++;

    // 5. Open Create Profile modal
    await client.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Profile'));
      if (btn) btn.click();
    `);
    await sleep(600);

    const hasBrowseButton = await client.eval(`
      document.body.innerText.includes("Browse Installed Apps") ||
      document.body.innerText.includes("Browse")
    `);
    console.log(`[CHECK 4] 'Browse Installed Apps' button rendered in form: ${hasBrowseButton}`);
    assert.strictEqual(hasBrowseButton, true);
    passed++;

    // 6. Click Browse to open ApplicationPickerModal
    await client.eval(`
      const browseBtn = document.getElementById('btn-browse-installed-apps') ||
        Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Browse Installed Apps') || b.innerText.includes('Browse'));
      if (browseBtn) {
        browseBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    `);
    await sleep(1500);

    const pickerModalOpen = await client.eval(`
      document.body.innerText.includes("Windows Applications Picker") ||
      document.body.innerText.includes("WINDOWS APPLICATIONS PICKER")
    `);
    console.log(`[CHECK 5] ApplicationPickerModal opened and rendered live: ${pickerModalOpen}`);
    assert.strictEqual(pickerModalOpen, true);
    passed++;

    // 7. Verify scanning capability inside live installed app
    const scanResult = await client.eval(`
      window.electron.apps.discover().then(apps => ({
        count: apps.length,
        hasSteam: apps.some(a => a.name.toLowerCase().includes('steam')),
        steamExe: apps.find(a => a.name.toLowerCase().includes('steam'))?.executablePath,
        hasHaveloc: apps.some(a => a.name.toLowerCase().includes('haveloc')),
        havelocApp: apps.find(a => a.name.toLowerCase().includes('haveloc'))
      }))
    `);
    console.log(`[CHECK 6] Live Windows discovery: ${scanResult.count} apps found.`);
    console.log(`  - Steam discovered: ${scanResult.hasSteam} (${scanResult.steamExe})`);
    console.log(`  - Haveloc (Chrome PWA) discovered: ${scanResult.hasHaveloc}`);
    if (scanResult.havelocApp) {
      console.log(`  - Haveloc args: ${JSON.stringify(scanResult.havelocApp.arguments)}`);
      console.log(`  - Haveloc workingDir: ${scanResult.havelocApp.workingDirectory}`);
      console.log(`  - Haveloc isPWA: ${scanResult.havelocApp.isPWA}`);
    }
    assert(scanResult.count > 0, "No apps discovered");
    assert.strictEqual(scanResult.hasSteam, true, "Steam was not discovered");
    assert.strictEqual(scanResult.hasHaveloc, true, "Haveloc PWA was not discovered");
    assert(Array.isArray(scanResult.havelocApp?.arguments) && scanResult.havelocApp.arguments.length > 0, "Haveloc args were missing");
    passed++;

    // 8. Test Live Approval of Haveloc PWA and Steam
    const approvalResult = await client.eval(`
      (async () => {
        const apps = await window.electron.apps.discover();
        const haveloc = apps.find(a => a.name.toLowerCase().includes('haveloc'));
        const steam = apps.find(a => a.name === 'Steam' || a.name.toLowerCase().includes('steam'));
        let hRes = null;
        let sRes = null;
        if (haveloc) hRes = await window.electron.apps.approve(haveloc);
        if (steam) sRes = await window.electron.apps.approve(steam);
        return {
          havelocApproved: Boolean(hRes && hRes.success),
          steamApproved: Boolean(sRes && sRes.success),
          havelocStoredArgs: hRes?.app?.arguments,
          havelocStoredCwd: hRes?.app?.workingDirectory
        };
      })()
    `);
    console.log(`[CHECK 7] Live Approval test result:`, JSON.stringify(approvalResult));
    assert.strictEqual(approvalResult.havelocApproved, true, "Failed to approve Haveloc");
    assert.strictEqual(approvalResult.steamApproved, true, "Failed to approve Steam");
    assert(Array.isArray(approvalResult.havelocStoredArgs) && approvalResult.havelocStoredArgs.length > 0);
    passed++;

    // 9. Close picker modal
    await client.eval(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(500);

    console.log("==========================================================================");
    console.log(`   LIVE INSTALLED APPLICATION VERIFICATION PASSED: ${passed}/6 CHECKS   `);
    console.log("==========================================================================");
  } finally {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
}

runInstalledAppsVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
