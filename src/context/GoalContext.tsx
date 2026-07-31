"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type GoalType = "Weekly" | "Monthly";

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  target: number;
  current: number;
  completed: boolean;
}

interface GoalContextType {
  goals: Goal[];
  addGoal: (title: string, type: GoalType, target: number) => void;
  updateProgress: (id: string, delta: number) => void;
  deleteGoal: (id: string) => void;
  editGoal: (id: string, title: string, target: number) => void;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

const INITIAL_GOALS: Goal[] = [
  { id: "1", title: "Solve LeetCode Problems", type: "Weekly", target: 20, current: 8, completed: false },
  { id: "2", title: "Study System Design", type: "Monthly", target: 30, current: 12, completed: false },
];

export function GoalProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedGoals = localStorage.getItem("alfred_goals");
    if (savedGoals) {
      setGoals(JSON.parse(savedGoals));
    } else {
      setGoals(INITIAL_GOALS);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("alfred_goals", JSON.stringify(goals));
    }
  }, [goals, isLoaded]);

  const addGoal = (title: string, type: GoalType, target: number) => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title,
      type,
      target,
      current: 0,
      completed: false,
    };
    setGoals([newGoal, ...goals]);
  };

  const updateProgress = (id: string, delta: number) => {
    setGoals(goals.map(goal => {
      if (goal.id === id) {
        const newCurrent = Math.min(goal.target, Math.max(0, goal.current + delta));
        const isCompleted = newCurrent >= goal.target;
        return { ...goal, current: newCurrent, completed: isCompleted };
      }
      return goal;
    }));
  };

  const editGoal = (id: string, title: string, target: number) => {
    setGoals(goals.map(goal => {
      if (goal.id === id) {
        const newCurrent = Math.min(target, goal.current);
        const isCompleted = newCurrent >= target;
        return { ...goal, title, target, current: newCurrent, completed: isCompleted };
      }
      return goal;
    }));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(goal => goal.id !== id));
  };

  if (!isLoaded) return null;

  return (
    <GoalContext.Provider value={{ goals, addGoal, updateProgress, deleteGoal, editGoal }}>
      {children}
    </GoalContext.Provider>
  );
}

export function useGoals() {
  const context = useContext(GoalContext);
  if (context === undefined) {
    throw new Error("useGoals must be used within a GoalProvider");
  }
  return context;
}
