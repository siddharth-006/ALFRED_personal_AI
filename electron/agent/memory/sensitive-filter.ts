/**
 * ALFRED Phase 5.7: Sensitive Data Detection & Privacy Filter
 *
 * Prevents saving sensitive credentials, API keys, passwords, tokens,
 * and private keys into ALFRED long-term memory.
 */

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
    // API keys & service tokens
    { regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|xox[baprs]-[0-9a-zA-Z]{10,})\b/i, reason: "API key" },
    { regex: /\b(?:api[_-]?key|access[_-]?token|bearer\s+[a-zA-Z0-9_\-\.]{20,})\b/i, reason: "API key or token" },
    // Passwords & credentials
    { regex: /\b(?:password\s*[:=]|passwd\s*[:=]|pwd\s*[:=]|my\s+password\s+is\s+)/i, reason: "password" },
    // Private keys & certificates
    { regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i, reason: "private key" },
    // Environment variables / secrets
    { regex: /\b(?:process\.env\.[A-Z0-9_]+|export\s+[A-Z0-9_]+_SECRET\s*=)/i, reason: "environment secret" },
    // Financial numbers (Credit cards: 13-19 digits with separators, CVV)
    { regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/, reason: "credit card number" },
    { regex: /\b(?:cvv|cvc)\s*[:=]\s*\d{3,4}\b/i, reason: "card security code" },
];

export interface SensitiveCheckResult {
    isSensitive: boolean;
    reason?: string;
    safeExplanation?: string;
}

export function detectSensitiveData(text: string): SensitiveCheckResult {
    if (!text || typeof text !== "string") {
        return { isSensitive: false };
    }

    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.regex.test(text)) {
            return {
                isSensitive: true,
                reason: pattern.reason,
                safeExplanation: "I can't save passwords, API keys, or credentials as ALFRED memory.",
            };
        }
    }

    return { isSensitive: false };
}
