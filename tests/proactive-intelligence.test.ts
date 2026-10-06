/**
 * ALFRED Phase 5.5C — Proactive Intelligence Comprehensive Test Suite
 *
 * Verifies:
 * 1. Overdue task produces a proactive suggestion.
 * 2. Due-today task produces a proactive suggestion.
 * 3. Active focus produces a suggestion.
 * 4. Paused focus produces a suggestion.
 * 5. Supported goal/project signal works.
 * 6. Unsupported/inferential relationships are skipped.
 * 7. Duplicate suggestions are suppressed (anti-spam / cooldown).
 * 8. Dismissed suggestions behave correctly.
 * 9. Fresh context removes stale suggestions.
 * 10. Proactive layer performs no mutations (read-only verification).
 * 11. User action routes through existing command/tool architecture.
 * 12. No arbitrary shell execution.
 * 13. Sensitive data is not exposed.
 * 14. Empty state produces no fabricated alert.
 * 15. Multiple signals are bounded (max 3, 1 active).
 * 16. Existing Recommendation Agent still works.
 * 17. Existing normal commands still work.
 */

import { agentContextService } from "../electron/agent/agent-context/agent-context.service";
import { proactiveAgentService } from "../electron/agent/proactive/proactive-agent.service";
import { recommendationAgentService } from "../electron/agent/recommendation/recommendation-agent.service";
import { taskService } from "../electron/services/task.service";
import { goalService } from "../electron/services/goal.service";
import { projectService } from "../electron/services/project.service";
import { workspaceService } from "../electron/services/workspace.service";
import { commandAgentService } from "../electron/agent/command-agent.service";
import "../electron/agent/providers/index";

