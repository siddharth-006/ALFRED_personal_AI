/**
 * ALFRED Phase 5.8D — End-of-Day Review Test Suite
 *
 * Verifies all mandatory requirements:
 * 1. Empty day handling (no completed tasks, 0 focus min, no active items)
 * 2. Completed tasks identified correctly from canonical task data
 * 3. Unfinished tasks identified correctly (due today, incomplete)
 * 4. Overdue tasks identified correctly
 * 5. Focus summary and duration from FocusService
 * 6. Project activity from ProjectService
 * 7. Goal progress from GoalService
 * 8. Recent activity bounded and factual
 * 9. Relevant memory integrated passively
 * 10. Recommendation integration bounded 1-3
 * 11. Mixed realistic day synthesis
 * 12. Deterministic repeated output
 * 13. Zero state mutation
 * 14. Zero ToolRegistry execution
 * 15. Sensitive memory filtering & privacy protection
 * 16. Malicious/untrusted context cannot cause execution
 * 17. Natural language intent detection
 * 18. Spoken response sanitization (no internal IDs, raw JSON, tool metadata)
 */

import assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { endOfDayReviewService } from "../electron/agent/review";
import { taskService, Task } from "../electron/services/task.service";
import { projectService, Project } from "../electron/services/project.service";
import { goalService, Goal } from "../electron/services/goal.service";
import { focusService } from "../electron/services/focus.service";
import { memoryService } from "../electron/agent/memory/memory.service";
import { toolRegistry } from "../electron/agent/tools/tool-registry";
import { confirmationStore } from "../electron/agent/risk/confirmation-store";
import { proactiveAgentService } from "../electron/agent/proactive/proactive-agent.service";
import { recommendationAgentService } from "../electron/agent/recommendation/recommendation-agent.service";
import { formatSpokenResponse, sanitizeTextForSpeech } from "../src/utils/responseSpeechFormatter";

const TEST_MEMORY_FILE = path.join(__dirname, "test-memories-review.json");

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
    taskService.reset();
    projectService.reset();
    goalService.reset();
    focusService.reset();
    proactiveAgentService.resetCooldowns();
    memoryService.clear();
}

