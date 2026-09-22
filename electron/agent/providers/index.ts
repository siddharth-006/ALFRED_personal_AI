import { providerRegistry } from "./provider-registry";
import { mockAIProvider } from "./impl/mock-ai-provider";
import { ollamaAIProvider } from "./impl/ollama-ai-provider";
import { geminiAIProvider } from "./impl/gemini-ai-provider";
import { claudeAIProvider } from "./impl/claude-ai-provider";
import { agentOrchestrator } from "../orchestrator/agent-orchestrator";
import { providerAgentPlanner } from "./provider-agent-planner";

export * from "./types";
export * from "./config/types";
export * from "./config/provider-config.service";
export * from "./provider-registry";
export * from "./impl/mock-ai-provider";
export * from "./impl/ollama-ai-provider";
export * from "./impl/gemini-ai-provider";
export * from "./impl/claude-ai-provider";
export * from "./provider-agent-planner";

/**
 * Auto-register standard built-in providers into ProviderRegistry.
 */
export function registerDefaultProviders(): void {
    if (!providerRegistry.hasProvider(mockAIProvider.id)) {
        providerRegistry.registerProvider(mockAIProvider);
    }
    if (!providerRegistry.hasProvider(ollamaAIProvider.id)) {
        providerRegistry.registerProvider(ollamaAIProvider);
    }
    if (!providerRegistry.hasProvider(geminiAIProvider.id)) {
        providerRegistry.registerProvider(geminiAIProvider);
    }
    if (!providerRegistry.hasProvider(claudeAIProvider.id)) {
        providerRegistry.registerProvider(claudeAIProvider);
    }
    agentOrchestrator.setPlanner(providerAgentPlanner);
}

// Auto-register providers on module import
registerDefaultProviders();


