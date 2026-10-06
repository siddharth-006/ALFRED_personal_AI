/**
 * ALFRED Phase 5.2 — Workspace Automation Dedicated Test Suite
 *
 * Validates:
 * 1. Valid workspace resolution by name and ID
 * 2. Workspace aliases resolve safely ("coding" -> DSA, "data science mode" -> Data Science, "ml" -> Machine Learning, "hack" -> Hackathon)
 * 3. Unknown workspace is safely rejected
 * 4. Ambiguous workspace query produces clarification (Answer Mode), not guessing
 * 5. AI cannot specify arbitrary executable paths or command injection
 * 6. AI cannot inject shell commands in folder paths or websites
 * 7. Workspace launch executes strictly through ToolRegistry
 * 8. Workspace cannot bypass PlanValidator
 * 9. Workspace cannot bypass RiskEvaluator (low-risk, no unnecessary confirmation)
 * 10. Existing application whitelist remains strictly enforced
 * 11. Website opening protocol validation (http/https only)
 * 12. Local folder path security (rejection of metacharacters)
 * 13. Multi-step workspace execution (e.g. "Start my DSA workspace and open Chrome")
 * 14. Conversational context resolution ("Which workspaces do I have?" -> "Start the Machine Learning one")
 */

import assert from "assert";
import { workspaceService, Workspace } from "../electron/services/workspace.service";
import { launchWorkspaceTool } from "../electron/agent/tools/builtins/launch-workspace.tool";
import { toolRegistry, registerDefaultTools } from "../electron/agent/tools";
import { appResolverTool } from "../electron/tools/app-resolver.tool";
import { appExecutorTool } from "../electron/tools/app-executor.tool";
import { evaluatePlanRisk } from "../electron/agent/risk/risk-evaluator";
import { validateAgentPlan } from "../electron/agent/providers/impl/plan-validator";
import { AgentOrchestrator } from "../electron/agent/orchestrator/agent-orchestrator";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { conversationContextService } from "../electron/services/conversation-context.service";
import { AgentPlan } from "../electron/agent/orchestrator/types";

// Register default tools
registerDefaultTools();

