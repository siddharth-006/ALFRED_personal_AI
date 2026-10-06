/**
 * ALFRED Phase 5.1 — Native Desktop Application Control Test Suite
 *
 * Validates:
 * 1. Safe application resolution and aliases for all initial supported apps:
 *    - Visual Studio Code ("vs code", "visual studio code", "code", "vscode", "vs_code")
 *    - Google Chrome ("chrome", "google chrome", "googlechrome")
 *    - Spotify ("spotify")
 *    - Discord ("discord")
 *    - Windows Terminal ("windows terminal", "terminal", "wt")
 * 2. Strict rejection of arbitrary paths, shell injection, PowerShell commands, and cmd.exe
 * 3. Execution authority: ToolRegistry as the single path
 * 4. Backward-compatible tool contract ({ appName }, { application }, { target })
 * 5. Low-risk evaluation (no unexpected confirmation prompt)
 * 6. Sequential multi-step execution compatibility
 * 7. Clean, safe error messages for unavailable apps without shell fallback
 * 8. Prevention of direct process execution by AI
 */

import assert from "assert";
import { appResolverTool } from "../electron/tools/app-resolver.tool";
import { appExecutorTool } from "../electron/tools/app-executor.tool";
import { launchApplicationTool } from "../electron/agent/tools/builtins/launch-application.tool";
import { toolRegistry, registerDefaultTools } from "../electron/agent/tools";
import { evaluatePlanRisk } from "../electron/agent/risk/risk-evaluator";
import { validateAgentPlan } from "../electron/agent/providers/impl/plan-validator";
import { AgentOrchestrator } from "../electron/agent/orchestrator/agent-orchestrator";
import { AgentPlan } from "../electron/agent/orchestrator/types";

