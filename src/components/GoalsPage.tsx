"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, CheckCircle2, Calendar, Trash2, Edit2, Save, X } from "lucide-react";
import { useGoals, GoalType, Goal } from "@/context/GoalContext";

export default function GoalsPage() {
  const { goals, addGoal, updateProgress, deleteGoal, editGoal } = useGoals();

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>("Weekly");
  const [newGoalTarget, setNewGoalTarget] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTempTitle, setEditTempTitle] = useState("");
  const [editTempTarget, setEditTempTarget] = useState("");

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !newGoalTarget) return;
    addGoal(newGoalTitle, newGoalType, Number(newGoalTarget));
    setNewGoalTitle("");
    setNewGoalTarget("");
  };

  const startEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditTempTitle(goal.title);
    setEditTempTarget(goal.target.toString());
  };

  const saveEdit = () => {
    if (editingId && editTempTitle.trim() && editTempTarget) {
      editGoal(editingId, editTempTitle, Number(editTempTarget));
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this goal?")) {
      deleteGoal(id);
    }
  };

  const weeklyGoals = goals.filter(g => g.type === "Weekly");
  const monthlyGoals = goals.filter(g => g.type === "Monthly");

  const completedWeekly = weeklyGoals.filter(g => g.completed).length;
  const completedMonthly = monthlyGoals.filter(g => g.completed).length;

  const totalGoals = goals.length;
  const completedTotal = goals.filter(g => g.completed).length;
  const overallPercentage = totalGoals > 0 ? Math.round((completedTotal / totalGoals) * 100) : 0;

  const renderGoalCard = (goal: Goal) => {
    const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100)) || 0;
    const isEditing = editingId === goal.id;

    return (
      <div key={goal.id} className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-5 relative overflow-hidden group">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              className="w-full bg-[#0f1115] border border-blue-500 text-white p-2 rounded focus:outline-none"
              value={editTempTitle}
              onChange={(e) => setEditTempTitle(e.target.value)}
              placeholder="Goal Title"
            />
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                className="w-full bg-[#0f1115] border border-blue-500 text-white p-2 rounded focus:outline-none"
                value={editTempTarget}
                onChange={(e) => setEditTempTarget(e.target.value)}
                placeholder="Target"
              />
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
            <div className="flex justify-between items-start mb-3">
              <div>
                {goal.completed && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-500 rounded mb-2">
                    <CheckCircle2 size={12} className="mr-1" /> COMPLETED
                  </span>
                )}
                <h3 className={"font-medium text-lg " + (goal.completed ? "text-gray-400" : "text-gray-100")}>
                  {goal.title}
                </h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-white">{percentage}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-400">
                <span className="text-white font-bold">{goal.current}</span> / {goal.target}
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => startEdit(goal)} 
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => updateProgress(goal.id, -1)} 
                  disabled={goal.current <= 0}
                  className="p-1.5 bg-[#2d313b] hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-gray-300"
                >
                  <Minus size={16} />
                </button>
                <button 
                  onClick={() => updateProgress(goal.id, 1)} 
                  disabled={goal.completed}
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
                >
                  <Plus size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(goal.id)} 
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-red-500 hover:bg-red-500/20 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="w-full bg-[#15181d] rounded-full h-1.5 mt-4">
              <div 
                className={(goal.completed ? "bg-green-500" : "bg-blue-500") + " h-1.5 rounded-full transition-all duration-500"}
                style={{ width: percentage + "%" }}
              ></div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-[#0f1115] min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Goals</h1>
        <p className="text-gray-400">Track and manage your weekly and monthly milestones.</p>
      </header>
      
      {/* Overall Progress Section */}
      <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-white">Overall Goal Completion Percentage</h2>
          <span className="text-2xl font-bold text-white">{overallPercentage}%</span>
        </div>
        <div className="w-full bg-[#15181d] rounded-full h-3 mt-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500" 
            style={{ width: overallPercentage + "%" }}
          ></div>
        </div>
      </div>

      {/* Goal Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg">
            <Target size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Total Weekly</p>
            <h3 className="text-xl font-bold text-white">{weeklyGoals.length}</h3>
          </div>
        </div>
        
        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 text-green-500 rounded-lg">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Completed Weekly</p>
            <h3 className="text-xl font-bold text-white">{completedWeekly}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Total Monthly</p>
            <h3 className="text-xl font-bold text-white">{monthlyGoals.length}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-gray-400 text-xs">Completed Monthly</p>
            <h3 className="text-xl font-bold text-white">{completedMonthly}</h3>
          </div>
        </div>
      </div>

      <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Add New Goal</h2>
        <form onSubmit={handleAddGoal} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            className="flex-1 bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Goal Name (e.g. Study 30 Hours)"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
          />
          <select
            className="bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500"
            value={newGoalType}
            onChange={(e) => setNewGoalType(e.target.value as GoalType)}
          >
            <option value="Weekly">Weekly Goal</option>
            <option value="Monthly">Monthly Goal</option>
          </select>
          <input
            type="number"
            min="1"
            className="w-full md:w-32 bg-[#15181d] border border-[#2d313b] text-white p-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Target"
            value={newGoalTarget}
            onChange={(e) => setNewGoalTarget(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newGoalTitle.trim() || !newGoalTarget}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 px-6 rounded-lg font-medium flex items-center justify-center transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Add Goal
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Goals Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Target size={24} className="mr-2 text-blue-500" />
            Weekly Goals
          </h2>
          {weeklyGoals.length === 0 ? (
            <p className="text-gray-500 bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl text-center">No weekly goals added yet.</p>
          ) : (
            <div className="space-y-4">
              {weeklyGoals.map(renderGoalCard)}
            </div>
          )}
        </div>

        {/* Monthly Goals Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Calendar size={24} className="mr-2 text-purple-500" />
            Monthly Goals
          </h2>
          {monthlyGoals.length === 0 ? (
            <p className="text-gray-500 bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl text-center">No monthly goals added yet.</p>
          ) : (
            <div className="space-y-4">
              {monthlyGoals.map(renderGoalCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
