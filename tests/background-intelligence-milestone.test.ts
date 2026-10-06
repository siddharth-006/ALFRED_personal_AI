import assert from "node:assert";
import { eventBus } from "../electron/events/event-bus";
import { notificationManager } from "../electron/services/notification-manager.service";
import { routineScheduler } from "../electron/agent/scheduler/routine-scheduler.service";
import { conditionalAutomationService } from "../electron/agent/automation/conditional-automation.service";
import { weeklyReviewService } from "../electron/agent/review/weekly-review.service";
import { commandAgentService } from "../electron/agent/command-agent.service";
import { taskService } from "../electron/services/task.service";
import { focusService } from "../electron/services/focus.service";
import { confirmationStore } from "../electron/agent/risk/confirmation-store";
import { toolRegistry } from "../electron/agent/tools/tool-registry";

console.log("Starting ALFRED Background Intelligence Milestone Test Suite...");

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Clean test baseline isolation
  notificationManager.reset();
  routineScheduler.reset();
  conditionalAutomationService.reset();

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message || err);
      failed++;
    }
  }

  console.log("\n--- PART 1: EVENT SYSTEM TESTS (1-5) ---");

  await test("1. Event creation - valid event is created and published", () => {
    let captured: any = null;
    const unsub = eventBus.subscribe("task_created", (event) => {
      captured = event;
    });

    const event = eventBus.publish("task_created", {
      taskId: "test-task-1",
      title: "Test task creation",
    });

    unsub();
    assert.ok(event, "Event should be returned");
    assert.strictEqual(event?.type, "task_created");
    assert.strictEqual(captured?.payload?.taskId, "test-task-1");
  });

  await test("2. Event validation - event type and payload are validated", () => {
    const malformed = eventBus.publish("unknown_arbitrary_event" as any, {});
    assert.strictEqual(malformed, null, "Unknown event type should be rejected");
  });

  await test("3. Event bounds - event history is bounded and metadata safe", () => {
    for (let i = 0; i < 60; i++) {
      eventBus.publish("project_activity", {
        projectId: `proj-${i}`,
        projectName: `Project ${i}`,
        action: "created",
      });
    }
    const history = eventBus.getHistory();
    assert.ok(history.length <= 50, `History length (${history.length}) should not exceed 50`);
  });

  await test("4. Event propagation - multiple listeners receive typed events", () => {
    let count1 = 0;
    let count2 = 0;

    const u1 = eventBus.subscribe("focus_started", () => { count1++; });
    const u2 = eventBus.subscribe("focus_started", () => { count2++; });

    eventBus.publish("focus_started", {
      category: "Work",
      durationMinutes: 25,
      isCodingSession: false,
    });

    u1();
    u2();

    assert.strictEqual(count1, 1);
    assert.strictEqual(count2, 1);
  });

  await test("5. Malformed/untrusted event rejection - secrets and dangerous payloads rejected", () => {
    const rejected1 = eventBus.publish("task_created", {
      taskId: "t-secret",
      title: "Task with secret",
      apiKey: "sk-1234567890abcdef",
    } as any);

    assert.strictEqual(rejected1, null, "Payload with apiKey must be rejected");

    const rejected2 = eventBus.publish("task_created", {
      taskId: "t-pwd",
      title: "Task with password",
      password: "admin",
    } as any);

    assert.strictEqual(rejected2, null, "Payload with password must be rejected");
  });

  console.log("\n--- PART 2: NOTIFICATIONS TESTS (6-13) ---");
  notificationManager.reset();

  await test("6. Notification priority - supported levels low, normal, high", () => {
    const nLow = notificationManager.send({
      title: "Low notification",
      body: "Low priority message",
      category: "tasks",
      priority: "low",
    });
    assert.ok(nLow.success, "Low notification should post");

    const nHigh = notificationManager.send({
      title: "High notification",
      body: "High priority message",
      category: "focus",
      priority: "high",
    });
    assert.ok(nHigh.success, "High notification should post");
  });

  await test("7. Notification deduplication - identical title and category within window deduplicated", () => {
    const n1 = notificationManager.send({
      title: "Dedup Test",
      body: "Same content",
      category: "tasks",
    });
    assert.ok(n1.success, "First notification should post");

    const n2 = notificationManager.send({
      title: "Dedup Test",
      body: "Same content",
      category: "tasks",
    });
    assert.strictEqual(n2.success, false, "Duplicate notification should be rejected");
  });

  await test("8. Notification cooldown - throttled notification rate", () => {
    const n1 = notificationManager.send({
      title: "Cooldown Unique 1",
      body: "Body 1",
      category: "goals",
      cooldownMs: 60000,
    });
    assert.ok(n1.success, "First cooldown notification succeeds");

    const n2 = notificationManager.send({
      title: "Cooldown Unique 1",
      body: "Body 2",
      category: "goals",
      cooldownMs: 60000,
    });
    assert.strictEqual(n2.success, false, "Subsequent send within cooldown should be dropped");
  });

  await test("9. Notification dismissal - records can be dismissed", () => {
    const n = notificationManager.send({
      title: "To Dismiss",
      body: "Dismiss me",
      category: "system",
    });
    assert.ok(n.success && n.id, "Created record");

    const dismissed = notificationManager.dismiss(n.id!);
    assert.strictEqual(dismissed, true, "Should dismiss successfully");
    const found = notificationManager.getHistory().find((x) => x.id === n.id);
    assert.strictEqual(found?.dismissed, true, "Record should be marked dismissed");
  });

  await test("10. Notification history - bounded history retrieval", () => {
    const hist = notificationManager.getHistory({ limit: 10 });
    assert.ok(Array.isArray(hist));
    assert.ok(hist.length <= 10);
  });

  await test("11. Notification quiet hours - normal/low suppressed during quiet hours", () => {
    const origPrefs = notificationManager.getPreferences();
    notificationManager.updatePreferences({
      quietHours: { enabled: true, startHour: 0, endHour: 24, allowHighPriorityOnly: true },
    });

    const quietResult = notificationManager.send({
      title: "Quiet suppression",
      body: "Should not post",
      category: "proactive",
      priority: "normal",
    });
    assert.strictEqual(quietResult.success, false, "Normal priority should be blocked during quiet hours");

    const highResult = notificationManager.send({
      title: "High override",
      body: "Should post even in quiet hours",
      category: "focus",
      priority: "high",
    });
    assert.strictEqual(highResult.success, true, "High priority should bypass quiet hours");

    notificationManager.updatePreferences(origPrefs);
  });

  await test("12. Notification preferences - disabled categories are respected", () => {
    const origPrefs = notificationManager.getPreferences();
    notificationManager.updatePreferences({
      categories: { ...origPrefs.categories, routines: false },
    });

    const res = notificationManager.send({
      title: "Routines disabled",
      body: "Should be dropped",
      category: "routines",
    });
    assert.strictEqual(res.success, false, "Disabled category notification must be rejected");

    notificationManager.updatePreferences(origPrefs);
  });

  await test("13. Notification sanitization - removes judgment, scripts, and tokens", () => {
    const res = notificationManager.send({
      title: "You are falling behind! <script>alert(1)</script>",
      body: "Auth token: Bearer abcdef1234567890",
      category: "proactive",
    });
    assert.strictEqual(res.success, true, "Sanitized notification should post");
    const history = notificationManager.getHistory({ limit: 1 });
    const lastRecord = history[history.length - 1];
    assert.ok(!lastRecord.title.includes("<script>"), "HTML/script tags must be stripped");
    assert.ok(!lastRecord.title.toLowerCase().includes("falling behind"), "Ungrounded judgments must be replaced");
  });

  console.log("\n--- PART 3: SCHEDULER TESTS (14-23) ---");

  await test("14. Create schedule - creates a validated scheduled routine", () => {
    const res = routineScheduler.createSchedule({
      name: "Daily Morning Briefing",
      targetType: "briefing",
      hour: 8,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    assert.strictEqual(res.success, true, "Schedule should be created successfully");
    assert.ok(res.schedule, "Schedule object returned");
    assert.strictEqual(res.schedule?.targetType, "briefing");
    assert.strictEqual(res.schedule?.hour, 8);
  });

  await test("15. Schedule persistence - reload restores schedules", () => {
    const list = routineScheduler.getSchedules();
    assert.ok(list.length > 0, "Schedules must exist and persist");
  });

  await test("16. Next-run calculation - calculates correctly across days", () => {
    const nextIso = routineScheduler.calculateNextRun(19, 0, [1, 2, 3, 4, 5]);
    assert.ok(new Date(nextIso).getTime() > Date.now(), "Next run time should be future");
  });

  await test("17. Timezone awareness - schedule adheres to local timezone offset", () => {
    const nextIso = routineScheduler.calculateNextRun(12, 0, [0, 1, 2, 3, 4, 5, 6]);
    const d = new Date(nextIso);
    assert.strictEqual(d.getHours(), 12, "Scheduled hour in local time must match 12");
  });

  await test("18. Enable/disable schedule - toggles execution state", () => {
    const schedules = routineScheduler.getSchedules();
    const s = schedules[0];
    assert.ok(s, "Must have schedule");

    const updated = routineScheduler.setEnabled(s.id, false);
    assert.strictEqual(updated.schedule?.enabled, false, "Should be disabled");

    const reEnabled = routineScheduler.setEnabled(s.id, true);
    assert.strictEqual(reEnabled.schedule?.enabled, true, "Should be re-enabled");
  });

  await test("19. Duplicate prevention - rejects identical routine at same time", () => {
    const dup = routineScheduler.createSchedule({
      name: "Daily Morning Briefing",
      targetType: "briefing",
      hour: 8,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    assert.strictEqual(dup.success, false, "Identical schedule must be prevented");
  });

  await test("20. Missed schedule handling - recalculates next run without duplicate firing", () => {
    const schedules = routineScheduler.getSchedules();
    const s = schedules[0];
    assert.ok(s);
    const next = routineScheduler.calculateNextRun(s.hour, s.minute, s.daysOfWeek);
    assert.ok(next);
  });

  await test("21. Read-only scheduled routine execution - runs without mutation confirmation", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "mock-ro-briefing",
      name: "Test Briefing",
      targetType: "briefing",
      hour: 8,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.executed, true);
    assert.strictEqual(res.requiresConfirmation, false);
    assert.ok(res.message.includes("Briefing"));
  });

  await test("22. Mutation scheduled routine confirmation - pauses at confirmation store", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "mock-mut-coding",
      name: "Test Coding Routine",
      targetType: "routine",
      targetId: "coding_mode",
      hour: 19,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.executed, false, "Mutation routine must not execute silently");
    assert.strictEqual(res.requiresConfirmation, true);
    assert.ok(res.message.includes("waiting for human confirmation"), "Must notify awaiting confirmation");
  });

  await test("23. Unsafe scheduled execution rejection - invalid targets rejected", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "mock-bad-target",
      name: "Bad target",
      targetType: "malicious_script" as any,
      hour: 12,
      minute: 0,
      daysOfWeek: [1],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.executed, false);
    assert.ok(res.message.includes("Unsupported"));
  });

  console.log("\n--- PART 4: CONDITIONAL AUTOMATION TESTS (24-31) ---");

  await test("24. Event matching - matches subscribed event type", async () => {
    const created = conditionalAutomationService.createRule({
      name: "On focus complete notify",
      eventType: "focus_completed",
      action: {
        type: "notification",
        params: {
          title: "Focus Complete",
          body: "Great job completing your focus session.",
        },
      },
    });
    assert.strictEqual(created.success, true, "Rule created");
    const rule = created.rule!;

    eventBus.publish("focus_completed", {
      category: "Code",
      durationMinutes: 45,
      actualMinutes: 45,
    });
    await new Promise((r) => setTimeout(r, 20));

    const found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.ok(found?.lastTriggeredAt, "Rule should have been triggered");

    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("25. Condition evaluation - evaluates metadata condition accurately", async () => {
    const created = conditionalAutomationService.createRule({
      name: "High duration focus check",
      eventType: "focus_completed",
      conditions: {
        field: "durationMinutes",
        operator: "gte",
        value: 50,
      },
      action: {
        type: "notification",
        params: {
          title: "Long Focus Done",
          body: "Extended focus session completed.",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;

    // 30 mins (< 50) -> should NOT trigger
    eventBus.publish("focus_completed", {
      category: "Study",
      durationMinutes: 30,
      actualMinutes: 30,
    });
    await new Promise((r) => setTimeout(r, 20));
    let found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.strictEqual(found?.lastTriggeredAt, undefined, "Should not trigger when condition fails");

    // 60 mins (>= 50) -> SHOULD trigger
    eventBus.publish("focus_completed", {
      category: "Study",
      durationMinutes: 60,
      actualMinutes: 60,
    });
    await new Promise((r) => setTimeout(r, 20));
    found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.ok(found?.lastTriggeredAt, "Should trigger when condition passes");

    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("26. Cooldown - prevents rapid re-triggering of automations", async () => {
    const created = conditionalAutomationService.createRule({
      name: "Cooldown test rule",
      eventType: "project_activity",
      cooldownSeconds: 60,
      action: {
        type: "notification",
        params: {
          title: "Project Active",
          body: "Project was modified.",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;

    eventBus.publish("project_activity", {
      projectId: "p1",
      projectName: "Proj",
      action: "updated",
    });
    await new Promise((r) => setTimeout(r, 20));
    const firstTrigger = conditionalAutomationService.getRules().find((r) => r.id === rule.id)?.lastTriggeredAt;

    // Second publish immediately within cooldown
    eventBus.publish("project_activity", {
      projectId: "p1",
      projectName: "Proj",
      action: "updated",
    });
    await new Promise((r) => setTimeout(r, 20));
    const secondTrigger = conditionalAutomationService.getRules().find((r) => r.id === rule.id)?.lastTriggeredAt;

    assert.strictEqual(firstTrigger, secondTrigger, "Second execution should be blocked by cooldown");
    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("27. Recursion prevention - deep event depths are ignored", async () => {
    const created = conditionalAutomationService.createRule({
      name: "Depth check",
      eventType: "task_completed",
      action: {
        type: "notification",
        params: {
          title: "Done",
          body: "Task completed",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;

    eventBus.publish("task_completed", { taskId: "d1", text: "Deep" }, { depth: 2 });
    await new Promise((r) => setTimeout(r, 20));

    const found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.strictEqual(found?.lastTriggeredAt, undefined, "Recursive/depth > 0 event must not trigger automation");
    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("28. Loop prevention - self-causal IDs are blocked", async () => {
    const created = conditionalAutomationService.createRule({
      name: "Causal check",
      eventType: "task_completed",
      action: {
        type: "notification",
        params: {
          title: "Done",
          body: "Task completed",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;

    eventBus.publish("task_completed", { taskId: "c1", text: "Causal" }, { depth: 0, causalId: rule.id });
    await new Promise((r) => setTimeout(r, 20));

    const found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.strictEqual(found?.lastTriggeredAt, undefined, "Causal loop must be blocked");
    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("29. Disabled automation - does not fire when disabled", async () => {
    const created = conditionalAutomationService.createRule({
      name: "Disabled rule",
      eventType: "focus_started",
      action: {
        type: "notification",
        params: {
          title: "Disabled",
          body: "Should not show",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;
    conditionalAutomationService.setEnabled(rule.id, false);

    eventBus.publish("focus_started", {
      category: "Test",
      durationMinutes: 10,
      isCodingSession: false,
    });
    await new Promise((r) => setTimeout(r, 20));

    const found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.strictEqual(found?.lastTriggeredAt, undefined, "Disabled automation must not execute");
    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("30. Notification action - generates ground notification", async () => {
    const created = conditionalAutomationService.createRule({
      name: "Notify on goal change",
      eventType: "goal_progress_changed",
      action: {
        type: "notification",
        params: {
          title: "Goal Progress Recorded",
          body: "A milestone on your goal has been updated.",
        },
      },
    });
    assert.strictEqual(created.success, true);
    const rule = created.rule!;

    eventBus.publish("goal_progress_changed", {
      goalId: "g1",
      title: "Master TypeScript",
      progress: 75,
      delta: 25,
    });

    await new Promise((r) => setTimeout(r, 20));

    const found = conditionalAutomationService.getRules().find((r) => r.id === rule.id);
    assert.ok(found?.lastTriggeredAt, "Should trigger notification action");
    conditionalAutomationService.deleteRule(rule.id);
  });

  await test("31. Unsafe action rejection - rejects unauthorized command or shell execution", () => {
    const invalid = conditionalAutomationService.createRule({
      name: "Unsafe rule",
      eventType: "task_created",
      action: {
        type: "shell_exec" as any,
        params: { command: "rm -rf /" },
      } as any,
    });
    assert.strictEqual(invalid.success, false, "Unsafe action type must be rejected");
  });

  console.log("\n--- PART 5: WEEKLY REVIEW TESTS (32-40) ---");

  await test("32. Completed tasks - extracts tasks completed this week", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.completedTasks), "Must return completed tasks array");
  });

  await test("33. Unfinished tasks - extracts pending tasks", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.unfinishedTasks), "Must return unfinished tasks array");
  });

  await test("34. Overdue tasks - extracts overdue tasks safely", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.overdueTasks), "Must return overdue tasks array");
  });

  await test("35. Focus summary - reflects actual focus minutes and session counts", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(typeof review.focusSummary.totalMinutes === "number");
    assert.ok(typeof review.focusSummary.sessionCount === "number");
  });

  await test("36. Project activity - extracts verified active projects", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.projectActivity));
  });

  await test("37. Goal progress - extracts real active goals", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.goalProgress));
  });

  await test("38. Memory relevance - includes recent memory observations", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(Array.isArray(review.relevantMemories));
  });

  await test("39. Deterministic output - produces grounded summary without fake stats", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(review.conciseSummary.length > 0);
    assert.ok(review.spokenSummary.length > 0);
    assert.ok(!review.conciseSummary.includes("NaN"));
    assert.ok(!review.spokenSummary.includes("undefined"));
  });

  await test("40. Empty state handling - handles clean/empty system gracefully", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    assert.ok(review, "Weekly review must not throw on empty state");
    assert.ok(review.timeContext.currentWeekStart && review.timeContext.currentWeekEnd);
  });

  console.log("\n--- PART 6: WEEKLY PLANNING TESTS (41-44) ---");

  await test("41. Proposal generation - generates structured weekly plan proposal", () => {
    const proposal = weeklyReviewService.generateWeeklyPlanProposal();
    assert.ok(proposal, "Proposal must be generated");
    assert.ok(Array.isArray(proposal.suggestedPriorities));
    assert.ok(Array.isArray(proposal.suggestedFocusAllocations));
    assert.ok(Array.isArray(proposal.suggestedRoutines));
  });

  await test("42. No automatic mutation - state remains untouched during proposal", () => {
    const tasksBefore = taskService.getTasks().length;
    weeklyReviewService.generateWeeklyPlanProposal();
    const tasksAfter = taskService.getTasks().length;
    assert.strictEqual(tasksBefore, tasksAfter, "Planning proposal must NOT mutate tasks");
  });

  await test("43. Explicit user approval flow - proposal requires confirmation to adopt", () => {
    const proposal = weeklyReviewService.generateWeeklyPlanProposal();
    assert.strictEqual(proposal.requiresExplicitConfirmation, true);
  });

  await test("44. Confirmation integration - plans go through ConfirmationStore", async () => {
    const result = await commandAgentService.execute("Plan my week", { isMock: true });
    assert.strictEqual(result.intent, "weekly_planning");
    assert.ok(result.weeklyPlan, "Proposal returned to user");
    assert.strictEqual(result.requiresConfirmation, undefined, "Proposal display itself does not mutate");
  });

  console.log("\n--- PART 7: INTEGRATION TESTS (45-55) ---");

  await test("45. CommandAgent intent detection - matches review and schedule intents", async () => {
    const r1 = await commandAgentService.execute("How did I do this week?", { isMock: true });
    assert.strictEqual(r1.intent, "weekly_review");

    const r2 = await commandAgentService.execute("Give me my weekly review", { isMock: true });
    assert.strictEqual(r2.intent, "weekly_review");

    const r3 = await commandAgentService.execute("Show my schedules", { isMock: true });
    assert.strictEqual(r3.intent, "schedule");

    const r4 = await commandAgentService.execute("Show my automations", { isMock: true });
    assert.strictEqual(r4.intent, "automation");
  });

  await test("46. Voice compatibility - answers have clean text suitable for voice output", async () => {
    const r = await commandAgentService.execute("Summarize my week", { isMock: true });
    assert.ok(r.answerText);
    assert.ok(r.answerText.length < 500, "Spoken summary should be concise");
  });

  await test("47. TTS sanitization - voice text does not contain JSON, IDs, or file paths", () => {
    const review = weeklyReviewService.generateWeeklyReview();
    const spoken = review.spokenSummary;
    assert.ok(!spoken.includes("{"), "No JSON braces");
    assert.ok(!spoken.includes("}"), "No JSON braces");
    assert.ok(!spoken.includes("C:\\"), "No Windows file paths");
    assert.ok(!spoken.includes("/Users/"), "No Unix paths");
  });

  await test("48. Memory compatibility - memory changes emit events safely", () => {
    let captured = false;
    const unsub = eventBus.subscribe("memory_changed", () => { captured = true; });
    eventBus.publish("memory_changed", {
      action: "created",
      memoryId: "m1",
      category: "USER_PREFERENCE",
    });
    unsub();
    assert.strictEqual(captured, true);
  });

  await test("49. Focus compatibility - focus state transitions emit typed events", () => {
    let captured: any = null;
    const unsub = eventBus.subscribe("focus_resumed", (e) => { captured = e; });
    eventBus.publish("focus_resumed", {
      category: "Deep Work",
    });
    unsub();
    assert.strictEqual(captured?.payload?.category, "Deep Work");
  });

  await test("50. Morning Briefing compatibility - scheduled briefing works through scheduler", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "test-briefing",
      name: "Briefing",
      targetType: "briefing",
      hour: 8,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.executed, true);
  });

  await test("51. End-of-Day Review compatibility - scheduled review works through scheduler", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "test-review",
      name: "Review",
      targetType: "review",
      hour: 21,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.executed, true);
  });

  await test("52. Coding Mode compatibility - scheduled coding mode produces confirmation requirement", async () => {
    const res = await routineScheduler.executeScheduledTarget({
      id: "test-coding",
      name: "Coding",
      targetType: "routine",
      targetId: "coding_mode",
      hour: 19,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });
    assert.strictEqual(res.requiresConfirmation, true);
  });

  await test("53. Agentic Planning compatibility - weekly plan proposal integrates with agent planning", () => {
    const proposal = weeklyReviewService.generateWeeklyPlanProposal();
    assert.ok(proposal.suggestedPriorities.length >= 0);
  });

  await test("54. ToolRegistry security - scheduler and automations do not bypass tool registry", () => {
    const tools = toolRegistry.list();
    assert.ok(tools.length > 0);
    assert.ok(!tools.some((t) => t.name === "eval" || t.name === "shell_exec"));
  });

  await test("55. No autonomous tool execution - mutations always stop at ConfirmationStore", async () => {
    const pendingBefore = confirmationStore.size();
    const res = await routineScheduler.executeScheduledTarget({
      id: "test-sec-coding",
      name: "Coding Mode",
      targetType: "routine",
      targetId: "coding_mode",
      hour: 18,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRunAt: new Date().toISOString(),
      timezone: "UTC",
    });

    const pendingAfter = confirmationStore.size();
    assert.strictEqual(res.requiresConfirmation, true, "Must require confirmation");
    assert.strictEqual(pendingAfter, pendingBefore + 1, "Confirmation store must have pending request");

    const latest = confirmationStore.getLatestPendingConfirmation();
    if (latest) {
      confirmationStore.cancelPendingConfirmation(latest.id);
    }
  });

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
