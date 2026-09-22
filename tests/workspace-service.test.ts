import assert from "assert";
import { workspaceService, WorkspaceLaunchPayload } from "../electron/services/workspace.service";
import { appResolverTool } from "../electron/tools/app-resolver.tool";

async function runWorkspaceServiceTests() {
    console.log("==========================================");
    console.log("   RUNNING WORKSPACE SERVICE TESTS        ");
    console.log("==========================================");

    let passed = 0;
    let failed = 0;

    async function test(description: string, fn: () => Promise<void> | void) {
        try {
            await fn();
            console.log(`✓ PASS: ${description}`);
            passed++;
        } catch (err: unknown) {
            console.error(`✗ FAIL: ${description}`);
            console.error(err);
            failed++;
        }
    }

    // 1. Whitelisted apps resolve correctly in workspace payload
    await test("1. Whitelisted app 'VS Code' is resolved securely", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_1",
            applications: ["VS Code"],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.workspaceId, "test_ws_1");
        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.results[0].type, "application");
        assert.strictEqual(result.results[0].target, "VS Code");
        assert.strictEqual(result.results[0].executable, "code");
    });

    await test("2. Whitelisted app 'Chrome' is resolved securely", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_2",
            applications: ["Chrome"],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.results[0].executable, "chrome");
    });

    await test("3. Whitelisted app 'Windows Terminal' is resolved securely", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_3",
            applications: ["Windows Terminal"],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.results[0].executable, "wt");
    });

    // 2. Unsupported app returns structured failure and is NEVER executed
    await test("4. Unsupported application returns structured failure without executing", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_4",
            applications: ["NonExistentApp123"],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.results[0].type, "application");
        assert.strictEqual(result.results[0].target, "NonExistentApp123");
        assert.strictEqual(result.results[0].success, false);
        assert.strictEqual(result.results[0].executable, undefined);
        assert.strictEqual(result.results[0].error, "Unsupported application.");
    });

    // 3. Malicious app string is rejected by resolver and NEVER executed
    await test("5. Malicious app payload string is rejected with structured failure", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_5",
            applications: ["VS Code; rm -rf /", "calc.exe && notepad"],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.results.length, 2);

        for (const item of result.results) {
            assert.strictEqual(item.success, false);
            assert.strictEqual(item.executable, undefined);
            assert.strictEqual(item.error, "Application name contains invalid or unsafe characters.");
        }
    });

    // 4. Multiple resource types return structured results
    await test("6. Mixed workspace payload (Apps, Folders, URLs) returns structured result list", async () => {
        const payload: WorkspaceLaunchPayload = {
            id: "test_ws_mixed",
            applications: ["VS Code"],
            websites: ["https://leetcode.com"],
            localFolders: [process.cwd()],
        };

        const result = await workspaceService.launchWorkspace(payload);
        assert.strictEqual(result.workspaceId, "test_ws_mixed");
        assert.strictEqual(result.results.length, 3);

        const types = result.results.map((r) => r.type);
        assert.deepStrictEqual(types, ["application", "folder", "url"]);
    });

    console.log("==========================================");
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runWorkspaceServiceTests();
