import { commandAgentService } from "./command-agent.service";

/**
 * Command Agent Test Suite (Phase 3.2 - Step 4 Expanded Capabilities Verification)
 *
 * NOTE: All Step 3 & Step 4 execution tests run with `{ isMock: true }` so NO real OS processes are spawned during tests.
 */
async function runTests() {
    console.log("==========================================================================");
    console.log("ALFRED Command Agent — Phase 3.2 Step 4 Comprehensive Capability Test Suite");
    console.log("==========================================================================\n");

    const testCases = [
        // APPLICATION LAUNCHING
        {
            name: "1. Application: Open VS Code",
            input: "Open VS Code",
            expectedIntent: "launch_application",
            expectedTarget: "VS Code",
        },
        {
            name: "2. Application: Launch Chrome",
            input: "Launch Chrome",
            expectedIntent: "launch_application",
            expectedTarget: "Chrome",
        },

        // NAVIGATION
        {
            name: "3. Navigation: Open missions",
            input: "Open missions",
            expectedIntent: "navigate",
            expectedTarget: "missions",
        },
        {
            name: "4. Navigation: Show my goals",
            input: "Show my goals",
            expectedIntent: "navigate",
            expectedTarget: "goals",
        },
        {
            name: "5. Navigation: Go to projects",
            input: "Go to projects",
            expectedIntent: "navigate",
            expectedTarget: "projects",
        },
        {
            name: "6. Navigation: Open workspaces",
            input: "Open workspaces",
            expectedIntent: "navigate",
            expectedTarget: "workspaces",
        },
        {
            name: "7. Navigation: Go home",
            input: "Go home",
            expectedIntent: "navigate",
            expectedTarget: "dashboard",
        },

        // SYSTEM STATUS
        {
            name: "8. System: System status",
            input: "System status",
            expectedIntent: "system_status",
            expectedTarget: null,
        },
        {
            name: "9. System: What's my system status?",
            input: "What's my system status?",
            expectedIntent: "system_status",
            expectedTarget: null,
        },

        // DEEP WORK / FOCUS
        {
            name: "10. Deep Work: Start Deep Work",
            input: "Start Deep Work",
            expectedIntent: "start_deep_work",
            expectedTarget: null,
        },
        {
            name: "11. Deep Work: Start focus mode",
            input: "Start focus mode",
            expectedIntent: "start_deep_work",
            expectedTarget: null,
        },

        // WORKSPACES
        {
            name: "12. Workspace: Open my Hackathon workspace",
            input: "Open my Hackathon workspace",
            expectedIntent: "launch_workspace",
            expectedTarget: "Hackathon",
        },
        {
            name: "13. Workspace: Start my coding workspace",
            input: "Start my coding workspace",
            expectedIntent: "launch_workspace",
            expectedTarget: "DSA",
        },

        // TASK INFORMATION (READ-ONLY)
        {
            name: "14. Tasks: Show today's tasks",
            input: "Show today's tasks",
            expectedIntent: "show_tasks",
            expectedTarget: null,
        },
        {
            name: "15. Tasks: What are my pending tasks?",
            input: "What are my pending tasks?",
            expectedIntent: "show_tasks",
            expectedTarget: null,
        },

        // UNKNOWN PROMPTS
        {
            name: "16. Unknown: Do something completely random",
            input: "Do something completely random",
            expectedIntent: "unknown",
            expectedTarget: null,
        },

        // SECURITY REJECTIONS
        {
            name: "17. Security: Run powershell",
            input: "Run powershell",
            expectedIntent: "unknown",
            expectedTarget: null,
        },
        {
            name: "18. Security: Execute cmd.exe",
            input: "Execute cmd.exe",
            expectedIntent: "unknown",
            expectedTarget: null,
        },
        {
            name: "19. Security: Open C:\\Windows\\System32\\calc.exe",
            input: "Open C:\\Windows\\System32\\calc.exe",
            expectedIntent: "unknown",
            expectedTarget: null,
        },
        {
            name: "20. Security: Open VS Code; powershell ...",
            input: "Open VS Code; powershell ...",
            expectedIntent: "unknown",
            expectedTarget: null,
        },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        const result = await commandAgentService.parseCommand(test.input);
        const isSuccess =
            result.intent === test.expectedIntent && result.target === test.expectedTarget;

        if (isSuccess) {
            passed++;
            console.log(`✅ [PASS] ${test.name}`);
            console.log(`   Input:  "${test.input}"`);
            console.log(`   Action: ${JSON.stringify(result)}\n`);
        } else {
            failed++;
            console.log(`❌ [FAIL] ${test.name}`);
            console.log(`   Input:    "${test.input}"`);
            console.log(`   Expected: intent="${test.expectedIntent}", target=${JSON.stringify(test.expectedTarget)}`);
            console.log(`   Received: ${JSON.stringify(result)}\n`);
        }
    }

    console.log("==========================================================================");
    console.log(`Step 4 Capability Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${testCases.length})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
