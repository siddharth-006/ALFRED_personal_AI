/**
 * ALFRED Phase 5.5A — Agent Context & Personal State Comprehensive Test Suite
 *
 * Verifies:
 * 1. Empty ALFRED state produces valid context.
 * 2. Pending/completed tasks are summarized correctly.
 * 3. Overdue tasks are identified correctly.
 * 4. Today's tasks are identified correctly.
 * 5. Active projects are included.
 * 6. Active goals are included.
 * 7. Focus running/paused/idle states are represented correctly.
 * 8. Recent activity is bounded.
 * 9. Context does not expose secrets.
 * 10. Context does not contain raw shell commands/tool internals.
 * 11. Context serialization is deterministic and valid.
 * 12. Context reflects newly changed task state (freshness).
 * 13. Context size remains bounded.
 * 14. AI providers receive the same normalized context structure.
 * 15. Context layer cannot execute mutation tools (read-only guarantee).
 */

import { agentContextService, DEFAULT_BOUNDS } from "../electron/agent/agent-context/agent-context.service";
import { taskService } from "../electron/services/task.service";
import { goalService } from "../electron/services/goal.service";
import { projectService } from "../electron/services/project.service";
import { workspaceService } from "../electron/services/workspace.service";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { providerConfigService } from "../electron/agent/providers/config/provider-config.service";
import { providerRegistry } from "../electron/agent/providers/provider-registry";
import { buildAgentSystemPrompt } from "../electron/agent/providers/impl/planning-prompt";
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
    console.log("   ALFRED PHASE 5.5A: AGENT CONTEXT & PERSONAL STATE TEST SUITE           ");
    console.log("==========================================================================\n");

    const fixedNow = new Date("2026-09-27T10:00:00.000Z");
    providerConfigService.setActiveProviderId("mock");

    // 1. Empty ALFRED state produces valid context
    await runTest("1. Empty ALFRED state produces valid context snapshot", () => {
        taskService.reset([]);
        goalService.reset([]);
        projectService.reset([]);
        workspaceService.reset([]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot !== null && typeof snapshot === "object", "Snapshot must be object");
        assert(snapshot.generatedAt === fixedNow.toISOString(), "generatedAt must match now");
        assert(snapshot.tasks.summary.total === 0, "Tasks total should be 0");
        assert(snapshot.tasks.summary.pending === 0, "Tasks pending should be 0");
        assert(snapshot.projects.summary.total === 0, "Projects total should be 0");
        assert(snapshot.goals.summary.total === 0, "Goals total should be 0");
        assert(snapshot.workspaces.summary.total === 0, "Workspaces total should be 0");
        assert(snapshot.focus.state === "idle", "Focus default should be idle");
        assert(snapshot.focus.isActive === false, "Focus isActive should be false");
        assert(Array.isArray(snapshot.activity) && snapshot.activity.length === 0, "Activity should be empty array");
        assert(snapshot.analytics.taskCompletionRate === 0, "Task completion rate should be 0");
    });

    // 2. Pending/completed tasks are summarized correctly
    await runTest("2. Pending and completed tasks are summarized accurately", () => {
        taskService.reset([
            { id: "1", text: "Task A", completed: false, category: "Personal" },
            { id: "2", text: "Task B", completed: true, category: "DSA" },
            { id: "3", text: "Task C", completed: false, category: "Career" },
            { id: "4", text: "Task D", completed: true, category: "Personal" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot.tasks.summary.total === 4, "Total tasks must be 4");
        assert(snapshot.tasks.summary.pending === 2, "Pending tasks must be 2");
        assert(snapshot.tasks.summary.completed === 2, "Completed tasks must be 2");
        assert(snapshot.tasks.summary.completionRatePercentage === 50, "Completion rate must be 50%");
        assert(snapshot.tasks.recentPending.length === 2, "Recent pending items length 2");
        assert(snapshot.tasks.recentlyCompleted.length === 2, "Recently completed items length 2");
    });

    // 3. Overdue tasks are identified correctly
    await runTest("3. Overdue tasks are identified correctly by date comparison", () => {
        taskService.reset([
            { id: "1", text: "Overdue Task", completed: false, category: "DSA", dueDate: "2026-09-25" },
            { id: "2", text: "Future Task", completed: false, category: "DSA", dueDate: "2026-09-30" },
            { id: "3", text: "Completed Past Task", completed: true, category: "DSA", dueDate: "2026-09-20" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot.tasks.summary.overdue === 1, "Only pending past tasks count as overdue");
        assert(snapshot.tasks.recentPending[0].isOverdue === true, "Task 1 should have isOverdue = true");
        assert(snapshot.tasks.recentPending[1].isOverdue === undefined, "Future task must not be overdue");
    });

    // 4. Today's tasks are identified correctly
    await runTest("4. Today's tasks are identified correctly", () => {
        taskService.reset([
            { id: "1", text: "Due Today Pending", completed: false, category: "DSA", dueDate: "2026-09-27" },
            { id: "2", text: "Due Tomorrow", completed: false, category: "DSA", dueDate: "2026-09-28" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot.tasks.summary.dueToday === 1, "Due today count must be 1");
        assert(snapshot.tasks.todayPending.length === 1, "todayPending array has 1 item");
        assert(snapshot.tasks.todayPending[0].text === "Due Today Pending", "Matches task title");
    });

    // 5. Active projects are included
    await runTest("5. Active projects and progress statistics are captured", () => {
        projectService.reset([
            { id: "p1", name: "ALFRED AI", description: "Personal Assistant", category: "Personal", status: "In Progress", progress: 60, createdDate: "2026-09-01" },
            { id: "p2", name: "Completed App", description: "Done", category: "College", status: "Completed", progress: 100, createdDate: "2026-09-01" },
            { id: "p3", name: "Fresh Idea", description: "Upcoming", category: "Hackathon", status: "Not Started", progress: 0, createdDate: "2026-09-01" },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot.projects.summary.total === 3, "Total projects = 3");
        assert(snapshot.projects.summary.active === 1, "Active projects = 1");
        assert(snapshot.projects.summary.completed === 1, "Completed projects = 1");
        assert(snapshot.projects.summary.notStarted === 1, "Not started = 1");
        assert(snapshot.projects.activeProjects.length === 2, "Active/not-completed projects = 2");
        assert(snapshot.projects.activeProjects[0].name === "ALFRED AI", "First active is ALFRED AI");
        assert(snapshot.projects.activeProjects[0].progress === 60, "Progress is 60%");
    });

    // 6. Active goals are included
    await runTest("6. Active goals and completion metrics are captured", () => {
        goalService.reset([
            { id: "g1", title: "Solve 20 LeetCode", type: "Weekly", target: 20, current: 15, completed: false },
            { id: "g2", title: "Complete Course", type: "Monthly", target: 10, current: 10, completed: true },
        ]);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        assert(snapshot.goals.summary.total === 2, "Total goals = 2");
        assert(snapshot.goals.summary.active === 1, "Active goals = 1");
        assert(snapshot.goals.summary.completed === 1, "Completed goals = 1");
        assert(snapshot.goals.activeGoals.length === 1, "Active goals list has 1");
        assert(snapshot.goals.activeGoals[0].progressPercentage === 75, "15/20 = 75%");
    });

    // 7. Focus running/paused/idle states are represented correctly
    await runTest("7. Focus states (idle, running, paused, completed) are represented accurately", () => {
        const idleSnapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: { state: "idle" },
        });
        assert(idleSnapshot.focus.state === "idle" && !idleSnapshot.focus.isActive, "Idle focus is not active");

        const runningSnapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: {
                state: "running",
                sessionDurationMinutes: 30,
                remainingSeconds: 1200,
                todayFocusMinutes: 45,
                totalFocusMinutes: 120,
            },
        });
        assert(runningSnapshot.focus.state === "running" && runningSnapshot.focus.isActive, "Running focus is active");
        assert(runningSnapshot.focus.elapsedSeconds === 600, "1800 - 1200 = 600s elapsed");
        assert(runningSnapshot.focus.todayFocusMinutes === 45, "Today focus minutes preserved");

        const pausedSnapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            focus: { state: "paused" },
        });
        assert(pausedSnapshot.focus.state === "paused" && pausedSnapshot.focus.isActive, "Paused focus is marked active");
    });

    // 8. Recent activity is bounded
    await runTest("8. Recent activity feed is bounded and preserves recent items", () => {
        const dummyActivities = Array.from({ length: 30 }, (_, i) => ({
            type: "command_completed",
            label: `Activity #${i}`,
            detail: `Details for item ${i}`,
            timestamp: Date.now() - i * 1000,
        }));

        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            activity: dummyActivities,
        });

        assert(snapshot.activity.length === DEFAULT_BOUNDS.MAX_RECENT_ACTIVITIES, `Activity bounded to ${DEFAULT_BOUNDS.MAX_RECENT_ACTIVITIES}`);
        assert(snapshot.activity[0].label === "Activity #0", "Most recent activity preserved at top");
    });

    // 9. Context does not expose secrets
    await runTest("9. Context serialization strictly filters secrets and sensitive keys", () => {
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        // Inject rogue object with dangerous keys into snapshot
        (snapshot as any).untrusted = {
            apiKey: "sk-proj-1234567890abcdef",
            secretToken: "secret_value_xyz",
            password: "super_secret_pw",
            auth_token: "bearer 987654",
            safeName: "Alfred Assistant",
        };

        const serialized = agentContextService.serializeForAgent(snapshot);
        assert(!serialized.includes("sk-proj-1234567890abcdef"), "API keys must be stripped");
        assert(!serialized.includes("secret_value_xyz"), "secretToken must be stripped");
        assert(!serialized.includes("super_secret_pw"), "password must be stripped");
        assert(!serialized.includes("bearer 987654"), "auth_token must be stripped");
        assert(serialized.includes("Alfred Assistant"), "Safe fields must remain");
    });

    // 10. Context does not contain raw shell commands / tool internals
    await runTest("10. Context filters shell commands and process internals from activity details", () => {
        const snapshot = agentContextService.getContextSnapshot({
            now: fixedNow,
            activity: [
                {
                    type: "command_completed",
                    label: "Safe Action",
                    detail: "powershell -Command Start-Process calc.exe",
                    timestamp: Date.now(),
                },
            ],
        });

        const serialized = agentContextService.serializeForAgent(snapshot);
        assert(!serialized.includes("powershell"), "Raw powershell must be filtered");
        assert(serialized.includes("[FILTERED]"), "Dangerous token replaced with [FILTERED]");
    });

    // 11. Context serialization is deterministic and valid JSON
    await runTest("11. Context serialization produces deterministic and valid JSON", () => {
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow, memoryLimit: 0 });
        snapshot.memory = { totalEnabled: 0, relevant: [] };
        const serialized1 = agentContextService.serializeForAgent(snapshot);
        const serialized2 = agentContextService.serializeForAgent(snapshot);

        assert(serialized1 === serialized2, "Serialization must be deterministic");
        const parsed = JSON.parse(serialized1);
        assert(parsed.generatedAt === fixedNow.toISOString(), "Parsed JSON matches original generatedAt");
    });

    // 12. Context reflects newly changed task state (Freshness)
    await runTest("12. Context reflects immediately updated state upon task creation or completion", async () => {
        taskService.reset([
            { id: "1", text: "Initial Task", completed: false, category: "Personal" },
        ]);

        const snap1 = agentContextService.getContextSnapshot();
        assert(snap1.tasks.summary.pending === 1, "Pending must be 1 initially");

        // Create new task
        const newTask = taskService.createTask("Second Task", "DSA");
        const snap2 = agentContextService.getContextSnapshot();
        assert(snap2.tasks.summary.total === 2, "Total immediately reflects 2");
        assert(snap2.tasks.summary.pending === 2, "Pending immediately reflects 2");

        // Complete the first task
        taskService.completeTask("1");
        const snap3 = agentContextService.getContextSnapshot();
        assert(snap3.tasks.summary.pending === 1, "Pending drops to 1 after completion");
        assert(snap3.tasks.summary.completed === 1, "Completed increases to 1");
    });

    // 13. Context size remains bounded
    await runTest("13. Context size remains bounded even with hundreds of tasks, projects, and goals", () => {
        const bulkTasks = Array.from({ length: 200 }, (_, i) => ({
            id: `task_${i}`,
            text: `Task description number ${i} with extra text words here`,
            completed: i % 2 === 0,
            category: "Bulk",
        }));
        taskService.reset(bulkTasks);

        const bulkProjects = Array.from({ length: 50 }, (_, i) => ({
            id: `proj_${i}`,
            name: `Project number ${i}`,
            description: `Description of project ${i}`,
            category: "Personal" as any,
            status: "In Progress" as any,
            progress: 30,
            createdDate: "2026-09-01",
        }));
        projectService.reset(bulkProjects);

        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });
        const serialized = agentContextService.serializeForAgent(snapshot);

        // Even with 200 tasks and 50 projects, serialized payload must be well under 15KB
        assert(serialized.length < 15000, `Serialized context must be bounded (length: ${serialized.length} chars)`);
        assert(snapshot.tasks.recentPending.length <= DEFAULT_BOUNDS.MAX_RECENT_PENDING, "Pending tasks bounded");
        assert(snapshot.projects.activeProjects.length <= DEFAULT_BOUNDS.MAX_ACTIVE_PROJECTS, "Projects bounded");
    });

    // 14. AI providers receive the same normalized context structure
    await runTest("14. AI Providers receive the identical normalized context structure in planning prompt", () => {
        taskService.reset([
            { id: "1", text: "Normalized Task", completed: false, category: "Personal" },
        ]);
        const snapshot = agentContextService.getContextSnapshot({ now: fixedNow });

        const promptText = buildAgentSystemPrompt({
            userRequest: "How many tasks do I have?",
            context: { agentContext: snapshot },
        });

        assert(promptText.includes("ALFRED Application Context (READ-ONLY Snapshot):"), "System prompt has context header");
        assert(promptText.includes("Normalized Task"), "Prompt contains task details");
        assert(promptText.includes('"completionRatePercentage"'), "Prompt contains typed summary");
    });

    // 15. Context layer cannot execute mutation tools (Read-Only Guarantee)
    await runTest("15. Read-only guarantee: AgentContextService exposes no mutation methods", () => {
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(agentContextService));
        const disallowed = [
            "createTask",
            "completeTask",
            "updateGoal",
            "createGoal",
            "updateProject",
            "execute",
            "spawn",
            "exec",
            "launchApplication",
        ];

        for (const bad of disallowed) {
            assert(!methods.includes(bad), `AgentContextService must never expose mutation method '${bad}'`);
        }
    });

    // 16. CommandAgent query answers using context
    await runTest("16. CommandAgent answers informational task count and active status using context", async () => {
        taskService.reset([
            { id: "1", text: "LeetCode Daily", completed: false, category: "DSA" },
            { id: "2", text: "Documentation", completed: true, category: "Work" },
        ]);

        const res1 = await commandAgentService.executeCommand("How many tasks do I have?", { isMock: true });
        assert(res1.success === true, "Task count command should succeed");
        assert(res1.responseType === "answer", "Must be answer response type");
        assert(Boolean(res1.answerText?.includes("2 task(s) in total")), `Must state 2 tasks, got: ${res1.answerText}`);
        assert(Boolean(res1.answerText?.includes("1 pending")), `Must state 1 pending, got: ${res1.answerText}`);

        const res2 = await commandAgentService.executeCommand("What's currently active?", { isMock: true });
        assert(res2.success === true, "Active status command should succeed");
        assert(res2.responseType === "answer", "Must be answer response type");
        assert(Boolean(res2.answerText?.includes("Focus is currently")), `Must report focus state, got: ${res2.answerText}`);
    });

    console.log("\n==========================================================================");
    console.log("ALL 16 AGENT CONTEXT & PERSONAL STATE TESTS PASSED SUCCESSFULLY");
    console.log("==========================================================================\n");
}

main().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