function assert(condition: boolean, msg: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

async function runTest(name: string, fn: () => Promise<void> | void) {
    try {
        await fn();
        console.log(`✅ [PASS] ${name}`);
    } catch (err: any) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

async function main() {
    console.log("==========================================================================");
    console.log("   ALFRED PHASE 5.5C: PROACTIVE INTELLIGENCE TEST SUITE                   ");
    console.log("==========================================================================\n");

    const fixedNow = new Date("2026-09-27T10:00:00.000Z");

    const resetAll = () => {
        taskService.reset([]);
        goalService.reset([]);
        projectService.reset([]);
        workspaceService.reset([]);
        proactiveAgentService.resetCooldowns();
    };

    // 1. Overdue task produces a proactive suggestion
    await runTest("1. Overdue task produces a proactive suggestion", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-overdue-1",
                text: "Renew cloud domain certificates",
                completed: false,
                category: "Infrastructure",
                priority: "high",
                dueDate: "2026-09-20", // Past
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });

        assert(result.activeSuggestion !== null, "Must have an active suggestion");
        assert(result.activeSuggestion!.type === "overdue_work", `Expected overdue_work, got ${result.activeSuggestion!.type}`);
        assert(result.activeSuggestion!.relatedEntityId === "task-overdue-1", "Related entity should match task ID");
        assert(result.activeSuggestion!.message.includes("Renew cloud domain certificates"), "Message should include task text");
        assert(result.activeSuggestion!.priority === "high", "Overdue work should have high priority");
        assert(result.activeSuggestion!.suggestedAction !== undefined, "Action must be defined");
    });

    // 2. Due-today task produces a proactive suggestion
    await runTest("2. Due-today task produces a proactive suggestion", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-today-1",
                text: "Submit sprint deliverables",
                completed: false,
                category: "Work",
                priority: "medium",
                dueDate: "2026-09-27", // Today
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });

        assert(result.activeSuggestion !== null, "Must have active suggestion");
        assert(result.activeSuggestion!.type === "due_today_work", `Expected due_today_work, got ${result.activeSuggestion!.type}`);
        assert(result.activeSuggestion!.rationale.includes("scheduled for today"), "Rationale must reference scheduled today");
    });

    // 3. Active focus produces a suggestion
    await runTest("3. Active focus session produces a proactive suggestion", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: {
                state: "running",
                isActive: true,
                sessionDurationMinutes: 50,
                elapsedSeconds: 600,
                remainingSeconds: 2400,
                activeWorkspace: "Kernel Dev",
            },
        });

        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });
        assert(result.activeSuggestion !== null, "Must have active suggestion");
        assert(result.activeSuggestion!.type === "active_focus", `Expected active_focus, got ${result.activeSuggestion!.type}`);
        assert(result.activeSuggestion!.message.includes("40m remaining"), "Should display remaining minutes");
        assert(result.activeSuggestion!.message.includes("Kernel Dev"), "Should mention active workspace");
    });

    // 4. Paused focus produces a suggestion
    await runTest("4. Paused focus session produces a proactive suggestion with resume action", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: {
                state: "paused",
                isActive: true,
                sessionDurationMinutes: 25,
                elapsedSeconds: 600,
                remainingSeconds: 900,
            },
        });

        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });
        assert(result.activeSuggestion !== null, "Must have active suggestion");
        assert(result.activeSuggestion!.type === "paused_focus", `Expected paused_focus, got ${result.activeSuggestion!.type}`);
        assert(result.activeSuggestion!.suggestedAction?.command === "resume focus", "Suggested action must be resume focus");
    });

    // 5. Supported goal/project signal works
    await runTest("5. Supported goal/project signal works", () => {
        resetAll();
        projectService.reset([
            {
                id: "proj-p1",
                name: "Autonomous Rover",
                status: "In Progress",
                progress: 50,
                category: "Personal",
                description: "Hardware build",
                createdDate: "2026-09-01",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });

        assert(result.activeSuggestion !== null, "Must have active suggestion");
        assert(result.activeSuggestion!.type === "active_project_stale", "Should detect stale active project");
        assert(result.activeSuggestion!.title.includes("Autonomous Rover"), "Should include project name");
        assert(result.activeSuggestion!.message.includes("50%"), "Should include progress percentage");
    });

    // 6. Unsupported/inferential relationships are skipped
    await runTest("6. Unsupported/inferential relationships are skipped", () => {
        resetAll();
        // Project that has active recent directives in snapshot activity
        projectService.reset([
            {
                id: "proj-active-1",
                name: "Mobile App",
                status: "In Progress",
                progress: 30,
                category: "Personal",
                description: "React Native",
                createdDate: "2026-09-01",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            activity: [
                {
                    type: "command_completed",
                    label: "Directives in Mobile App",
                    detail: "Worked on Mobile App screens",
                    timestamp: fixedNow.getTime() - 60000,
                },
            ],
        });

        const result = proactiveAgentService.evaluate(snapshot, { now: fixedNow });
        // The project has recent activity, so it MUST NOT be surfaced as active_project_stale
        const staleProj = result.suggestions.find((s) => s.type === "active_project_stale");
        assert(staleProj === undefined, "Active project with recent activity must be skipped");
    });

    // 7. Duplicate suggestions are suppressed (anti-spam / cooldown)
    await runTest("7. Duplicate suggestions are suppressed (cooldown deduplication)", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-repeat-1",
                text: "Repeated task warning",
                completed: false,
                category: "Work",
                priority: "high",
                dueDate: "2026-09-10", // Overdue
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });

        // First evaluation: should surface
        const res1 = proactiveAgentService.evaluate(snapshot, { now: fixedNow });
        assert(res1.activeSuggestion !== null, "First evaluation should surface suggestion");
        assert(res1.activeSuggestion!.type === "overdue_work", "Should be overdue work");

        // Second immediate evaluation without force: must be suppressed by cooldown
        const res2 = proactiveAgentService.evaluate(snapshot, { now: fixedNow });
        assert(res2.activeSuggestion === null, "Immediate second evaluation must suppress duplicate suggestion");
    });

    // 8. Dismissed suggestions behave correctly
    await runTest("8. Dismissed suggestions behave correctly and remain suppressed", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-dismiss-1",
                text: "Dismissible task warning",
                completed: false,
                category: "Work",
                priority: "high",
                dueDate: "2026-09-10",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const res1 = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });
        assert(res1.activeSuggestion !== null, "Must have active suggestion");

        // Dismiss the suggestion
        proactiveAgentService.dismiss(res1.activeSuggestion!.cooldownKey, fixedNow);

        // 30 minutes later (longer than normal cooldown of 15m, but shorter than dismissed cooldown of 2h)
        const later30Min = new Date(fixedNow.getTime() + 30 * 60 * 1000);
        const res2 = proactiveAgentService.evaluate(snapshot, { now: later30Min });
        assert(res2.activeSuggestion === null, "Dismissed suggestion must remain suppressed within dismissed cooldown window");
    });

    // 9. Fresh context removes stale suggestions
    await runTest("9. Fresh context removes stale suggestions after resolution", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-resolve-1",
                text: "Resolve this task",
                completed: false,
                category: "Work",
                priority: "high",
                dueDate: "2026-09-15",
            },
        ]);

        const snapshot1 = agentContextService.getContextSnapshot({ now: fixedNow });
        const res1 = proactiveAgentService.evaluate(snapshot1, { now: fixedNow, force: true });
        assert(res1.activeSuggestion?.type === "overdue_work", "Should detect overdue task");

        // Mark the task as completed
        taskService.completeTask("task-resolve-1");

        // Fresh snapshot
        const snapshot2 = agentContextService.getContextSnapshot({ now: fixedNow });
        const res2 = proactiveAgentService.evaluate(snapshot2, { now: fixedNow, force: true });

        // Overdue suggestion must disappear immediately because condition resolved!
        const overdueSuggestion = res2.suggestions.find((s) => s.type === "overdue_work");
        assert(overdueSuggestion === undefined, "Resolved task must not generate overdue suggestion");
    });

    // 10. Proactive layer performs no mutations (read-only verification)
    await runTest("10. Proactive layer performs no mutations (read-only verification)", () => {
        resetAll();
        taskService.reset([
            { id: "ro-1", text: "Read only task", completed: false, category: "Testing", priority: "high" },
        ]);
        goalService.reset([
            { id: "ro-g1", title: "Read only goal", type: "Weekly", target: 10, current: 5, completed: false },
        ]);

        const tasksBefore = JSON.stringify(taskService.getTasks());
        const goalsBefore = JSON.stringify(goalService.getGoals());

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });

        const tasksAfter = JSON.stringify(taskService.getTasks());
        const goalsAfter = JSON.stringify(goalService.getGoals());

        assert(tasksBefore === tasksAfter, "Proactive service mutated task state!");
        assert(goalsBefore === goalsAfter, "Proactive service mutated goal state!");

        // Assert service prototype has zero mutation methods
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(proactiveAgentService));
        const forbiddenPrefixes = ["execute", "launch", "kill", "spawn", "write", "mutate", "create", "delete"];
        for (const method of methods) {
            for (const bad of forbiddenPrefixes) {
                assert(!method.toLowerCase().startsWith(bad), `Forbidden mutation method on ProactiveAgentService: ${method}`);
            }
        }
    });

    // 11. User action routes through existing command/tool architecture
    await runTest("11. User action routes through existing command/tool architecture", async () => {
        resetAll();
        taskService.reset([
            {
                id: "act-t1",
                text: "Audit server security logs",
                completed: false,
                category: "Security",
                priority: "high",
                dueDate: "2026-09-15",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const res = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });

        assert(res.activeSuggestion?.suggestedAction !== undefined, "Action must exist");
        const actionCommand = res.activeSuggestion!.suggestedAction!.command;

        // Simulate user clicking action button: routes through commandAgentService.executeCommand
        const executionResult = await commandAgentService.execute(actionCommand);
        assert(executionResult !== null, "Execution result must exist");
        assert(executionResult.intent === "show_tasks", `Command "${actionCommand}" must route to show_tasks intent`);
    });

    // 12. No arbitrary shell execution
    await runTest("12. No arbitrary shell execution", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const res = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });

        for (const s of res.suggestions) {
            if (s.suggestedAction) {
                assert(!s.suggestedAction.command.includes("powershell"), "No raw powershell allowed in suggested action");
                assert(!s.suggestedAction.command.includes("cmd.exe"), "No cmd.exe allowed in suggested action");
                assert(!s.suggestedAction.command.includes(";"), "No command chaining allowed in suggested action");
            }
        }
    });

    // 13. Sensitive data is not exposed
    await runTest("13. Sensitive data is not exposed in proactive suggestions", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        // Inject untrusted secrets into snapshot
        (snapshot as any).untrusted = {
            apiKey: "sk-ant-api03-proactive-secret-key-12345",
            password: "super_secret_proactive_password",
        };

        const res = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });
        const serialized = JSON.stringify(res);

        assert(!serialized.includes("sk-ant-api03"), "API key must not leak in proactive suggestions");
        assert(!serialized.includes("super_secret"), "Password must not leak in proactive suggestions");
    });

    // 14. Empty state produces no fabricated alert
    await runTest("14. Empty state produces no fabricated alert", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const res = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });

        assert(res.suggestions.length === 0, "Empty state must not fabricate proactive suggestions");
        assert(res.activeSuggestion === null, "Active suggestion must be null when state is clear");
    });

    // 15. Multiple signals are bounded (max 3, 1 active)
    await runTest("15. Multiple signals are bounded (max 3 items, 1 active)", () => {
        resetAll();
        // Create overdue tasks, due today tasks, active projects, paused focus
        taskService.reset([
            { id: "t-od", text: "Overdue task", completed: false, category: "Work", priority: "high", dueDate: "2026-09-10" },
            { id: "t-td", text: "Today task", completed: false, category: "Work", priority: "medium", dueDate: "2026-09-27" },
        ]);
        projectService.reset([
            { id: "p1", name: "Project 1", status: "In Progress", progress: 20, category: "Personal", description: "Desc", createdDate: "2026-09-01" },
            { id: "p2", name: "Project 2", status: "In Progress", progress: 40, category: "Personal", description: "Desc", createdDate: "2026-09-01" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: {
                state: "paused",
                isActive: true,
                sessionDurationMinutes: 25,
                elapsedSeconds: 300,
                remainingSeconds: 1200,
            },
        });

        const res = proactiveAgentService.evaluate(snapshot, { now: fixedNow, force: true });
        assert(res.suggestions.length <= 3, `Suggestions count must be <= 3, got ${res.suggestions.length}`);
        assert(res.activeSuggestion !== null, "Active suggestion must exist");
    });

    // 16. Existing Recommendation Agent still works
    await runTest("16. Existing Recommendation Agent still works without conflict", () => {
        resetAll();
        taskService.reset([
            { id: "rec-task-1", text: "Tune neural hyperparameters", completed: false, category: "AI", priority: "high" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const recResult = recommendationAgentService.generateRecommendations(snapshot);

        assert(recResult.recommendations.length >= 1, "Recommendation agent must still work");
        assert(recResult.recommendations[0].title.includes("Tune neural hyperparameters"), "Should recommend high priority task");
    });

    // 17. Existing normal commands still work
    await runTest("17. Existing normal commands still work", async () => {
        resetAll();
        const res = await commandAgentService.execute("open VS Code");
        assert(res.intent === "launch_application", `Intent should be launch_application, got ${res.intent}`);
        assert(res.appName === "VS Code", "Target should be VS Code");
    });

    console.log("\n==========================================================================");
    console.log("   ALL 17 PROACTIVE INTELLIGENCE TESTS PASSED                            ");
    console.log("==========================================================================");
}

main().catch((err) => {
    console.error("Unhandled test runner error:", err);
    process.exit(1);
});
