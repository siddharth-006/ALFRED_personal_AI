/**
 * ALFRED Phase 5.8A — Daily Routine Engine Test Suite
 *
 * Verifies all 21 mandatory requirements:
 * 1. Coding routine resolves correctly.
 * 2. Coding aliases resolve correctly.
 * 3. Data Science routine resolves correctly.
 * 4. ML routine resolves correctly.
 * 5. Hackathon routine resolves correctly.
 * 6. Unknown routine does not accidentally match.
 * 7. Ambiguous routine requests require clarification.
 * 8. Routine steps use only registered tools.
 * 9. Invalid tool names are rejected.
 * 10. Routine arguments are validated.
 * 11. Multi-step dependency ordering is preserved.
 * 12. Failed dependency prevents dependent execution.
 * 13. Routine does not directly access child_process/shell.
 * 14. Existing confirmation behavior is preserved.
 * 15. Cancellation executes zero tools.
 * 16. Routine execution goes through ToolRegistry.
 * 17. Existing normal commands continue working.
 * 18. Recommendations continue working.
 * 19. Proactive intelligence continues working.
 * 20. Agentic planning continues working.
 * 21. Voice/TTS behavior remains compatible.
 */

import assert from "assert";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { routineService, Routine } from "../electron/agent/routines";
import { toolRegistry } from "../electron/agent/tools/tool-registry";
import { confirmationStore } from "../electron/agent/risk/confirmation-store";
import { proactiveAgentService } from "../electron/agent/proactive/proactive-agent.service";
import { recommendationAgentService } from "../electron/agent/recommendation/recommendation-agent.service";
import { agentContextService } from "../electron/agent/agent-context/agent-context.service";
import { workspaceService } from "../electron/services/workspace.service";
import { taskService } from "../electron/services/task.service";
import { goalService } from "../electron/services/goal.service";
import { projectService } from "../electron/services/project.service";
import { focusService } from "../electron/services/focus.service";
import { formatSpokenResponse, sanitizeTextForSpeech } from "../src/utils/responseSpeechFormatter";

