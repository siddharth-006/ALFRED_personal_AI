import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getUserDataDirectory } from "../../utils/paths";
import { logger } from "../../utils/logger";
import { eventBus } from "../../events/event-bus";
import {
    MemoryCategory,
    MemoryItem,
    MemoryItemSummary,
    MEMORY_BOUNDS,
} from "./memory.types";
import { detectSensitiveData } from "./sensitive-filter";

const DEFAULT_STOP_WORDS = new Set([
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "and", "or", "is",
    "are", "was", "were", "i", "you", "my", "your", "that", "this", "it", "me",
    "please", "can", "could", "would", "prefer", "preferring", "like", "use",
    "using", "remember", "forget", "don't", "dont", "setup", "session",
]);

export class MemoryService {
    private memories: Map<string, MemoryItem> = new Map();
    private storageFilePath: string;
    private initialized = false;

    constructor(storagePath?: string) {
        if (storagePath) {
            this.storageFilePath = storagePath;
        } else {
            this.storageFilePath = this.resolveDefaultStoragePath();
        }
        this.loadFromDisk();
    }

    private resolveDefaultStoragePath(): string {
        try {
            const userDataDir = getUserDataDirectory();
            return path.join(userDataDir, "alfred_memories.json");
        } catch {
            return path.join(getUserDataDirectory(), "alfred_memories.json");
        }
    }

    public setStoragePath(customPath: string): void {
        this.storageFilePath = customPath;
        this.loadFromDisk();
    }