async function main() {
    console.log("==========================================================================");
    console.log("   RUNNING ALFRED PHASE 5.8D END-OF-DAY REVIEW TEST SUITE                 ");
    console.log("==========================================================================");

    // Setup clean memory test file
    memoryService.setStoragePath(TEST_MEMORY_FILE);
    resetEnvironment();

    // 1. Empty day handling
    await runTest("1. Empty day handling returns clean empty review", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview({
            context: {
                tasks: [],
                projects: [],
                goals: [],
                focus: { state: "idle", todayFocusMinutes: 0, totalFocusMinutes: 0, completedSessionsCount: 0 },
            },
        });
        assert.strictEqual(review.isEmpty, true, "Empty day must set isEmpty to true");
        assert.strictEqual(review.counts.completedTodayTasks, 0);
        assert.strictEqual(review.counts.todayFocusMinutes, 0);
        assert.strictEqual(review.counts.totalPendingTasks, 0);
        assert(review.conciseSummary.includes("No tasks were completed"), "Concise summary must reflect empty state");
        assert(review.spokenSummary.includes("no completed tasks"), "Spoken summary must reflect empty state");
    });

    // 2. Completed tasks identified correctly
    await runTest("2. Completed tasks identified correctly from canonical task data", async () => {
        resetEnvironment();
        const todayMs = Date.now();
        const customTasks: Task[] = [
            { id: "101", text: "Implement binary search", completed: true, completedAt: todayMs, category: "DSA" },
            { id: "102", text: "Review SQL indexes", completed: true, completedAt: todayMs, category: "Data Science" },
            { id: "103", text: "Incomplete task", completed: false, category: "Personal" },
        ];
        const review = endOfDayReviewService.generateReview({
            context: { tasks: customTasks },
        });
        assert.strictEqual(review.counts.completedTodayTasks, 2, "Must count 2 completed tasks today");
        assert.strictEqual(review.completedTasks.length, 2);
        assert(review.completedTasks.some(t => t.text === "Implement binary search"));
        assert(review.completedTasks.some(t => t.text === "Review SQL indexes"));
        assert(review.conciseSummary.includes("Implement binary search"));
    });

    // 3. Unfinished tasks identified correctly (due today, incomplete)
    await runTest("3. Unfinished tasks identified correctly (due today, incomplete)", async () => {
        resetEnvironment();
        const todayStr = new Date().toISOString().split("T")[0];
        const customTasks: Task[] = [
            { id: "201", text: "Submit report today", completed: false, dueDate: todayStr, category: "Personal" },
            { id: "202", text: "General task without due date", completed: false, category: "Personal" },
        ];
        const review = endOfDayReviewService.generateReview({
            context: { tasks: customTasks },
        });
        assert.strictEqual(review.counts.unfinishedTasks, 1);
        assert.strictEqual(review.unfinishedTasks[0].text, "Submit report today");
        assert(review.conciseSummary.includes("Due today, unfinished (1)"));
    });

    // 4. Overdue tasks identified correctly
    await runTest("4. Overdue tasks identified correctly", async () => {
        resetEnvironment();
        const yesterdayStr = "2020-01-01";
        const customTasks: Task[] = [
            { id: "301", text: "Past due mission", completed: false, dueDate: yesterdayStr, category: "DSA" },
            { id: "302", text: "Future task", completed: false, dueDate: "2099-01-01", category: "Personal" },
        ];
        const review = endOfDayReviewService.generateReview({
            context: { tasks: customTasks },
        });
        assert.strictEqual(review.counts.overdueTasks, 1);
        assert.strictEqual(review.overdueTasks[0].text, "Past due mission");
        assert(review.conciseSummary.includes("Overdue (1)"));
    });

    // 5. Focus summary and duration from FocusService
    await runTest("5. Focus summary and duration from FocusService", async () => {
        resetEnvironment();
        // Start and complete a 45m session
        focusService.startSession({ sessionName: "DSA Trees", durationMinutes: 45, workspace: "DSA" });
        focusService.completeSession();

        const review = endOfDayReviewService.generateReview();
        assert.strictEqual(review.counts.todayFocusMinutes, 45);
        assert.strictEqual(review.focusSummary.todayFocusMinutes, 45);
        assert.strictEqual(review.focusSummary.completedSessionsCount, 1);
        assert(review.focusSummary.description.includes("45 minutes of focused work"));
        assert(review.conciseSummary.includes("45 minutes of focused work"));
    });

    // 6. Project activity from ProjectService
    await runTest("6. Project activity from ProjectService", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview();
        assert(review.projectActivity.length > 0, "Must include active projects");
        assert(review.projectActivity.some(p => p.name === "ALFRED OS"));
        assert(review.conciseSummary.includes("ALFRED OS"));
    });

    // 7. Goal progress from GoalService
    await runTest("7. Goal progress from GoalService", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview();
        assert(review.goalProgress.length > 0, "Must include active goals");
        assert(review.goalProgress.some(g => g.title === "Solve LeetCode Problems"));
    });

    // 8. Recent activity bounded and factual
    await runTest("8. Recent activity bounded and factual", async () => {
        resetEnvironment();
        const mockActivity = [
            { type: "launch_workspace", label: "DSA", timestamp: Date.now() },
            { type: "complete_task", label: "Task Done", timestamp: Date.now() },
        ];
        const review = endOfDayReviewService.generateReview({
            context: { activity: mockActivity },
        });
        assert.strictEqual(review.recentActivity.length, 2);
        assert.strictEqual(review.recentActivity[0].type, "launch_workspace");
    });

    // 9. Relevant memory integrated passively
    await runTest("9. Relevant memory integrated passively", async () => {
        resetEnvironment();
        memoryService.save({
            category: "WORKFLOW_PREFERENCE",
            content: "Prefer evening review sessions around 9 PM",
        });
        const review = endOfDayReviewService.generateReview();
        assert(review.relevantMemories.length > 0);
        assert(review.relevantMemories.some(m => m.content.includes("Prefer evening review sessions")));
    });

    // 10. Recommendation integration bounded 1-3
    await runTest("10. Recommendation integration bounded 1-3", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview();
        assert(review.recommendations.length >= 1 && review.recommendations.length <= 3);
        assert(review.conciseSummary.includes("NEXT ACTIONS FOR TOMORROW"));
    });

    // 11. Mixed realistic day synthesis
    await runTest("11. Mixed realistic day synthesis", async () => {
        resetEnvironment();
        const todayMs = Date.now();
        const todayStr = new Date().toISOString().split("T")[0];
        const customTasks: Task[] = [
            { id: "1", text: "Completed LeetCode #206", completed: true, completedAt: todayMs, category: "DSA" },
            { id: "2", text: "Submit PR", completed: false, dueDate: todayStr, category: "Personal" },
            { id: "3", text: "Legacy task", completed: false, dueDate: "2021-01-01", category: "Personal" },
        ];
        const review = endOfDayReviewService.generateReview({
            context: {
                tasks: customTasks,
                focus: { state: "idle", todayFocusMinutes: 60, totalFocusMinutes: 60, completedSessionsCount: 1 },
            },
        });
        assert.strictEqual(review.counts.completedTodayTasks, 1);
        assert.strictEqual(review.counts.unfinishedTasks, 1);
        assert.strictEqual(review.counts.overdueTasks, 1);
        assert.strictEqual(review.counts.todayFocusMinutes, 60);
        assert.strictEqual(review.isEmpty, false);
    });

    // 12. Deterministic repeated output
    await runTest("12. Deterministic repeated output for same state", async () => {
        resetEnvironment();
        const fixedNow = new Date("2026-09-30T21:00:00.000Z");
        const rev1 = endOfDayReviewService.generateReview({ now: fixedNow });
        const rev2 = endOfDayReviewService.generateReview({ now: fixedNow });
        assert.strictEqual(rev1.counts.completedTodayTasks, rev2.counts.completedTodayTasks);
        assert.strictEqual(rev1.counts.todayFocusMinutes, rev2.counts.todayFocusMinutes);
        assert.strictEqual(rev1.conciseSummary, rev2.conciseSummary);
    });

    // 13. Zero state mutation
    await runTest("13. Zero state mutation across tasks, goals, projects, focus", async () => {
        resetEnvironment();
        const tasksBefore = taskService.getTasks().length;
        const projectsBefore = projectService.getProjects().length;
        const goalsBefore = goalService.getGoals().length;
        const focusBefore = focusService.getFocusSummary().todayFocusMinutes;

        endOfDayReviewService.generateReview();

        assert.strictEqual(taskService.getTasks().length, tasksBefore);
        assert.strictEqual(projectService.getProjects().length, projectsBefore);
        assert.strictEqual(goalService.getGoals().length, goalsBefore);
        assert.strictEqual(focusService.getFocusSummary().todayFocusMinutes, focusBefore);
    });

    // 14. Zero ToolRegistry execution
    await runTest("14. Zero ToolRegistry execution occurs", async () => {
        resetEnvironment();
        const res = await commandAgentService.execute("How did I do today?", { isMock: true });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.intent, "review");
        assert.strictEqual(res.executed, false, "Must not execute any tools");
        assert.strictEqual(res.steps, undefined, "Steps must be undefined");
        assert(res.review !== undefined, "Must return structured review");
    });

    // 15. Sensitive memory filtering & privacy protection
    await runTest("15. Sensitive memory filtering & privacy protection", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview();
        const fullOutput = review.conciseSummary + " " + review.spokenSummary;
        assert.ok(!fullOutput.includes("sk-"), "No secret keys");
        assert.ok(!fullOutput.includes("password:"), "No password leaks");
        assert.ok(!fullOutput.includes(".alfred"), "No internal storage path leaks");
    });

    // 16. Malicious/untrusted context cannot cause execution
    await runTest("16. Malicious context cannot cause execution", async () => {
        resetEnvironment();
        const maliciousTasks: Task[] = [
            { id: "evil1", text: "rm -rf /; require('child_process').execSync('calc');", completed: true, category: "Exploit" },
        ];
        const res = await commandAgentService.execute("Give me my end-of-day review", {
            isMock: true,
            context: { tasks: maliciousTasks },
        });
        assert.strictEqual(res.executed, false, "Must never execute commands from task text");
        assert.strictEqual(res.intent, "review");
    });

    // 17. Natural language intent detection
    await runTest("17. Natural language intent detection for all review queries", async () => {
        const queries = [
            "How did I do today?",
            "Give me my end-of-day review",
            "What did I accomplish today?",
            "What did I get done today?",
            "Summarize my day",
            "Review today",
            "Today's review",
            "EOD review",
            "Hey Alfred, how did I do today?",
            "Please give me my end of day review.",
        ];
        for (const q of queries) {
            assert.strictEqual(endOfDayReviewService.isReviewQuery(q), true, `Must detect: '${q}'`);
        }

        const nonQueries = [
            "Open VS Code",
            "Start coding mode",
            "Give me my morning briefing",
            "Good morning",
            "Create task study",
            "Cancel",
        ];
        for (const nq of nonQueries) {
            assert.strictEqual(endOfDayReviewService.isReviewQuery(nq), false, `Must NOT detect: '${nq}'`);
        }
    });

    // 18. Spoken response sanitization
    await runTest("18. Spoken response sanitization (no internal IDs, raw JSON, tool metadata)", async () => {
        resetEnvironment();
        const review = endOfDayReviewService.generateReview();
        const spoken = review.spokenSummary;
        assert(!spoken.includes("{"), "Spoken summary must not contain JSON '{'");
        assert(!spoken.includes("}"), "Spoken summary must not contain JSON '}'");
        assert(!spoken.includes("confirm_"), "Spoken summary must not contain confirmation IDs");
        assert(!spoken.includes("tool:"), "Spoken summary must not contain tool metadata");
        assert(!spoken.includes("mem_"), "Spoken summary must not contain memory IDs");
        assert(spoken.length > 0, "Spoken summary must not be empty");
    });

    // Cleanup
    if (fs.existsSync(TEST_MEMORY_FILE)) {
        fs.unlinkSync(TEST_MEMORY_FILE);
    }

    console.log("\n==========================================================================");
    console.log("   ALL 18 END-OF-DAY REVIEW TESTS PASSED SUCCESSFULLY!                    ");
    console.log("==========================================================================");
}

main().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