async function runTest(name: string, fn: () => Promise<void> | void) {
    try {
        await fn();
        console.log(`✅ [PASS] ${name}`);
    } catch (err: any) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

function resetEnvironment() {
    confirmationStore.clear();
    routineService.reset();
    workspaceService.reset();
    taskService.reset();
    goalService.reset();
    projectService.reset();
    focusService.reset();
    proactiveAgentService.resetCooldowns();
}

async function main() {
    console.log("==========================================================================");
    console.log("   ALFRED PHASE 5.8A: DAILY ROUTINE ENGINE COMPREHENSIVE TEST SUITE       ");
    console.log("==========================================================================\n");

    // 1. Coding routine resolves correctly
    await runTest("1. Coding routine resolves correctly", async () => {
        resetEnvironment();
        const res = routineService.resolveRoutine("Start coding mode");
        assert.strictEqual(res.matched, true, "Must match Coding Mode");
        assert.strictEqual(res.routine?.id, "routine_coding_mode");
        assert.strictEqual(res.routine?.name, "Coding Mode");
        assert.strictEqual(res.routine?.steps.length, 3);
        assert.strictEqual(res.routine?.steps[0].toolName, "launch_workspace");
        assert.strictEqual(res.routine?.steps[1].toolName, "launch_application");
        assert.strictEqual(res.routine?.steps[2].toolName, "start_deep_work");

        const cmdRes = await commandAgentService.execute("Start coding mode", { isMock: true });
        assert.strictEqual(cmdRes.success, true);
        assert.strictEqual(cmdRes.requiresConfirmation, true, "Routine must pause for confirmation");
        assert.strictEqual(cmdRes.executed, false, "Must not execute prior to confirmation");
        assert.strictEqual(cmdRes.routine?.id, "routine_coding_mode");
        assert(cmdRes.confirmationId !== undefined);
        assert(cmdRes.agenticPlan !== undefined);
        assert.strictEqual(cmdRes.agenticPlan!.steps.length, 3);
    });

    // 2. Coding aliases resolve correctly
    await runTest("2. Coding aliases resolve correctly", async () => {
        resetEnvironment();
        const aliasesToTest = [
            "start coding",
            "prepare my coding workspace",
            "start dsa mode",
            "coding mode",
            "dsa mode",
            "coding routine",
        ];

        for (const alias of aliasesToTest) {
            const res = routineService.resolveRoutine(alias);
            assert.strictEqual(res.matched, true, `Alias '${alias}' must resolve to Coding Mode`);
            assert.strictEqual(res.routine?.id, "routine_coding_mode");
        }
    });

    // 3. Data Science routine resolves correctly
    await runTest("3. Data Science routine resolves correctly", async () => {
        resetEnvironment();
        const res = routineService.resolveRoutine("Start data science mode");
        assert.strictEqual(res.matched, true, "Must match Data Science Mode");
        assert.strictEqual(res.routine?.id, "routine_datascience_mode");
        assert.strictEqual(res.routine?.name, "Data Science Mode");
        assert.strictEqual(res.routine?.steps[0].args.workspace, "Data Science");

        // Test aliases
        const aliases = ["start data science", "prepare my data science workspace", "start ds mode", "data science mode"];
        for (const a of aliases) {
            const aRes = routineService.resolveRoutine(a);
            assert.strictEqual(aRes.matched, true, `Alias '${a}' must match Data Science`);
            assert.strictEqual(aRes.routine?.id, "routine_datascience_mode");
        }

        const cmdRes = await commandAgentService.execute("Start data science mode", { isMock: true });
        assert.strictEqual(cmdRes.success, true);
        assert.strictEqual(cmdRes.requiresConfirmation, true);
        assert.strictEqual(cmdRes.routine?.id, "routine_datascience_mode");
    });

    // 4. ML routine resolves correctly
    await runTest("4. ML routine resolves correctly", async () => {
        resetEnvironment();
        const res = routineService.resolveRoutine("Start machine learning mode");
        assert.strictEqual(res.matched, true, "Must match Machine Learning Mode");
        assert.strictEqual(res.routine?.id, "routine_ml_mode");
        assert.strictEqual(res.routine?.name, "Machine Learning Mode");
        assert.strictEqual(res.routine?.steps[0].args.workspace, "Machine Learning");

        // Test aliases
        const aliases = ["start machine learning", "prepare my machine learning workspace", "start ml mode", "prepare my ml workspace", "start ml"];
        for (const a of aliases) {
            const aRes = routineService.resolveRoutine(a);
            assert.strictEqual(aRes.matched, true, `Alias '${a}' must match Machine Learning`);
            assert.strictEqual(aRes.routine?.id, "routine_ml_mode");
        }

        const cmdRes = await commandAgentService.execute("Start ml mode", { isMock: true });
        assert.strictEqual(cmdRes.success, true);
        assert.strictEqual(cmdRes.requiresConfirmation, true);
        assert.strictEqual(cmdRes.routine?.id, "routine_ml_mode");
    });

    // 5. Hackathon routine resolves correctly
    await runTest("5. Hackathon routine resolves correctly", async () => {
        resetEnvironment();
        const res = routineService.resolveRoutine("Start hackathon mode");
        assert.strictEqual(res.matched, true, "Must match Hackathon Mode");
        assert.strictEqual(res.routine?.id, "routine_hackathon_mode");
        assert.strictEqual(res.routine?.name, "Hackathon Mode");
        assert.strictEqual(res.routine?.steps[0].args.workspace, "Hackathon");

        // Test aliases
        const aliases = ["start hackathon", "prepare my hackathon workspace", "hackathon mode", "start hack mode", "hackathon sprint"];
        for (const a of aliases) {
            const aRes = routineService.resolveRoutine(a);
            assert.strictEqual(aRes.matched, true, `Alias '${a}' must match Hackathon`);
            assert.strictEqual(aRes.routine?.id, "routine_hackathon_mode");
        }

        const cmdRes = await commandAgentService.execute("Start hackathon mode", { isMock: true });
        assert.strictEqual(cmdRes.success, true);
        assert.strictEqual(cmdRes.requiresConfirmation, true);
        assert.strictEqual(cmdRes.routine?.id, "routine_hackathon_mode");
    });

    // 6. Unknown routine does not accidentally match
    await runTest("6. Unknown routine does not accidentally match", async () => {
        resetEnvironment();
        const unknownQueries = [
            "Start cooking mode",
            "Start gaming mode",
            "Start flying mode",
            "Prepare my sandwich",
            "open calculator",
        ];

        for (const q of unknownQueries) {
            const res = routineService.resolveRoutine(q);
            assert.strictEqual(res.matched, false, `Unknown query '${q}' must not match any routine`);
        }
    });

    // 7. Ambiguous routine requests require clarification
    await runTest("7. Ambiguous routine requests require clarification", async () => {
        resetEnvironment();
        const ambiguousQueries = ["start mode", "start routine", "prepare workspace"];

        for (const q of ambiguousQueries) {
            const res = routineService.resolveRoutine(q);
            assert.strictEqual(res.matched, false, `Ambiguous query '${q}' must not match a single routine`);
            assert.strictEqual(res.ambiguous, true, `Ambiguous query '${q}' must flag ambiguous: true`);
            assert(res.candidates && res.candidates.length > 1, "Must list candidate routines");
            assert.strictEqual(typeof res.clarificationPrompt, "string");
            assert.strictEqual(res.clarificationPrompt!.includes("Which routine"), true);

            const cmdRes = await commandAgentService.execute(q, { isMock: true });
            assert.strictEqual(cmdRes.executed, false, "Must not execute tools on ambiguous request");
            assert.strictEqual(cmdRes.responseType, "answer");
            assert.strictEqual(cmdRes.explanation?.includes("Which routine"), true);
        }
    });

    // 8. Routine steps use only registered tools
    await runTest("8. Routine steps use only registered tools", () => {
        resetEnvironment();
        const routines = routineService.getRoutines();
        for (const r of routines) {
            for (const step of r.steps) {
                assert(
                    toolRegistry.has(step.toolName),
                    `Tool '${step.toolName}' in routine '${r.name}' must be registered in ToolRegistry`
                );
            }
        }
    });

    // 9. Invalid tool names are rejected
    await runTest("9. Invalid tool names are rejected", () => {
        resetEnvironment();
        const invalidRoutine: Routine = {
            id: "routine_malicious",
            name: "Malicious Routine",
            description: "Attempts arbitrary tool execution",
            aliases: ["malicious"],
            steps: [
                {
                    id: "step-bad",
                    toolName: "system_shell_exec", // Not registered in ToolRegistry
                    args: { cmd: "dir" },
                },
            ],
            enabled: true,
        };

        const val = routineService.validateRoutine(invalidRoutine);
        assert.strictEqual(val.valid, false, "Must reject unregistered tool");
        assert(val.error?.includes("unregistered tool"), "Error must state tool is unregistered");
    });

    // 10. Routine arguments are validated
    await runTest("10. Routine arguments are validated", () => {
        resetEnvironment();
        // Shell metacharacter injection in args
        const injectionRoutine: Routine = {
            id: "routine_inject",
            name: "Injection Routine",
            description: "Attempts dangerous characters",
            aliases: ["inject"],
            steps: [
                {
                    id: "step-1",
                    toolName: "launch_workspace",
                    args: { workspace: "DSA; rm -rf /" },
                },
            ],
            enabled: true,
        };

        const val = routineService.validateRoutine(injectionRoutine);
        assert.strictEqual(val.valid, false, "Must reject shell metacharacters in arguments");
        assert(val.error?.includes("prohibited shell characters"), "Error must mention shell characters");

        // Missing required property for tool
        const missingArgRoutine: Routine = {
            id: "routine_missing_arg",
            name: "Missing Arg Routine",
            description: "Missing workspace",
            aliases: ["missing"],
            steps: [
                {
                    id: "step-1",
                    toolName: "launch_workspace",
                    args: {}, // missing workspace
                },
            ],
            enabled: true,
        };
        const valMissing = routineService.validateRoutine(missingArgRoutine);
        assert.strictEqual(valMissing.valid, false, "Must reject invalid tool args");
        assert(valMissing.error?.includes("argument validation failed"));
    });

    // 11. Multi-step dependency ordering is preserved
    await runTest("11. Multi-step dependency ordering is preserved", () => {
        resetEnvironment();
        const routine = routineService.getRoutineById("routine_coding_mode")!;
        const rawPlan = routineService.routineToAgentPlan(routine, "Start coding mode");

        assert.strictEqual(rawPlan.toolCalls.length, 3);
        assert.strictEqual(rawPlan.toolCalls[0].dependsOn, undefined);
        assert.deepStrictEqual(rawPlan.toolCalls[1].dependsOn, [0], "Step 1 must depend on Step 0");
        assert.deepStrictEqual(rawPlan.toolCalls[2].dependsOn, [1], "Step 2 must depend on Step 1");

        // Forward dependency must be rejected
        const forwardDepRoutine: Routine = {
            id: "routine_forward_dep",
            name: "Forward Dep Routine",
            description: "Invalid dependency",
            aliases: ["forward"],
            steps: [
                { id: "s1", toolName: "launch_workspace", args: { workspace: "DSA" }, dependsOn: [1] },
                { id: "s2", toolName: "start_deep_work", args: {} },
            ],
            enabled: true,
        };
        const val = routineService.validateRoutine(forwardDepRoutine);
        assert.strictEqual(val.valid, false);
        assert(val.error?.includes("forward reference"), "Must reject forward dependency");
    });

    // 12. Failed dependency prevents dependent execution
    await runTest("12. Failed dependency prevents dependent execution", async () => {
        resetEnvironment();
        // Construct a routine with a failing step 0 and dependent step 1
        const customRoutine: Routine = {
            id: "routine_failing_prereq",
            name: "Failing Routine",
            description: "Step 0 fails, Step 1 should skip",
            aliases: ["failing test routine"],
            steps: [
                {
                    id: "s1",
                    toolName: "launch_workspace",
                    // Request an invalid workspace that fails resolution
                    args: { workspace: "InvalidNonExistentWorkspace999" },
                },
                {
                    id: "s2",
                    toolName: "start_deep_work",
                    args: {},
                    dependsOn: [0],
                },
            ],
            enabled: true,
        };

        routineService.reset([customRoutine]);

        const planRes = await commandAgentService.execute("failing test routine", { isMock: true });
        assert(planRes.confirmationId !== undefined);

        // Confirm execution
        const execRes = await commandAgentService.confirmAction(planRes.confirmationId!);
        assert.strictEqual(execRes.success, false, "Overall execution must report false due to step failure");
        assert(execRes.steps !== undefined, "Steps must be reported");
        assert.strictEqual(execRes.steps.length, 2);

        // Step 0 must have failed
        assert.strictEqual(execRes.steps[0].success, false, "Step 0 must have failed");

        // Step 1 must have been skipped
        assert.strictEqual(execRes.steps[1].skipped, true, "Step 1 must be skipped");
        assert(execRes.steps[1].skipReason?.includes("failed"), "Skip reason must cite prerequisite failure");
    });

    // 13. Routine does not directly access child_process/shell
    await runTest("13. Routine does not directly access child_process/shell", () => {
        resetEnvironment();
        const routineCatalogStr = JSON.stringify(routineService.getRoutines());
        assert(!routineCatalogStr.includes("child_process"), "Catalog must not reference child_process");
        assert(!routineCatalogStr.includes("execSync"), "Catalog must not reference execSync");
        assert(!routineCatalogStr.includes("spawn"), "Catalog must not reference spawn");
    });

    // 14. Existing confirmation behavior is preserved
    await runTest("14. Existing confirmation behavior is preserved", async () => {
        resetEnvironment();
        const planRes = await commandAgentService.execute("Start coding mode", { isMock: true });
        assert.strictEqual(planRes.requiresConfirmation, true);
        assert.strictEqual(planRes.executed, false);
        const confId = planRes.confirmationId!;

        // Confirm with "Yes"
        const confirmRes = await commandAgentService.execute("Yes", { isMock: true });
        assert.strictEqual(confirmRes.success, true);
        assert.strictEqual(confirmRes.confirmed, true);
        assert.strictEqual(confirmRes.executed, true);
        assert.strictEqual(confirmRes.steps?.length, 3);
        assert(confirmRes.steps?.every((s) => s.success), "All 3 routine steps must succeed");

        // Confirmation ID is consumed; re-confirming must fail
        const reConfirm = await commandAgentService.confirmAction(confId);
        assert.strictEqual(reConfirm.success, false, "Consumed confirmation cannot be re-executed");
    });

    // 15. Cancellation executes zero tools
    await runTest("15. Cancellation executes zero tools", async () => {
        resetEnvironment();
        const planRes = await commandAgentService.execute("Start coding mode", { isMock: true });
        assert(planRes.confirmationId !== undefined);

        // Cancel with "No"
        const cancelRes = await commandAgentService.execute("No", { isMock: true });
        assert.strictEqual(cancelRes.cancelled, true);
        assert.strictEqual(cancelRes.executed, false);

        // Confirmation cannot execute after cancel
        const confirmAfterCancel = await commandAgentService.confirmAction(planRes.confirmationId!);
        assert.strictEqual(confirmAfterCancel.success, false);
    });

    // 16. Routine execution goes through ToolRegistry
    await runTest("16. Routine execution goes through ToolRegistry", async () => {
        resetEnvironment();
        let workspaceToolExecuted = false;
        let appToolExecuted = false;
        let deepWorkExecuted = false;

        const origWsExec = toolRegistry.get("launch_workspace")!.execute;
        const origAppExec = toolRegistry.get("launch_application")!.execute;
        const origDwExec = toolRegistry.get("start_deep_work")!.execute;

        toolRegistry.get("launch_workspace")!.execute = async (input, opt) => {
            workspaceToolExecuted = true;
            return origWsExec(input, opt);
        };
        toolRegistry.get("launch_application")!.execute = async (input, opt) => {
            appToolExecuted = true;
            return origAppExec(input, opt);
        };
        toolRegistry.get("start_deep_work")!.execute = async (input, opt) => {
            deepWorkExecuted = true;
            return origDwExec(input, opt);
        };

        try {
            const planRes = await commandAgentService.execute("Start coding mode", { isMock: true });
            assert.strictEqual(workspaceToolExecuted, false, "No tool may execute before confirmation");
            assert.strictEqual(appToolExecuted, false);
            assert.strictEqual(deepWorkExecuted, false);

            await commandAgentService.confirmAction(planRes.confirmationId!);
            assert.strictEqual(workspaceToolExecuted, true, "launch_workspace must execute through ToolRegistry");
            assert.strictEqual(appToolExecuted, true, "launch_application must execute through ToolRegistry");
            assert.strictEqual(deepWorkExecuted, true, "start_deep_work must execute through ToolRegistry");
        } finally {
            toolRegistry.get("launch_workspace")!.execute = origWsExec;
            toolRegistry.get("launch_application")!.execute = origAppExec;
            toolRegistry.get("start_deep_work")!.execute = origDwExec;
        }
    });

    // 17. Existing normal commands continue working
    await runTest("17. Existing normal commands continue working", async () => {
        resetEnvironment();
        const res = await commandAgentService.execute("open VS Code", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.intent, "launch_application");
        assert.strictEqual(res.appName, "VS Code");
        assert.strictEqual(res.executed, true);
        assert.strictEqual(res.requiresConfirmation, undefined, "Simple command must not require confirmation");
    });

    // 18. Recommendations continue working
    await runTest("18. Recommendations continue working", async () => {
        resetEnvironment();
        const res = await commandAgentService.execute("What should I work on now?", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.intent, "recommendation");
        assert(res.recommendations && res.recommendations.length > 0);
        assert.strictEqual(res.executed, false);
    });

    // 19. Proactive intelligence continues working
    await runTest("19. Proactive intelligence continues working", async () => {
        resetEnvironment();
        const snapshot = agentContextService.getContextSnapshot();
        const proactiveRes = proactiveAgentService.evaluate(snapshot);
        assert(proactiveRes !== undefined);
        assert(Array.isArray(proactiveRes.suggestions));
    });

    // 20. Agentic planning continues working
    await runTest("20. Agentic planning continues working", async () => {
        resetEnvironment();
        const res = await commandAgentService.execute("Prepare me for coding", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.intent, "agentic_plan");
        assert.strictEqual(res.requiresConfirmation, true);
        assert(res.agenticPlan !== undefined);
        assert(res.agenticPlan!.steps.length >= 3);
    });

    // 21. Voice/TTS behavior remains compatible
    await runTest("21. Voice/TTS behavior remains compatible", async () => {
        resetEnvironment();
        // Listing routines inquiry
        const listRes = await commandAgentService.execute("What routines do you have?", { isMock: true });
        assert.strictEqual(listRes.success, true);
        assert.strictEqual(listRes.executed, false, "Listing must be read-only");
        assert.strictEqual(listRes.responseType, "answer");
        assert(listRes.answerText?.includes("Coding Mode"));
        assert(listRes.answerText?.includes("Data Science Mode"));
        assert(listRes.answerText?.includes("Machine Learning Mode"));
        assert(listRes.answerText?.includes("Hackathon Mode"));

        const spokenList = formatSpokenResponse(listRes);
        assert(spokenList !== null);
        assert(!spokenList.includes("{"), "Spoken list must not contain JSON");
        assert(!spokenList.includes("routine_coding_mode"), "Spoken list must not expose internal IDs");

        // Routine proposal prompt speech
        const routineRes = await commandAgentService.execute("Start coding mode", { isMock: true });
        const spokenProposal = formatSpokenResponse(routineRes);
        assert(spokenProposal !== null);
        assert(spokenProposal.toLowerCase().includes("proceed"), "Spoken proposal must ask to proceed");
        assert(!spokenProposal.includes("{"), "Spoken proposal must not contain JSON");
        assert(!spokenProposal.includes("routine_coding_mode"), "Spoken proposal must not expose internal IDs");
    });

    console.log("\n==========================================================================");
    console.log("   ALL 21 ROUTINE ENGINE TESTS PASSED SUCCESSFULLY!                      ");
    console.log("==========================================================================");
}

main().catch((err) => {
    console.error("Fatal error in routine-engine.test.ts:", err);
    process.exit(1);
});
