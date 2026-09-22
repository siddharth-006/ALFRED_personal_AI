"use strict";
/**
 * Conversational Command Context Test Suite — Phase 4.13
 *
 * Validates short-term conversation context in ALFRED:
 * - Bounded FIFO session-only memory
 * - Pronoun & entity reference resolution ("it", "that task", "that goal")
 * - Disambiguation & safe clarification without arbitrary execution
 * - Multi-turn mutation follow-ups (task, goal, project, workspace)
 * - Informational follow-ups in Answer Mode without tool execution
 * - Security constraints: no ToolRegistry bypass, no arbitrary ID injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
const conversation_context_service_1 = require("../services/conversation-context.service");
const task_service_1 = require("../services/task.service");
const goal_service_1 = require("../services/goal.service");
const project_service_1 = require("../services/project.service");
const command_agent_service_1 = require("./command-agent.service");
const tool_registry_1 = require("./tools/tool-registry");
const tools_1 = require("./tools");
const plan_validator_1 = require("./providers/impl/plan-validator");
// Register default tools
(0, tools_1.registerDefaultTools)();
// Register AI providers
require("./providers/index");
let passedTests = 0;
let failedTests = 0;
function assert(condition, testName, details) {
    if (condition) {
        console.log(`✅ [PASS] ${testName}`);
        passedTests++;
    }
    else {
        console.error(`❌ [FAIL] ${testName}${details ? ` - ${details}` : ""}`);
        failedTests++;
    }
}
async function runTests() {
    console.log("==========================================================================");
    console.log("ALFRED Conversational Command Context — Phase 4.13 Test Suite");
    console.log("==========================================================================\n");
    // =========================================================================
    // SECTION 1: BASIC CONTEXT RETENTION & BOUNDS
    // =========================================================================
    console.log("--- Section 1: Basic Context Retention & Bounds ---");
    conversation_context_service_1.conversationContextService.clear();
    assert(conversation_context_service_1.conversationContextService.getRecentTurns().length === 0, "1.1 Conversation context starts empty after clear()");
    // Record turn
    conversation_context_service_1.conversationContextService.addTurn({
        userRequest: "Create a task called Finish ML project",
        intent: "create_task",
        responseType: "action",
        toolsExecuted: ["create_task"],
        targetEntity: { type: "task", id: "task-101", name: "Finish ML project" },
        summary: "Created task task-101: Finish ML project",
    });
    const turnsAfterOne = conversation_context_service_1.conversationContextService.getRecentTurns();
    assert(turnsAfterOne.length === 1 &&
        turnsAfterOne[0].userRequest === "Create a task called Finish ML project" &&
        turnsAfterOne[0].targetEntity?.id === "task-101", "1.2 Previous command and structured entity result are retained");
    // Verify bounded FIFO queue: default max is 10
    assert(conversation_context_service_1.DEFAULT_MAX_CONVERSATION_TURNS === 10, "1.3 DEFAULT_MAX_CONVERSATION_TURNS is set to 10");
    for (let i = 2; i <= 15; i++) {
        conversation_context_service_1.conversationContextService.addTurn({
            userRequest: `Command ${i}`,
            intent: "launch_application",
            responseType: "action",
            toolsExecuted: ["launch_application"],
            summary: `Executed command ${i}`,
        });
    }
    const turnsAfterFifteen = conversation_context_service_1.conversationContextService.getRecentTurns();
    assert(turnsAfterFifteen.length === 10, "1.4 Context is strictly bounded to max turns (10 entries)");
    assert(turnsAfterFifteen[0].userRequest === "Command 6", "1.5 Oldest entries are removed FIFO (turn 1-5 evicted, oldest is Command 6)");
    assert(turnsAfterFifteen[turnsAfterFifteen.length - 1].userRequest === "Command 15", "1.6 Most recent entry is at the tail of the recent turns list");
    // =========================================================================
    // SECTION 2: MULTI-TURN TASK FOLLOW-UP ("it", "that task")
    // =========================================================================
    console.log("\n--- Section 2: Multi-Turn Task Follow-Up ---");
    // Reset services
    conversation_context_service_1.conversationContextService.clear();
    const initialTasks = [
        { id: "1", text: "Existing background task", category: "Personal", completed: false },
    ];
    task_service_1.taskService.reset(initialTasks);
    // Turn 1: Create task via commandAgentService
    const res1 = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Finish ML project.");
    assert(res1.success && res1.responseType === "action" && res1.executed, "2.1 Turn 1: Successfully created task 'Finish ML project'");
    const createdTasks = task_service_1.taskService.getTasks().filter(t => t.text.includes("Finish ML project"));
    assert(createdTasks.length === 1, "2.2 Task 'Finish ML project' exists in TaskService");
    const createdTaskId = createdTasks[0].id;
    // Check conversationContextService recorded it
    const lastEntity = conversation_context_service_1.conversationContextService.getLastEntity("task");
    assert(lastEntity !== null && lastEntity !== undefined && lastEntity.id === createdTaskId, "2.3 Conversation service recorded the newly created task entity");
    // Turn 2: Follow-up "Mark it as completed."
    const res2 = await command_agent_service_1.commandAgentService.executeCommand("Mark it as completed.");
    assert(res2.success && res2.responseType === "action" && res2.executed, "2.4 Turn 2: Successfully resolved 'it' to the recently created task");
    const updatedTask = task_service_1.taskService.getTasks().find(t => t.id === createdTaskId);
    assert(updatedTask !== undefined && updatedTask.completed === true, "2.5 The target task was marked as completed in TaskService");
    // Turn 3: "that task" follow-up
    const res3 = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Write unit tests");
    assert(res3.success && res3.executed, "2.6 Turn 3: Created task 'Write unit tests'");
    const unitTestTask = task_service_1.taskService.getTasks().find(t => t.text.includes("Write unit tests"));
    const res4 = await command_agent_service_1.commandAgentService.executeCommand("Complete that task");
    assert(res4.success && res4.responseType === "action" && res4.executed, "2.7 Turn 4: 'Complete that task' successfully completed the recent task");
    const updatedUnitTestTask = task_service_1.taskService.getTasks().find(t => t.id === unitTestTask?.id);
    assert(updatedUnitTestTask !== undefined && updatedUnitTestTask.completed === true, "2.8 Task 'Write unit tests' marked completed via 'that task' reference");
    // =========================================================================
    // SECTION 3: MULTI-TURN GOAL & PROJECT FOLLOW-UP
    // =========================================================================
    console.log("\n--- Section 3: Multi-Turn Goal & Project Follow-Up ---");
    const initialGoals = [
        { id: "goal-1", title: "Existing Goal", type: "Weekly", target: 10, current: 2, completed: false },
    ];
    goal_service_1.goalService.reset(initialGoals);
    // Turn 1: Create a goal
    const goalRes1 = await command_agent_service_1.commandAgentService.executeCommand("Create a goal to solve 100 LeetCode problems");
    assert(goalRes1.success && goalRes1.responseType === "action" && goalRes1.executed, "3.1 Turn 1: Created goal to solve 100 LeetCode problems");
    const createdGoals = goal_service_1.goalService.getGoals().filter(g => g.title.includes("LeetCode"));
    assert(createdGoals.length === 1, "3.2 Goal exists in GoalService");
    const createdGoalId = createdGoals[0].id;
    // Turn 2: Follow-up question in Answer Mode: "What did you just create?"
    const goalRes2 = await command_agent_service_1.commandAgentService.executeCommand("What did you just create?");
    assert(goalRes2.success &&
        goalRes2.responseType === "answer" &&
        !goalRes2.executed &&
        Boolean(goalRes2.answerText?.includes("solve 100 LeetCode problems")), "3.3 Turn 2: 'What did you just create?' answered with entity context without executing tools");
    // Turn 3: "Complete that goal"
    const goalRes3 = await command_agent_service_1.commandAgentService.executeCommand("Complete that goal");
    assert(goalRes3.success && goalRes3.responseType === "action" && goalRes3.executed, "3.4 Turn 3: 'Complete that goal' resolved to recent goal");
    const updatedGoal = goal_service_1.goalService.getGoals().find(g => g.id === createdGoalId);
    assert(updatedGoal !== undefined && updatedGoal.completed === true, "3.5 Goal marked completed in GoalService via follow-up");
    // Project Follow-up: Update project then ask what was updated
    const initialProjects = [
        {
            id: "proj-1",
            name: "Machine Learning Pipeline",
            description: "ML pipeline",
            category: "Data Science",
            status: "In Progress",
            progress: 40,
            createdDate: "2026-03-01",
        },
    ];
    project_service_1.projectService.reset(initialProjects);
    const projRes1 = await command_agent_service_1.commandAgentService.executeCommand("Update ML project progress to 80%");
    assert(projRes1.success && projRes1.executed, "3.6 Updated ML project progress to 80%");
    const projRes2 = await command_agent_service_1.commandAgentService.executeCommand("What did you just update?");
    assert(projRes2.success &&
        projRes2.responseType === "answer" &&
        !projRes2.executed &&
        Boolean(projRes2.answerText?.toLowerCase().includes("machine learning pipeline")), "3.7 'What did you just update?' answered with project context without executing tools");
    // =========================================================================
    // SECTION 4: WORKSPACE CONTEXT & DEEP WORK FOLLOW-UP
    // =========================================================================
    console.log("\n--- Section 4: Workspace Context & Deep Work Follow-Up ---");
    conversation_context_service_1.conversationContextService.clear();
    // Turn 1: Open workspace
    const wsRes1 = await command_agent_service_1.commandAgentService.executeCommand("Open my Machine Learning workspace");
    assert(wsRes1.success && wsRes1.responseType === "action" && wsRes1.executed, "4.1 Turn 1: Opened Machine Learning workspace");
    assert(conversation_context_service_1.conversationContextService.getLastEntity("workspace")?.name === "Machine Learning", "4.2 Conversation recorded 'Machine Learning' workspace entity");
    // Turn 2: "Now start deep work"
    const wsRes2 = await command_agent_service_1.commandAgentService.executeCommand("Now start deep work");
    assert(wsRes2.success && wsRes2.responseType === "action" && wsRes2.executed, "4.3 Turn 2: Follow-up 'Now start deep work' planned and executed successfully");
    assert(wsRes2.appName === "machine-learning", "4.4 Deep work session name contextualized to 'machine-learning'");
    // =========================================================================
    // SECTION 5: AMBIGUITY & UNRESOLVED REFERENCE SAFETY
    // =========================================================================
    console.log("\n--- Section 5: Ambiguity & Unresolved Reference Safety ---");
    // Clear conversation completely
    conversation_context_service_1.conversationContextService.clear();
    // Unresolved task pronoun
    const ambigRes1 = await command_agent_service_1.commandAgentService.executeCommand("Mark it as completed.");
    assert(ambigRes1.success &&
        ambigRes1.responseType === "answer" &&
        !ambigRes1.executed &&
        Boolean(ambigRes1.answerText?.includes("Which task do you mean?")), "5.1 Unresolved 'it' task reference safely prompts 'Which task do you mean?' without tool execution");
    // Unresolved goal pronoun
    const ambigRes2 = await command_agent_service_1.commandAgentService.executeCommand("Complete that goal");
    assert(ambigRes2.success &&
        ambigRes2.responseType === "answer" &&
        !ambigRes2.executed &&
        Boolean(ambigRes2.answerText?.includes("Which goal do you mean?")), "5.2 Unresolved 'that goal' reference safely prompts 'Which goal do you mean?' without tool execution");
    // Unknown recent creation
    conversation_context_service_1.conversationContextService.clear();
    const ambigRes3 = await command_agent_service_1.commandAgentService.executeCommand("What did you just create?");
    assert(ambigRes3.success &&
        ambigRes3.responseType === "answer" &&
        !ambigRes3.executed &&
        Boolean(ambigRes3.answerText?.includes("No task, goal, or project was created recently")), "5.3 Query about recent creation with no prior actions returns informative message without tool execution");
    // =========================================================================
    // SECTION 6: SECURITY & VALIDATION BOUNDARIES
    // =========================================================================
    console.log("\n--- Section 6: Security & Validation Boundaries ---");
    // 6.1 ToolRegistry remains exclusive execution authority
    assert(tool_registry_1.toolRegistry.has("create_task") &&
        tool_registry_1.toolRegistry.has("complete_task") &&
        tool_registry_1.toolRegistry.has("create_goal") &&
        tool_registry_1.toolRegistry.has("update_goal") &&
        tool_registry_1.toolRegistry.has("update_project"), "6.1 ToolRegistry holds exclusive execution authority for all controlled actions");
    // 6.2 Validator blocks invalid tool calls even if conversation context is populated
    conversation_context_service_1.conversationContextService.addTurn({
        userRequest: "Malicious injection attempt",
        intent: "launch_application",
        responseType: "action",
        toolsExecuted: [],
        summary: "Attempting bypass",
    });
    const invalidToolResult = (0, plan_validator_1.validateToolCall)({
        tool: "execute_arbitrary_code",
        arguments: { command: "rm -rf /" },
    });
    assert(invalidToolResult === null, "6.2 Plan validator rejects unknown tools regardless of conversation context");
    // 6.3 Empty or non-whitelisted args rejected
    const invalidArgsResult = (0, plan_validator_1.validateToolCall)({
        tool: "complete_task",
        arguments: { taskId: "" },
    });
    assert(invalidArgsResult === null, "6.3 Plan validator rejects invalid complete_task arguments (empty taskId)");
    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("==========================================================================");
    console.log(`Phase 4.13 Test Results: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
    console.log("==========================================================================");
    if (failedTests > 0) {
        process.exit(1);
    }
}
runTests().catch((err) => {
    console.error("Test runner encountered an unhandled error:", err);
    process.exit(1);
});
