/**
 * ALFRED Event System — Strongly Typed Application Event Contract
 *
 * Core event definitions for event-driven background intelligence.
 * Safe, bounded, and decoupled.
 */

export type AppEventType =
    | "task_completed"
    | "task_created"
    | "task_became_overdue"
    | "focus_started"
    | "focus_paused"
    | "focus_resumed"
    | "focus_completed"
    | "focus_stopped"
    | "goal_progress_changed"
    | "project_activity"
    | "routine_completed"
    | "memory_changed"
    | "workspace_launched"
    | "app_launched";

export interface TaskEventPayload {
    taskId: string;
    text?: string;
    title?: string;
    category?: string;
    priority?: "low" | "medium" | "high";
    dueDate?: string;
    completedAt?: number;
}

export interface FocusEventPayload {
    sessionId?: string;
    sessionName?: string;
    durationMinutes?: number;
    workspace?: string;
    application?: string;
    elapsedSeconds?: number;
    remainingSeconds?: number;
    category?: string;
    isCodingSession?: boolean;
    actualMinutes?: number;
}

export interface GoalEventPayload {
    goalId: string;
    title: string;
    type?: "Weekly" | "Monthly";
    current?: number;
    target?: number;
    completed?: boolean;
    progress?: number;
    progressPercentage?: number;
    delta?: number;
}

export interface ProjectEventPayload {
    projectId: string;
    name?: string;
    projectName?: string;
    category?: string;
    progress?: number;
    status?: string;
    action?: string;
}

export interface RoutineEventPayload {
    routineId: string;
    routineName: string;
    stepsCompleted: number;
    totalSteps: number;
}

export interface MemoryEventPayload {
    memoryId?: string;
    action: "create" | "update" | "delete" | "clear" | "created" | "updated" | "deleted";
    category?: string;
}

export interface WorkspaceEventPayload {
    workspaceId: string;
    name: string;
    type?: string;
}

export interface AppLaunchEventPayload {
    appName: string;
}

export interface AppEventPayloadMap {
    task_completed: TaskEventPayload;
    task_created: TaskEventPayload;
    task_became_overdue: TaskEventPayload;
    focus_started: FocusEventPayload;
    focus_paused: FocusEventPayload;
    focus_resumed: FocusEventPayload;
    focus_completed: FocusEventPayload;
    focus_stopped: FocusEventPayload;
    goal_progress_changed: GoalEventPayload;
    project_activity: ProjectEventPayload;
    routine_completed: RoutineEventPayload;
    memory_changed: MemoryEventPayload;
    workspace_launched: WorkspaceEventPayload;
    app_launched: AppLaunchEventPayload;
}

export interface AppEvent<K extends AppEventType = AppEventType> {
    id: string;
    type: K;
    timestamp: number;
    payload: AppEventPayloadMap[K];
    causalId?: string;
    depth?: number;
}

export type EventListener<K extends AppEventType = AppEventType> = (
    event: AppEvent<K>
) => void | Promise<void>;
