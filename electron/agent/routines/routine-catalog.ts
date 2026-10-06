/**
 * ALFRED Phase 5.8A — Daily Routine Catalog
 *
 * Deterministic built-in catalog of standard routines.
 * Compatible with existing ToolRegistry tools and Agentic Planning dependency model.
 */

import { Routine } from "./routine.types";

export const BUILTIN_ROUTINES: Routine[] = [
    {
        id: "routine_coding_mode",
        name: "Coding Mode",
        description: "Prepares your DSA coding environment, opens VS Code, and initiates a focus session.",
        aliases: [
            "coding mode",
            "start coding mode",
            "start coding",
            "start my coding session",
            "start coding session",
            "begin a coding session",
            "begin coding session",
            "start a coding session",
            "coding session",
            "prepare my coding workspace",
            "prepare coding workspace",
            "start dsa mode",
            "dsa mode",
            "start dsa",
            "coding routine",
            "run coding mode",
            "prepare my coding environment",
            "set up coding mode",
            "activate coding mode",
        ],
        steps: [
            {
                id: "coding-step-1",
                toolName: "launch_workspace",
                args: { workspace: "DSA", workspaceName: "DSA" },
            },
            {
                id: "coding-step-2",
                toolName: "launch_application",
                args: { appName: "VS Code" },
                dependsOn: [0],
            },
            {
                id: "coding-step-3",
                toolName: "start_deep_work",
                args: {},
                dependsOn: [1],
            },
        ],
        enabled: true,
    },
    {
        id: "routine_datascience_mode",
        name: "Data Science Mode",
        description: "Prepares your Data Science workspace, opens VS Code, and initiates a focus session.",
        aliases: [
            "data science mode",
            "start data science mode",
            "start data science",
            "prepare my data science workspace",
            "prepare data science workspace",
            "start ds mode",
            "ds mode",
            "analytics mode",
            "start analytics mode",
            "data science routine",
            "prepare my data science environment",
            "set up data science mode",
            "activate data science mode",
        ],
        steps: [
            {
                id: "ds-step-1",
                toolName: "launch_workspace",
                args: { workspace: "Data Science", workspaceName: "Data Science" },
            },
            {
                id: "ds-step-2",
                toolName: "launch_application",
                args: { appName: "VS Code" },
                dependsOn: [0],
            },
            {
                id: "ds-step-3",
                toolName: "start_deep_work",
                args: { sessionName: "Data Science" },
                dependsOn: [1],
            },
        ],
        enabled: true,
    },
    {
        id: "routine_ml_mode",
        name: "Machine Learning Mode",
        description: "Prepares your Machine Learning workspace, opens VS Code, and initiates a focus session.",
        aliases: [
            "machine learning mode",
            "start machine learning mode",
            "start machine learning",
            "prepare my machine learning workspace",
            "prepare my ml workspace",
            "prepare ml workspace",
            "start ml mode",
            "ml mode",
            "start ml",
            "machine learning routine",
            "ml routine",
            "prepare my machine learning environment",
            "set up machine learning mode",
            "activate machine learning mode",
        ],
        steps: [
            {
                id: "ml-step-1",
                toolName: "launch_workspace",
                args: { workspace: "Machine Learning", workspaceName: "Machine Learning" },
            },
            {
                id: "ml-step-2",
                toolName: "launch_application",
                args: { appName: "VS Code" },
                dependsOn: [0],
            },
            {
                id: "ml-step-3",
                toolName: "start_deep_work",
                args: { sessionName: "Machine Learning" },
                dependsOn: [1],
            },
        ],
        enabled: true,
    },
    {
        id: "routine_hackathon_mode",
        name: "Hackathon Mode",
        description: "Prepares your Hackathon sprint workspace, opens VS Code, and initiates a focus session.",
        aliases: [
            "hackathon mode",
            "start hackathon mode",
            "start hackathon",
            "prepare my hackathon workspace",
            "prepare hackathon workspace",
            "start hack mode",
            "hack mode",
            "hackathon sprint",
            "hackathon routine",
            "prepare my hackathon environment",
            "set up hackathon mode",
            "activate hackathon mode",
        ],
        steps: [
            {
                id: "hackathon-step-1",
                toolName: "launch_workspace",
                args: { workspace: "Hackathon", workspaceName: "Hackathon" },
            },
            {
                id: "hackathon-step-2",
                toolName: "launch_application",
                args: { appName: "VS Code" },
                dependsOn: [0],
            },
            {
                id: "hackathon-step-3",
                toolName: "start_deep_work",
                args: { sessionName: "Hackathon" },
                dependsOn: [1],
            },
        ],
        enabled: true,
    },
];
