"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Search,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Hash,
  Database,
} from "lucide-react";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";
import type {
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeSummary,
} from "../../electron/knowledge/knowledge.types";

interface KnowledgeVaultModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function KnowledgeVaultModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: KnowledgeVaultModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const onClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [controlledOnClose]);

  const [activeTab, setActiveTab] = useState<"search" | "documents" | "import">("search");
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Import form state
  const [importName, setImportName] = useState("");
  const [importContent, setImportContent] = useState("");
  const [importType, setImportType] = useState<"text" | "markdown" | "json" | "project_note">("markdown");
  const [importProject, setImportProject] = useState("");
  const [statusNotice, setStatusNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadData = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.knowledge) {
      try {
        const [sum, docs] = await Promise.all([
          window.electron.knowledge.getSummary(),
          window.electron.knowledge.getDocuments(),
        ]);
        setSummary(sum);
        setDocuments(docs || []);
      } catch (err) {
        console.error("Failed to load knowledge vault:", err);
      }
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      playClickSound();
      setInternalIsOpen(true);
      loadData();
    };

    window.addEventListener("open-knowledge-modal", handleOpen);
    return () => window.removeEventListener("open-knowledge-modal", handleOpen);
  }, [loadData]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    playClickSound();
    if (window.electron?.knowledge) {
      const results = await window.electron.knowledge.search({
        query: searchQuery,
        limit: 8,
      });
      setSearchResults(results || []);
      setHasSearched(true);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importName.trim() || !importContent.trim()) {
      setStatusNotice({ type: "error", message: "Name and content are required." });
      return;
    }

    playClickSound();
    if (window.electron?.knowledge) {
      const res = await window.electron.knowledge.import({
        name: importName.trim(),
        content: importContent,
        type: importType,
        projectId: importProject.trim() || undefined,
      });

      if (res.success) {
        playSuccessSound();
        setStatusNotice({
          type: "success",
          message: `Imported "${importName}" with ${res.chunksCreated} indexed chunk(s).`,
        });
        setImportName("");
        setImportContent("");
        loadData();
      } else {
        setStatusNotice({
          type: "error",
          message: res.error || "Failed to import document.",
        });
      }
    }
  };

  const handleDelete = async (id: string, title: string) => {
    playClickSound();
    if (window.electron?.knowledge) {
      await window.electron.knowledge.delete(id);
      playSuccessSound();
      setStatusNotice({ type: "success", message: `Deleted document "${title}".` });
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl h-[700px] bg-[#0c0d10] border border-white/10 rounded-xl flex flex-col shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-wide text-white flex items-center gap-2">
                  PERSONAL KNOWLEDGE VAULT
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    LOCAL RAG
                  </span>
                </h2>
                <p className="text-xs text-white/50">
                  User-controlled private document indexing & semantic grounding
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subheader summary stats */}
          <div className="px-6 py-2.5 bg-black/40 border-b border-white/5 flex items-center gap-6 text-xs text-white/60">
            <div className="flex items-center gap-1.5">
              <Database size={13} className="text-cyan-400" />
              <span>{summary?.totalDocuments || 0} Documents</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Hash size={13} className="text-cyan-400" />
              <span>{summary?.totalChunks || 0} Indexed Chunks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="text-cyan-400" />
              <span>{Math.round((summary?.totalSizeBytes || 0) / 1024)} KB Stored</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 px-6 gap-2 bg-black/20">
            <button
              onClick={() => { playClickSound(); setActiveTab("search"); }}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "search"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              <Search size={14} />
              Search Knowledge
            </button>
            <button
              onClick={() => { playClickSound(); setActiveTab("documents"); }}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "documents"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              <FileText size={14} />
              Browse Documents ({documents.length})
            </button>
            <button
              onClick={() => { playClickSound(); setActiveTab("import"); }}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "import"
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              <Upload size={14} />
              Import Document
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {statusNotice && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  statusNotice.type === "success"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/15 border border-red-500/30 text-red-300"
                }`}
              >
                {statusNotice.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {statusNotice.message}
              </div>
            )}

            {/* TAB 1: SEARCH */}
            {activeTab === "search" && (
              <div className="space-y-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-white/40" size={16} />
                    <input
                      type="text"
                      placeholder="Ask or search your documents (e.g., 'ALFRED architecture decision')..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/15 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-colors"
                  >
                    Search
                  </button>
                </form>

                {searchResults.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="text-[11px] text-white/40 uppercase tracking-wider">
                      Found {searchResults.length} relevant chunk(s)
                    </div>
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-cyan-300">{r.citation}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/60">
                            Score: {Math.round(r.relevanceScore * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed font-mono whitespace-pre-wrap">
                          {r.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="text-center py-12 text-white/40 text-xs">
                    No relevant information found in your local knowledge base for &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/40 text-xs">
                    Type a query above to deterministically search your indexed notes and project documents.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BROWSE DOCUMENTS */}
            {activeTab === "documents" && (
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs">
                    No documents imported yet. Switch to the &quot;Import Document&quot; tab to add notes.
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between hover:border-white/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          <FileText size={14} className="text-cyan-400" />
                          {doc.title}
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                            {doc.type}
                          </span>
                          {doc.projectId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              Project Scoped
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 truncate max-w-md">
                          {doc.content.slice(0, 100)}...
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-2 rounded hover:bg-red-500/20 text-white/40 hover:text-red-300 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: IMPORT */}
            {activeTab === "import" && (
              <form onSubmit={handleImport} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. ALFRED Architecture Decision"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-white/15 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Document Type</label>
                    <select
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-black/60 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="markdown">Markdown (.md)</option>
                      <option value="text">Plain Text (.txt)</option>
                      <option value="json">Structured JSON (.json)</option>
                      <option value="project_note">Project Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Optional Project Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Machine Learning"
                      value={importProject}
                      onChange={(e) => setImportProject(e.target.value)}
                      className="w-full px-3 py-2 bg-black/60 border border-white/15 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Content (Untrusted Raw Text)</label>
                  <textarea
                    rows={8}
                    placeholder="Paste your notes or document text here..."
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    className="w-full p-3 bg-black/60 border border-white/15 rounded-lg text-xs text-white font-mono placeholder-white/40 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 text-[11px] text-white/50">
                  Security Guarantee: Text is safely chunked into local data only. It will never be executed or passed to shell processes.
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-colors"
                >
                  Import & Index Document
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-white/40">
            <div>Deterministic TF-IDF Ranking • Zero Cloud Document Crawling</div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-white/10 text-white hover:bg-white/20 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
