/**
 * ALFRED Personal Knowledge / Local RAG — Types & Contracts
 *
 * Safe, bounded, local-first document indexing and deterministic retrieval.
 */

export type KnowledgeSourceType = "text" | "markdown" | "json" | "project_note";

export interface KnowledgeSource {
    id: string;
    name: string;
    type: KnowledgeSourceType;
    filePath?: string;
    projectId?: string;
    workspaceId?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    sizeBytes: number;
    chunkCount: number;
}

export interface KnowledgeDocument {
    id: string;
    sourceId: string;
    title: string;
    content: string;
    type: KnowledgeSourceType;
    projectId?: string;
    workspaceId?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface KnowledgeChunk {
    id: string;
    documentId: string;
    sourceId: string;
    documentTitle: string;
    chunkIndex: number;
    text: string;
    tokenCount: number;
    projectId?: string;
    workspaceId?: string;
}

export interface KnowledgeSearchResult {
    documentId: string;
    documentName: string;
    sourceId: string;
    chunkId: string;
    chunkIndex: number;
    text: string;
    relevanceScore: number;
    projectId?: string;
    workspaceId?: string;
    citation: string;
}

export interface KnowledgeSearchOptions {
    query: string;
    projectId?: string;
    workspaceId?: string;
    limit?: number;
    minScore?: number;
}

export interface KnowledgeImportInput {
    name: string;
    content: string;
    type?: KnowledgeSourceType;
    filePath?: string;
    projectId?: string;
    workspaceId?: string;
    tags?: string[];
}

export interface KnowledgeImportResult {
    success: boolean;
    document?: KnowledgeDocument;
    source?: KnowledgeSource;
    chunksCreated?: number;
    error?: string;
}

export interface KnowledgeSummary {
    totalDocuments: number;
    totalChunks: number;
    totalSizeBytes: number;
    sources: KnowledgeSource[];
}
