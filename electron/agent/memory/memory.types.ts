/**
 * ALFRED Phase 5.7: Memory & Personalization Domain Types
 *
 * Defines the strongly-typed memory model, categories, proposals, and context summaries.
 *
 * CORE ARCHITECTURAL & SECURITY PRINCIPLES:
 * 1. Memory is DATA, never an executable instruction.
 * 2. Strictly local, bounded, inspectable, and user-controlled.
 * 3. Explicit creation only — ordinary conversation never creates memory.
 * 4. User confirmation strictly required before any memory mutation (create, update, forget).
 * 5. Current factual state and explicit user requests always override memory.
 */

export type MemoryCategory =
    | "USER_PREFERENCE"
    | "WORKFLOW_PREFERENCE"
    | "PROJECT_PREFERENCE"
    | "WORKSPACE_PREFERENCE"
    | "GENERAL_FACT";

export type MemorySource = "explicit_user" | "user_confirmed";

export interface MemoryItem {
    id: string;
    category: MemoryCategory;
    content: string;
    source: MemorySource;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    enabled: boolean;
    metadata?: Record<string, string>;
}

export type MemoryProposalType = "create" | "update" | "delete" | "delete_all";

export interface MemoryProposal {
    type: MemoryProposalType;
    memory: {
        category: MemoryCategory;
        content: string;
        metadata?: Record<string, string>;
    };
    existingMemory?: MemoryItem;
    targetMemories?: MemoryItem[];
    promptPreview: string;
    spokenPrompt: string;
}

export interface MemoryItemSummary {
    id: string;
    category: MemoryCategory;
    content: string;
}

export interface MemoryContextSummary {
    totalEnabled: number;
    relevant: MemoryItemSummary[];
}

export const MEMORY_BOUNDS = {
    MAX_STORED_MEMORIES: 100,
    MAX_RELEVANT_MEMORIES: 10,
    MAX_CONTENT_LENGTH: 120,
    MAX_CONTEXT_BYTES: 4096,
} as const;