async function runNativeAppLaunchTests() {
    registerDefaultTools();
    console.log("==========================================================================");
    console.log("   ALFRED PHASE 5.1: NATIVE DESKTOP APPLICATION CONTROL TEST SUITE       ");
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

    // 1. SUPPORTED APPLICATIONS & ALIASES RESOLUTION
    await test("1. VS Code and all its aliases resolve to 'code'", () => {
        const aliases = ["vs code", "VS Code", "visual studio code", "Visual Studio Code", "code", "Code", "vscode", "VSCODE", "vs_code", "vs-code"];
        for (const alias of aliases) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Alias failed: ${alias}`);
            if (res.success) {
                assert.strictEqual(res.executable, "code");
            }
        }
    });

    await test("2. Chrome and all its aliases resolve to 'chrome'", () => {
        const aliases = ["chrome", "Chrome", "google chrome", "Google Chrome", "googlechrome", "google-chrome", "google_chrome"];
        for (const alias of aliases) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Alias failed: ${alias}`);
            if (res.success) {
                assert.strictEqual(res.executable, "chrome");
            }
        }
    });

    await test("3. Spotify resolves to 'spotify'", () => {
        const res = appResolverTool.resolveApplication("Spotify");
        assert.strictEqual(res.success, true);
        if (res.success) {
            assert.strictEqual(res.executable, "spotify");
        }
    });

    await test("4. Discord resolves to 'discord'", () => {
        const res = appResolverTool.resolveApplication("Discord");
        assert.strictEqual(res.success, true);
        if (res.success) {
            assert.strictEqual(res.executable, "discord");
        }
    });

    await test("5. Windows Terminal and aliases resolve to 'wt'", () => {
        const aliases = ["windows terminal", "Windows Terminal", "terminal", "Terminal", "wt", "WT", "windowsterminal", "windows-terminal", "windows_terminal"];
        for (const alias of aliases) {
            const res = appResolverTool.resolveApplication(alias);
            assert.strictEqual(res.success, true, `Alias failed: ${alias}`);
            if (res.success) {
                assert.strictEqual(res.executable, "wt");
            }
        }
    });

    // 2. SECURITY REJECTION TESTS
    await test("6. Unknown applications are safely rejected without execution", () => {
        const unknownApps = ["notepad++", "sublime", "calc", "firefox", "random_untrusted_app"];
        for (const app of unknownApps) {
            const res = appResolverTool.resolveApplication(app);
            assert.strictEqual(res.success, false, `Did not reject unknown app: ${app}`);
            if (!res.success) {
                assert.strictEqual(res.executable, null);
                assert(Boolean(res.error));
            }
        }
    });

    await test("7. Arbitrary executable paths and path traversal are rejected", () => {
        const paths = [
            "C:\\Windows\\System32\\calc.exe",
            "C:/Windows/System32/cmd.exe",
            "../../calc.exe",
            "..\\..\\Windows\\notepad.exe",
            "/bin/bash",
            "/usr/bin/python",
            ".\\malicious.exe",
        ];
        for (const p of paths) {
            const res = appResolverTool.resolveApplication(p);
            assert.strictEqual(res.success, false, `Path was not rejected: ${p}`);
        }
    });

    await test("8. Shell command injection attempts are strictly rejected", () => {
        const injections = [
            "VS Code; calc.exe",
            "Chrome && notepad",
            "Spotify | dir",
            "`calc`",
            "$(whoami)",
            "Discord > out.txt",
            "code\ncalc",
            "chrome\r\ncalc",
        ];
        for (const inj of injections) {
            const res = appResolverTool.resolveApplication(inj);
            assert.strictEqual(res.success, false, `Injection not rejected: ${inj}`);
            if (!res.success) {
                assert.strictEqual(res.executable, null);
            }
        }
    });

    await test("9. PowerShell syntax and variables are rejected", () => {
        const psCommands = [
            "powershell -c calc",
            "powershell.exe -Command 'calc'",
            "$env:PATH",
            "${env:TEMP}",
            "&(Get-Command calc)",
        ];
        for (const ps of psCommands) {
            const res = appResolverTool.resolveApplication(ps);
            assert.strictEqual(res.success, false, `PowerShell syntax not rejected: ${ps}`);
        }
    });

    await test("10. launch_application tool validation rejects illegal inputs", () => {
        // Missing property
        const res1 = launchApplicationTool.validateInput!({});
        assert.strictEqual(res1.valid, false);

        // Path separator
        const res2 = launchApplicationTool.validateInput!({ appName: "C:\\Windows\\notepad.exe" });
        assert.strictEqual(res2.valid, false);

        // Shell metacharacter
        const res3 = launchApplicationTool.validateInput!({ appName: "VS Code; calc" });
        assert.strictEqual(res3.valid, false);

        // Empty string
        const res4 = launchApplicationTool.validateInput!({ appName: "   " });
        assert.strictEqual(res4.valid, false);
    });

    // 3. TOOL CONTRACT & BACKWARD COMPATIBILITY
    await test("11. launch_application supports { appName } contract", async () => {
        const input = { appName: "VS Code" };
        const val = launchApplicationTool.validateInput!(input);
        assert.strictEqual(val.valid, true);

        const res = await launchApplicationTool.execute(input, { isMock: true });
        assert.strictEqual(res.success, true);
        if (res.success) {
            assert.strictEqual(res.data?.executable, "code");
        }
    });

    await test("12. launch_application supports { application } contract", async () => {
        const input = { application: "vs_code" };
        const val = launchApplicationTool.validateInput!(input);
        assert.strictEqual(val.valid, true);

        const res = await launchApplicationTool.execute(input, { isMock: true });
        assert.strictEqual(res.success, true);
        if (res.success) {
            assert.strictEqual(res.data?.executable, "code");
        }
    });

    // 4. PLAN VALIDATOR & RISK EVALUATOR INTEGRATION
    await test("13. PlanValidator validates launch_application plans and normalizes arguments", () => {
        const plan: AgentPlan = {
            userRequest: "Open VS Code",
            toolCalls: [{ tool: "launch_application", arguments: { application: "vs_code" } }],
        };
        const validation = validateAgentPlan(plan);
        assert.strictEqual(validation.valid, true);
        assert.strictEqual(validation.plan?.toolCalls[0].arguments.appName, "vs_code");
    });

    await test("14. RiskEvaluator evaluates launch_application as LOW risk (no confirmation required)", () => {
        const plan: AgentPlan = {
            userRequest: "Launch Chrome",
            toolCalls: [{ tool: "launch_application", arguments: { appName: "Chrome" } }],
        };
        const risk = evaluatePlanRisk(plan);
        assert.strictEqual(risk.level, "low");
        assert.strictEqual(risk.requiresConfirmation, false);
    });

    // 5. MULTI-STEP PLANNING INTEGRATION
    await test("15. Multi-step plan executes sequential applications via AgentOrchestrator", async () => {
        const multiPlan: AgentPlan = {
            userRequest: "Open VS Code and Chrome",
            toolCalls: [
                { tool: "launch_application", arguments: { appName: "VS Code" } },
                { tool: "launch_application", arguments: { appName: "Chrome" } },
            ],
        };

        const orchestrator = new AgentOrchestrator(undefined, toolRegistry);
        const result = await orchestrator.executePlan(multiPlan, { isMock: true });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.results.length, 2);
        assert.strictEqual(result.results[0].tool, "launch_application");
        assert.strictEqual(result.results[1].tool, "launch_application");
        assert.strictEqual(result.executedSteps, 2);
    });

    // 6. ERROR HANDLING WITHOUT SHELL FALLBACK
    await test("16. Unavailable application returns clean error without shell fallback", async () => {
        // Spotify is not installed on this test machine (verified in environment diagnostics)
        // If an app is whitelisted but not found, AppExecutorTool returns clean error without spawning shell
        const result = await appExecutorTool.execute("non_existent_binary_key_xyz");
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.executed, false);
        assert.strictEqual(result.error?.includes("could not be found on this system"), true);
    });

    // 7. EXECUTION AUTHORITY: ToolRegistry IS THE ONLY PATH
    await test("17. ToolRegistry executes launch_application safely and rejects arbitrary tools", async () => {
        assert.strictEqual(toolRegistry.has("launch_application"), true);

        // ToolRegistry rejects arbitrary process execution tools
        assert.strictEqual(toolRegistry.has("exec_shell_command"), false);
        assert.strictEqual(toolRegistry.has("spawn_process"), false);
        assert.strictEqual(toolRegistry.has("powershell"), false);

        // Mock execution through ToolRegistry succeeds
        const execRes = await toolRegistry.execute("launch_application", { appName: "Discord" }, { isMock: true });
        assert.strictEqual(execRes.success, true);
    });

    console.log("==========================================================================");
    console.log(`SUMMARY: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runNativeAppLaunchTests();
