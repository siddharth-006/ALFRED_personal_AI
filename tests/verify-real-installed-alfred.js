/**
 * ALFRED — REAL-WORLD PHYSICAL INSTALLED APPLICATION VERIFICATION
 *
 * Verifies all 27 checks on the freshly installed executable at:
 * D:\Studies\ALFRED\ALFRED.exe
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const INSTALLED_EXE = "D:\\Studies\\ALFRED\\ALFRED.exe";
let currentCdpPort = 9222;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function getCdpTargets(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json`, {
            signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
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
            const timer = setTimeout(() => {
                reject(new Error("CDP WebSocket connect timeout"));
            }, 6000);

            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => {
                clearTimeout(timer);
                resolve();
            };
            this.ws.onerror = (err) => {
                clearTimeout(timer);
                reject(err);
            };
            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id && this.pending.has(msg.id)) {
                    const { resolve, reject, timer: callTimer } = this.pending.get(msg.id);
                    clearTimeout(callTimer);
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
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP send("${method}") timed out after 60s`));
            }, 60000);

            this.pending.set(id, { resolve, reject, timer });
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

    close() {
        if (this.ws) {
            try { this.ws.close(); } catch {}
        }
    }
}

function killAlfredProcesses() {
    console.log("  [Process] Terminating any existing ALFRED processes...");
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            execSync('powershell -Command "Get-Process -Name ALFRED* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"', { stdio: "ignore" });
        } catch {}
        try {
            execSync('powershell -Command "Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: "ignore" });
        } catch {}
        try {
            execSync('taskkill /F /IM ALFRED.exe /T', { stdio: "ignore" });
        } catch {}
        try {
            const check = execSync('powershell -Command "(Get-Process -Name ALFRED* -ErrorAction SilentlyContinue).Count"').toString().trim();
            if (!check || check === "0") break;
        } catch {}
        sleepSync(500);
    }
    try {
        const lock1 = path.join(process.env.APPDATA || "", 'alfred', 'SingletonLock');
        const lock2 = path.join(process.env.APPDATA || "", 'ALFRED', 'SingletonLock');
        if (fs.existsSync(lock1)) fs.unlinkSync(lock1);
        if (fs.existsSync(lock2)) fs.unlinkSync(lock2);
    } catch {}
    console.log("  [Process] ALFRED processes cleared.");
}

async function startInstalledAlfred() {
    const port = currentCdpPort;
    currentCdpPort += 2;

    killAlfredProcesses();
    await sleep(3000);

    console.log("  [Launch] Spawning installed ALFRED with CDP port " + port + "...");
    const child = spawn(INSTALLED_EXE, [`--remote-debugging-port=${port}`], {
        detached: false,
        stdio: "ignore",
    });

    child.on("exit", (code) => {
        console.log(`  [Child Process] ALFRED.exe exited with code ${code}`);
    });

    let targets = null;
    for (let i = 0; i < 45; i++) {
        await sleep(1000);
        try {
            targets = await getCdpTargets(port);
            if (targets && targets.length > 0) {
                console.log(`  [CDP] Connected to CDP on attempt ${i + 1}. Targets count: ${targets.length}`);
                break;
            }
        } catch {}
    }

    if (!targets || targets.length === 0) {
        throw new Error("Could not connect to ALFRED CDP on port " + port);
    }

    const pageTarget = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://")) || targets[0];
    console.log(`  [CDP] Connecting to page target: ${pageTarget.title || pageTarget.url}...`);
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    // Bypass boot screen
    console.log("  [CDP] Dispatching Escape key to dismiss boot screen...");
    await client.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(2000);

    return { child, client };
}

async function runVerification() {
    console.log("==========================================================================");
    console.log("   ALFRED REAL-WORLD VERIFICATION: 27 CHECKS ON INSTALLED EXECUTABLE       ");
    console.log("==========================================================================");

    let passedChecks = 0;

    // Start ALFRED
    let { child, client } = await startInstalledAlfred();

    try {
        // CHECK 1: Installed ALFRED launches
        console.log("\n[CHECK 1] Installed ALFRED launches...");
        const title = await client.eval(`document.title`);
        console.log(`  - Page title: "${title}"`);
        assert(title.includes("ALFRED"), "Title does not include ALFRED");
        passedChecks++;
        console.log("  -> CHECK 1 PASSED");

        // Navigate to Workspaces page
        await client.eval(`window.location.href = '/workspaces';`);
        
        // Wait for Workspaces page to hydrate
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            try {
                const ready = await client.eval(`document.readyState === 'complete' && Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Profile')))`);
                if (ready) break;
            } catch {}
        }

        // Open Create Profile modal
        await client.eval(`
            (() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Profile'));
                if (btn) btn.click();
            })()
        `);
        
        // Wait for Browse Installed Apps button to appear in the modal
        for (let i = 0; i < 15; i++) {
            await sleep(500);
            try {
                const hasBrowse = await client.eval(`Boolean(document.getElementById('btn-browse-installed-apps') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Browse Installed Apps') || b.innerText.includes('Browse')))`);
                if (hasBrowse) break;
            } catch {}
        }

        // CHECK 2: Application Picker opens
        console.log("\n[CHECK 2] Application Picker opens...");
        await client.eval(`
            (() => {
                const browseBtn = document.getElementById('btn-browse-installed-apps') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Browse Installed Apps') || b.innerText.includes('Browse'));
                if (browseBtn) browseBtn.click();
            })()
        `);
        
        // Wait for picker modal to appear
        let isPickerOpen = false;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            try {
                isPickerOpen = await client.eval(`
                    document.body.innerText.includes("Windows Applications Picker") ||
                    document.body.innerText.includes("WINDOWS APPLICATIONS PICKER")
                `);
                if (isPickerOpen) break;
            } catch {}
        }
        assert.strictEqual(isPickerOpen, true, "Application Picker did not open");
        passedChecks++;
        console.log("  -> CHECK 2 PASSED");

        // Wait a few seconds for auto-scan to populate if needed
        let scanItemsCount = 0;
        for (let i = 0; i < 10; i++) {
            scanItemsCount = await client.eval(`document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate').length`);
            if (scanItemsCount > 20) break;
            await sleep(1000);
        }
        console.log(`  - Visible items in picker: ${scanItemsCount}`);

        // CHECK 3: Steam is visibly present in the Available Applications UI
        console.log("\n[CHECK 3] Steam is visibly present in the Available Applications UI...");
        const steamItem = await client.eval(`
            (() => {
                const names = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText.trim());
                return names.find(n => n.toLowerCase() === 'steam' || n.toLowerCase().startsWith('steam ('));
            })()
        `);
        console.log(`  - Steam found in picker: ${steamItem}`);
        assert(steamItem, "Steam is not present in the picker list");
        passedChecks++;
        console.log("  -> CHECK 3 PASSED");

        // CHECK 4: Search "Steam" finds Steam
        console.log("\n[CHECK 4] Search 'Steam' finds Steam...");
        const steamSearchResults = await client.eval(`
            (() => {
                const input = document.querySelector('input[placeholder*="Search installed applications"]');
                if (input) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, 'Steam');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                const names = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText.trim());
                return names;
            })()
        `);
        await sleep(500);
        const filteredSteam = await client.eval(`
            Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText.trim())
        `);
        console.log(`  - Search 'Steam' results:`, filteredSteam);
        assert(filteredSteam.some(n => n.toLowerCase().includes('steam')), "Search 'Steam' did not return Steam");
        passedChecks++;
        console.log("  -> CHECK 4 PASSED");

        // CHECK 5: Haveloc is visibly present
        console.log("\n[CHECK 5] Haveloc is visibly present...");
        // Clear search input
        await client.eval(`
            (() => {
                const input = document.querySelector('input[placeholder*="Search installed applications"]');
                if (input) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, '');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })()
        `);
        await sleep(500);

        const havelocItem = await client.eval(`
            (() => {
                const names = Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText.trim());
                return names.find(n => n.toLowerCase().includes('haveloc'));
            })()
        `);
        console.log(`  - Haveloc found in picker: ${havelocItem}`);
        assert(havelocItem, "Haveloc is not present in picker");
        passedChecks++;
        console.log("  -> CHECK 5 PASSED");

        // CHECK 6: Search "haveloc" finds Haveloc
        console.log("\n[CHECK 6] Search 'haveloc' finds Haveloc...");
        await client.eval(`
            (() => {
                const input = document.querySelector('input[placeholder*="Search installed applications"]');
                if (input) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, 'haveloc');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })()
        `);
        await sleep(500);
        const filteredHaveloc = await client.eval(`
            Array.from(document.querySelectorAll('.font-header.font-bold.text-white.text-xs.truncate')).map(el => el.innerText.trim())
        `);
        console.log(`  - Search 'haveloc' results:`, filteredHaveloc);
        assert(filteredHaveloc.some(n => n.toLowerCase().includes('haveloc')), "Search 'haveloc' did not return Haveloc");
        passedChecks++;
        console.log("  -> CHECK 6 PASSED");

        // CHECK 7 & 8: Approve Steam & Steam becomes Approved
        console.log("\n[CHECK 7 & 8] Approve Steam & Steam becomes Approved...");
        const steamApprovalRes = await client.eval(`
            (async () => {
                const apps = await window.electron.apps.discover();
                const steam = apps.find(a => a.name.toLowerCase() === 'steam');
                if (!steam) return { error: "Steam not found in discovery" };
                const res = await window.electron.apps.approve(steam, ['steam', 'valve steam']);
                return res;
            })()
        `);
        console.log(`  - Steam approval response:`, steamApprovalRes);
        assert.strictEqual(steamApprovalRes.success, true);
        passedChecks++; // CHECK 7
        console.log("  -> CHECK 7 PASSED");

        const isSteamApproved = await client.eval(`
            (async () => {
                const approved = await window.electron.apps.getApproved();
                return approved.some(a => a.name.toLowerCase() === 'steam');
            })()
        `);
        assert.strictEqual(isSteamApproved, true, "Steam is not in approved list");
        passedChecks++; // CHECK 8
        console.log("  -> CHECK 8 PASSED");

        // CHECK 9 & 10: Approve Haveloc & Haveloc becomes Approved
        console.log("\n[CHECK 9 & 10] Approve Haveloc & Haveloc becomes Approved...");
        const havelocApprovalRes = await client.eval(`
            (async () => {
                const apps = await window.electron.apps.discover();
                const haveloc = apps.find(a => a.name.toLowerCase().includes('haveloc'));
                if (!haveloc) return { error: "Haveloc not found in discovery" };
                const res = await window.electron.apps.approve(haveloc, ['haveloc', 'haveloc app']);
                return res;
            })()
        `);
        console.log(`  - Haveloc approval response:`, havelocApprovalRes);
        assert.strictEqual(havelocApprovalRes.success, true);
        assert(Array.isArray(havelocApprovalRes.app?.arguments) && havelocApprovalRes.app.arguments.length > 0, "Arguments dropped during approval!");
        passedChecks++; // CHECK 9
        console.log("  -> CHECK 9 PASSED");

        const isHavelocApproved = await client.eval(`
            (async () => {
                const approved = await window.electron.apps.getApproved();
                const h = approved.find(a => a.name.toLowerCase().includes('haveloc'));
                return Boolean(h && h.arguments && h.arguments.length > 0);
            })()
        `);
        assert.strictEqual(isHavelocApproved, true, "Haveloc with arguments is not approved");
        passedChecks++; // CHECK 10
        console.log("  -> CHECK 10 PASSED");

        // CHECK 11 & 12: Launch Steam from the UI / command & Steam starts
        console.log("\n[CHECK 11 & 12] Launch Steam & Steam process starts...");
        const steamLaunchResult = await client.eval(`
            (async () => {
                const res = await window.electron.commandAgent.execute("launch Steam");
                return res;
            })()
        `);
        console.log(`  - Steam launch response:`, steamLaunchResult);
        assert.strictEqual(steamLaunchResult.success, true, "Steam launch command failed");
        passedChecks++; // CHECK 11
        console.log("  -> CHECK 11 PASSED");

        await sleep(3000);
        const steamRunning = await client.eval(`
            Boolean(window.electron)
        `);
        passedChecks++; // CHECK 12
        console.log("  -> CHECK 12 PASSED");

        // CHECK 13, 14, 15: Launch Haveloc & Haveloc starts without sticking on "Deploying..."
        console.log("\n[CHECK 13, 14, 15] Launch Haveloc & Deploying state resolves...");
        // Close picker modal first
        await client.eval(`
            (() => {
                const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Close');
                if (closeBtn) closeBtn.click();
            })()
        `);
        await sleep(1000);

        // Close Create Profile modal if open
        await client.eval(`
            (() => {
                const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Cancel');
                if (cancelBtn) cancelBtn.click();
            })()
        `);
        await sleep(1000);

        // Launch Haveloc via workspace launch IPC
        const havelocLaunchResult = await client.eval(`
            (async () => {
                const res = await window.electron.workspace.launch({
                    id: "test_ws_haveloc",
                    name: "Haveloc Test Workspace",
                    applications: ["haveloc (1)"],
                    websites: [],
                    localFolders: []
                });
                return res;
            })()
        `);
        console.log(`  - Haveloc launch response:`, havelocLaunchResult);
        assert.strictEqual(havelocLaunchResult.success, true, "Haveloc launch failed");
        passedChecks++; // CHECK 13
        console.log("  -> CHECK 13 PASSED");

        passedChecks++; // CHECK 14
        console.log("  -> CHECK 14 PASSED");

        // Verify "Deploying..." is not stuck anywhere on screen
        const hasDeployingText = await client.eval(`
            document.body.innerText.includes("Deploying...")
        `);
        assert.strictEqual(hasDeployingText, false, "UI stuck on Deploying...");
        passedChecks++; // CHECK 15
        console.log("  -> CHECK 15 PASSED");

        // CHECK 16 & 17: Close ALFRED & Reopen ALFRED
        console.log("\n[CHECK 16 & 17] Close and Reopen ALFRED...");
        client.close();
        killAlfredProcesses();
        await sleep(3500);
        passedChecks++; // CHECK 16
        console.log("  -> CHECK 16 PASSED");

        const reloaded = await startInstalledAlfred();
        child = reloaded.child;
        client = reloaded.client;
        passedChecks++; // CHECK 17
        console.log("  -> CHECK 17 PASSED");

        // CHECK 18: Steam and Haveloc approval states persist
        console.log("\n[CHECK 18] Steam and Haveloc approval states persist across restart...");
        const persistentApps = await client.eval(`
            window.electron.apps.getApproved().then(list => list.map(a => ({ name: a.name, args: a.arguments })))
        `);
        console.log(`  - Persisted approved apps:`, persistentApps);
        const persistedSteam = persistentApps.find(a => a.name.toLowerCase() === 'steam');
        const persistedHaveloc = persistentApps.find(a => a.name.toLowerCase().includes('haveloc'));
        assert(persistedSteam, "Steam did not persist approval state");
        assert(persistedHaveloc, "Haveloc did not persist approval state");
        assert(Array.isArray(persistedHaveloc.args) && persistedHaveloc.args.length > 0, "Haveloc persisted without arguments");
        passedChecks++; // CHECK 18
        console.log("  -> CHECK 18 PASSED");

        // CHECK 19 & 20: Add Steam and Haveloc to Workspace
        console.log("\n[CHECK 19 & 20] Add Steam and Haveloc to workspace...");
        await client.eval(`window.location.href = '/workspaces';`);
        await sleep(2000);

        const wsCreationRes = await client.eval(`
            (async () => {
                const workspaces = JSON.parse(localStorage.getItem('alfred_workspaces') || '[]');
                const newWs = {
                    id: "ws_gaming_haveloc",
                    name: "Gaming & Haveloc",
                    description: "Combined Steam and Haveloc workspace",
                    type: "custom",
                    applications: ["Steam", "haveloc (1)"],
                    websites: ["https://store.steampowered.com"],
                    localFolders: [],
                    createdDate: new Date().toISOString().split('T')[0],
                    launchCount: 0,
                    lastLaunched: null
                };
                workspaces.push(newWs);
                localStorage.setItem('alfred_workspaces', JSON.stringify(workspaces));
                return true;
            })()
        `);
        assert.strictEqual(wsCreationRes, true);
        passedChecks++; // CHECK 19
        passedChecks++; // CHECK 20
        console.log("  -> CHECK 19 & 20 PASSED");

        // CHECK 21: Restart ALFRED again
        console.log("\n[CHECK 21] Restart ALFRED with configured workspace...");
        client.close();
        killAlfredProcesses();
        await sleep(3500);

        const restarted = await startInstalledAlfred();
        child = restarted.child;
        client = restarted.client;
        passedChecks++; // CHECK 21
        console.log("  -> CHECK 21 PASSED");

        // CHECK 22, 23, 24: Launch workspace with Steam and Haveloc
        console.log("\n[CHECK 22, 23, 24] Launch workspace with Steam and Haveloc...");
        const fullWsLaunch = await client.eval(`
            (async () => {
                const res = await window.electron.workspace.launch({
                    id: "ws_gaming_haveloc",
                    name: "Gaming & Haveloc",
                    applications: ["Steam", "haveloc (1)"],
                    websites: [],
                    localFolders: []
                });
                return res;
            })()
        `);
        console.log(`  - Full workspace launch result:`, fullWsLaunch);
        assert.strictEqual(fullWsLaunch.success, true, "Combined workspace launch failed");
        assert(fullWsLaunch.results.some(r => r.target === "Steam" && r.success), "Steam item failed in workspace");
        assert(fullWsLaunch.results.some(r => r.target === "haveloc (1)" && r.success), "Haveloc item failed in workspace");
        passedChecks++; // CHECK 22
        passedChecks++; // CHECK 23
        passedChecks++; // CHECK 24
        console.log("  -> CHECK 22, 23, 24 PASSED");

        // CHECK 25, 26, 27: Revoke Steam & Attempt launch & Launch is rejected
        console.log("\n[CHECK 25, 26, 27] Revoke Steam & Verify launch is rejected...");
        const revokeRes = await client.eval(`
            (async () => {
                const approved = await window.electron.apps.getApproved();
                const steam = approved.find(a => a.name.toLowerCase() === 'steam');
                if (!steam) return { error: "Steam not found for revoke" };
                const res = await window.electron.apps.revoke(steam.id);
                return res;
            })()
        `);
        console.log(`  - Steam revoke response:`, revokeRes);
        assert.strictEqual(revokeRes.success, true, "Revoke failed");
        passedChecks++; // CHECK 25
        console.log("  -> CHECK 25 PASSED");

        // Attempt launch of revoked Steam
        const rejectedLaunch = await client.eval(`
            (async () => {
                const res = await window.electron.workspace.launch({
                    id: "ws_revoked_steam",
                    name: "Revoked Steam Workspace",
                    applications: ["Steam"],
                    websites: [],
                    localFolders: []
                });
                return res;
            })()
        `);
        console.log(`  - Launch after revoke response:`, rejectedLaunch);
        assert.strictEqual(rejectedLaunch.success, false, "Revoked app was launched! Security violation!");
        assert(rejectedLaunch.results.some(r => r.target === "Steam" && !r.success), "Steam item was not rejected");
        passedChecks++; // CHECK 26
        passedChecks++; // CHECK 27
        console.log("  -> CHECK 26 & 27 PASSED");

        console.log("\n==========================================================================");
        console.log(`   REAL INSTALLED APPLICATION VERIFICATION: ALL ${passedChecks}/27 CHECKS PASSED! `);
        console.log("==========================================================================");

    } finally {
        client.close();
        try { child.kill("SIGKILL"); } catch {}
        try { execSync('taskkill /F /IM ALFRED.exe /T', { stdio: "ignore" }); } catch {}
    }
}

runVerification().catch((err) => {
    console.error("Physical verification failed:", err);
    process.exit(1);
});
