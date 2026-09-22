"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_orchestrator_1 = require("./agent-orchestrator");
const mock_planner_1 = require("./mock-planner");
const tool_registry_1 = require("../tools/tool-registry");
const launch_application_tool_1 = require("../tools/builtins/launch-application.tool");
const navigate_tool_1 = require("../tools/builtins/navigate.tool");
const system_status_tool_1 = require("../tools/builtins/system-status.tool");
const start_deep_work_tool_1 = require("../tools/builtins/start-deep-work.tool");
const launch_workspace_tool_1 = require("../tools/builtins/launch-workspace.tool");
const show_tasks_tool_1 = require("../tools/builtins/show-tasks.tool");
const open_url_tool_1 = require("../tools/builtins/open-url.tool");
const open_path_tool_1 = require("../tools/builtins/open-path.tool");
const command_agent_service_1 = require("../command-agent.service");
/**
 * ALFRED Agent Tool Calling & Orchestration Test Suite (Phase 3.3 - Step 2)
 *
 * Verifies orchestration pipeline, tool execution validation, multi-tool plan handling,
 * error recovery, security enforcement, and Phase 3.2 backwards compatibility.
 *
 * NOTE: All application execution tests run with `{ isMock: true }` so NO real OS processes are spawned.
 */
async function runOrchestrationTests() {
    console.log("==========================================================================");
    console.log("ALFRED Agent Tool Orchestration — Step 2 Comprehensive Test Suite");
    console.log("==========================================================================\n");
    let passed = 0;
    let failed = 0;
    function assert(condition, testName, detail) {
        if (condition) {
            passed++;
            console.log(`✅ [PASS] ${testName}`);
            if (detail)
                console.log(`   Detail: ${detail}`);
        }
        else {
            failed++;
            console.log(`❌ [FAIL] ${testName}`);
            if (detail)
                console.log(`   Failure Detail: ${detail}`);
        }
    }
    // Set up clean registry with built-in tools
    const registry = new tool_registry_1.ToolRegistry();
    const defaultTools = [
        launch_application_tool_1.launchApplicationTool,
        navigate_tool_1.navigateTool,
        system_status_tool_1.systemStatusTool,
        start_deep_work_tool_1.startDeepWorkTool,
        launch_workspace_tool_1.launchWorkspaceTool,
        show_tasks_tool_1.showTasksTool,
        open_url_tool_1.openUrlTool,
        open_path_tool_1.openPathTool,
    ];
    for (const tool of defaultTools) {
        registry.register(tool);
    }
    const planner = new mock_planner_1.MockAgentPlanner();
    const orchestrator = new agent_orchestrator_1.AgentOrchestrator(planner, registry);
    // 1. Single tool call
    try {
        const res = await orchestrator.execute("Open VS Code", { isMock: true });
        assert(res.success === true && res.results.length === 1 && res.results[0].tool === "launch_application", "1. Single tool call execution ('Open VS Code')", `Executed tool: ${res.results[0]?.tool}`);
    }
    catch (err) {
        assert(false, "1. Single tool call execution", String(err));
    }
    // 2. Multiple tool calls (multi-step plan)
    try {
        const res = await orchestrator.execute("Prepare my coding workspace", { isMock: true });
        assert(res.success === true &&
            res.results.length === 2 &&
            res.results[0].tool === "launch_application" &&
            res.results[1].tool === "launch_application", "2. Multiple tool calls execution ('Prepare my coding workspace' -> 2 apps)", `Executed ${res.results.length} tool calls`);
    }
    catch (err) {
        assert(false, "2. Multiple tool calls execution", String(err));
    }
    // 3. Valid tool arguments
    try {
        const res = await orchestrator.execute("Open missions");
        assert(res.success === true &&
            res.results[0]?.tool === "navigate" &&
            res.results[0]?.data?.targetPath === "/tasks", "3. Valid tool arguments ('Open missions' -> targetPath: /tasks)");
    }
    catch (err) {
        assert(false, "3. Valid tool arguments", String(err));
    }
    // 4. Unknown tool rejection
    try {
        const res = await orchestrator.execute("Test unknown tool");
        assert(res.success === false &&
            res.results.length === 1 &&
            res.results[0].tool === "non_existent_tool" &&
            Boolean(res.results[0].error?.includes("Unknown tool")), "4. Unknown tool rejection (unregistered tool call safely rejected)", `Error message: ${res.results[0]?.error}`);
    }
    catch (err) {
        assert(false, "4. Unknown tool rejection", String(err));
    }
    // 5. Invalid arguments rejection
    try {
        const res = await orchestrator.execute("Test invalid args", { isMock: true });
        assert(res.success === false &&
            res.results.length === 1 &&
            res.results[0].tool === "launch_application" &&
            Boolean(res.results[0].error?.includes("Unsupported")), "5. Invalid tool arguments rejection (calc.exe rejected by AppResolverTool)", `Error message: ${res.results[0]?.error}`);
    }
    catch (err) {
        assert(false, "5. Invalid arguments rejection", String(err));
    }
    // 6. Tool execution failure handling
    try {
        const res = await orchestrator.execute("Test injection payload", { isMock: true });
        assert(res.success === false &&
            res.results.length === 1 &&
            Boolean(res.results[0].error?.includes("invalid shell characters")), "6. Tool execution failure handling (shell metacharacter injection blocked)", `Error message: ${res.results[0]?.error}`);
    }
    catch (err) {
        assert(false, "6. Tool execution failure handling", String(err));
    }
    // 7. Multiple tool calls where one fails (partial failure)
    try {
        const res = await orchestrator.execute("Test multi-tool partial failure", { isMock: true });
        assert(res.success === false &&
            res.results.length === 2 &&
            res.results[0].success === true &&
            res.results[1].success === false, "7. Multiple tool calls where one fails (1 pass, 1 fail correctly captured)", `Tool 1 success: ${res.results[0]?.success}, Tool 2 success: ${res.results[1]?.success}`);
    }
    catch (err) {
        assert(false, "7. Multiple tool calls where one fails", String(err));
    }
    // 8. Security: Planner cannot bypass Tool Registry
    try {
        // Create a rogue planner that attempts to return a tool call targeting dynamic evaluation
        class RoguePlanner {
            plan(userRequest) {
                return {
                    userRequest,
                    explanation: "Attempting bypass",
                    toolCalls: [
                        { tool: "launch_application", arguments: { appName: "../../cmd.exe" } },
                        { tool: "raw_shell_exec", arguments: { command: "dir" } },
                    ],
                };
            }
        }
        const rogueOrchestrator = new agent_orchestrator_1.AgentOrchestrator(new RoguePlanner(), registry);
        const res = await rogueOrchestrator.execute("do evil", { isMock: true });
        const pathTraversalBlocked = res.results[0]?.success === false;
        // In Phase 4.14 sequential failure halting, step 2 is never executed after step 1 fails; or if executed, rejected by registry
        const rawShellBlocked = res.results.length === 1 || (res.results[1]?.success === false && Boolean(res.results[1]?.error?.includes("Unknown tool")));
        assert(res.success === false && pathTraversalBlocked && rawShellBlocked, "8. Security: Planner cannot bypass Tool Registry (traversal and unregistered shell tool rejected)");
    }
    catch (err) {
        assert(false, "8. Security: Planner cannot bypass Tool Registry", String(err));
    }
    // 9. Empty / unknown user request
    try {
        const emptyRes = await orchestrator.execute("");
        const unknownRes = await orchestrator.execute("Do something completely random and unmapped");
        assert(emptyRes.success === false &&
            Boolean(emptyRes.error?.includes("cannot be empty")) &&
            unknownRes.success === false &&
            unknownRes.results.length === 0, "9. Empty / unknown user request handling (empty and unmapped prompts handled safely)");
    }
    catch (err) {
        assert(false, "9. Empty/unknown user request", String(err));
    }
    // 10. Existing Phase 3.2 command functionality remains unaffected
    try {
        const p32Result1 = await command_agent_service_1.commandAgentService.parseCommand("Open VS Code");
        const p32Result2 = await command_agent_service_1.commandAgentService.parseCommand("Start Deep Work");
        const p32Result3 = await command_agent_service_1.commandAgentService.parseCommand("Show my goals");
        assert(p32Result1.intent === "launch_application" &&
            p32Result2.intent === "start_deep_work" &&
            p32Result3.intent === "navigate", "10. Existing Phase 3.2 command functionality remains unaffected (CommandAgentService intact)");
    }
    catch (err) {
        assert(false, "10. Phase 3.2 backwards compatibility", String(err));
    }
    console.log("\n==========================================================================");
    console.log(`Agent Orchestration Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    if (failed > 0) {
        process.exit(1);
    }
}
runOrchestrationTests();
