"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Cpu, ChevronDown, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { playClickSound, playHoverSound } from "@/utils/audioSystem";

export interface ProviderItem {
    id: string;
    name: string;
    status: "ready" | "configured" | "unconfigured" | "disabled";
    configured: boolean;
    enabled: boolean;
}

export default function AIProviderSelector() {
    const [activeProvider, setActiveProvider] = useState<string>("mock");
    const [effectiveProvider, setEffectiveProvider] = useState<string>("mock");
    const [providers, setProviders] = useState<ProviderItem[]>([
        { id: "mock",   name: "Mock AI",          status: "ready",       configured: true,  enabled: true  },
        { id: "ollama", name: "Ollama (Local AI)", status: "disabled",    configured: true,  enabled: false },
        { id: "gemini", name: "Google Gemini",     status: "disabled",    configured: false, enabled: false },
        { id: "claude", name: "Anthropic Claude",  status: "disabled",    configured: false, enabled: false },
    ]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadProviderData = async () => {
        if (typeof window !== "undefined" && window.electron?.aiProvider) {
            try {
                const active = await window.electron.aiProvider.getActive();
                setActiveProvider(active);
                setEffectiveProvider(active);

                const statuses = await window.electron.aiProvider.getStatuses();
                const providerItems: ProviderItem[] = [];

                for (const s of statuses) {
                    let itemStatus = s.status;
                    if (s.providerId === "ollama" && s.enabled) {
                        try {
                            const avail = await window.electron.aiProvider.checkAvailability("ollama");
                            itemStatus = avail.available ? "ready" : "disabled";
                        } catch {
                            itemStatus = "disabled";
                        }
                    }
                    providerItems.push({
                        id: s.providerId,
                        name: s.name,
                        status: itemStatus as any,
                        configured: s.configured,
                        enabled: s.enabled,
                    });
                }

                setProviders(providerItems);
            } catch (err) {
                console.error("AIProviderSelector: Failed loading provider statuses:", err);
            }
        }
    };

    useEffect(() => {
        loadProviderData();
    }, []);

    const openDropdown = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 6,
                right: window.innerWidth - rect.right,
            });
        }
        setIsOpen(true);
    }, []);

    const closeDropdown = useCallback(() => {
        setIsOpen(false);
        setDropdownPos(null);
    }, []);

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
        setActiveProvider(providerId);
        closeDropdown();

        if (typeof window !== "undefined" && window.electron?.aiProvider) {
            try {
                const res = await window.electron.aiProvider.setActive(providerId);
                setEffectiveProvider(res.effectiveId);

                if (providerId === "ollama") {
                    const avail = await window.electron.aiProvider.checkAvailability("ollama");
                    if (avail.available) {
                        setNotice("AI Provider: Ollama (Local AI) ACTIVE & CONNECTED");
                    } else {
                        setNotice("Ollama server unreachable (http://localhost:11434) — Using Mock AI fallback");
                    }
                    setTimeout(() => setNotice(null), 4000);
                } else if (res.effectiveId !== providerId) {
                    setNotice(`'${getLabel(providerId)}' is unconfigured. Falling back to MOCK.`);
                    setTimeout(() => setNotice(null), 4000);
                } else {
                    setNotice(`AI Provider: ${getLabel(providerId)} ACTIVE`);
                    setTimeout(() => setNotice(null), 2500);
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
                    <span className="text-[9px] px-1.5 py-0.5 bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40 font-bold tracking-wider">
                        READY
                    </span>
                );
            case "disabled":
                return (
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/40 font-bold tracking-wider">
                        DISABLED
                    </span>
                );
            default:
                return (
                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-500/15 text-gray-400 border border-gray-500/40 font-bold tracking-wider">
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
                className="bg-[#030c14] border border-[#00BFFF]/60 shadow-[0_0_40px_rgba(0,191,255,0.15)] rounded-sm"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#00BFFF]/25 bg-[#00BFFF]/5">
                    <span className="font-header text-[10px] text-[#00E5FF] tracking-[0.2em] font-bold">
                        SELECT AI PROVIDER
                    </span>
                    <ShieldCheck size={12} className="text-[#00E5FF] opacity-70" />
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
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-all duration-150
                                    ${isSelected
                                        ? "bg-[#00BFFF]/20 border-l-2 border-[#00E5FF]"
                                        : "border-l-2 border-transparent hover:bg-[#00BFFF]/10 hover:border-[#00BFFF]/50"
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {isSelected
                                        ? <Check size={13} className="text-[#00E5FF] shrink-0" />
                                        : <div className="w-[13px] shrink-0" />
                                    }
                                    <span className={`font-header text-[12px] font-bold tracking-wider
                                        ${isSelected ? "text-[#DFF6FF]" : "text-[#A8C7FA]"}`}>
                                        {p.name}
                                    </span>
                                </div>
                                <div className="shrink-0">
                                    {getStatusBadge(p.status)}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer hint */}
                <div className="px-3 py-2 border-t border-[#00BFFF]/15 bg-[#00BFFF]/5">
                    <span className="text-[9px] font-data text-[#4a7a99] tracking-wider">
                        SECURITY: AI PROVIDERS PLAN ONLY · TOOL REGISTRY EXECUTES
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
                        isOpen ? closeDropdown() : openDropdown();
                    }}
                    onMouseEnter={() => playHoverSound()}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00BFFF]/10 border border-[#00BFFF]/30 hover:border-[#00BFFF]/70 hover:bg-[#00BFFF]/15 transition-all duration-200 cursor-pointer"
                >
                    <Cpu size={13} className="text-[#00E5FF] animate-pulse shrink-0" />
                    <span className="font-header text-[11px] font-bold tracking-wider text-[#00E5FF] whitespace-nowrap">
                        AI: {effectiveProvider.toUpperCase()}
                    </span>
                    {effectiveProvider !== activeProvider && (
                        <span className="text-[9px] text-amber-400 font-bold whitespace-nowrap">(FALLBACK)</span>
                    )}
                    <ChevronDown
                        size={11}
                        className={`text-[#00BFFF] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </div>

            {dropdownMenu}

            {/* Toast notification — always in portal */}
            {notice && typeof document !== "undefined" && createPortal(
                <div className="fixed top-[60px] right-5 z-[99999] bg-[#030c14] border border-amber-500/60 px-4 py-2.5 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span className="font-data text-[11px] text-amber-300 tracking-wide">{notice}</span>
                </div>,
                document.body
            )}
        </>
    );
}
