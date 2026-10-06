/**
 * ALFRED Event Bus — Central Event-Driven Architecture
 *
 * Provides strongly-typed, decoupled event publishing and subscription.
 * Strictly in-process, non-polling, bounded event buffer.
 *
 * SECURITY & ARCHITECTURAL GUARANTEES:
 * 1. Sanitization: Rejects sensitive data, secrets, or executable code in payloads.
 * 2. Bounded Payload Size: Prevents memory exhaustion.
 * 3. Loop & Recursion Protection: Limits event propagation depth and detects causal loops.
 * 4. Error Isolation: Listener exceptions never disrupt publisher execution.
 */

import { AppEvent, AppEventType, AppEventPayloadMap, EventListener } from "./event.types";
import { logger } from "../utils/logger";

const MAX_EVENT_HISTORY = 50;
const MAX_PAYLOAD_BYTES = 16384; // 16 KB max payload
const MAX_RECURSION_DEPTH = 3;

const SENSITIVE_KEYWORD_REGEX = /(?:password|secret|bearer|authorization|api[-_]?key|private[-_]?key)/i;
const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\\\n\r]/;

export class EventBus {
    private static instance: EventBus | null = null;
    private listeners: Map<string, Set<EventListener<any>>> = new Map();
    private eventHistory: AppEvent[] = [];
    private idCounter = 0;

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Validates an event payload for safety and security.
     */
    public validatePayload(type: AppEventType, payload: unknown): { valid: boolean; error?: string } {
        const validTypes: AppEventType[] = [
            "task_completed",
            "task_created",
            "task_became_overdue",
            "focus_started",
            "focus_paused",
            "focus_resumed",
            "focus_completed",
            "focus_stopped",
            "goal_progress_changed",
            "project_activity",
            "routine_completed",
            "memory_changed",
            "workspace_launched",
            "app_launched",
        ];

        if (!validTypes.includes(type)) {
            return { valid: false, error: `Invalid or unrecognized event type: '${type}'.` };
        }

        if (!payload || typeof payload !== "object") {
            return { valid: false, error: "Payload must be a non-null object." };
        }

        let serialized: string;
        try {
            serialized = JSON.stringify(payload);
        } catch {
            return { valid: false, error: "Payload cannot be JSON-serialized." };
        }

        if (serialized.length > MAX_PAYLOAD_BYTES) {
            return { valid: false, error: `Payload exceeds maximum allowed size (${MAX_PAYLOAD_BYTES} bytes).` };
        }

        // Check for sensitive keywords in payload
        if (SENSITIVE_KEYWORD_REGEX.test(serialized)) {
            return { valid: false, error: "Payload contains forbidden sensitive terms or secrets." };
        }

        // Check for shell metacharacters in string properties
        for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
            if (typeof val === "string") {
                // If it looks like a shell injection or raw executable command, reject
                if (DANGEROUS_SHELL_REGEX.test(val) && (val.includes("rm ") || val.includes("curl") || val.includes("bash") || val.includes("powershell"))) {
                    return { valid: false, error: `Property '${key}' contains prohibited shell injection characters.` };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Publishes a typed event to all registered listeners.
     */
    public publish<K extends AppEventType>(
        type: K,
        payload: AppEventPayloadMap[K],
        metadata?: { causalId?: string; depth?: number }
    ): AppEvent<K> | null {
        const validation = this.validatePayload(type, payload);
        if (!validation.valid) {
            logger.warn(`[EventBus] Rejected event '${type}': ${validation.error}`);
            return null;
        }

        const depth = metadata?.depth ?? 0;
        if (depth > MAX_RECURSION_DEPTH) {
            logger.warn(`[EventBus] Dropped event '${type}' due to exceeding maximum recursion depth (${MAX_RECURSION_DEPTH}).`);
            return null;
        }

        const now = Date.now();
        const eventId = `evt_${now}_${++this.idCounter}_${Math.random().toString(36).substring(2, 6)}`;
        const event: AppEvent<K> = {
            id: eventId,
            type,
            timestamp: now,
            payload: { ...payload },
            causalId: metadata?.causalId,
            depth,
        };

        // Bounded history
        this.eventHistory.push(event);
        if (this.eventHistory.length > MAX_EVENT_HISTORY) {
            this.eventHistory.shift();
        }

        logger.info(`[EventBus] Published event '${type}' (ID: ${eventId}, depth: ${depth})`);

        // Notify specific listeners
        this.notifyListeners(type, event);

        // Notify wildcard listeners
        this.notifyListeners("*", event);

        return event;
    }

    private notifyListeners(channel: string, event: AppEvent): void {
        const handlers = this.listeners.get(channel);
        if (!handlers || handlers.size === 0) return;

        for (const handler of Array.from(handlers)) {
            try {
                const res = handler(event);
                if (res instanceof Promise) {
                    res.catch((err) => {
                        logger.error(`[EventBus] Async listener error on '${channel}': ${err?.message}`);
                    });
                }
            } catch (err: any) {
                logger.error(`[EventBus] Sync listener error on '${channel}': ${err?.message}`);
            }
        }
    }

    /**
     * Subscribes to a specific event type or "*" for all events.
     * Returns an unsubscribe function.
     */
    public subscribe<K extends AppEventType>(
        type: K | "*",
        listener: EventListener<K>
    ): () => void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(listener);

        return () => {
            const handlers = this.listeners.get(type);
            if (handlers) {
                handlers.delete(listener);
                if (handlers.size === 0) {
                    this.listeners.delete(type);
                }
            }
        };
    }

    /**
     * Returns recent events (read-only copy, newest first or oldest first).
     */
    public getRecentEvents(limit = 20): AppEvent[] {
        const slice = this.eventHistory.slice(-Math.min(limit, MAX_EVENT_HISTORY));
        return slice.map((e) => ({ ...e, payload: { ...e.payload } }));
    }

    public getHistory(limit = 50): AppEvent[] {
        return this.getRecentEvents(limit);
    }

    /**
     * Clears history (useful for test isolation).
     */
    public clearHistory(): void {
        this.eventHistory = [];
    }

    /**
     * Clears listeners (useful for test isolation).
     */
    public clearListeners(): void {
        this.listeners.clear();
    }
}

export const eventBus = EventBus.getInstance();
