"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Trash2, Edit2, Check, BrainCircuit, ShieldAlert, Plus } from "lucide-react";
import { playClickSound, playHoverSound } from "@/utils/audioSystem";

export interface MemoryItemView {
    id: string;
    category: string;
    content: string;
    source: string;
    createdAt: string;
    updatedAt: string;
    enabled: boolean;
    metadata?: Record<string, string>;
}

export default function MemoryVaultModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [memories, setMemories] = useState<MemoryItemView[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [newContent, setNewContent] = useState<string>("");
    const [newCategory, setNewCategory] = useState<string>("USER_PREFERENCE");
    const [showAddForm, setShowAddForm] = useState(false);
    const [statusNotice, setStatusNotice] = useState<string | null>(null);

    const loadMemories = useCallback(async () => {
        if (typeof window !== "undefined" && window.electron?.memory) {
            try {
                const items = await window.electron.memory.getAll();
                setMemories(items);
            } catch {
                setMemories([]);
            }
        }
    }, []);

    useEffect(() => {
        const handleOpen = () => {
            playClickSound();
            setIsOpen(true);
            loadMemories();
        };

        window.addEventListener("open-memory-vault", handleOpen);
        return () => window.removeEventListener("open-memory-vault", handleOpen);
    }, [loadMemories]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const handleToggleEnabled = async (item: MemoryItemView) => {
        playClickSound();
        if (window.electron?.memory) {
            await window.electron.memory.update(item.id, { enabled: !item.enabled });
            loadMemories();
        }
    };

    const handleDelete = async (id: string) => {
        playClickSound();
        if (window.electron?.memory) {
            await window.electron.memory.delete(id);
            setStatusNotice("Memory removed.");
            setTimeout(() => setStatusNotice(null), 2500);
            loadMemories();
        }
    };

    const startEditing = (item: MemoryItemView) => {
        playClickSound();
        setEditingId(item.id);
        setEditContent(item.content);
    };

    const saveEdit = async (id: string) => {
        playClickSound();
        if (window.electron?.memory && editContent.trim()) {
            const res = await window.electron.memory.update(id, { content: editContent.trim() });
            if (res.success) {
                setEditingId(null);
                loadMemories();
            } else {
                setStatusNotice(res.error || "Failed to update memory.");
                setTimeout(() => setStatusNotice(null), 3000);
            }
        }
    };

    const handleCreateMemory = async (e: React.FormEvent) => {
        e.preventDefault();
        playClickSound();
        if (!newContent.trim() || !window.electron?.memory) return;

        const res = await window.electron.memory.save({
            category: newCategory,
            content: newContent.trim(),
        });

        if (res.success) {
            setNewContent("");
            setShowAddForm(false);
            setStatusNotice("Memory saved.");
            setTimeout(() => setStatusNotice(null), 2500);
            loadMemories();
        } else {
            setStatusNotice(res.error || "Could not save memory.");
            setTimeout(() => setStatusNotice(null), 3500);
        }
    };

    if (!isOpen) return null;

    const filtered = memories.filter((m) =>
        filterCategory === "ALL" ? true : m.category === filterCategory
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#07090E] border border-cyan-500/30 rounded-sm shadow-[0_0_35px_rgba(6,182,212,0.15)] flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/40">
                    <div className="flex items-center space-x-3">
                        <BrainCircuit size={18} className="text-[#06B6D4]" />
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className="font-mono text-xs font-bold text-[#06B6D4] uppercase tracking-widest">
                                    ALFRED // MEMORY VAULT
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-sm bg-cyan-500/10 border border-cyan-500/20 text-[#06B6D4]">
                                    {memories.length} / 100 SLOTS
                                </span>
                            </div>
                            <p className="text-[10px] font-mono text-white/40 mt-0.5">
                                User-controlled persistent preferences and workflow facts
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            playClickSound();
                            setIsOpen(false);
                        }}
                        className="text-white/40 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Status Notice */}
                {statusNotice && (
                    <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 font-mono text-xs flex items-center space-x-2">
                        <ShieldAlert size={14} />
                        <span>{statusNotice}</span>
                    </div>
                )}

                {/* Filter Bar & Controls */}
                <div className="px-4 py-3 border-b border-white/[0.06] bg-black/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-1 overflow-x-auto text-[11px] font-mono">
                        {["ALL", "USER_PREFERENCE", "WORKSPACE_PREFERENCE", "PROJECT_PREFERENCE", "WORKFLOW_PREFERENCE"].map(
                            (cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        playHoverSound();
                                        setFilterCategory(cat);
                                    }}
                                    className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                                        filterCategory === cat
                                            ? "bg-[#06B6D4]/20 border border-[#06B6D4]/40 text-[#06B6D4] font-bold"
                                            : "text-white/40 hover:text-white/80"
                                    }`}
                                >
                                    {cat.replace("_PREFERENCE", "")}
                                </button>
                            )
                        )}
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-2.5 py-1 rounded-sm bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/70 hover:text-white text-xs font-mono flex items-center space-x-1.5 cursor-pointer"
                    >
                        <Plus size={13} />
                        <span>Add Preference</span>
                    </button>
                </div>

                {/* Add Preference Inline Form */}
                {showAddForm && (
                    <form
                        onSubmit={handleCreateMemory}
                        className="p-4 border-b border-white/[0.08] bg-black/60 space-y-3"
                    >
                        <div className="flex items-center space-x-3">
                            <select
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="bg-black/80 border border-white/20 rounded-sm text-xs font-mono text-white/80 px-2 py-1.5"
                            >
                                <option value="USER_PREFERENCE">USER_PREFERENCE</option>
                                <option value="WORKSPACE_PREFERENCE">WORKSPACE_PREFERENCE</option>
                                <option value="PROJECT_PREFERENCE">PROJECT_PREFERENCE</option>
                                <option value="WORKFLOW_PREFERENCE">WORKFLOW_PREFERENCE</option>
                                <option value="GENERAL_FACT">GENERAL_FACT</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Enter preference (e.g. Prefer DSA workspace for coding)..."
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                maxLength={120}
                                className="flex-1 bg-black/80 border border-white/20 rounded-sm text-xs font-mono text-white px-3 py-1.5 focus:border-[#06B6D4] outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-3 py-1 text-xs font-mono text-white/50 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-3 py-1 bg-[#06B6D4] text-black font-mono text-xs font-bold rounded-sm hover:bg-[#0891B2] transition-colors"
                            >
                                Save Memory
                            </button>
                        </div>
                    </form>
                )}

                {/* Memories List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center text-xs font-mono text-white/30">
                            No memories found in vault. Say &quot;Remember that...&quot; in terminal to store preferences.
                        </div>
                    ) : (
                        filtered.map((item) => (
                            <div
                                key={item.id}
                                className={`p-3 rounded-sm border transition-colors ${
                                    item.enabled
                                        ? "bg-white/[0.02] border-white/[0.08] hover:border-white/20"
                                        : "bg-white/[0.01] border-white/[0.04] opacity-50"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1.5">
                                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-cyan-500/10 text-[#06B6D4] border border-cyan-500/20 font-semibold">
                                                {item.category.replace("_PREFERENCE", "")}
                                            </span>
                                            <span className="text-[10px] font-mono text-white/30">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {editingId === item.id ? (
                                            <div className="flex items-center space-x-2 mt-2">
                                                <input
                                                    type="text"
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    maxLength={120}
                                                    className="flex-1 bg-black/80 border border-cyan-500/40 rounded-sm text-xs font-mono text-white px-2 py-1 outline-none"
                                                />
                                                <button
                                                    onClick={() => saveEdit(item.id)}
                                                    className="p-1 rounded-sm bg-cyan-500/20 text-[#06B6D4] hover:bg-cyan-500/30"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1 rounded-sm text-white/40 hover:text-white"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-mono text-white/90 leading-relaxed break-words">
                                                {item.content}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center space-x-1.5 shrink-0 pt-0.5">
                                        <button
                                            onClick={() => handleToggleEnabled(item)}
                                            className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono cursor-pointer transition-colors ${
                                                item.enabled
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    : "bg-white/[0.05] text-white/40 border border-white/10"
                                            }`}
                                        >
                                            {item.enabled ? "ACTIVE" : "DISABLED"}
                                        </button>
                                        <button
                                            onClick={() => startEditing(item)}
                                            className="p-1 rounded-sm text-white/40 hover:text-[#06B6D4] transition-colors cursor-pointer"
                                            title="Edit memory"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1 rounded-sm text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                                            title="Forget memory"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
