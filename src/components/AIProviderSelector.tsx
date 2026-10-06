"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { playClickSound, playHoverSound } from "@/utils/audioSystem";

export interface ProviderItem {
    id: string;
    name: string;
    status: "ready" | "configured" | "unconfigured" | "disabled" | "offline";
    configured: boolean;
    enabled: boolean;
}

export default function AIProviderSelector() {
    const [activeProvider, setActiveProvider] = useState<string>("mock");
    const [effectiveProvider, setEffectiveProvider] = useState<string>("mock");
    const [providers, setProviders] = useState<ProviderItem[]>([
        { id: "mock",   name: "Mock AI",          status: "ready",       configured: true,  enabled: true  },
        { id: "ollama", name: "Ollama (Local AI)", status: "ready",       configured: true,  enabled: true  },
        { id: "gemini", name: "Google Gemini",     status: "unconfigured", configured: false, enabled: false },
        { id: "claude", name: "Anthropic Claude",  status: "unconfigured", configured: false, enabled: false },
    ]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const openDropdown = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 6,
                right: window.innerWidth - rect.right,
            });
            setIsOpen(true);
        }
    }, []);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
    }, []);

    const loadProviderData = useCallback(async () => {
        if (typeof window !== "undefined" && window.electron?.aiProvider) {
            try {
                const active = await window.electron.aiProvider.getActive();
                setActiveProvider(active);
                setEffectiveProvider(active);

                const statuses = await window.electron.aiProvider.getStatuses();
                const providerItems: ProviderItem[] = [];

                for (const s of statuses) {
                    let itemStatus: "ready" | "configured" | "unconfigured" | "disabled" | "offline" = 
                        (s.status === "ready" || s.status === "configured" || s.status === "unconfigured" || s.status === "disabled")
                            ? s.status
                            : "unconfigured";

                    if (s.providerId === "ollama") {
                        try {
                            const avail = await window.electron.aiProvider.checkAvailability("ollama");
                            itemStatus = avail.available ? "ready" : "offline";
                        } catch {
                            itemStatus = "offline";
                        }
                    }
                    providerItems.push({
                        id: s.providerId,
                        name: s.name,
                        status: itemStatus,
                        configured: s.configured,
                        enabled: s.enabled,
                    });
                }

                setProviders(providerItems);
            } catch (err) {
                console.error("AIProviderSelector: Failed loading provider statuses:", err);
            }
        }
    }, []);

    useEffect(() => {
        loadProviderData();

        // Allow sidebar settings or other components to trigger the selector
        const handleOpenExternal = () => {
            openDropdown();
        };
        window.addEventListener("open-provider-selector", handleOpenExternal);
        return () => window.removeEventListener("open-provider-selector", handleOpenExternal);
    }, [loadProviderData, openDropdown]);

    // Close when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideTrigger = triggerRef.current?.contains(target);
            const insideDropdown = dropdownRef.current?.contains(target);
            if (!insideTrigger && !insideDropdown) {
                closeDropdown();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, closeDropdown]);

    const handleSelectProvider = async (providerId: string) => {
        playClickSound();
        closeDropdown();

        if (typeof window !== "undefined" && window.electron?.aiProvider) {
            try {
                const res = await window.electron.aiProvider.setActive(providerId);
                setActiveProvider(providerId);
                setEffectiveProvider(res.effectiveId);

                // Persist selection to settings so it survives app restarts
                if (window.electron.settings?.update) {
                    try {
                        await window.electron.settings.update({
                            aiProvider: {
                                activeProvider: providerId as any,
                                temperature: 0.7,
                                hasConfiguredApiKey: providerId !== "mock" && providerId !== "ollama" ? false : true,
                            }
                        });
                    } catch {}
                }

                if (res.error || res.effectiveId !== providerId) {
                    setNotice(
                        res.error ||
                        `'${getLabel(providerId)}' unconfigured. Falling back to ${getLabel(res.effectiveId)}.`
                    );
                    setTimeout(() => setNotice(null), 3500);
                } else {
                    setNotice(null);
                }
                await loadProviderData();
            } catch (err) {
                console.error("IPC error switching provider:", err);
            }
        } else {
            // No Electron IPC (browser preview fallback)
            if (providerId !== "mock") {
                setNotice(`'${getLabel(providerId)}' unconfigured. Falling back to MOCK.`);
                setEffectiveProvider("mock");
                setTimeout(() => setNotice(null), 3500);
            } else {
                setEffectiveProvider("mock");
            }
        }
    };

    const getLabel = (id: string) =>
        providers.find((p) => p.id === id)?.name ?? id.toUpperCase();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ready":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded font-semibold tracking-wider">
                        READY
                    </span>
                );
            case "offline":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded font-semibold tracking-wider">
                        OFFLINE
                    </span>
                );
            case "configured":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded font-semibold tracking-wider">
                        CONFIGURED
                    </span>
                );
            case "unconfigured":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-500/15 text-slate-400 border border-slate-500/30 rounded font-semibold tracking-wider">
                        UNCONFIGURED
                    </span>
                );
            case "disabled":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded font-semibold tracking-wider">
                        DISABLED
                    </span>
                );
            default:
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-500/15 text-slate-400 border border-slate-500/30 rounded font-semibold tracking-wider">
                        N/A
                    </span>
                );
        }
    };

    const dropdownMenu = isOpen && dropdownPos && typeof document !== "undefined"
        ? createPortal(
            <div
                ref={dropdownRef}
                style={{
                    position: "fixed",
                    top: dropdownPos.top,
                    right: dropdownPos.right,
                    width: 280,
                    zIndex: 99999,
                }}
                className="bg-[#0D101A] border border-white/[0.12] shadow-2xl shadow-black/80 rounded-lg overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
                    <span className="font-mono text-[10px] text-slate-400 tracking-wider font-semibold">
                        ACTIVE AI PROVIDER
                    </span>
                    <ShieldCheck size={13} className="text-slate-400" />
                </div>

                {/* Provider rows */}
                <div className="py-1">
                    {providers.map((p) => {
                        const isSelected = activeProvider === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => handleSelectProvider(p.id)}
                                onMouseEnter={() => playHoverSound()}
                                className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition-all duration-150 cursor-pointer
                                    ${isSelected
                                        ? "bg-white/[0.08] border-l-2 border-[#E11D48]"
                                        : "border-l-2 border-transparent hover:bg-white/[0.04] text-slate-400"
                                    }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {isSelected ? (
                                        <Check size={13} className="text-[#E11D48] shrink-0" />
                                    ) : (
                                        <div className="w-[13px] shrink-0" />
                                    )}
                                    <span className={`text-xs tracking-wide truncate ${isSelected ? "text-white font-medium" : "text-slate-300"}`}>
                                        {p.name}
                                    </span>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {getStatusBadge(p.status)}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer hint */}
                <div className="px-3.5 py-2 border-t border-white/[0.08] bg-black/30">
                    <span className="text-[9px] font-mono text-slate-400 tracking-wider">
                        PLANNER GATEWAY // TOOL REGISTRY EXECUTES
                    </span>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <div className="relative inline-flex items-center">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => {
                        playClickSound();
                        if (isOpen) {
                            closeDropdown();
                        } else {
                            openDropdown();
                        }
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] hover:border-white/[0.20] transition-all duration-150 cursor-pointer text-slate-200"
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] shrink-0" />
                    <span className="font-mono text-xs font-semibold tracking-wide text-slate-200 whitespace-nowrap">
                        {effectiveProvider.toUpperCase()}
                    </span>
                    {effectiveProvider !== activeProvider && (
                        <span className="text-[9px] font-mono text-amber-400 font-bold whitespace-nowrap">(FALLBACK)</span>
                    )}
                    <ChevronDown
                        size={12}
                        className={`text-slate-400 transition-transform duration-150 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </div>

            {dropdownMenu}

            {/* Toast notification */}
            {notice && typeof document !== "undefined" && createPortal(
                <div className="fixed top-14 right-5 z-[99999] bg-[#0D101A] border border-amber-500/50 rounded-md px-3.5 py-2 shadow-xl shadow-black/60 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span className="font-mono text-xs text-amber-300 tracking-wide">{notice}</span>
                </div>,
                document.body
            )}
        </>
    );
}
