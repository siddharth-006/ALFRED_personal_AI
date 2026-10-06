# ALFRED — Executive Demonstration & Showcase Walkthrough

This document outlines the canonical end-to-end showcase workflow for video recordings, live technical demonstrations, and portfolio walkthroughs. Every step utilizes real, existing production capabilities without mock hacks or fake UI states.

---

## Technical Prerequisites

1. **System Environment**: Windows 10/11 x64 (PowerShell & audio devices available).
2. **Installation/Run**:
   - Packaged installer build: Run `release/ALFRED-Setup-0.1.0.exe` (or `release/win-unpacked/ALFRED.exe`).
   - Development run: `npm run dev` and `npm run electron`.
3. **Audio (Optional for voice demo)**:
   - Microphone enabled for local Whisper STT & OpenWakeWord.
   - Speakers/headphones enabled for Windows SAPI Neural TTS.

---

## Step-by-Step Showcase Flow

### Step 1: System Boot & First-Launch Onboarding
- **Action**: Launch ALFRED.
- **Observed Behavior**:
  - The cinematic dark graphite interface initializes with telemetry grid styling.
  - On the first run, the **System Setup Wizard** automatically opens.
  - Step through:
    1. *System Initialization* — Read local-first covenant.
    2. *AI Provider Architecture* — Select Mock Engine (instant local) or Ollama/Gemini/Claude.
    3. *Acoustic Interface* — Toggle Whisper, Wake Word ("Hey Alfred"), and Neural TTS.
    4. *Global Desktop Summon* — Review `Ctrl+Shift+Space` global hotkey.
    5. *Security Covenant* — Confirm strict ToolRegistry permission boundaries.
    6. *Operational Readiness* — Click **"INITIALIZE ALFRED CORE"**.
  - Settings are committed to `.alfred/settings.json`, and onboarding will not reappear on subsequent launches.

### Step 2: Global Background Presence & Hotkey Summon
- **Action**: Minimize or close the window (clicks `X`).
- **Observed Behavior**:
  - Window cleanly minimizes to the Windows System Tray (cyan ALFRED emblem).
  - Background scheduler and event bus remain active.
- **Action**: Press `Ctrl+Shift+Space` from anywhere on Windows.
- **Observed Behavior**:
  - ALFRED window immediately restores to the foreground.
  - The Command Center automatically opens with keyboard focus on the input bar.

### Step 3: Grounded Tactical Recommendation
- **Action**: In the Command Terminal, ask:
  ```text
  what needs my attention right now?
  ```
- **Observed Behavior**:
  - ALFRED parses the query through the active AI provider and AgentContext snapshot.
  - Returns grounded tactical recommendations based on pending tasks, active goals, and streak data.
  - Neural TTS speaks the response aloud in a concise, executive tone.

### Step 4: Multi-Step Objective (Coding Mode / Workspace Launch)
- **Action**: In the Command Terminal, type or speak:
  ```text
  start coding mode for DSA
  ```
  *(Alternative voice input: Click the mic icon or say "Hey Alfred, start coding mode")*
- **Observed Behavior**:
  - ALFRED analyzes the risk policy: workspace and focus state modifications require operator authorization.
  - An **Agentic Plan Preview** is rendered:
    1. Step 1: Launch DSA workspace tools.
    2. Step 2: Initialize VS Code IDE.
    3. Step 3: Engage 25-minute deep work Focus session.
  - A single-use confirmation token is generated in `ConfirmationStore`.

### Step 5: Operator Confirmation & Execution Chain
- **Action**: Click **"Authorize Execution"** (or type `yes` / `confirm`).
- **Observed Behavior**:
  - Confirmation token is validated and consumed.
  - Execution delegates to `ToolRegistry` approved tools (`launch_workspace`, `app_launcher`, `focus_session`).
  - Terminal logs execution progression with green telemetry indicators.
  - Audio confirmation chime plays (`playSuccessSound`).

### Step 6: Active Work & Focus Session
- **Action**: Navigate to Dashboard or Focus view.
- **Observed Behavior**:
  - Live Focus timer ticks down with real-time streak tracking.
  - Productivity metrics update truthfully (completed task counts, focus minutes).
  - ALFRED Core orb pulses in amber/cyan focus state.

### Step 7: Local Knowledge Vault (RAG)
- **Action**: Open the Knowledge Vault (`Ctrl+K` or sidebar book icon).
- **Observed Behavior**:
  - Ingest local markdown or code documentation.
  - Search indexed documents locally. Sub-millisecond BM25 keyword matching returns exact text snippets without external server calls.

### Step 8: End-of-Day Review
- **Action**: In the Command Terminal, type:
  ```text
  run end of day review
  ```
- **Observed Behavior**:
  - ALFRED compiles completed tasks, focus duration, and velocity for the day.
  - Displays structured recap without fabricated statistics.
  - Summarizes tactical readiness for tomorrow.

---

## Architectural Integrity Demonstrated

- **Zero-Bypass Security**: No direct shell injection; every tool passes through `ToolRegistry`.
- **Local Sovereignty**: Sensitive data stays in `.alfred/` in the user's home folder.
- **Resilient Fallbacks**: If external AI or microphones are unavailable, deterministic mock engines and manual controls take over smoothly.
