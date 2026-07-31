"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { updateStreak } from '../utils/streakUtils';

export type TaskCategory = string;

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: TaskCategory;
}

interface TaskContextType {
  tasks: Task[];
  addTask: (text: string, category: TaskCategory) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  editTask: (id: string, newText: string, newCategory: TaskCategory) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const INITIAL_TASKS: Task[] = [
  { id: '1', text: 'Solve 2 LeetCode Problems', completed: false, category: 'DSA' },
  { id: '2', text: 'SQL Revision', completed: false, category: 'Data Science' },
  { id: '3', text: 'Work on Power BI Project', completed: false, category: 'Data Science' },
  { id: '4', text: 'Apply for Internship', completed: false, category: 'Personal' },
  { id: '5', text: 'Read Tech News', completed: false, category: 'Personal' },
];

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedTasks = localStorage.getItem('alfred_tasks_v2'); // new key for new schema natively
    const oldTasks = localStorage.getItem('alfred_tasks');
    
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else if (oldTasks) {
      // Migrate old schema if needed, but here let's just initialize
      const parsedOld = JSON.parse(oldTasks);
      const migrated = parsedOld.map((t: { id: string | number, text: string, completed: boolean }) => ({
        id: t.id.toString(),
        text: t.text,
        completed: t.completed,
        category: 'Personal' as TaskCategory
      }));
      setTasks(migrated);
    } else {
      setTasks(INITIAL_TASKS);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('alfred_tasks_v2', JSON.stringify(tasks));
    }
  }, [tasks, isLoaded]);

  const addTask = (text: string, category: TaskCategory) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false,
      category,
    };
    setTasks([newTask, ...tasks]);
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = !task.completed;
        if (newCompleted) {
          updateStreak();
        }
        return { ...task, completed: newCompleted };
      }
      return task;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const editTask = (id: string, newText: string, newCategory: TaskCategory) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, text: newText, category: newCategory } : task
    ));
  };

  if (!isLoaded) return null;

  return (
    <TaskContext.Provider value={{ tasks, addTask, toggleTask, deleteTask, editTask }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
