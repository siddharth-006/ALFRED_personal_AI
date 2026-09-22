import { logger } from "../utils/logger";

export type EntityType = "task" | "goal" | "project" | "workspace" | "app";

export interface TargetEntity {
    type: EntityType;
    id?: string;
    name?: string;
}

export interface ConversationTurn {
    id: string;
    timestamp: number;
    userRequest: string;
    intent: string;
    responseType: "action" | "answer";
    answerText?: string;
    toolsExecuted: string[];
    targetEntity?: TargetEntity;
    /** Multiple entities produced or referenced in a multi-step execution */
    targetEntities?: TargetEntity[];
    summary: string;
}

export const DEFAULT_MAX_CONVERSATION_TURNS = 10;

/**
 * Short-Term Conversational Command Context Service (Phase 4.13)
 *
 * Maintains a bounded in-memory FIFO queue of recent interactions within the current session.
 *
 * PRIVACY & SECURITY GUARANTEES:
 * 1. Session-Scoped & In-Memory: NEVER saved to disk, files, database, or localStorage.
 * 2. Bounded Capacity: Drops oldest entries beyond DEFAULT_MAX_CONVERSATION_TURNS.
 * 3. Sanitized Data: Only stores safe metadata (request text, intent, tools, entity ID/name, answer summary).
 * 4. Zero Secrets: Never stores credentials, API keys, tokens, or environment variables.
 */
export class ConversationContextService {
    private turns: ConversationTurn[] = [];
    private maxTurns: number;
    private turnCounter = 0;

    constructor(maxTurns: number = DEFAULT_MAX_CONVERSATION_TURNS) {
        this.maxTurns = maxTurns;
    }

    /**
     * Adds a completed interaction turn to the recent conversation history.
     */
    public addTurn(
        turn: Omit<ConversationTurn, "id" | "timestamp">
    ): ConversationTurn {
        const newTurn: ConversationTurn = {
            id: `turn-${Date.now()}-${++this.turnCounter}`,
            timestamp: Date.now(),
            userRequest: String(turn.userRequest || "").trim(),
            intent: String(turn.intent || "unknown"),
            responseType: turn.responseType || "action",
            answerText: turn.answerText ? String(turn.answerText).trim() : undefined,
            toolsExecuted: Array.isArray(turn.toolsExecuted) ? [...turn.toolsExecuted] : [],
            targetEntity: turn.targetEntity ? { ...turn.targetEntity } : undefined,
            targetEntities: turn.targetEntities && turn.targetEntities.length > 0
                ? turn.targetEntities.map((e) => ({ ...e }))
                : undefined,
            summary: String(turn.summary || "").trim(),
        };

        this.turns.push(newTurn);

        // Enforce FIFO retention limit
        if (this.turns.length > this.maxTurns) {
            const removed = this.turns.shift();
            logger.info(`ConversationContextService: Evicted oldest turn '${removed?.id}' to maintain bound (${this.maxTurns}).`);
        }

        const entityLabel = newTurn.targetEntities && newTurn.targetEntities.length > 0
            ? newTurn.targetEntities.map((e) => e.name || e.id).join(", ")
            : newTurn.targetEntity?.name || "none";

        logger.info(
            `ConversationContextService: Recorded turn '${newTurn.id}' (intent: ${newTurn.intent}, entity: ${entityLabel}). History length: ${this.turns.length}`
        );

        return { ...newTurn };
    }

    /**
     * Returns a read-only list of recent conversation turns in chronological order.
     */
    public getRecentTurns(limit?: number): ConversationTurn[] {
        const effectiveLimit = limit && limit > 0 ? limit : this.maxTurns;
        return this.turns.slice(-effectiveLimit).map((t) => ({ ...t }));
    }

    /**
     * Returns the most recent conversation turn, if any.
     */
    public getLastTurn(): ConversationTurn | undefined {
        if (this.turns.length === 0) return undefined;
        return { ...this.turns[this.turns.length - 1] };
    }

    /**
     * Searches recent conversation turns backwards for the most recently referenced entity.
     * @param type Optional specific entity type filter ("task" | "goal" | "project" | "workspace" | "app")
     */
    public getLastEntity(type?: EntityType): TargetEntity | undefined {
        for (let i = this.turns.length - 1; i >= 0; i--) {
            const turn = this.turns[i];
            if (turn.targetEntities && turn.targetEntities.length > 0) {
                for (let j = turn.targetEntities.length - 1; j >= 0; j--) {
                    const entity = turn.targetEntities[j];
                    if (entity && (!type || entity.type === type)) {
                        return { ...entity };
                    }
                }
            }
            const entity = turn.targetEntity;
            if (entity && (!type || entity.type === type)) {
                return { ...entity };
            }
        }
        return undefined;
    }

    /**
     * Clears conversational history (e.g. for testing or session reset).
     */
    public clear(): void {
        this.turns = [];
        logger.info("ConversationContextService: Cleared conversation history.");
    }

    /**
     * Gets current maximum turns capacity.
     */
    public getMaxTurns(): number {
        return this.maxTurns;
    }

    /**
     * Sets maximum turns capacity (resizing if needed).
     */
    public setMaxTurns(maxTurns: number): void {
        this.maxTurns = Math.max(1, maxTurns);
        while (this.turns.length > this.maxTurns) {
            this.turns.shift();
        }
    }
}

export const conversationContextService = new ConversationContextService();
