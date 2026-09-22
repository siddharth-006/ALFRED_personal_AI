/**
 * Controlled Goal & Project Actions Test Suite — Phase 4.12
 *
 * Tests the security boundary, validation, execution, and provider-agnostic
 * planning contract for 'create_goal', 'update_goal', and 'update_project' tools.
 */

import { goalService, Goal } from "../services/goal.service";
import { projectService, Project } from "../services/project.service";
import { taskService } from "../services/task.service";
import { toolRegistry } from "./tools/tool-registry";
import { registerDefaultTools } from "./tools";
import { createGoalTool } from "./tools/builtins/create-goal.tool";
import { updateGoalTool } from "./tools/builtins/update-goal.tool";
import { updateProjectTool } from "./tools/builtins/update-project.tool";
import { validateToolCall, parseAndValidateAgentPlan } from "./providers/impl/plan-validator";
import { ALFRED_TOOL_CATALOG } from "./providers/impl/planning-prompt";
import { commandAgentService } from "./command-agent.service";
import { providerRegistry } from "./providers/provider-registry";
import { providerConfigService } from "./providers/config/provider-config.service";
import { MockAIProvider } from "./providers/impl/mock-ai-provider";
import { ClaudeAIProvider } from "./providers/impl/claude-ai-provider";
import { agentOrchestrator } from "./orchestrator";

// Register default tools
registerDefaultTools();

