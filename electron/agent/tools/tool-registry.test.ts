import { ToolRegistry } from "./tool-registry";
import { registerDefaultTools } from "./index";
import { ToolDefinition } from "./types";

/**
 * ALFRED Tool System Architecture Test Suite (Phase 3.3 - Step 1)
 *
 * Verifies tool registry functionality, initial tool registrations,
 * and security bounds (prevention of arbitrary shell execution, input validation,
 * route whitelisting, and AppResolverTool enforcement).
 *
 * NOTE: All application launch tests run with `{ isMock: true }` so NO real OS processes are spawned.
 */
async function runToolSystemTests() {
    console.log("==========================================================================");
    console.log("ALFRED Tool System Architecture — Comprehensive Unit & Security Test Suite");
    console.log("==========================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, detail?: string) {
        if (condition) {
            passed++;
            console.log(`✅ [PASS] ${testName}`);
            if (detail) console.log(`   Detail: ${detail}`);
        } else {
            failed++;
            console.log(`❌ [FAIL] ${testName}`);
            if (detail) console.log(`   Failure Detail: ${detail}`);
        }
    }

    const testRegistry = new ToolRegistry();

    // 1. Registry can register a tool
    try {
        const dummyTool: ToolDefinition = {
            name: "dummy_tool",
            description: "Dummy test tool",
            category: "utility",
            execute: () => ({ success: true, data: "ok" }),
        };
        testRegistry.register(dummyTool);
        assert(testRegistry.has("dummy_tool"), "1. Registry can register a tool");
    } catch (err: unknown) {
        assert(false, "1. Registry can register a tool", String(err));
    }

    // 2. Registry can retrieve a tool
    try {
        const retrieved = testRegistry.get("dummy_tool");
        assert(retrieved !== undefined && retrieved.name === "dummy_tool", "2. Registry can retrieve a tool");
    } catch (err: unknown) {
        assert(false, "2. Registry can retrieve a tool", String(err));
    }

    // 3. Registry can list tools
    try {
        const list = testRegistry.list();
        assert(list.length === 1 && list[0].name === "dummy_tool", "3. Registry can list tools");
    } catch (err: unknown) {
        assert(false, "3. Registry can list tools", String(err));
    }

    // 4. Duplicate tool names are rejected
    try {
        let threw = false;
        try {
            testRegistry.register({
                name: "dummy_tool",
                description: "Duplicate tool",
                category: "utility",
                execute: () => ({ success: true }),
            });
        } catch {
            threw = true;
        }
        assert(threw, "4. Duplicate tool names are rejected");
    } catch (err: unknown) {
        assert(false, "4. Duplicate tool names are rejected", String(err));
    }

    // 5. Unknown tool names are rejected upon execution
    try {
        const res = await testRegistry.execute("non_existent_tool");
        assert(res.success === false && Boolean(res.error?.includes("Unknown tool")), "5. Unknown tool names are rejected");
    } catch (err: unknown) {
        assert(false, "5. Unknown tool names are rejected", String(err));
    }

    // Prepare full registry with default tools for steps 6 - 18
    const registry = new ToolRegistry();
    // Pre-populate with default tools
    const defaultToolsRegistry = new ToolRegistry();
    const defaultToolsList = [
        (await import("./builtins/launch-application.tool")).launchApplicationTool,
        (await import("./builtins/navigate.tool")).navigateTool,
        (await import("./builtins/system-status.tool")).systemStatusTool,
        (await import("./builtins/start-deep-work.tool")).startDeepWorkTool,
        (await import("./builtins/launch-workspace.tool")).launchWorkspaceTool,
        (await import("./builtins/show-tasks.tool")).showTasksTool,
        (await import("./builtins/open-url.tool")).openUrlTool,
        (await import("./builtins/open-path.tool")).openPathTool,
    ];
    for (const tool of defaultToolsList) {
        registry.register(tool);
    }

    // 6. launch_application tool exists
    assert(Boolean(registry.has("launch_application")), "6. launch_application tool exists");

    // 7. navigate tool exists
    assert(Boolean(registry.has("navigate")), "7. navigate tool exists");

    // 8. system_status tool exists
    assert(Boolean(registry.has("system_status")), "8. system_status tool exists");

    // 9. start_deep_work tool exists
    assert(Boolean(registry.has("start_deep_work")), "9. start_deep_work tool exists");

    // 10. launch_workspace tool exists
    assert(Boolean(registry.has("launch_workspace")), "10. launch_workspace tool exists");

    // 11. show_tasks tool exists
    assert(Boolean(registry.has("show_tasks")), "11. show_tasks tool exists");

    // 12. open_url tool exists
    assert(Boolean(registry.has("open_url")), "12. open_url tool exists");

    // 13. open_path tool exists
    assert(Boolean(registry.has("open_path")), "13. open_path tool exists");

    // SECURITY TESTS

    // 14. launch_application cannot execute arbitrary executable names
    try {
        const res = await registry.execute("launch_application", { appName: "calc.exe" }, { isMock: true });
        assert(
            res.success === false && Boolean(res.error?.includes("Unsupported") || res.error?.includes("invalid")),
            "14. launch_application cannot execute arbitrary executable names (calc.exe rejected)"
        );
    } catch (err: unknown) {
        assert(false, "14. launch_application cannot execute arbitrary executable names", String(err));
    }

    // 15. launch_application cannot receive shell commands
    try {
        const res = await registry.execute(
            "launch_application",
            { appName: "VS Code; powershell -Command Start-Process calc" },
            { isMock: true }
        );
        assert(
            res.success === false,
            "15. launch_application cannot receive shell commands (injection rejected)"
        );
    } catch (err: unknown) {
        assert(false, "15. launch_application cannot receive shell commands", String(err));
    }

    // 16. malicious input does not bypass AppResolverTool
    try {
        const res = await registry.execute(
            "launch_application",
            { appName: "../../Windows/System32/cmd.exe" },
            { isMock: true }
        );
        assert(
            res.success === false && Boolean(res.error?.includes("paths") || res.error?.includes("Unsupported")),
            "16. malicious input does not bypass AppResolverTool (path traversal rejected)"
        );
    } catch (err: unknown) {
        assert(false, "16. malicious input does not bypass AppResolverTool", String(err));
    }

    // 17. navigation cannot access arbitrary routes
    try {
        const res = await registry.execute("navigate", { route: "/admin/secret_shell" });
        assert(
            res.success === false && Boolean(res.error?.includes("Invalid navigation target")),
            "17. navigation cannot access arbitrary routes (unwhitelisted route rejected)"
        );
    } catch (err: unknown) {
        assert(false, "17. navigation cannot access arbitrary routes", String(err));
    }

    // 18. arbitrary shell execution is impossible through the tool registry
    try {
        const resUrl = await registry.execute("open_url", { url: "file:///C:/Windows/System32/cmd.exe" });
        const resPath = await registry.execute("open_path", { path: "powershell.exe; calc" });
        assert(
            resUrl.success === false && resPath.success === false,
            "18. arbitrary shell execution is impossible through tool registry (protocol & path safety enforced)"
        );
    } catch (err: unknown) {
        assert(false, "18. arbitrary shell execution is impossible through the tool registry", String(err));
    }

    // ADDITIONAL FUNCTIONAL VERIFICATIONS
    try {
        const validLaunch = await registry.execute("launch_application", { appName: "VS Code" }, { isMock: true });
        assert(validLaunch.success === true, "Functional Check: Valid app launch (VS Code) succeeds in mock mode");

        const validNav = await registry.execute("navigate", { route: "missions" });
        assert(validNav.success === true && (validNav.data as any)?.targetPath === "/tasks", "Functional Check: Valid navigation ('missions') succeeds");
    } catch (err: unknown) {
        assert(false, "Functional Checks", String(err));
    }

    console.log("\n==========================================================================");
    console.log(`Tool System Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runToolSystemTests();
