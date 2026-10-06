/**
 * ALFRED — Windows Installed Applications Picker & Approved Registry Test Suite
 *
 * Validates:
 * 1. Security & path validation (dangerous shells, traversal, extensions)
 * 2. ApprovedAppsService lifecycle, defaults, persistence, alias resolution
 * 3. AppResolverTool integration with discovery and approved registry
 * 4. WorkspaceService persistence and sync
 * 5. Rejection of unapproved apps
 */

import assert from "assert";
import path from "path";
import fs from "fs";
import os from "os";
import { ApprovedAppsService } from "../electron/services/approved-apps.service";
import { validateApplicationPath } from "../electron/services/app-discovery.service";
import { appResolverTool } from "../electron/tools/app-resolver.tool";
import { WorkspaceService } from "../electron/services/workspace.service";

async function runApprovedAppsTests() {
    console.log("==========================================================================");
    console.log("   ALFRED: WINDOWS INSTALLED APPLICATIONS & APPROVED REGISTRY TEST SUITE   ");
    console.log("==========================================================================");

    let passed = 0;
    let failed = 0;

    async function test(description: string, fn: () => Promise<void> | void) {
        try {
            await fn();
            console.log(`✅ [PASS] ${description}`);
            passed++;
        } catch (err: unknown) {
            console.error(`❌ [FAIL] ${description}`);
            console.error(err);
            failed++;
        }
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alfred-test-apps-"));
    const testStoragePath = path.join(tempDir, "test_approved_apps.json");

    try {
        // 1. Security & Path Validation
        await test("1.1 Rejects dangerous shells and interpreters", () => {
            const forbidden = [
                "C:\\Windows\\System32\\cmd.exe",
                "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
                "C:\\Windows\\System32\\rundll32.exe",
                "C:\\Windows\\System32\\cscript.exe",
                "C:\\Windows\\System32\\wscript.exe",
                "C:\\Windows\\System32\\mshta.exe",
                "C:\\Windows\\System32\\regsvr32.exe",
            ];

            for (const bin of forbidden) {
                const res = validateApplicationPath(bin, { checkFileExists: false });
                assert.strictEqual(res.valid, false, `Did not reject forbidden interpreter: ${bin}`);
                assert(Boolean(res.error));
            }
        });

        await test("1.2 Rejects path traversal and non-executable extensions", () => {
            assert.strictEqual(validateApplicationPath("C:\\Windows\\..\\something.exe", { checkFileExists: false }).valid, false);
            assert.strictEqual(validateApplicationPath("C:\\Tools\\script.bat", { checkFileExists: false }).valid, false);
            assert.strictEqual(validateApplicationPath("C:\\Tools\\script.ps1", { checkFileExists: false }).valid, false);
            assert.strictEqual(validateApplicationPath("C:\\Tools\\malware.vbs", { checkFileExists: false }).valid, false);
            assert.strictEqual(validateApplicationPath("", { checkFileExists: false }).valid, false);
        });

        await test("1.3 Permits legitimate Windows application paths format", () => {
            const valid = "C:\\Program Files\\ExampleApp\\app.exe";
            const res = validateApplicationPath(valid, { checkFileExists: false });
            assert.strictEqual(res.valid, true);
        });

        // 2. ApprovedAppsService Lifecycle & Defaults
        await test("2.1 Initializes with 6 built-in applications seeded by default", () => {
            const service = new ApprovedAppsService(testStoragePath);
            const apps = service.getApprovedApplications();
            assert(apps.length >= 6);

            const names = apps.map((a) => a.name);
            assert(names.includes("Visual Studio Code"));
            assert(names.includes("Google Chrome"));
            assert(names.includes("Spotify"));
            assert(names.includes("Discord"));
            assert(names.includes("Windows Terminal"));
            assert(names.includes("Power BI Desktop"));
        });

        await test("2.2 Approves new valid applications with user authorization & persists", () => {
            const service = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            const candidate = {
                id: "custom_notes",
                name: "Obsidian Notes",
                executablePath: "C:\\Program Files\\Obsidian\\Obsidian.exe",
                source: "user_approved" as const,
                aliases: ["notes", "obsidian"],
            };

            const result = service.approveApplication(candidate, ["my notebook"], { checkFileExists: false });
            assert.strictEqual(result.success, true);
            assert.strictEqual(service.isApplicationApproved("Obsidian Notes"), true);
            assert.strictEqual(service.isApplicationApproved("notes"), true);
            assert.strictEqual(service.isApplicationApproved("my notebook"), true);

            // Re-instantiate from storage to verify disk persistence
            const reloadedService = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            assert.strictEqual(reloadedService.isApplicationApproved("Obsidian Notes"), true);
        });

        await test("2.3 Blocks approval of prohibited binaries", () => {
            const service = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            const evil = {
                id: "evil_cmd",
                name: "Command Prompt Hack",
                executablePath: "C:\\Windows\\System32\\cmd.exe",
                source: "user_approved" as const,
                aliases: ["cmd"],
            };

            const result = service.approveApplication(evil, undefined, { checkFileExists: false });
            assert.strictEqual(result.success, false);
            assert.strictEqual(service.isApplicationApproved("evil_cmd"), false);
        });

        await test("2.4 Revokes approved applications but protects core built-ins", () => {
            const service = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            service.approveApplication({
                id: "slack_app",
                name: "Slack",
                executablePath: "C:\\Users\\User\\AppData\\Local\\slack\\slack.exe",
                source: "discovered",
                aliases: ["slack"],
            }, undefined, { checkFileExists: false });

            assert.strictEqual(service.isApplicationApproved("slack"), true);
            const revokeResult = service.revokeApplication("slack_app");
            assert.strictEqual(revokeResult.success, true);
            assert.strictEqual(service.isApplicationApproved("slack"), false);

            // Attempting to revoke core built-in should be prevented
            const builtinRevoke = service.revokeApplication("app_vscode");
            assert.strictEqual(builtinRevoke.success, false);
        });

        // 3. AppResolverTool Integration
        await test("3.1 Resolves built-in apps seamlessly", () => {
            const res = appResolverTool.resolveApplication("vs code");
            assert.strictEqual(res.success, true);
            if (res.success) {
                assert.strictEqual(res.executable, "code");
            }
        });

        await test("3.2 Resolves user-approved application by name or alias", () => {
            const service = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            service.approveApplication({
                id: "figma_tool",
                name: "Figma Desktop",
                executablePath: "C:\\Users\\User\\AppData\\Local\\Figma\\Figma.exe",
                source: "user_approved",
                aliases: ["figma", "design app"],
            }, undefined, { checkFileExists: false });

            const found = service.findApprovedApp("design app");
            assert.notStrictEqual(found, null);
            assert.strictEqual(found?.name, "Figma Desktop");
        });

        await test("3.3 Strictly prevents command injection attempts", () => {
            const maliciousInputs = [
                "calc & notepad",
                "code | powershell",
                "spotify; rm -rf /",
                "`whoami`",
                "$(calc)",
            ];

            for (const input of maliciousInputs) {
                const res = appResolverTool.resolveApplication(input);
                assert.strictEqual(res.success, false);
                assert(/invalid|unsafe|not found/i.test(res.error));
            }
        });

        await test("3.4 Allows parenthesized display names such as 'haveloc (1)'", () => {
            const service = new ApprovedAppsService(testStoragePath, { checkFileExists: false });
            service.approveApplication({
                id: "app_haveloc_1",
                name: "haveloc (1)",
                executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe",
                arguments: ["--profile-directory=Profile 10", "--app-id=aoliifjkcbemeopkleemkdaomjoiflap"],
                workingDirectory: "C:\\Program Files\\Google\\Chrome\\Application",
                isPWA: true,
                source: "user_approved",
                aliases: ["haveloc", "haveloc 1"],
            }, undefined, { checkFileExists: false });

            const resolved = service.findApprovedApp("haveloc (1)");
            assert.notStrictEqual(resolved, null);
            assert.strictEqual(resolved?.name, "haveloc (1)");
            assert.strictEqual(resolved?.isPWA, true);
            assert.deepStrictEqual(resolved?.arguments, ["--profile-directory=Profile 10", "--app-id=aoliifjkcbemeopkleemkdaomjoiflap"]);
            assert.strictEqual(resolved?.workingDirectory, "C:\\Program Files\\Google\\Chrome\\Application");
        });

        await test("3.5 Discovers and preserves PWA arguments and working directories", () => {
            const { appDiscoveryService } = require("../electron/services/app-discovery.service");
            const parsed = appDiscoveryService.parseShortcutArguments('--profile-directory="Profile 10" --app-id=aoliifjkcbemeopkleemkdaomjoiflap');
            assert.deepStrictEqual(parsed, ["--profile-directory=Profile 10", "--app-id=aoliifjkcbemeopkleemkdaomjoiflap"]);
        });

        // 4. Workspace Service Persistence
        await test("4.1 Persists workspace modifications to disk", () => {
            const wsStoragePath = path.join(tempDir, "test_workspaces.json");
            const wsService = new WorkspaceService(undefined, wsStoragePath);

            const initialList = wsService.getWorkspaces();
            assert(initialList.length >= 4);

            const modified = [
                ...initialList,
                {
                    id: "ws_custom_research",
                    name: "AI Research",
                    description: "Papers and modeling",
                    type: "custom",
                    applications: ["VS Code"],
                    websites: ["https://arxiv.org"],
                    localFolders: ["D:\\Studies"],
                    launchCount: 1,
                    lastLaunched: new Date().toISOString(),
                },
            ];

            wsService.syncWorkspaces(modified as any);

            // Re-load from storage
            const reloaded = new WorkspaceService(undefined, wsStoragePath);
            const loadedList = reloaded.getWorkspaces();
            assert.strictEqual(loadedList.length, modified.length);
            assert(loadedList.some((w) => w.name === "AI Research"));
        });
    } finally {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch {}
    }

    console.log("==========================================================================");
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED                       `);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runApprovedAppsTests().catch((err) => {
    console.error("Test runner encountered error:", err);
    process.exit(1);
});
