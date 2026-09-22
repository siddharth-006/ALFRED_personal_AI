"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ProjectCategory = "DSA" | "Data Science" | "College" | "Hackathon" | "Personal";
export type ProjectStatus = "Not Started" | "In Progress" | "Completed";

export interface Project {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  progress: number;
  createdDate: string;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const INITIAL_PROJECTS: Project[] = [
  {
    id: "1",
    name: "ALFRED OS",
    description: "Personal productivity dashboard with task and goal tracking",
    category: "Personal",
    status: "In Progress",
    progress: 40,
    createdDate: new Date().toISOString().split("T")[0],
  },
  {
    id: "2",
    name: "Power BI Dashboard",
    description: "Interactive analytics dashboard for data visualization",
    category: "Data Science",
    status: "In Progress",
    progress: 75,
    createdDate: new Date().toISOString().split("T")[0],
  },
  {
    id: "3",
    name: "Hackathon Project",
    description: "Full-stack web application for hackathon submission",
    category: "Hackathon",
    status: "Not Started",
    progress: 15,
    createdDate: new Date().toISOString().split("T")[0],
  },
];

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedProjects = localStorage.getItem("alfred_projects");
    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    } else {
      setProjects(INITIAL_PROJECTS);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("alfred_projects", JSON.stringify(projects));
      if (typeof window !== "undefined" && window.electron?.projects?.syncProjects) {
        window.electron.projects.syncProjects(projects);
      }
    }
  }, [projects, isLoaded]);

  // Real-time synchronization when projects are mutated in Electron (via AI Command Agent)
  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.projects?.onProjectsChanged) {
      const unsubscribe = window.electron.projects.onProjectsChanged((updatedProjects: Project[]) => {
        if (Array.isArray(updatedProjects)) {
          setProjects(updatedProjects);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const addProject = (projectData: Omit<Project, "id">) => {
    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
    };
    setProjects([newProject, ...projects]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(projects.map(project => {
      if (project.id === id) {
        const updatedProject = { ...project, ...updates };
        // Auto-complete at 100%
        if (updatedProject.progress >= 100) {
          updatedProject.progress = 100;
          updatedProject.status = "Completed";
        }
        return updatedProject;
      }
      return project;
    }));
  };

  const deleteProject = (id: string) => {
    setProjects(projects.filter(project => project.id !== id));
  };

  if (!isLoaded) return null;

  return (
    <ProjectContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
}