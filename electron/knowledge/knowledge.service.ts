/**
 * ALFRED Personal Knowledge / Local RAG — Knowledge Service
 *
 * Provides safe, bounded, local-first document indexing and deterministic retrieval.
 * Adheres strictly to security boundaries:
 * - Documents are untrusted data and remain plain strings.
 * - Never sent to shell, child_process, or eval.
 * - Deterministic keyword & token relevance scoring with internal citations.
 * - Bounded document size, chunk count, and persistence.
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getUserDataDirectory } from "../utils/paths";
import {
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeImportInput,
    KnowledgeImportResult,
    KnowledgeSearchOptions,
    KnowledgeSearchResult,
    KnowledgeSource,
    KnowledgeSourceType,
    KnowledgeSummary,
} from "./knowledge.types";
import { logger } from "../utils/logger";
import { eventBus } from "../events/event-bus";

// Guardrail constraints
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_TOTAL_DOCUMENTS = 100;
export const MAX_CHUNKS_PER_DOC = 50;
export const CHUNK_TARGET_SIZE = 400; // Characters
export const CHUNK_OVERLAP = 50;      // Characters
export const MAX_QUERY_LENGTH = 300;
export const MAX_SEARCH_RESULTS = 10;

// Dangerous file extensions
const EXECUTABLE_EXTENSIONS = new Set([
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".dll", ".bin", ".msi", ".com", ".scr", ".pif",
]);

// Sensitive credential patterns to reject or sanitize
const SENSITIVE_PATTERNS = [
    /AIza[0-9A-Za-z-_]{35}/,                         // Google API key
    /sk-[a-zA-Z0-9]{20,}/,                          // OpenAI secret key
    /ghp_[a-zA-Z0-9]{20,}/,                         // GitHub token
    /password\s*[:=]\s*['"][^'"]+['"]/i,            // Plaintext password field
];

export class KnowledgeService {
    private static instance: KnowledgeService | null = null;
    private persistencePath: string = "";
    private sources: Map<string, KnowledgeSource> = new Map();
    private documents: Map<string, KnowledgeDocument> = new Map();
    private chunks: KnowledgeChunk[] = [];
    private initialized = false;

    private constructor() {
        this.initStoragePath();
        this.loadFromDisk();
    }

    public static getInstance(): KnowledgeService {
        if (!KnowledgeService.instance) {
            KnowledgeService.instance = new KnowledgeService();
        }
        return KnowledgeService.instance;
    }

    private initStoragePath(): void {
        try {
            const userData = getUserDataDirectory();
            this.persistencePath = path.join(userData, "knowledge.json");
        } catch {
            this.persistencePath = path.join(getUserDataDirectory(), "knowledge.json");
        }
    }

    /**
     * Loads knowledge from local persistence with corruption resilience.
     */
    public loadFromDisk(): void {
        try {
            if (!fs.existsSync(this.persistencePath)) {
                this.initialized = true;
                return;
            }

            const raw = fs.readFileSync(this.persistencePath, "utf-8");
            if (!raw.trim()) {
                this.initialized = true;
                return;
            }

            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.sources) && Array.isArray(parsed.documents)) {
                this.sources.clear();
                this.documents.clear();
                this.chunks = [];

                for (const s of parsed.sources) {
                    if (s && s.id) this.sources.set(s.id, s);
                }
                for (const d of parsed.documents) {
                    if (d && d.id) {
                        this.documents.set(d.id, d);
                        const docChunks = this.chunkDocument(d);
                        this.chunks.push(...docChunks);
                    }
                }
                logger.info(`[KnowledgeService] Loaded ${this.documents.size} documents, ${this.chunks.length} chunks.`);
            }
            this.initialized = true;
        } catch (err: any) {
            logger.warn(`[KnowledgeService] Corrupted knowledge storage detected: ${err?.message}. Recovering...`);
            try {
                // Back up corrupt file
                const backupPath = `${this.persistencePath}.corrupt.${Date.now()}`;
                if (fs.existsSync(this.persistencePath)) {
                    fs.renameSync(this.persistencePath, backupPath);
                }
            } catch {}
            this.sources.clear();
            this.documents.clear();
            this.chunks = [];
            this.initialized = true;
        }
    }

    /**
     * Persists knowledge sources and documents to local disk.
     */
    public saveToDisk(): void {
        try {
            const payload = {
                version: 1,
                updatedAt: new Date().toISOString(),
                sources: Array.from(this.sources.values()),
                documents: Array.from(this.documents.values()),
            };
            fs.writeFileSync(this.persistencePath, JSON.stringify(payload, null, 2), "utf-8");
        } catch (err: any) {
            logger.error(`[KnowledgeService] Failed to save knowledge to disk: ${err?.message}`);
        }
    }

    /**
     * Validates input against security constraints.
     */
    public validateImport(input: KnowledgeImportInput): { valid: boolean; error?: string } {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Invalid document input payload." };
        }

        try {
            const { settingsService } = require("../services/settings.service");
            if (!settingsService.isPermitted("knowledge_access")) {
                return { valid: false, error: "Knowledge access is disabled in ALFRED Settings." };
            }
        } catch {
            // Standalone or testing context
        }

        if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
            return { valid: false, error: "Document name is required." };
        }

        if (input.content === undefined || input.content === null || typeof input.content !== "string") {
            return { valid: false, error: "Document content must be a string." };
        }

        // File size check
        const byteLength = Buffer.byteLength(input.content, "utf-8");
        if (byteLength > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                error: `Document exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB (size: ${(byteLength / (1024 * 1024)).toFixed(2)} MB).`,
            };
        }

        // Check path traversal if filePath provided
        if (input.filePath) {
            const normalized = path.normalize(input.filePath);
            if (input.filePath.includes("..") || normalized.includes("..")) {
                return { valid: false, error: "Path traversal detected in file path." };
            }

            const ext = path.extname(input.filePath).toLowerCase();
            if (EXECUTABLE_EXTENSIONS.has(ext)) {
                return { valid: false, error: `Executable file type '${ext}' is strictly forbidden.` };
            }
        }

        // Rejection of sensitive API keys or passwords in document
        for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(input.content)) {
                return { valid: false, error: "Document contains sensitive credentials or API keys and cannot be imported." };
            }
        }

        // Bounded document count
        if (this.documents.size >= MAX_TOTAL_DOCUMENTS) {
            return { valid: false, error: `Maximum document limit (${MAX_TOTAL_DOCUMENTS}) reached. Remove unused documents first.` };
        }

        return { valid: true };
    }

    /**
     * Splits document content into deterministic chunks.
     */
    public chunkDocument(doc: KnowledgeDocument): KnowledgeChunk[] {
        const text = doc.content || "";
        if (!text.trim()) return [];

        const chunks: KnowledgeChunk[] = [];
        let startIndex = 0;
        let chunkIndex = 0;

        while (startIndex < text.length && chunkIndex < MAX_CHUNKS_PER_DOC) {
            let endIndex = Math.min(startIndex + CHUNK_TARGET_SIZE, text.length);

            // Attempt to break on paragraph or sentence boundary if not at end
            if (endIndex < text.length) {
                const nextNewline = text.indexOf("\n", endIndex - 40);
                if (nextNewline !== -1 && nextNewline <= endIndex + 40) {
                    endIndex = nextNewline + 1;
                } else {
                    const nextPeriod = text.indexOf(". ", endIndex - 40);
                    if (nextPeriod !== -1 && nextPeriod <= endIndex + 40) {
                        endIndex = nextPeriod + 2;
                    }
                }
            }

            const chunkText = text.substring(startIndex, endIndex).trim();
            if (chunkText.length > 0) {
                // Approximate token count: ~4 chars per token
                const tokenCount = Math.max(1, Math.round(chunkText.length / 4));
                chunks.push({
                    id: `chunk_${doc.id}_${chunkIndex}`,
                    documentId: doc.id,
                    sourceId: doc.sourceId,
                    documentTitle: doc.title,
                    chunkIndex,
                    text: chunkText,
                    tokenCount,
                    projectId: doc.projectId,
                    workspaceId: doc.workspaceId,
                });
                chunkIndex++;
            }

            startIndex = Math.max(endIndex - CHUNK_OVERLAP, endIndex);
            if (startIndex >= text.length) break;
        }

        return chunks;
    }

    /**
     * Imports an explicitly provided document into the local knowledge layer.
     */
    public importDocument(input: KnowledgeImportInput): KnowledgeImportResult {
        const validation = this.validateImport(input);
        if (!validation.valid) {
            logger.warn(`[KnowledgeService] Import rejected: ${validation.error}`);
            return { success: false, error: validation.error };
        }

        // Sanitize and detect source type
        let sourceType: KnowledgeSourceType = input.type || "text";
        let contentToStore = input.content;

        if (sourceType === "json" || input.name.endsWith(".json")) {
            sourceType = "json";
            try {
                // Validate JSON parsability
                const parsed = JSON.parse(input.content);
                contentToStore = JSON.stringify(parsed, null, 2);
            } catch (err: any) {
                return { success: false, error: `Invalid JSON document content: ${err?.message}` };
            }
        } else if (input.name.endsWith(".md") || sourceType === "markdown") {
            sourceType = "markdown";
        }

        const now = new Date().toISOString();
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const doc: KnowledgeDocument = {
            id: docId,
            sourceId,
            title: input.name.trim(),
            content: contentToStore,
            type: sourceType,
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            tags: input.tags,
            createdAt: now,
            updatedAt: now,
        };

        const newChunks = this.chunkDocument(doc);

        const source: KnowledgeSource = {
            id: sourceId,
            name: doc.title,
            type: sourceType,
            filePath: input.filePath,
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            tags: input.tags,
            createdAt: now,
            updatedAt: now,
            sizeBytes: Buffer.byteLength(contentToStore, "utf-8"),
            chunkCount: newChunks.length,
        };

        this.sources.set(source.id, source);
        this.documents.set(doc.id, doc);
        this.chunks.push(...newChunks);

        this.saveToDisk();

        logger.info(`[KnowledgeService] Imported document '${doc.title}' (${newChunks.length} chunks, ${source.sizeBytes} bytes).`);

        return {
            success: true,
            document: doc,
            source,
            chunksCreated: newChunks.length,
        };
    }

    /**
     * Deterministic local keyword and token search with source citations.
     */
    public search(options: KnowledgeSearchOptions): KnowledgeSearchResult[] {
        if (!options || typeof options.query !== "string") {
            return [];
        }

        try {
            const { settingsService } = require("../services/settings.service");
            if (!settingsService.isPermitted("knowledge_access")) {
                logger.debug("[KnowledgeService] Search suppressed: knowledge_access permission disabled.");
                return [];
            }
        } catch {
            // Standalone or testing context
        }

        const query = options.query.trim().slice(0, MAX_QUERY_LENGTH);
        if (!query) return [];

        const limit = Math.min(options.limit || 5, MAX_SEARCH_RESULTS);
        const minScore = options.minScore ?? 0.05;

        // Tokenize query into lowercase alphanumeric words
        const queryTerms = query
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((t) => t.length >= 2);

        if (queryTerms.length === 0) return [];

        const results: KnowledgeSearchResult[] = [];
        const lowerQuery = query.toLowerCase();

        for (const chunk of this.chunks) {
            // Scope filtering
            if (options.projectId && chunk.projectId !== options.projectId) {
                continue;
            }
            if (options.workspaceId && chunk.workspaceId !== options.workspaceId) {
                continue;
            }

            const lowerChunk = chunk.text.toLowerCase();
            const lowerTitle = chunk.documentTitle.toLowerCase();

            let score = 0;

            // 1. Exact phrase match bonus
            if (lowerChunk.includes(lowerQuery)) {
                score += 3.0;
            }

            // 2. Title match bonus
            if (lowerTitle.includes(lowerQuery)) {
                score += 2.0;
            }

            // 3. Token match score
            let termHits = 0;
            for (const term of queryTerms) {
                if (lowerTitle.includes(term)) {
                    score += 0.8;
                }
                const count = (lowerChunk.match(new RegExp(`\\b${term}\\b`, "g")) || []).length;
                if (count > 0) {
                    termHits++;
                    score += Math.min(count * 0.4, 1.2);
                } else if (lowerChunk.includes(term)) {
                    termHits++;
                    score += 0.2;
                }
            }

            // Must match at least one relevant term
            if (termHits > 0 || score > 0) {
                const relevanceScore = Math.min(Number((score / (queryTerms.length + 1)).toFixed(3)), 1.0);
                if (relevanceScore >= minScore) {
                    results.push({
                        documentId: chunk.documentId,
                        documentName: chunk.documentTitle,
                        sourceId: chunk.sourceId,
                        chunkId: chunk.id,
                        chunkIndex: chunk.chunkIndex,
                        text: chunk.text,
                        relevanceScore,
                        projectId: chunk.projectId,
                        workspaceId: chunk.workspaceId,
                        citation: `[Source: ${chunk.documentTitle}, Chunk #${chunk.chunkIndex + 1}]`,
                    });
                }
            }
        }

        // Sort descending by relevance score
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return results.slice(0, limit);
    }

    /**
     * Formats search results into a clean, grounded answer suitable for CommandAgent & TTS.
     */
    public formatAnswer(query: string, results: KnowledgeSearchResult[]): { text: string; spokenText: string; hasKnowledge: boolean } {
        if (!results || results.length === 0) {
            const noMatch = `The local knowledge base does not contain enough information about "${query}".`;
            return {
                text: noMatch,
                spokenText: noMatch,
                hasKnowledge: false,
            };
        }

        const lines: string[] = [
            `Based on your local knowledge base:`,
            "",
        ];

        for (const res of results) {
            lines.push(`• ${res.citation}`);
            lines.push(`  "${res.text}"`);
            lines.push("");
        }

        const topDoc = results[0].documentName;
        const spoken = `According to your document ${topDoc}, ${results[0].text.slice(0, 140)}.`;

        return {
            text: lines.join("\n").trim(),
            spokenText: spoken,
            hasKnowledge: true,
        };
    }

    /**
     * Retrieves all documents or documents filtered by project/workspace.
     */
    public getDocuments(filter?: { projectId?: string; workspaceId?: string }): KnowledgeDocument[] {
        const all = Array.from(this.documents.values());
        if (!filter) return all;
        return all.filter((d) => {
            if (filter.projectId && d.projectId !== filter.projectId) return false;
            if (filter.workspaceId && d.workspaceId !== filter.workspaceId) return false;
            return true;
        });
    }

    /**
     * Retrieves document by ID.
     */
    public getDocumentById(id: string): KnowledgeDocument | null {
        return this.documents.get(id) || null;
    }

    /**
     * Deletes a document and its associated chunks and sources.
     */
    public deleteDocument(id: string): boolean {
        const doc = this.documents.get(id);
        if (!doc) return false;

        this.documents.delete(id);
        if (doc.sourceId) {
            this.sources.delete(doc.sourceId);
        }
        this.chunks = this.chunks.filter((c) => c.documentId !== id);
        this.saveToDisk();

        logger.info(`[KnowledgeService] Deleted document '${doc.title}' (${id}).`);
        return true;
    }

    /**
     * Clears all documents, chunks, and sources.
     */
    public clearAll(): void {
        this.sources.clear();
        this.documents.clear();
        this.chunks = [];
        this.saveToDisk();
        logger.info("[KnowledgeService] All knowledge base entries cleared.");
    }

    /**
     * Returns summary telemetry of the local knowledge base.
     */
    public getSummary(): KnowledgeSummary {
        let totalSizeBytes = 0;
        for (const s of this.sources.values()) {
            totalSizeBytes += s.sizeBytes;
        }

        return {
            totalDocuments: this.documents.size,
            totalChunks: this.chunks.length,
            totalSizeBytes,
            sources: Array.from(this.sources.values()),
        };
    }
}

export const knowledgeService = KnowledgeService.getInstance();
