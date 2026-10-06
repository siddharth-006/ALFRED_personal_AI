import { AgentPlan } from "../orchestrator/types";
import { ToolExecutionOptions } from "../tools/types";
import { PendingConfirmation, RiskEvaluationResult } from "./types";
import { logger } from "../../utils/logger";

/** Default pending confirmation lifetime: 10 minutes */
export const DEFAULT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/**
 * In-Memory Pending Confirmation Store (Phase 4.16)
 *
 * Stores exact validated AgentPlans awaiting explicit user confirmation.
 * Guarantees:
 * - In-memory only (never persisted to disk or localStorage).
 * - Exact validated plan is preserved immutably.
 * - Single-use consumption (consumed exactly once).
 * - Time-bounded (automatic expiration after TTL).
 */
export class ConfirmationStore {
    private pendingMap = new Map<string, PendingConfirmation>();
    private ttlMs: number;

    constructor(ttlMs = DEFAULT_CONFIRMATION_TTL_MS) {
        this.ttlMs = ttlMs;
    }

    /**
     * Generates a unique, non-guessable confirmation identifier.
     */
    private generateId(): string {
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 10);
        return `confirm_${timestamp}_${rand}`;
    }

    /**
     * Stores an already-validated plan awaiting user confirmation.
     */
    public createPendingConfirmation(
        plan: AgentPlan,
        risk: RiskEvaluationResult,
        userRequest: string,
        context?: Record<string, unknown>,
        options?: ToolExecutionOptions
    ): PendingConfirmation {
        const now = Date.now();
        const id = this.generateId();

        // Clone plan and context to guarantee immutability
        const immutablePlan: AgentPlan = JSON.parse(JSON.stringify(plan));
        const immutableContext = context ? JSON.parse(JSON.stringify(context)) : undefined;

        const pending: PendingConfirmation = {
            id,
            userRequest: String(userRequest || ""),
            plan: immutablePlan,
            risk,
            context: immutableContext,
            options: options ? { ...options } : undefined,
            createdAt: now,
            expiresAt: now + this.ttlMs,
        };

        this.pendingMap.set(id, pending);
        logger.info(
            `ConfirmationStore: Created pending confirmation '${id}' for prompt "${userRequest}" (${risk.mutationCount} mutations)`
        );

        return { ...pending };
    }

    /**
     * Stores a memory mutation proposal awaiting explicit user confirmation (Phase 5.7).
     */
    public createPendingMemoryConfirmation(
        proposal: any,
        userRequest: string
    ): PendingConfirmation {
        const now = Date.now();
        const id = this.generateId();

        const dummyPlan: AgentPlan = {
            userRequest,
            explanation: proposal.promptPreview,
            type: "action",
            toolCalls: [],
        };

        const risk: RiskEvaluationResult = {
            riskLevel: "medium",
            level: "medium",
            requiresConfirmation: true,
            mutationCount: 1,
            mutationTools: ["memory_mutation"],
            reason: `User confirmation required to ${proposal.type} memory`,
            summary: `Memory ${proposal.type}`,
        };

        const pending: PendingConfirmation = {
            id,
            userRequest: String(userRequest || ""),
            plan: dummyPlan,
            risk,
            memoryProposal: JSON.parse(JSON.stringify(proposal)),
            createdAt: now,
            expiresAt: now + this.ttlMs,
        };

        this.pendingMap.set(id, pending);
        logger.info(
            `ConfirmationStore: Created pending memory confirmation '${id}' for prompt "${userRequest}" (${proposal.type})`
        );

        return { ...pending };
    }

    /**
     * Retrieves pending confirmation if present and unexpired.
     */
    public getPendingConfirmation(id: string): PendingConfirmation | undefined {
        if (!id || typeof id !== "string") return undefined;
        const pending = this.pendingMap.get(id);
        if (!pending) return undefined;

        if (Date.now() > pending.expiresAt) {
            logger.warn(`ConfirmationStore: Confirmation '${id}' has expired. Discarding.`);
            this.pendingMap.delete(id);
            return undefined;
        }

        return { ...pending };
    }

    /**
     * Atomically retrieves and removes a pending confirmation so it can only be executed once.
     */
    public consumePendingConfirmation(id: string): PendingConfirmation | undefined {
        if (!id || typeof id !== "string") return undefined;
        const pending = this.getPendingConfirmation(id);
        if (!pending) return undefined;

        this.pendingMap.delete(id);
        logger.info(`ConfirmationStore: Consumed pending confirmation '${id}' for execution.`);
        return pending;
    }

    /**
     * Cancels and removes a pending confirmation.
     */
    public cancelPendingConfirmation(id: string): boolean {
        if (!id || typeof id !== "string") return false;
        const exists = this.pendingMap.has(id);
        if (exists) {
            this.pendingMap.delete(id);
            logger.info(`ConfirmationStore: Cancelled pending confirmation '${id}'.`);
        }
        return exists;
    }

    /**
     * Retrieves the most recently created active pending confirmation.
     */
    public getLatestPendingConfirmation(): PendingConfirmation | undefined {
        const keys = Array.from(this.pendingMap.keys());
        if (keys.length === 0) return undefined;
        for (let i = keys.length - 1; i >= 0; i--) {
            const pending = this.getPendingConfirmation(keys[i]);
            if (pending) return pending;
        }
        return undefined;
    }

    /**
     * Returns total active pending confirmations count.
     */
    public size(): number {
        return this.pendingMap.size;
    }

    /**
     * Clears all pending confirmations (e.g. for test cleanup).
     */
    public clear(): void {
        this.pendingMap.clear();
        logger.info("ConfirmationStore: Cleared all pending confirmations.");
    }
}

export const confirmationStore = new ConfirmationStore();
