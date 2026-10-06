const { spawn } = require("child_process");
const http = require("http");

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

async function reproduce() {
  console.log("Launching installed ALFRED.exe...");
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

    if (!targets || targets.length === 0) {
      throw new Error("Could not connect to CDP targets on port " + CDP_PORT);
    }

    const pageTarget = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://")) || targets[0];
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    console.log("Connected to ALFRED CDP!");

    // 1. Dismiss boot screen / escape
    await client.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(2000);

    // 2. Navigate to Workspaces
    await client.eval(`window.location.href = '/workspaces';`);
    await sleep(2000);

    // 3. Open Create Profile Modal
    await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Profile'));
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);

    // 4. Click Browse Installed Apps
    const browseClicked = await client.eval(`
      (() => {
        const browseBtn = document.getElementById('btn-browse-installed-apps') ||
          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Browse Installed Apps') || b.innerText.includes('Browse'));
        if (browseBtn) {
          browseBtn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log("Browse button clicked:", browseClicked);
    await sleep(2000);

    // Check modal title
    const modalText = await client.eval(`
      (() => {
        const title = Array.from(document.querySelectorAll('h3')).map(h => h.innerText);
        return title;
      })()
    `);
    console.log("Modal titles on screen:", modalText);

    // 5. Inspect what is in the ApplicationPickerModal on OPEN (WITHOUT CLICKING SCAN!)
    const initialApps = await client.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('All (') || b.innerText.includes('Approved (') || b.innerText.includes('Available (')).map(b => b.innerText);
        return { items, tabs };
      })()
    `);
    console.log("--- INITIAL MODAL STATE (BEFORE SCANNING) ---");
    console.log("Tabs:", initialApps.tabs);
    console.log("Visible app items count:", initialApps.items.length);
    console.log("Visible app names:", initialApps.items);

    // Check if Steam is in initial list
    const hasSteamInitial = initialApps.items.some(n => n.toLowerCase().includes('steam'));
    console.log("Is Steam in initial list?:", hasSteamInitial);

    // 6. Search for 'Steam' in search input
    await client.eval(`
      (() => {
        const input = document.querySelector('input[placeholder*="Search installed applications"]');
        if (input) {
          input.value = 'Steam';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    const searchSteamResult = await client.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        const emptyMsg = document.body.innerText.includes("No matching applications found.");
        return { items, emptyMsg };
      })()
    `);
    console.log("--- SEARCH FOR 'Steam' (BEFORE SCAN) ---");
    console.log("Found items:", searchSteamResult.items);
    console.log("Empty message shown:", searchSteamResult.emptyMsg);

    // 7. Search for 'haveloc'
    await client.eval(`
      (() => {
        const input = document.querySelector('input[placeholder*="Search installed applications"]');
        if (input) {
          input.value = 'haveloc';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    const searchHavelocResult = await client.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        const emptyMsg = document.body.innerText.includes("No matching applications found.");
        return { items, emptyMsg };
      })()
    `);
    console.log("--- SEARCH FOR 'haveloc' (BEFORE SCAN) ---");
    console.log("Found items:", searchHavelocResult.items);
    console.log("Empty message shown:", searchHavelocResult.emptyMsg);

    // 8. Now let's click 'Scan' button to see what happens
    console.log("Clicking 'Scan' button...");
    await client.eval(`
      (() => {
        const scanBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Scan') || b.innerText.includes('Scanning'));
        if (scanBtn) scanBtn.click();
      })()
    `);
    await sleep(4000);

    const afterScanTabs = await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('All (') || b.innerText.includes('Approved (') || b.innerText.includes('Available (')).map(b => b.innerText);
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        return { tabs, itemsCount: items.length };
      })()
    `);
    console.log("--- AFTER SCAN ---");
    console.log("Tabs after scan:", afterScanTabs.tabs);

    // 9. Now search for 'Steam' again
    await client.eval(`
      (() => {
        const input = document.querySelector('input[placeholder*="Search installed applications"]');
        if (input) {
          input.value = 'Steam';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);
    const searchSteamAfterScan = await client.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        return items;
      })()
    `);
    console.log("Search 'Steam' after scan:", searchSteamAfterScan);

    // 10. Search for 'haveloc' after scan
    await client.eval(`
      (() => {
        const input = document.querySelector('input[placeholder*="Search installed applications"]');
        if (input) {
          input.value = 'haveloc';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);
    const searchHavelocAfterScan = await client.eval(`
      (() => {
        const items = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText);
        return items;
      })()
    `);
    console.log("Search 'haveloc' after scan:", searchHavelocAfterScan);

  } finally {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
}

reproduce().catch(err => {
  console.error("Reproduction script error:", err);
  process.exit(1);
});
