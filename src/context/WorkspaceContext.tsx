"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type WorkspaceType = "dsa" | "datascience" | "hackathon" | "machinelearning" | "college" | "personal" | "custom";

export interface Workspace {
  id: string;
  name: string;
  description: string;
  type: WorkspaceType;
  applications: string[];
  websites: string[];
  localFolders: string[];
  createdDate: string;
  launchCount: number;
  lastLaunched: string | null;
}

export type FocusType = string | null;

interface WorkspaceContextType {
  workspaces: Workspace[];
  addWorkspace: (workspace: Omit<Workspace, "id" | "launchCount" | "lastLaunched" | "createdDate">) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  launchWorkspace: (id: string) => void;
  currentFocus: FocusType;
  setFocus: (focus: FocusType) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "ws_dsa",
    name: "DSA",
    description: "Daily DSA and problem-solving setup.",
    type: "dsa",
    applications: ["VS Code"],
    websites: [
      "https://leetcode.com",
      "https://www.geeksforgeeks.org",
      "https://chatgpt.com",
      "https://grindgram.in/career-tracks/curious-coding-sheet",
      "https://codolio.com/question-tracker/sheet/strivers-a2z-dsa-sheet?category=popular"
    ],
    localFolders: [],
    createdDate: new Date().toISOString().split("T")[0],
    launchCount: 0,
    lastLaunched: null,
  },
  {
    id: "ws_datascience",
    name: "Data Science",
    description: "Analytics and dashboard building environment.",
    type: "datascience",
    applications: ["VS Code", "Power BI"],
    websites: ["https://www.kaggle.com", "https://chatgpt.com"],
    localFolders: [],
    createdDate: new Date().toISOString().split("T")[0],
    launchCount: 0,
    lastLaunched: null,
  },
  {
    id: "ws_hackathon",
    name: "Hackathon",
    description: "Hackathon development environment.",
    type: "hackathon",
    applications: ["VS Code"],
    websites: ["https://github.com", "https://chatgpt.com", "https://www.figma.com"],
    localFolders: [],
    createdDate: new Date().toISOString().split("T")[0],
    launchCount: 0,
    lastLaunched: null,
  },
  {
    id: "ws_ml",
    name: "Machine Learning",
    description: "Machine Learning Specialization and course study environment.",
    type: "machinelearning",
    applications: ["VS Code"],
    websites: ["https://www.coursera.org"],
    localFolders: ["D:\\Studies\\Machine Learning\\Coursera - Machine Learning Specialization"],
    createdDate: new Date().toISOString().split("T")[0],
    launchCount: 0,
    lastLaunched: null,
  }
];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentFocus, setCurrentFocus] = useState<FocusType>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function initWorkspaces() {
      // 1. Try loading from electron backend first
      if (typeof window !== "undefined" && window.electron?.workspace?.getAll) {
        try {
          const backendWs = await window.electron.workspace.getAll();
          if (Array.isArray(backendWs) && backendWs.length > 0) {
            setWorkspaces(backendWs);
            localStorage.setItem("alfred_workspaces", JSON.stringify(backendWs));
            initFocus();
            setIsLoaded(true);
            return;
          }
        } catch (e) {
          console.warn("[WorkspaceContext] Error fetching from backend:", e);
        }
      }

      // 2. Fallback to localStorage or defaults
      const savedWorkspaces = localStorage.getItem("alfred_workspaces");
      if (savedWorkspaces) {
        try {
          const parsed = JSON.parse(savedWorkspaces);
          setWorkspaces(parsed);
          if (typeof window !== "undefined" && window.electron?.workspace?.sync) {
            window.electron.workspace.sync(parsed).catch(() => {});
          }
        } catch {
          setWorkspaces(INITIAL_WORKSPACES);
        }
      } else {
        setWorkspaces(INITIAL_WORKSPACES);
        if (typeof window !== "undefined" && window.electron?.workspace?.sync) {
          window.electron.workspace.sync(INITIAL_WORKSPACES).catch(() => {});
        }
      }

      initFocus();
      setIsLoaded(true);
    }

    function initFocus() {
      const savedFocus = localStorage.getItem("alfred_focus");
      if (savedFocus) {
        setCurrentFocus(savedFocus as FocusType);
      }
    }

    initWorkspaces();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("alfred_workspaces", JSON.stringify(workspaces));
      if (typeof window !== "undefined" && window.electron?.workspace?.sync) {
        window.electron.workspace.sync(workspaces).catch(() => {});
      }
    }
  }, [workspaces, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      if (currentFocus) {
        localStorage.setItem("alfred_focus", currentFocus);
      } else {
        localStorage.removeItem("alfred_focus");
      }
    }
  }, [currentFocus, isLoaded]);

  const addWorkspace = (workspaceData: Omit<Workspace, "id" | "launchCount" | "lastLaunched" | "createdDate">) => {
    const newWorkspace: Workspace = {
      ...workspaceData,
      id: Date.now().toString(),
      createdDate: new Date().toISOString().split("T")[0],
      launchCount: 0,
      lastLaunched: null,
    };
    setWorkspaces([...workspaces, newWorkspace]);
  };

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setWorkspaces(workspaces.map(ws => 
      ws.id === id ? { ...ws, ...updates } : ws
    ));
  };

  const deleteWorkspace = (id: string) => {
    setWorkspaces(workspaces.filter(ws => ws.id !== id));
  };

  const launchWorkspace = (id: string) => {
    setWorkspaces(workspaces.map(ws => {
      if (ws.id === id) {
        if (typeof window !== "undefined") {
          import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
            dispatchAlfredActivity({
              type: "workspace_launched",
              state: "executing",
              label: "WORKSPACE LAUNCHED",
              detail: `${ws.name} environment activated`,
            });
          });
        }
        return {
          ...ws,
          launchCount: ws.launchCount + 1,
          lastLaunched: new Date().toISOString(),
        };
      }
      return ws;
    }));
  };

  const setFocus = (focus: FocusType) => {
    setCurrentFocus(focus);
  };

  if (!isLoaded) return null;

  return (
    <WorkspaceContext.Provider value={{ 
      workspaces, 
      addWorkspace, 
      updateWorkspace, 
      deleteWorkspace, 
      launchWorkspace,
      currentFocus,
      setFocus
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaces() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspaces must be used within a WorkspaceProvider");
  }
  return context;
}
