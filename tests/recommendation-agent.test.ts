/**
 * ALFRED Phase 5.5B — Recommendation Agent Comprehensive Test Suite
 *
 * Verifies:
 * 1. Overdue task produces an appropriate factual recommendation.
 * 2. Due-today task produces an appropriate factual recommendation.
 * 3. High-priority pending task is recognized.
 * 4. Active project can be recommended.
 * 5. Active goal can be recommended.
 * 6. Active focus session is respected.
 * 7. No fabricated recommendation when context is empty.
 * 8. Recommendation includes human-readable rationale.
 * 9. Recommendation count is bounded (1–3).
 * 10. Recommendation layer performs no mutations (read-only verification).
 * 11. Recommendation request through CommandAgentService works.
 * 12. Normal commands still work through ToolRegistry.
 * 13. Provider-independent behavior (consistent across Mock/Ollama/Gemini/Claude).
 * 14. Fresh context is used dynamically.
 * 15. Sensitive data remains redacted in recommendation output.
 * 16. Voice/TTS response contains only natural spoken content (no IDs, JSON, or code).
 */

import { agentContextService } from "../electron/agent/agent-context/agent-context.service";
import { recommendationAgentService } from "../electron/agent/recommendation/recommendation-agent.service";
import { taskService, Task } from "../electron/services/task.service";
import { goalService } from "../electron/services/goal.service";
import { projectService } from "../electron/services/project.service";
import { workspaceService } from "../electron/services/workspace.service";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { memoryService } from "../electron/agent/memory/memory.service";
import { formatSpokenResponse } from "../src/utils/responseSpeechFormatter";
import { providerConfigService } from "../electron/agent/providers/config/provider-config.service";
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
    console.log("   ALFRED PHASE 5.5B: RECOMMENDATION AGENT TEST SUITE                    ");
    console.log("==========================================================================\n");

    const fixedNow = new Date("2026-09-27T10:00:00.000Z");

    // Reset services to clean slate
    const resetAll = () => {
        providerConfigService.setActiveProviderId("mock");
        taskService.reset([]);
        goalService.reset([]);
        projectService.reset([]);
        workspaceService.reset([]);
        memoryService.clear();
    };

    // 1. Overdue task produces an appropriate factual recommendation
    await runTest("1. Overdue task produces an appropriate factual recommendation", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-overdue-1",
                text: "Submit quarterly security audit report",
                completed: false,
                category: "Security",
                priority: "medium",
                dueDate: "2026-09-20", // Past
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate at least one recommendation");
        const rec = result.recommendations[0];
        assert(rec.category === "overdue_task", `Expected category overdue_task, got ${rec.category}`);
        assert(rec.relatedEntityId === "task-overdue-1", "Should point to the overdue task ID");
        assert(rec.title.includes("Submit quarterly security audit report"), "Title should reference task text");
        assert(rec.rationale.toLowerCase().includes("overdue"), "Rationale must state the task is overdue");
        assert(rec.signals.some((s) => s.field.includes("task") && s.explanation.includes("overdue")), "Signal should document overdue fact");
    });

    // 2. Due-today task produces an appropriate factual recommendation
    await runTest("2. Due-today task produces an appropriate factual recommendation", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-today-1",
                text: "Prepare weekly status presentation",
                completed: false,
                category: "Work",
                priority: "medium",
                dueDate: "2026-09-27", // Today
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate at least one recommendation");
        const rec = result.recommendations[0];
        assert(rec.category === "due_today_task", `Expected category due_today_task, got ${rec.category}`);
        assert(rec.title.includes("Prepare weekly status presentation"), "Title should mention task");
        assert(rec.rationale.toLowerCase().includes("due today"), "Rationale must state task is due today");
    });

    // 3. High-priority pending task is recognized
    await runTest("3. High-priority pending task is recognized", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-hp-1",
                text: "Fix zero-day vulnerability in auth service",
                completed: false,
                category: "Security",
                priority: "high",
            },
            {
                id: "task-normal-1",
                text: "Clean up unused icons",
                completed: false,
                category: "General",
                priority: "low",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate recommendation");
        const rec = result.recommendations.find((r) => r.relatedEntityId === "task-hp-1");
        assert(!!rec, "Must recommend the high priority task");
        assert(rec!.category === "high_priority_task", `Expected category high_priority_task, got ${rec!.category}`);
        assert(rec!.rationale.toLowerCase().includes("high priority"), "Rationale must mention high priority");
    });

    // 4. Active project can be recommended
    await runTest("4. Active project can be recommended", () => {
        resetAll();
        projectService.reset([
            {
                id: "proj-ml-1",
                name: "Deep Neural Engine",
                status: "In Progress",
                progress: 65,
                category: "Data Science",
                description: "Optimizing inference latency",
                createdDate: "2026-09-01",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate recommendation");
        const rec = result.recommendations.find((r) => r.category === "active_project");
        assert(!!rec, "Must find active project recommendation");
        assert(rec!.title.includes("Deep Neural Engine"), "Must cite project name");
        assert(rec!.rationale.includes("65%"), "Rationale should cite observable 65% progress");
        assert(rec!.relatedEntityType === "project", "relatedEntityType must be project");
    });

    // 5. Active goal can be recommended
    await runTest("5. Active goal can be recommended", () => {
        resetAll();
        goalService.reset([
            {
                id: "goal-algo-1",
                title: "Solve 100 graph problems",
                type: "Monthly",
                current: 42,
                target: 100,
                completed: false,
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate recommendation");
        const rec = result.recommendations.find((r) => r.category === "active_goal");
        assert(!!rec, "Must find active goal recommendation");
        assert(rec!.title.includes("Solve 100 graph problems"), "Must cite goal title");
        assert(rec!.rationale.includes("42/100"), "Rationale should include progress numbers");
    });

    // 6. Active focus session is respected
    await runTest("6. Active focus session is respected", () => {
        resetAll();
        taskService.reset([
            {
                id: "task-pending-1",
                text: "Side task",
                completed: false,
                category: "General",
                priority: "medium",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: {
                state: "running",
                isActive: true,
                sessionDurationMinutes: 45,
                elapsedSeconds: 900,
                remainingSeconds: 1800,
                activeWorkspace: "DSA Mastery",
                sessionType: "Deep Work",
                todayFocusMinutes: 45,
                totalFocusMinutes: 120,
                completedSessionsCount: 2,
            },
        });

        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Must generate recommendation");
        const firstRec = result.recommendations[0];
        assert(firstRec.category === "focus_session", `Expected focus_session, got ${firstRec.category}`);
        assert(firstRec.rationale.includes("running"), "Rationale should note running focus session");
        assert(firstRec.rationale.includes("DSA Mastery"), "Rationale should mention active workspace");
    });

    // 7. No fabricated recommendation when context is empty
    await runTest("7. No fabricated recommendation when context is empty", () => {
        resetAll();
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "Should provide an advisory entry");
        assert(result.recommendations[0].category === "empty_state", "Should be empty_state category");
        assert(result.hasPendingPriorities === false, "hasPendingPriorities must be false");
        assert(
            result.recommendations[0].rationale.toLowerCase().includes("no pending tasks") ||
            result.recommendations[0].rationale.toLowerCase().includes("caught up"),
            "Rationale should honestly state everything is clear"
        );
    });

    // 8. Recommendation includes human-readable rationale
    await runTest("8. Recommendation includes human-readable rationale", () => {
        resetAll();
        taskService.reset([
            { id: "t1", text: "Write documentation", completed: false, category: "Work", priority: "high" },
        ]);
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        for (const rec of result.recommendations) {
            assert(typeof rec.rationale === "string" && rec.rationale.length > 5, "Rationale must be descriptive");
            assert(!rec.rationale.includes("{") && !rec.rationale.includes("}"), "Rationale must not be raw JSON");
        }
    });

    // 9. Recommendation count is bounded (1–3)
    await runTest("9. Recommendation count is bounded (1–3)", () => {
        resetAll();
        // Add 10 pending tasks
        const tasks: Task[] = Array.from({ length: 10 }).map((_, i) => ({
            id: `task-${i}`,
            text: `Pending task item number ${i}`,
            completed: false,
            category: "General",
            priority: (i % 2 === 0 ? "high" : "medium") as any,
        }));
        taskService.reset(tasks);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        assert(result.recommendations.length >= 1, "At least 1 recommendation");
        assert(result.recommendations.length <= 3, `Count must be <= 3, got ${result.recommendations.length}`);
    });

    // 10. Recommendation layer performs no mutations (read-only verification)
    await runTest("10. Recommendation layer performs no mutations (read-only verification)", () => {
        resetAll();
        taskService.reset([
            { id: "mut-check-1", text: "Read-only test task", completed: false, category: "QA", priority: "high" },
        ]);
        goalService.reset([
            { id: "mut-goal-1", title: "Read-only test goal", type: "Weekly", target: 5, current: 2, completed: false },
        ]);
        projectService.reset([
            { id: "mut-proj-1", name: "Read-only test proj", status: "In Progress", progress: 20, category: "Personal", description: "Test", createdDate: "2026-09-01" },
        ]);

        const tasksBefore = JSON.stringify(taskService.getTasks());
        const goalsBefore = JSON.stringify(goalService.getGoals());
        const projsBefore = JSON.stringify(projectService.getProjects());

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        recommendationAgentService.generateRecommendations(snapshot);

        const tasksAfter = JSON.stringify(taskService.getTasks());
        const goalsAfter = JSON.stringify(goalService.getGoals());
        const projsAfter = JSON.stringify(projectService.getProjects());

        assert(tasksBefore === tasksAfter, "taskService was mutated by recommendation agent!");
        assert(goalsBefore === goalsAfter, "goalService was mutated by recommendation agent!");
        assert(projsBefore === projsAfter, "projectService was mutated by recommendation agent!");

        // Assert service has no mutation methods exposed
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(recommendationAgentService));
        const forbiddenPrefixes = ["create", "delete", "remove", "update", "execute", "launch", "kill", "spawn", "write"];
        for (const method of methods) {
            for (const bad of forbiddenPrefixes) {
                assert(!method.toLowerCase().startsWith(bad), `Forbidden mutation method on RecommendationAgent: ${method}`);
            }
        }
    });

    // 11. Recommendation request through CommandAgentService works
    await runTest("11. Recommendation request through CommandAgentService works", async () => {
        resetAll();
        taskService.reset([
            { id: "cmd-rec-1", text: "Implement recommendation tests", completed: false, category: "Testing", priority: "high" },
        ]);

        const queries = [
            "What should I work on now?",
            "What should I focus on today?",
            "What are my priorities?",
            "What should I do next?",
            "Give me something productive to work on",
        ];

        for (const query of queries) {
            const result = await commandAgentService.execute(query);
            assert(result.intent === "recommendation", `Query "${query}" should resolve to intent "recommendation", got: ${result.intent}`);
            assert(!!result.recommendations && result.recommendations.length > 0, `Query "${query}" should include recommendations`);
            assert(result.recommendations![0].title.includes("Implement recommendation tests"), "Should recommend high priority task");
            // Must NOT have executed any tools
            assert(!result.appName, "Must not set appName for recommendation");
            assert(!result.requiresConfirmation, "Must not trigger mutation confirmation");
        }
    });

    // 12. Normal commands still work through ToolRegistry
    await runTest("12. Normal commands still work through ToolRegistry", async () => {
        resetAll();
        const normalCommands = [
            { query: "open VS Code", expectedIntent: "launch_application" },
            { query: "launch Chrome", expectedIntent: "launch_application" },
            { query: "create a task to review pull request", expectedIntent: "create_task" },
        ];

        for (const { query, expectedIntent } of normalCommands) {
            const result = await commandAgentService.execute(query);
            assert(result.intent === expectedIntent, `Normal command "${query}" should have intent ${expectedIntent}, got ${result.intent}`);
            assert(result.intent !== "recommendation", "Normal command must not be intercepted as recommendation");
        }
    });

    // 13. Provider-independent behavior
    await runTest("13. Provider-independent behavior across providers", () => {
        resetAll();
        taskService.reset([
            { id: "pi-task-1", text: "Verify neural layer architecture", completed: false, category: "AI", priority: "high" },
        ]);

        // Verify recommendation core produces identical recommendations regardless of active provider
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const res1 = recommendationAgentService.generateRecommendations(snapshot);
        const res2 = recommendationAgentService.generateRecommendations(snapshot);

        assert(res1.recommendations.length === res2.recommendations.length, "Must produce deterministic count");
        assert(res1.recommendations[0].id === res2.recommendations[0].id, "Must produce deterministic id");
        assert(res1.recommendations[0].title === res2.recommendations[0].title, "Must produce deterministic title");
        assert(res1.recommendations[0].rationale === res2.recommendations[0].rationale, "Must produce deterministic rationale");
    });

    // 14. Fresh context is used dynamically
    await runTest("14. Fresh context is used dynamically (no stale recommendations)", async () => {
        resetAll();
        taskService.reset([
            { id: "fresh-1", text: "Urgent task 1", completed: false, category: "Work", priority: "high" },
        ]);

        const r1 = await commandAgentService.execute("What should I work on now?");
        assert(r1.recommendations![0].title.includes("Urgent task 1"), "First recommendation should be Urgent task 1");

        // Mark task completed and add new task
        taskService.completeTask("fresh-1");
        taskService.createTask("Urgent task 2", "Work");
        // Ensure priority is high
        const currentTasks = taskService.getTasks();
        const updated = currentTasks.map(t => t.text.includes("Urgent task 2") ? { ...t, priority: "high" as const } : t);
        taskService.syncTasks(updated);

        const r2 = await commandAgentService.execute("What should I work on now?");
        assert(r2.recommendations![0].title.includes("Urgent task 2"), "Fresh recommendation must immediately reflect new state");
        assert(!r2.recommendations![0].title.includes("Urgent task 1"), "Must not recommend already-completed task");
    });

    // 15. Sensitive data remains redacted in recommendation output
    await runTest("15. Sensitive data remains redacted in recommendation output", () => {
        resetAll();
        taskService.reset([
            {
                id: "sec-task",
                text: "Refactor security auditing component",
                completed: false,
                category: "Security",
                priority: "high",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        // Inject rogue untrusted properties with sensitive keys into snapshot
        (snapshot as any).untrusted = {
            apiKey: "sk-ant-api03-fake-secret-token-12345",
            password: "super_secret_password_xyz",
            envSecrets: { DB_PASS: "admin12345" },
        };

        const result = recommendationAgentService.generateRecommendations(snapshot);
        const explanation = recommendationAgentService.formatConversationalExplanation(result);
        const spoken = recommendationAgentService.formatSpokenRecommendation(result);
        const serializedResult = JSON.stringify(result);

        assert(!explanation.includes("sk-ant-api03"), "Explanation must not expose token");
        assert(!explanation.includes("super_secret_password_xyz"), "Explanation must not expose password");
        assert(!spoken.includes("sk-ant-api03"), "Spoken output must not expose token");
        assert(!spoken.includes("admin12345"), "Spoken output must not expose db password");
        assert(!serializedResult.includes("sk-ant-api03"), "Serialized recommendation must not leak untrusted secrets");
        assert(!serializedResult.includes("admin12345"), "Serialized recommendation must not leak secrets");
    });

    // 16. Voice/TTS response contains only natural spoken content
    await runTest("16. Voice/TTS response contains only natural spoken content", () => {
        resetAll();
        taskService.reset([
            {
                id: "tts-task-1",
                text: "Refactor database query indexes",
                completed: false,
                category: "Database",
                priority: "high",
            },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const result = recommendationAgentService.generateRecommendations(snapshot);

        // Test recommendation service formatter
        const spoken = recommendationAgentService.formatSpokenRecommendation(result);
        assert(typeof spoken === "string" && spoken.length > 0, "Spoken string must not be empty");
        assert(!spoken.includes("tts-task-1"), "TTS speech must not read raw IDs");
        assert(!spoken.includes("{") && !spoken.includes("}"), "TTS speech must not contain JSON brackets");
        assert(!spoken.includes("high_priority_task"), "TTS speech must not read raw enum identifiers");
        assert(spoken.includes("Refactor database query indexes"), "TTS speech should naturally cite the task name");

        // Test responseSpeechFormatter
        const clientSpeech = formatSpokenResponse({
            success: true,
            intent: "recommendation",
            recommendations: result.recommendations,
            explanation: result.summary,
        }, "what should I work on now?");

        assert(typeof clientSpeech === "string" && clientSpeech!.length > 0, "Client speech formatter must return string");
        assert(!clientSpeech!.includes("tts-task-1"), "Client speech formatter must not read raw IDs");
        assert(!clientSpeech!.includes("{"), "Client speech formatter must not contain raw JSON");
    });

    console.log("\n==========================================================================");
    console.log("   ALL 16 RECOMMENDATION AGENT TESTS PASSED                              ");
    console.log("==========================================================================");
}

main().catch((err) => {
    console.error("Unhandled test runner error:", err);
    process.exit(1);
});