    public loadFromDisk(): void {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const data = fs.readFileSync(this.storageFilePath, "utf8");
                if (data.trim()) {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed)) {
                        this.memories.clear();
                        for (const item of parsed) {
                            if (item && item.id && item.content) {
                                this.memories.set(item.id, {
                                    id: String(item.id),
                                    category: item.category || "GENERAL_FACT",
                                    content: String(item.content).slice(0, MEMORY_BOUNDS.MAX_CONTENT_LENGTH),
                                    source: item.source || "explicit_user",
                                    createdAt: item.createdAt || new Date().toISOString(),
                                    updatedAt: item.updatedAt || new Date().toISOString(),
                                    lastUsedAt: item.lastUsedAt,
                                    enabled: item.enabled !== false,
                                    metadata: item.metadata || {},
                                });
                            }
                        }
                        logger.info(`MemoryService: Loaded ${this.memories.size} memory item(s) from ${this.storageFilePath}`);
                        this.initialized = true;
                        return;
                    }
                }
            }
        } catch (err) {
            logger.warn(`MemoryService: Could not load memories from disk: ${err}`);
        }
        this.initialized = true;
    }

    public saveToDisk(): void {
        try {
            const dir = path.dirname(this.storageFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const items = Array.from(this.memories.values());
            fs.writeFileSync(this.storageFilePath, JSON.stringify(items, null, 2), "utf8");
        } catch (err) {
            logger.warn(`MemoryService: Failed writing memories to disk: ${err}`);
        }
    }

    public getAll(options: { enabledOnly?: boolean; category?: MemoryCategory } = {}): MemoryItem[] {
        let items = Array.from(this.memories.values());
        if (options.enabledOnly) {
            items = items.filter((m) => m.enabled);
        }
        if (options.category) {
            items = items.filter((m) => m.category === options.category);
        }
        // Return cloned array
        return items.map((m) => ({ ...m, metadata: { ...m.metadata } }));
    }

    public getById(id: string): MemoryItem | undefined {
        const item = this.memories.get(id);
        return item ? { ...item, metadata: { ...item.metadata } } : undefined;
    }

    public save(item: {
        category: MemoryCategory;
        content: string;
        source?: "explicit_user" | "user_confirmed";
        metadata?: Record<string, string>;
        enabled?: boolean;
    }): { success: boolean; memory?: MemoryItem; error?: string } {
        // 1. Privacy filter check
        const sensitiveCheck = detectSensitiveData(item.content);
        if (sensitiveCheck.isSensitive) {
            return {
                success: false,
                error: sensitiveCheck.safeExplanation || "I can't save passwords, API keys, or credentials as ALFRED memory.",
            };
        }

        // 2. Capacity bounds check (max 100 items per Section 25)
        if (this.memories.size >= MEMORY_BOUNDS.MAX_STORED_MEMORIES) {
            return {
                success: false,
                error: `Memory limit reached (${MEMORY_BOUNDS.MAX_STORED_MEMORIES} items). Please remove old memories before saving a new one.`,
            };
        }

        // 3. Sanitize content and length limit
        const sanitizedContent = String(item.content || "").trim().slice(0, MEMORY_BOUNDS.MAX_CONTENT_LENGTH);
        if (!sanitizedContent) {
            return { success: false, error: "Memory content cannot be empty." };
        }

        const now = new Date().toISOString();
        const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const memory: MemoryItem = {
            id,
            category: item.category,
            content: sanitizedContent,
            source: item.source || "user_confirmed",
            createdAt: now,
            updatedAt: now,
            enabled: item.enabled !== false,
            metadata: item.metadata ? { ...item.metadata } : {},
        };

        this.memories.set(id, memory);
        this.saveToDisk();
        logger.info(`MemoryService: Stored memory '${id}' [${memory.category}]: "${memory.content}"`);

        eventBus.publish("memory_changed", {
            memoryId: id,
            action: "create",
            category: memory.category,
        });

        return { success: true, memory: { ...memory } };
    }

    public update(
        id: string,
        updates: Partial<Omit<MemoryItem, "id" | "createdAt">>
    ): { success: boolean; memory?: MemoryItem; error?: string } {
        const existing = this.memories.get(id);
        if (!existing) {
            return { success: false, error: `Memory with ID '${id}' not found.` };
        }

        if (updates.content) {
            const sensitiveCheck = detectSensitiveData(updates.content);
            if (sensitiveCheck.isSensitive) {
                return {
                    success: false,
                    error: sensitiveCheck.safeExplanation || "I can't save passwords, API keys, or credentials as ALFRED memory.",
                };
            }
            existing.content = String(updates.content).trim().slice(0, MEMORY_BOUNDS.MAX_CONTENT_LENGTH);
        }

        if (updates.category) {
            existing.category = updates.category;
        }
        if (typeof updates.enabled === "boolean") {
            existing.enabled = updates.enabled;
        }
        if (updates.metadata) {
            existing.metadata = { ...existing.metadata, ...updates.metadata };
        }
        if (updates.lastUsedAt) {
            existing.lastUsedAt = updates.lastUsedAt;
        }
        existing.updatedAt = new Date().toISOString();

        this.saveToDisk();
        logger.info(`MemoryService: Updated memory '${id}': "${existing.content}"`);

        eventBus.publish("memory_changed", {
            memoryId: id,
            action: "update",
            category: existing.category,
        });

        return { success: true, memory: { ...existing } };
    }

    public delete(id: string): { success: boolean; error?: string } {
        if (!this.memories.has(id)) {
            return { success: false, error: `Memory with ID '${id}' not found.` };
        }
        this.memories.delete(id);
        this.saveToDisk();
        logger.info(`MemoryService: Deleted memory '${id}'`);

        eventBus.publish("memory_changed", {
            memoryId: id,
            action: "delete",
        });

        return { success: true };
    }

    public deleteMany(ids: string[]): { success: boolean; count: number } {
        let count = 0;
        for (const id of ids) {
            if (this.memories.delete(id)) {
                count++;
            }
        }
        if (count > 0) {
            this.saveToDisk();
            logger.info(`MemoryService: Deleted ${count} memories`);
            eventBus.publish("memory_changed", {
                action: "delete",
            });
        }
        return { success: true, count };
    }

    public clear(): void {
        this.memories.clear();
        this.saveToDisk();
        logger.info("MemoryService: Cleared all stored memories.");
        eventBus.publish("memory_changed", {
            action: "clear",
        });
    }

    /**
     * Detects existing memory with identical or near-duplicate content (Section 12).
     */
    public findSimilarOrDuplicate(content: string, category?: MemoryCategory): MemoryItem | undefined {
        const normalized = this.normalizeText(content);
        if (!normalized) return undefined;

        for (const mem of this.memories.values()) {
            if (!mem.enabled) continue;
            if (category && mem.category !== category) continue;

            const existingNorm = this.normalizeText(mem.content);
            if (existingNorm === normalized) {
                return { ...mem };
            }

            // Word overlap check (>80% overlap)
            const wordsA = new Set(normalized.split(" "));
            const wordsB = new Set(existingNorm.split(" "));
            const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
            const union = new Set([...wordsA, ...wordsB]);
            if (union.size > 0 && intersection.size / union.size >= 0.75) {
                return { ...mem };
            }
        }
        return undefined;
    }

    /**
     * Deterministic, bounded relevance retrieval for agent reasoning (Section 8).
     * If nothing is relevant, returns an empty array.
     */
    public findRelevantMemories(
        query: string,
        options: { currentWorkspace?: string; currentProject?: string; limit?: number } = {}
    ): MemoryItemSummary[] {
        const limit = options.limit || MEMORY_BOUNDS.MAX_RELEVANT_MEMORIES;
        const queryTerms = this.extractQueryTokens(query);

        const scoredItems: Array<{ item: MemoryItem; score: number }> = [];

        for (const mem of this.memories.values()) {
            if (!mem.enabled) continue;

            let score = 0;
            const contentNorm = mem.content.toLowerCase();
            const categoryNorm = mem.category.toLowerCase();

            // 1. Direct entity match in metadata or content
            if (options.currentWorkspace) {
                const wsLower = options.currentWorkspace.toLowerCase();
                if (contentNorm.includes(wsLower) || mem.metadata?.workspaceName?.toLowerCase() === wsLower) {
                    score += 15;
                }
            }
            if (options.currentProject) {
                const projLower = options.currentProject.toLowerCase();
                if (contentNorm.includes(projLower) || mem.metadata?.projectName?.toLowerCase() === projLower) {
                    score += 15;
                }
            }

            // 2. Query token overlap
            let matchedTokens = 0;
            for (const token of queryTerms) {
                if (contentNorm.includes(token)) {
                    score += 5;
                    matchedTokens++;
                } else if (categoryNorm.includes(token)) {
                    score += 2;
                }
            }

            // Memory must have at least one meaningful match
            if (score > 0) {
                scoredItems.push({ item: mem, score });
            }
        }

        // Sort descending by score
        scoredItems.sort((a, b) => b.score - a.score);

        return scoredItems.slice(0, limit).map((s) => ({
            id: s.item.id,
            category: s.item.category,
            content: s.item.content,
        }));
    }

    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 1 && !DEFAULT_STOP_WORDS.has(w))
            .join(" ");
    }

    private extractQueryTokens(query: string): string[] {
        return query
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !DEFAULT_STOP_WORDS.has(w));
    }
}

export const memoryService = new MemoryService();
