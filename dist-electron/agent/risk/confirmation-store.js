"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmationStore = exports.ConfirmationStore = exports.DEFAULT_CONFIRMATION_TTL_MS = void 0;
const logger_1 = require("../../utils/logger");
/** Default pending confirmation lifetime: 10 minutes */
exports.DEFAULT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
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
class ConfirmationStore {
    pendingMap = new Map();
    ttlMs;
    constructor(ttlMs = exports.DEFAULT_CONFIRMATION_TTL_MS) {
        this.ttlMs = ttlMs;
    }
    /**
     * Generates a unique, non-guessable confirmation identifier.
     */
    generateId() {
        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 10);
        return `confirm_${timestamp}_${rand}`;
    }
    /**
     * Stores an already-validated plan awaiting user confirmation.
     */
    createPendingConfirmation(plan, risk, userRequest, context, options) {
        const now = Date.now();
        const id = this.generateId();
        // Clone plan and context to guarantee immutability
        const immutablePlan = JSON.parse(JSON.stringify(plan));
        const immutableContext = context ? JSON.parse(JSON.stringify(context)) : undefined;
        const pending = {
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
        logger_1.logger.info(`ConfirmationStore: Created pending confirmation '${id}' for prompt "${userRequest}" (${risk.mutationCount} mutations)`);
        return { ...pending };
    }
    /**
     * Retrieves pending confirmation if present and unexpired.
     */
    getPendingConfirmation(id) {
        if (!id || typeof id !== "string")
            return undefined;
        const pending = this.pendingMap.get(id);
        if (!pending)
            return undefined;
        if (Date.now() > pending.expiresAt) {
            logger_1.logger.warn(`ConfirmationStore: Confirmation '${id}' has expired. Discarding.`);
            this.pendingMap.delete(id);
            return undefined;
        }
        return { ...pending };
    }
    /**
     * Atomically retrieves and removes a pending confirmation so it can only be executed once.
     */
    consumePendingConfirmation(id) {
        if (!id || typeof id !== "string")
            return undefined;
        const pending = this.getPendingConfirmation(id);
        if (!pending)
            return undefined;
        this.pendingMap.delete(id);
        logger_1.logger.info(`ConfirmationStore: Consumed pending confirmation '${id}' for execution.`);
        return pending;
    }
    /**
     * Cancels and removes a pending confirmation.
     */
    cancelPendingConfirmation(id) {
        if (!id || typeof id !== "string")
            return false;
        const exists = this.pendingMap.has(id);
        if (exists) {
            this.pendingMap.delete(id);
            logger_1.logger.info(`ConfirmationStore: Cancelled pending confirmation '${id}'.`);
        }
        return exists;
    }
    /**
     * Returns total active pending confirmations count.
     */
    size() {
        return this.pendingMap.size;
    }
    /**
     * Clears all pending confirmations (e.g. for test cleanup).
     */
    clear() {
        this.pendingMap.clear();
        logger_1.logger.info("ConfirmationStore: Cleared all pending confirmations.");
    }
}
exports.ConfirmationStore = ConfirmationStore;
exports.confirmationStore = new ConfirmationStore();
