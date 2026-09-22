"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDefaultProviders = registerDefaultProviders;
const provider_registry_1 = require("./provider-registry");
const mock_ai_provider_1 = require("./impl/mock-ai-provider");
const ollama_ai_provider_1 = require("./impl/ollama-ai-provider");
const gemini_ai_provider_1 = require("./impl/gemini-ai-provider");
const claude_ai_provider_1 = require("./impl/claude-ai-provider");
const agent_orchestrator_1 = require("../orchestrator/agent-orchestrator");
const provider_agent_planner_1 = require("./provider-agent-planner");
__exportStar(require("./types"), exports);
__exportStar(require("./config/types"), exports);
__exportStar(require("./config/provider-config.service"), exports);
__exportStar(require("./provider-registry"), exports);
__exportStar(require("./impl/mock-ai-provider"), exports);
__exportStar(require("./impl/ollama-ai-provider"), exports);
__exportStar(require("./impl/gemini-ai-provider"), exports);
__exportStar(require("./impl/claude-ai-provider"), exports);
__exportStar(require("./provider-agent-planner"), exports);
/**
 * Auto-register standard built-in providers into ProviderRegistry.
 */
function registerDefaultProviders() {
    if (!provider_registry_1.providerRegistry.hasProvider(mock_ai_provider_1.mockAIProvider.id)) {
        provider_registry_1.providerRegistry.registerProvider(mock_ai_provider_1.mockAIProvider);
    }
    if (!provider_registry_1.providerRegistry.hasProvider(ollama_ai_provider_1.ollamaAIProvider.id)) {
        provider_registry_1.providerRegistry.registerProvider(ollama_ai_provider_1.ollamaAIProvider);
    }
    if (!provider_registry_1.providerRegistry.hasProvider(gemini_ai_provider_1.geminiAIProvider.id)) {
        provider_registry_1.providerRegistry.registerProvider(gemini_ai_provider_1.geminiAIProvider);
    }
    if (!provider_registry_1.providerRegistry.hasProvider(claude_ai_provider_1.claudeAIProvider.id)) {
        provider_registry_1.providerRegistry.registerProvider(claude_ai_provider_1.claudeAIProvider);
    }
    agent_orchestrator_1.agentOrchestrator.setPlanner(provider_agent_planner_1.providerAgentPlanner);
}
// Auto-register providers on module import
registerDefaultProviders();