async function runWorkspaceAutomationTests() {
    console.log("==========================================================================");
    console.log("     ALFRED PHASE 5.2: WORKSPACE AUTOMATION TEST SUITE                    ");
    console.log("==========================================================================\n");

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void> | void) {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } catch (err: unknown) {
            console.error(`❌ [FAIL] ${name}`);
            console.error(err);
            failed++;
        }
    }

    // Reset workspace service to canonical state
    workspaceService.reset();
    const { providerConfigService } = await import("../electron/agent/providers/config/provider-config.service");
    providerConfigService.setActiveProviderId("mock");

    // =========================================================================
    // SECTION 1: WORKSPACE RESOLUTION & ALIASES
    // =========================================================================
    console.log("--- Section 1: Workspace Resolution & Aliases ---");

    await test("1.1 Resolves exact workspace name ('DSA', 'Data Science', 'Hackathon', 'Machine Learning')", () => {
        const names = ["DSA", "Data Science", "Hackathon", "Machine Learning"];
        for (const name of names) {
            const res = workspaceService.resolveWorkspace(name);
            assert.strictEqual(res.found, true, `Failed to resolve ${name}`);
            assert.strictEqual(res.workspace?.name.toLowerCase(), name.toLowerCase());
        }
    });

    await test("1.2 Resolves exact workspace ID ('ws_dsa', 'ws_datascience', 'ws_hackathon', 'ws_ml')", () => {
        const ids = ["ws_dsa", "ws_datascience", "ws_hackathon", "ws_ml"];
        for (const id of ids) {
            const res = workspaceService.resolveWorkspace(id);
            assert.strictEqual(res.found, true, `Failed to resolve ID: ${id}`);
            assert.strictEqual(res.workspace?.id, id);
        }
    });

    await test("1.3 Resolves canonical aliases safely ('coding' -> DSA, 'ml' -> Machine Learning, 'data science mode' -> Data Science)", () => {
        const aliasMappings: Record<string, string> = {
            "coding": "DSA",
            "dsa": "DSA",
            "code": "DSA",
            "problem solving": "DSA",
            "ml": "Machine Learning",
            "machinelearning": "Machine Learning",
            "machine-learning": "Machine Learning",
            "data science": "Data Science",
            "datascience": "Data Science",
            "data science mode": "Data Science",
            "analytics": "Data Science",
            "hackathon": "Hackathon",
            "hack": "Hackathon",
        };

        for (const [alias, expectedTarget] of Object.entries(aliasMappings)) {
            const res = workspaceService.resolveWorkspace(alias);
            assert.strictEqual(res.found, true, `Alias '${alias}' failed to resolve`);
            assert.strictEqual(res.workspace?.name, expectedTarget, `Alias '${alias}' mapped to '${res.workspace?.name}' instead of '${expectedTarget}'`);
        }
    });

    await test("1.4 Handles conversational request text stripping ('Start my coding workspace', 'Prepare my machine learning environment')", () => {
        const queries = [
            { query: "Start my coding workspace", expected: "DSA" },
            { query: "Prepare my machine learning workspace", expected: "Machine Learning" },
            { query: "Launch my hackathon workspace", expected: "Hackathon" },
            { query: "Open my DSA workspace", expected: "DSA" },
            { query: "Start Data Science mode", expected: "Data Science" },
            { query: "switch to my ML setup", expected: "Machine Learning" },
        ];

        for (const item of queries) {
            const res = workspaceService.resolveWorkspace(item.query);
            assert.strictEqual(res.found, true, `Query '${item.query}' failed to resolve`);
            assert.strictEqual(res.workspace?.name, item.expected);
        }
    });

    await test("1.5 Unknown workspace is rejected with clean safe error", () => {
        const unknownQueries = [
            "TotallyFakeWorkspace123",
            "NonExistentEnv",
            "RandomNonexistentWorkspace",
        ];

        for (const q of unknownQueries) {
            const res = workspaceService.resolveWorkspace(q);
            assert.strictEqual(res.found, false, `Unknown query '${q}' should not be found`);
            assert.strictEqual(res.ambiguous, undefined);
            assert.strictEqual(typeof res.error, "string");
            assert(res.error?.includes(q));
        }
    });

    await test("1.6 Ambiguous workspace query produces clarification rather than guessing", () => {
        // Create an ambiguous scenario: add two custom workspaces sharing a term "Model"
        const customWorkspaces: Workspace[] = [
            ...workspaceService.getWorkspaces(),
            {
                id: "ws_ml_vision",
                name: "Vision Model",
                description: "Vision models",
                type: "custom",
                applications: ["VS Code"],
                websites: [],
                localFolders: [],
            },
            {
                id: "ws_ml_nlp",
                name: "Language Model",
                description: "Language models",
                type: "custom",
                applications: ["VS Code"],
                websites: [],
                localFolders: [],
            },
        ];

        workspaceService.syncWorkspaces(customWorkspaces);

        // Ambiguous query matching both "Vision Model" and "Language Model"
        const ambigRes = workspaceService.resolveWorkspace("Model");
        assert.strictEqual(ambigRes.found, false, "Ambiguous match should not resolve to a single workspace");
        assert.strictEqual(ambigRes.ambiguous, true, "Should be flagged as ambiguous");
        assert(Array.isArray(ambigRes.candidates) && ambigRes.candidates.length >= 2, "Should return candidate options");
        assert(ambigRes.error?.includes("multiple matching workspaces"), "Error message should prompt clarification");

        // Reset back to defaults
        workspaceService.reset();
    });

    // =========================================================================
    // SECTION 2: SECURITY & EXECUTION BOUNDARIES
    // =========================================================================
    console.log("\n--- Section 2: Security & Execution Boundaries ---");

    await test("2.1 Workspace cannot specify arbitrary executable paths or unwhitelisted apps", async () => {
        const maliciousPayload = {
            id: "ws_evil",
            name: "Evil Workspace",
            applications: ["calc.exe", "powershell.exe", "cmd.exe", "C:\\Windows\\System32\\cmd.exe"],
            websites: [],
            localFolders: [],
        };

        const result = await workspaceService.launchWorkspace(maliciousPayload, { isMock: true });
        assert.strictEqual(result.success, false, "Unapproved executables must fail");
        assert.strictEqual(result.results.length, 4);
        for (const item of result.results) {
            assert.strictEqual(item.success, false);
            assert.strictEqual(item.type, "application");
            assert(
                item.error?.includes("Unsupported application") ||
                item.error?.includes("invalid or unsafe") ||
                item.error?.includes("couldn't find an approved application") ||
                item.error?.includes("not been approved")
            );
        }
    });

    await test("2.2 Shell injection in application names is strictly blocked", async () => {
        const injectionPayload = {
            id: "ws_injection",
            name: "Injection Workspace",
            applications: [
                "VS Code; powershell -Command Start-Process calc",
                "Chrome && calc",
                "code | whoami",
            ],
            websites: [],
            localFolders: [],
        };

        const result = await workspaceService.launchWorkspace(injectionPayload, { isMock: true });
        assert.strictEqual(result.success, false);
        for (const item of result.results) {
            assert.strictEqual(item.success, false);
            assert(item.error?.includes("invalid or unsafe characters") || item.error?.includes("Unsupported"));
        }
    });

    await test("2.3 Shell metacharacters in localFolders are strictly blocked", async () => {
        const folderInjectionPayload = {
            id: "ws_folder_inject",
            name: "Folder Injection",
            applications: [],
            websites: [],
            localFolders: [
                "D:\\Projects; calc.exe",
                "D:\\Projects & powershell",
                "C:\\`whoami`",
                "D:\\test | cmd.exe",
            ],
        };

        const result = await workspaceService.launchWorkspace(folderInjectionPayload, { isMock: true });
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.results.length, 4);
        for (const item of result.results) {
            assert.strictEqual(item.type, "folder");
            assert.strictEqual(item.success, false);
            assert.strictEqual(item.error, "Folder path contains invalid or unsafe characters.");
        }
    });

    await test("2.4 Websites validate protocol (http/https only, no javascript: or file://)", async () => {
        const urlSecurityPayload = {
            id: "ws_url_sec",
            name: "URL Security Workspace",
            applications: [],
            websites: [
                "javascript:alert(1)",
                "file:///C:/Windows/System32/cmd.exe",
                "data:text/html,<script>alert(1)</script>",
                "ftp://evil.com/payload",
            ],
            localFolders: [],
        };

        const result = await workspaceService.launchWorkspace(urlSecurityPayload, { isMock: true });
        assert.strictEqual(result.success, false);
        for (const item of result.results) {
            assert.strictEqual(item.type, "url");
            assert.strictEqual(item.success, false);
            assert(item.error?.includes("Only http:// and https:// URLs are supported"));
        }
    });

    await test("2.5 ToolRegistry holds execution authority for launch_workspace", async () => {
        assert(toolRegistry.has("launch_workspace"), "ToolRegistry must contain 'launch_workspace'");
        const regTool = toolRegistry.get("launch_workspace");
        assert(regTool !== undefined);
        assert.strictEqual(regTool.name, "launch_workspace");

        // Execute via ToolRegistry with mock options
        const execRes = await toolRegistry.execute("launch_workspace", { workspaceName: "DSA" }, { isMock: true });
        assert.strictEqual(execRes.success, true);
        assert(execRes.data !== undefined);
        assert.strictEqual((execRes.data as any).workspaceId, "ws_dsa");
    });

    await test("2.6 PlanValidator validates launch_workspace plans and normalizes arguments", () => {
        const validPlan: AgentPlan = {
            userRequest: "Start my DSA workspace",
            explanation: "Starting workspace",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "DSA" } },
            ],
        };
        const validation = validateAgentPlan(validPlan);
        assert.strictEqual(validation.valid, true);

        // Shell metacharacters in workspaceName rejected
        const evilPlan: AgentPlan = {
            userRequest: "Start evil workspace",
            explanation: "Injection attempt",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "DSA; calc" } },
            ],
        };
        const evilValidation = validateAgentPlan(evilPlan);
        assert.strictEqual(evilValidation.valid, false);
    });

    await test("2.7 RiskEvaluator evaluates launch_workspace as LOW risk (no confirmation required)", () => {
        const plan: AgentPlan = {
            userRequest: "Start my DSA workspace",
            explanation: "Starting DSA workspace",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "DSA" } },
            ],
        };
        const risk = evaluatePlanRisk(plan);
        assert.strictEqual(risk.riskLevel, "low");
        assert.strictEqual(risk.requiresConfirmation, false);
        assert.strictEqual(risk.mutationCount, 0);
    });

    // =========================================================================
    // SECTION 3: TOOL EXECUTION & MULTI-STEP
    // =========================================================================
    console.log("\n--- Section 3: Tool Execution & Multi-Step ---");

    await test("3.1 launchWorkspace launches DSA workspace with mock application execution", async () => {
        const res = await workspaceService.launchWorkspace("DSA", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.workspaceName, "DSA");
        assert(res.results.length >= 1);
        const appItem = res.results.find((r) => r.type === "application");
        assert(appItem !== undefined);
        assert.strictEqual(appItem.target, "VS Code");
        assert.strictEqual(appItem.executable, "code");
        assert(typeof res.summary === "string");
        assert(res.summary.includes("DSA workspace is ready"));
    });

    await test("3.2 launchWorkspace launches Machine Learning workspace (app + website + folder)", async () => {
        const res = await workspaceService.launchWorkspace("Machine Learning", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.workspaceName, "Machine Learning");

        const appItem = res.results.find((r) => r.type === "application");
        const urlItem = res.results.find((r) => r.type === "url");
        const folderItem = res.results.find((r) => r.type === "folder");

        assert(appItem !== undefined && appItem.success === true, "App should succeed");
        assert(urlItem !== undefined && urlItem.success === true, "Website should succeed");
        assert(folderItem !== undefined && folderItem.success === true, "Folder should succeed");
    });

    await test("3.3 Multi-step plan: 'Start my DSA workspace and open Chrome' executes sequentially via AgentOrchestrator", async () => {
        const orchestrator = new AgentOrchestrator();
        const plan: AgentPlan = {
            userRequest: "Start my DSA workspace and then open Chrome",
            explanation: "Starting workspace and opening Chrome",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "DSA" } },
                { tool: "launch_application", arguments: { appName: "Chrome" } },
            ],
        };

        const execRes = await orchestrator.executePlan(plan, { isMock: true });
        assert.strictEqual(execRes.success, true);
        assert.strictEqual(execRes.totalSteps, 2);
        assert.strictEqual(execRes.executedSteps, 2);
        assert.strictEqual(execRes.results[0].tool, "launch_workspace");
        assert.strictEqual(execRes.results[1].tool, "launch_application");
    });

    await test("3.4 Multi-step plan handles workspace item failure safely", async () => {
        // Unknown workspace in step 1 should halt subsequent step
        const orchestrator = new AgentOrchestrator();
        const plan: AgentPlan = {
            userRequest: "Start fake workspace and then open Chrome",
            explanation: "Starting fake workspace",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "TotallyFakeWorkspace123" } },
                { tool: "launch_application", arguments: { appName: "Chrome" } },
            ],
        };

        const execRes = await orchestrator.executePlan(plan, { isMock: true });
        assert.strictEqual(execRes.success, false, "Plan with unknown workspace must fail");
        assert.strictEqual(execRes.results[0].success, false);
        // Step 2 should not have executed
        assert.strictEqual(execRes.executedSteps, 1);
    });

    // =========================================================================
    // SECTION 4: CONVERSATION CONTEXT & ANSWER MODE
    // =========================================================================
    console.log("\n--- Section 4: Conversation Context & Answer Mode ---");

    await test("4.1 'Which workspaces do I have?' returns configured workspaces in Answer Mode", async () => {
        conversationContextService.clear();

        const res = await commandAgentService.executeCommand("Which workspaces do I have?", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.responseType, "answer");
        assert.strictEqual(res.executed, false);
        assert(typeof res.answerText === "string");
        assert(res.answerText?.includes("DSA"));
        assert(res.answerText?.includes("Data Science"));
        assert(res.answerText?.includes("Machine Learning"));
        assert(res.answerText?.includes("Hackathon"));
    });

    await test("4.2 Conversational follow-up: 'Start the Machine Learning one' resolves via context", async () => {
        const res = await commandAgentService.executeCommand("Start the Machine Learning one", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.responseType, "action");
        assert.strictEqual(res.intent, "launch_workspace");
        assert.strictEqual(res.appName, "Machine Learning");
        assert.strictEqual(res.executed, true);
    });

    await test("4.3 Unknown workspace command through CommandAgentService returns safe failure/clarification", async () => {
        const res = await commandAgentService.executeCommand("Launch my TotallyFakeWorkspace123", { isMock: true });
        assert.strictEqual(res.success, false);
        assert(res.error !== undefined || (res.responseType === "answer" && res.answerText !== undefined));
    });

    console.log("\n==========================================================================");
    console.log(`SUMMARY: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runWorkspaceAutomationTests().catch((err) => {
    console.error("Test runner encountered unhandled error:", err);
    process.exit(1);
});