// Register AI providers
import "./providers/index";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
        console.log(`✅ [PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`❌ [FAIL] ${testName}${details ? ` - ${details}` : ""}`);
        failedTests++;
    }
}

async function runTests() {
    console.log("==========================================================================");
    console.log("ALFRED Controlled Goal & Project Actions — Phase 4.12 Test Suite");
    console.log("==========================================================================\n");

    // Initialize test state
    const initialGoals: Goal[] = [
        { id: "goal-1", title: "Master Dynamic Programming", type: "Weekly", target: 30, current: 10, completed: false },
        { id: "goal-2", title: "Study Distributed Systems", type: "Monthly", target: 20, current: 5, completed: false },
    ];
    goalService.reset(initialGoals);

    const initialProjects: Project[] = [
        {
            id: "proj-1",
            name: "Machine Learning Pipeline",
            description: "End-to-end model training and evaluation pipeline",
            category: "Data Science",
            status: "In Progress",
            progress: 35,
            createdDate: "2026-03-01",
        },
        {
            id: "proj-2",
            name: "ALFRED Desktop",
            description: "Personal AI companion desktop system",
            category: "Personal",
            status: "In Progress",
            progress: 80,
            createdDate: "2026-02-15",
        },
    ];
    projectService.reset(initialProjects);

    // -------------------------------------------------------------
    // 1. CREATE GOAL TESTS
    // -------------------------------------------------------------

    // 1.1 Valid creation with explicit type and target
    const createResult = await createGoalTool.execute({
        title: "Solve 100 LeetCode problems",
        type: "Monthly",
        target: 100,
    });
    assert(
        createResult.success === true &&
        createResult.data?.goal?.title === "Solve 100 LeetCode problems" &&
        createResult.data?.goal?.target === 100 &&
        createResult.data?.goal?.type === "Monthly" &&
        createResult.data?.goal?.completed === false &&
        createResult.data?.goal?.current === 0,
        "1. create_goal: Valid creation with explicit type and target",
        JSON.stringify(createResult)
    );

    // 1.2 Missing or empty title
    const emptyTitleVal = createGoalTool.validateInput!({ title: "   " });
    const missingTitleVal = createGoalTool.validateInput!({ target: 50 });
    assert(
        emptyTitleVal.valid === false && missingTitleVal.valid === false,
        "2. create_goal: Missing or empty title is rejected"
    );

    // 1.3 Malformed arguments
    const nullVal = createGoalTool.validateInput!(null);
    const arrayVal = createGoalTool.validateInput!(["title"]);
    const negativeTargetVal = createGoalTool.validateInput!({ title: "Learn Rust", target: -5 });
    const invalidTypeVal = createGoalTool.validateInput!({ title: "Learn Rust", type: "Yearly" as any });
    assert(
        nullVal.valid === false && arrayVal.valid === false && negativeTargetVal.valid === false && invalidTypeVal.valid === false,
        "3. create_goal: Malformed arguments (null, array, negative target, invalid type) rejected"
    );

    // 1.4 Disallow invented fields (e.g., deadline, priority, description)
    const inventedFieldVal = createGoalTool.validateInput!({
        title: "Prepare talk",
        deadline: "2026-10-01",
        priority: "High",
    });
    assert(
        inventedFieldVal.valid === false,
        "4. create_goal: Invented fields (deadline, priority) strictly rejected"
    );

    // 1.5 Exactly one goal is created in state
    const beforeGoalCount = goalService.getGoals().length;
    await createGoalTool.execute({ title: "Read 3 Research Papers", target: 3 });
    const afterGoalCount = goalService.getGoals().length;
    assert(
        afterGoalCount === beforeGoalCount + 1,
        "5. create_goal: Exactly one goal created in backend state"
    );

    // -------------------------------------------------------------
    // 2. UPDATE GOAL TESTS
    // -------------------------------------------------------------

    // 2.1 Valid update of progress / current
    const updateProgressRes = await updateGoalTool.execute({
        goalId: "goal-1",
        current: 15,
    });
    assert(
        updateProgressRes.success === true &&
        updateProgressRes.data?.goal?.current === 15 &&
        updateProgressRes.data?.goal?.completed === false,
        "6. update_goal: Valid update modifies current progress"
    );

    // 2.2 Auto-complete when current >= target
    const autoCompleteRes = await updateGoalTool.execute({
        goalId: "goal-1",
        current: 30, // target is 30
    });
    assert(
        autoCompleteRes.success === true &&
        autoCompleteRes.data?.goal?.current === 30 &&
        autoCompleteRes.data?.goal?.completed === true,
        "7. update_goal: Auto-completes goal when current progress reaches target"
    );

    // 2.3 Explicit completion flag
    const explicitCompleteRes = await updateGoalTool.execute({
        goalId: "goal-2",
        completed: true,
    });
    assert(
        explicitCompleteRes.success === true &&
        explicitCompleteRes.data?.goal?.completed === true,
        "8. update_goal: Explicit completion flag marks goal completed"
    );

    // 2.4 Nonexistent goal ID handled safely without crashing
    const nonexistentGoalRes = await updateGoalTool.execute({
        goalId: "nonexistent-goal-999",
        current: 5,
    });
    assert(
        nonexistentGoalRes.success === false &&
        typeof nonexistentGoalRes.error === "string" &&
        nonexistentGoalRes.error.includes("not found"),
        "9. update_goal: Nonexistent goal ID handled safely with structured error"
    );

    // 2.5 Malformed or empty goal ID rejected
    const emptyGoalIdVal = updateGoalTool.validateInput!({ goalId: "" });
    const missingGoalIdVal = updateGoalTool.validateInput!({ current: 10 });
    assert(
        emptyGoalIdVal.valid === false && missingGoalIdVal.valid === false,
        "10. update_goal: Empty or missing goalId rejected by validator"
    );

    // 2.6 Unsupported / invented fields rejected
    const updateInventedFieldVal = updateGoalTool.validateInput!({
        goalId: "goal-1",
        priority: "Low",
        category: "Work",
    });
    assert(
        updateInventedFieldVal.valid === false,
        "11. update_goal: Unsupported / invented fields rejected"
    );

    // -------------------------------------------------------------
    // 3. UPDATE PROJECT TESTS
    // -------------------------------------------------------------

    // 3.1 Valid progress update
    const updateProjRes = await updateProjectTool.execute({
        projectId: "proj-1",
        progress: 70,
    });
    assert(
        updateProjRes.success === true &&
        updateProjRes.data?.project?.progress === 70 &&
        updateProjRes.data?.project?.status === "In Progress",
        "12. update_project: Valid progress update modifies project"
    );

    // 3.2 Auto-complete status at 100% progress
    const completeProjRes = await updateProjectTool.execute({
        projectId: "proj-1",
        progress: 100,
    });
    assert(
        completeProjRes.success === true &&
        completeProjRes.data?.project?.progress === 100 &&
        completeProjRes.data?.project?.status === "Completed",
        "13. update_project: Auto-completes status to 'Completed' when progress reaches 100%"
    );

    // 3.3 Invalid progress ranges rejected
    const negProgressVal = updateProjectTool.validateInput!({ projectId: "proj-1", progress: -10 });
    const excessProgressVal = updateProjectTool.validateInput!({ projectId: "proj-1", progress: 120 });
    const nanProgressVal = updateProjectTool.validateInput!({ projectId: "proj-1", progress: NaN });
    assert(
        negProgressVal.valid === false && excessProgressVal.valid === false && nanProgressVal.valid === false,
        "14. update_project: Invalid progress (<0, >100, NaN) strictly rejected"
    );

    // 3.4 Nonexistent project ID rejected safely
    const nonexistentProjRes = await updateProjectTool.execute({
        projectId: "nonexistent-proj-888",
        progress: 50,
    });
    assert(
        nonexistentProjRes.success === false &&
        typeof nonexistentProjRes.error === "string" &&
        nonexistentProjRes.error.includes("not found"),
        "15. update_project: Nonexistent project ID handled safely with structured error"
    );

    // 3.5 Unsupported fields rejected
    const updateProjInventedVal = updateProjectTool.validateInput!({
        projectId: "proj-1",
        deadline: "tomorrow",
        gitRepo: "https://github.com/...",
    });
    assert(
        updateProjInventedVal.valid === false,
        "16. update_project: Invented fields (deadline, gitRepo) rejected"
    );

    // -------------------------------------------------------------
    // 4. SECURITY BOUNDARY TESTS
    // -------------------------------------------------------------

    // 4.1 Delete tools are strictly prohibited
    const deleteGoalVal = validateToolCall({ tool: "delete_goal", arguments: { goalId: "goal-1" } });
    const deleteProjVal = validateToolCall({ tool: "delete_project", arguments: { projectId: "proj-1" } });
    const hasDeleteGoal = toolRegistry.has("delete_goal");
    const hasDeleteProj = toolRegistry.has("delete_project");
    assert(
        deleteGoalVal === null && deleteProjVal === null && !hasDeleteGoal && !hasDeleteProj,
        "17. Security: Prohibited delete tools ('delete_goal', 'delete_project') rejected and unregistered"
    );

    // 4.2 Shell metacharacters injection
    const shellGoalVal = createGoalTool.validateInput!({ title: "Goal 1; rm -rf /" });
    const shellProjVal = updateProjectTool.validateInput!({ projectId: "proj-1`reboot`", progress: 50 });
    assert(
        shellGoalVal.valid === false && shellProjVal.valid === false,
        "18. Security: Shell metacharacters injection rejected"
    );

    // 4.3 Answer Mode strictly enforces empty toolCalls
    const answerModePlan = parseAndValidateAgentPlan(
        JSON.stringify({
            type: "answer",
            answerText: "You have 2 goals and 2 projects.",
            toolCalls: [{ tool: "create_goal", arguments: { title: "Hacked" } }],
        }),
        "Show goals and projects"
    );
    assert(
        answerModePlan.valid === true && answerModePlan.plan?.toolCalls.length === 0,
        "19. Security: Answer Mode strictly forces empty toolCalls (no sneaky mutations)"
    );

    // -------------------------------------------------------------
    // 5. INTEGRATION TESTS
    // -------------------------------------------------------------

    // 5.1 CommandAgentService executes create_goal via Mock AI
    providerConfigService.setActiveProviderId("mock");
    const agentGoalRes = await commandAgentService.executeCommand(
        "Create a goal to solve 100 LeetCode problems",
        { isMock: true, context: { goals: goalService.getGoals() } }
    );
    assert(
        agentGoalRes.success === true &&
        agentGoalRes.intent === "create_goal" &&
        agentGoalRes.executed === true &&
        agentGoalRes.goal !== undefined,
        "20. Integration: CommandAgentService executes 'create_goal' end-to-end",
        JSON.stringify(agentGoalRes)
    );

    // 5.2 CommandAgentService executes update_project via Mock AI
    const agentProjRes = await commandAgentService.executeCommand(
        "Update my ML project progress to 70%",
        { isMock: true, context: { projects: projectService.getProjects() } }
    );
    assert(
        agentProjRes.success === true &&
        agentProjRes.intent === "update_project" &&
        agentProjRes.executed === true &&
        agentProjRes.project !== undefined,
        "21. Integration: CommandAgentService executes 'update_project' end-to-end",
        JSON.stringify(agentProjRes)
    );

    // 5.3 Existing task tools and read-only tools remain fully registered and operational
    assert(
        toolRegistry.has("create_task") &&
        toolRegistry.has("complete_task") &&
        toolRegistry.has("create_goal") &&
        toolRegistry.has("update_goal") &&
        toolRegistry.has("update_project") &&
        toolRegistry.has("launch_application") &&
        toolRegistry.has("show_tasks") &&
        toolRegistry.has("system_status"),
        "22. Compatibility: All task, goal, project, and read-only tools registered in ToolRegistry"
    );

    // 5.4 Claude AI Provider tool catalog includes new tools
    const claudeCatalogHasGoals = ALFRED_TOOL_CATALOG.some(t => t.name === "create_goal");
    const claudeCatalogHasUpdateGoal = ALFRED_TOOL_CATALOG.some(t => t.name === "update_goal");
    const claudeCatalogHasUpdateProj = ALFRED_TOOL_CATALOG.some(t => t.name === "update_project");
    assert(
        claudeCatalogHasGoals && claudeCatalogHasUpdateGoal && claudeCatalogHasUpdateProj,
        "23. Compatibility: ALFRED_TOOL_CATALOG includes create_goal, update_goal, and update_project"
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log("==========================================================================");
    console.log(`Phase 4.12 Test Results: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
    console.log("==========================================================================");

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Test runner encountered an unhandled error:", err);
    process.exit(1);
});
