"use client";

import React, { useState } from "react";
import { Plus, Trash2, Edit2, CheckCircle, Circle, Save, X, ListTodo, CheckSquare, Clock, BarChart3 } from "lucide-react";
import { useTasks, TaskCategory, Task } from "@/context/TaskContext";

const CATEGORIES: TaskCategory[] = ["DSA", "Data Science", "College", "Hackathon", "Personal"];

export default function TasksPage() {
  const { tasks, addTask, toggleTask, deleteTask, editTask } = useTasks();
  
  const allCategories = Array.from(new Set([
    ...CATEGORIES,
    ...tasks.map(t => t.category)
  ]));

  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<string>("Personal");
  const [customNewCategory, setCustomNewCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTempText, setEditTempText] = useState("");
  const [editTempCategory, setEditTempCategory] = useState<string>("Personal");
  const [customEditCategory, setCustomEditCategory] = useState("");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const finalCategory = newTaskCategory === "Custom" ? (customNewCategory.trim() || "Personal") : newTaskCategory;
    addTask(newTaskText, finalCategory);
    setNewTaskText("");
    setCustomNewCategory("");
    setNewTaskCategory("Personal");
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTempText(task.text);
    if (allCategories.includes(task.category)) {
      setEditTempCategory(task.category);
      setCustomEditCategory("");
    } else {
      setEditTempCategory("Custom");
      setCustomEditCategory(task.category);
    }
  };

  const saveEdit = () => {
    if (editingId && editTempText.trim()) {
      const finalCategory = editTempCategory === "Custom" ? (customEditCategory.trim() || "Personal") : editTempCategory;
      editTask(editingId, editTempText, finalCategory);
      setEditingId(null);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.length - completedCount;
  const completionPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="p-4 md:p-8 bg-[#0f1115] min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Tasks</h1>
        <p className="text-gray-400">Manage your action items and track your progress.</p>
      </header>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg">
            <ListTodo size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Total Tasks</p>
            <h3 className="text-xl font-bold text-white">{tasks.length}</h3>
          </div>
        </div>
        
        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 text-green-500 rounded-lg">
            <CheckSquare size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Completed</p>
            <h3 className="text-xl font-bold text-white">{completedCount}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-orange-500/20 text-orange-500 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Pending</p>
            <h3 className="text-xl font-bold text-white">{pendingCount}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg">
            <BarChart3 size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Completion</p>
            <h3 className="text-xl font-bold text-white">{completionPercentage}%</h3>
          </div>
        </div>
      </div>

      <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Add New Task</h2>
        <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            className="flex-1 bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="What needs to be done?"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500 w-full md:w-40"
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
            >
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="Custom">Custom...</option>
            </select>
            {newTaskCategory === "Custom" && (
              <input
                type="text"
                className="bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500 w-full md:w-40 placeholder-gray-500"
                placeholder="Enter category"
                value={customNewCategory}
                onChange={(e) => setCustomNewCategory(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <button
            type="submit"
            disabled={!newTaskText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 px-6 rounded-lg font-medium flex items-center justify-center transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Add Task
          </button>
        </form>
      </div>

      <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">All Tasks</h2>
        
        {tasks.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <ListTodo size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No tasks found. Add a task above to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div 
                key={task.id}
                className={"flex items-center justify-between p-4 rounded-lg transition-all border " + (task.completed ? "bg-[#1a2228] border-green-500/30" : "bg-[#15181d] border-[#2d313b]")}
              >
                {editingId === task.id ? (
                  <div className="flex-1 flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <input
                      type="text"
                      className="flex-1 bg-[#0f1115] border border-blue-500 text-white p-2 rounded focus:outline-none"
                      value={editTempText}
                      onChange={(e) => setEditTempText(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <select
                        className="bg-[#0f1115] border border-blue-500 text-white p-2 rounded focus:outline-none w-32"
                        value={editTempCategory}
                        onChange={(e) => setEditTempCategory(e.target.value)}
                      >
                        {allCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="Custom">Custom...</option>
                      </select>
                      {editTempCategory === "Custom" && (
                        <input
                          type="text"
                          className="bg-[#0f1115] border border-blue-500 text-white p-2 rounded focus:outline-none w-32 placeholder-gray-500"
                          placeholder="Category name"
                          value={customEditCategory}
                          onChange={(e) => setCustomEditCategory(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={saveEdit} className="p-2 text-green-500 hover:bg-green-500/20 rounded">
                        <Save size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-red-500 hover:bg-red-500/20 rounded">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center flex-1 cursor-pointer overflow-hidden mr-4" onClick={() => toggleTask(task.id)}>
                      <div className={"flex-shrink-0 mr-4 transition-colors " + (task.completed ? "text-green-500" : "text-gray-500")}>
                        {task.completed ? <CheckCircle size={22} className="fill-green-500/20" /> : <Circle size={22} />}
                      </div>
                      <div className="flex flex-col flex-1 truncate">
                        <span className={"text-lg truncate transition-all " + (task.completed ? "text-gray-500 line-through" : "text-gray-200")}>
                          {task.text}
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-[#2d313b] w-max px-2 py-0.5 rounded mt-1">
                          {task.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button 
                        onClick={() => startEdit(task)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

