import assert from "assert";
import path from "path";
import fs from "fs";
import os from "os";
import { appResolverTool } from "../electron/tools/app-resolver.tool";
import { appExecutorTool } from "../electron/tools/app-executor.tool";
import { launchApplicationTool } from "../electron/agent/tools/builtins/launch-application.tool";
import { workspaceService } from "../electron/services/workspace.service";
import { approvedAppsService } from "../electron/services/approved-apps.service";
import { appDiscoveryService, validateApplicationPath } from "../electron/services/app-discovery.service";

async function runE2ETests() {
    console.log("==========================================================================");
    console.log("   ALFRED: INSTALLED APPS & HAVELOC / STEAM E2E PIPELINE TEST SUITE       ");
    console.log("==========================================================================");

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void> | void) {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } catch (e: any) {
            console.error(`❌ [FAIL] ${name}: ${e?.message}`);
            failed++;
        }
    }

    // 1. Steam discovery on this machine
    await test("1. Steam is discovered with valid path in Program Files (x86)", async () => {
        const apps = await appDiscoveryService.discoverApplications(true);
        const steam = apps.find((a) => a.name.toLowerCase() === "steam" || a.executablePath.toLowerCase().includes("steam.exe"));
        assert(steam, "Steam must be discovered");
        assert(steam.executablePath.toLowerCase().endsWith("steam.exe"), "Steam executablePath must end with steam.exe");
        assert(steam.executablePath.includes("Program Files (x86)"), "Steam path contains (x86)");
        const validation = validateApplicationPath(steam.executablePath);
        assert.strictEqual(validation.valid, true, `Steam path validation failed: ${validation.error}`);
    });

    // 2. Haveloc PWA discovery with arguments
    await test("2. Haveloc Chrome PWA is discovered with arguments and working directory", async () => {
        const apps = await appDiscoveryService.discoverApplications(false);
        const haveloc = apps.find((a) => a.name.toLowerCase().includes("haveloc"));
        assert(haveloc, "Haveloc must be discovered");
        assert(haveloc.isPWA, "Haveloc must be flagged as PWA");
        assert(Array.isArray(haveloc.arguments) && haveloc.arguments.length >= 2, "Haveloc must have arguments array");
        assert(haveloc.arguments.some((arg) => arg.includes("--profile-directory=")), "Missing profile directory arg");
        assert(haveloc.arguments.some((arg) => arg.includes("--app-id=")), "Missing app-id arg");
        assert(haveloc.workingDirectory, "Haveloc must have working directory");
    });

    // 3. Approval of Haveloc preserves metadata
    await test("3. Approving Haveloc preserves arguments, cwd, and resolves deduplication", async () => {
        const apps = await appDiscoveryService.discoverApplications(false);
        const haveloc = apps.find((a) => a.name.toLowerCase().includes("haveloc"));
        assert(haveloc);

        const approval = approvedAppsService.approveApplication(haveloc);
        assert.strictEqual(approval.success, true);
        assert(approval.app);
        assert.deepStrictEqual(approval.app.arguments, haveloc.arguments);
        assert.strictEqual(approval.app.workingDirectory, haveloc.workingDirectory);

        // Verify findApprovedApp resolves the one with arguments
        const resolved = approvedAppsService.findApprovedApp("haveloc (1)");
        assert(resolved, "Failed to resolve haveloc (1)");
        assert.deepStrictEqual(resolved.arguments, haveloc.arguments, "Resolved app lost arguments!");
    });

    // 4. AppResolverTool preserves metadata
    await test("4. AppResolverTool returns appId, arguments, and workingDirectory for Haveloc", () => {
        const resolution = appResolverTool.resolveApplication("haveloc (1)");
        assert.strictEqual(resolution.success, true);
        if (resolution.success) {
            assert(resolution.appId, "appId missing in resolution");
            assert(Array.isArray(resolution.arguments) && resolution.arguments.length > 0, "arguments missing in resolution");
            assert(resolution.workingDirectory, "workingDirectory missing in resolution");
        }
    });

    // 5. AppExecutorTool executes with mock and verifies metadata
    await test("5. AppExecutorTool mock execution preserves arguments and workingDirectory", async () => {
        const resolution = appResolverTool.resolveApplication("haveloc (1)");
        assert.strictEqual(resolution.success, true);
        if (resolution.success) {
            const execResult = await appExecutorTool.execute(resolution.executable, {
                isMock: true,
                appId: resolution.appId,
                arguments: resolution.arguments,
                workingDirectory: resolution.workingDirectory,
            });
            assert.strictEqual(execResult.success, true);
            assert.strictEqual(execResult.executed, true);
        }
    });

    // 6. LaunchApplicationTool executes with arguments
    await test("6. LaunchApplicationTool passes arguments through to executor", async () => {
        const result = await launchApplicationTool.execute(
            { appName: "haveloc (1)" },
            { isMock: true }
        );
        assert.strictEqual(result.success, true);
        assert(result.data?.executed);
        assert.strictEqual(result.data?.appName, "haveloc (1)");
    });

    // 7. Workspace launch executes Haveloc with arguments without hanging
    await test("7. WorkspaceService launches Haveloc workspace and resolves within timeout", async () => {
        const testWorkspace = {
            id: "ws_test_haveloc",
            name: "Haveloc Workspace",
            description: "Test workspace for Haveloc",
            type: "custom",
            applications: ["haveloc (1)"],
            websites: [],
            localFolders: [],
        };

        const startTime = Date.now();
        const launchRes = await workspaceService.launchWorkspace(testWorkspace, { isMock: true });
        const elapsed = Date.now() - startTime;

        assert.strictEqual(launchRes.success, true);
        assert(elapsed < 2000, `Launch took too long: ${elapsed}ms`);
        assert(launchRes.results.some((r) => r.target === "haveloc (1)" && r.success));
    });

    // 8. Security Regression: Unapproved apps, command injection, and interpreters rejected
    await test("8. Security: Injection and dangerous interpreters strictly blocked", async () => {
        // cmd.exe
        const cmdRes = appResolverTool.resolveApplication("cmd.exe");
        assert.strictEqual(cmdRes.success, false);

        // powershell.exe
        const psRes = appResolverTool.resolveApplication("powershell.exe");
        assert.strictEqual(psRes.success, false);

        // injection with & or ;
        const inject1 = appResolverTool.resolveApplication("VS Code & calc.exe");
        assert.strictEqual(inject1.success, false);

        const inject2 = appResolverTool.resolveApplication("calc.exe; notepad.exe");
        assert.strictEqual(inject2.success, false);

        // unapproved random binary
        const unapproved = appResolverTool.resolveApplication("unapproved_tool.exe");
        assert.strictEqual(unapproved.success, false);
    });

    console.log("==========================================================================");
    console.log(`   E2E RESULTS: ${passed} PASSED, ${failed} FAILED                       `);
    console.log("==========================================================================");
    if (failed > 0) process.exit(1);
}

runE2ETests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
