"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, CheckCircle2, TrendingUp, Circle, CheckCircle,
  Target, Play, X, Compass, LayoutGrid, Briefcase,
  Crosshair, ShieldAlert, Cpu, Activity, Radar, Plus
} from "lucide-react";
import { useTasks } from "@/context/TaskContext";
import { useGoals } from "@/context/GoalContext";
import { useProjects } from "@/context/ProjectContext";
import { useWorkspaces, Workspace, FocusType } from "@/context/WorkspaceContext";
import { getWorkspaceIcon } from "./WorkspacesPage";
import { getStreakData } from "@/utils/streakUtils";
import { getFocusName, getFocusDescription } from "@/utils/focusMapping";
import { playClickSound, playHoverSound, playSuccessSound } from "@/utils/audioSystem";

const WELCOME_SUBTITLES = [
  "Welcome back, Silverback. The empire awaits your command.",
  "Commander detected. All systems standing by.",
  "Mission Control online. Your objectives await.",
  "The grind resumes now. Deploy.",
  "Legends aren't born. They're built.",
  "Neural link established. Awaiting tactical directives.",
  "Main reactor online. Unleash hell.",
  "Security clearance accepted. Headquarters is yours.",
  "Your legacy is written in the actions you take today.",
  "Command privileges restored. Execute protocol.",
  "No distractions. No surrender. Only victory.",
  "Tactical grid active. Ready for deployment.",
  "Welcome to the war room. Time to conquer.",
  "The shadows belong to us. Let's work.",
  "Initiating deep work sequence. Stay sharp.",
  "Satellite uplink secured. You are online.",
  "The hardest battles forge the strongest commanders.",
  "Overriding limits. Pushing beyond maximum capacity.",
  "Focus engine primed. Destroy the weakness.",
  "You are the weapon. The system is just the scope.",
  "Vitals nominal. Mind sharp. Begin.",
  "They sleep while we build. Welcome back.",
  "Acknowledge no limits. Command the day.",
  "System unlocked. Let's make history.",
  "Welcome back to the Batcave, sir.",
  "Every second counts. Initiate protocol."
];

const BATMAN_QUOTES = [
  "It's not who I am underneath, but what I do that defines me.",
  "Why do we fall? So we can learn to pick ourselves up.",
  "Sometimes the truth isn't good enough. Sometimes people deserve more.",
  "The night is darkest just before the dawn. And I promise you, the dawn is coming.",
  "A hero can be anyone.",
  "Fear is a tool. When that light hits the sky, it's not just a call. It's a warning.",
  "If you make yourself more than just a man, if you devote yourself to an ideal, you become something else entirely.",
  "You only have one life. It's actually your duty to live it as fully as possible.",
  "Everything's impossible until somebody does it."
];

export default function Dashboard() {
  const { tasks, toggleTask, addTask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { workspaces, currentFocus, setFocus, launchWorkspace } = useWorkspaces();
  const [streakData, setStreakData] = useState({ currentStreak: 0, lastActiveDate: null as string | null });

  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [launchMessage, setLaunchMessage] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [quote, setQuote] = useState("");
  const [isNewTaskMode, setIsNewTaskMode] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("");

  useEffect(() => {
    setStreakData(getStreakData());
    setSubtitle(WELCOME_SUBTITLES[Math.floor(Math.random() * WELCOME_SUBTITLES.length)]);
    setQuote(BATMAN_QUOTES[Math.floor(Math.random() * BATMAN_QUOTES.length)]);

    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [tasks]);

  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const completedGoals = goals.filter(g => g.completed).length;
  const activeProjectsCount = projects.filter(p => p.status !== "Completed").length;
  const focusedCategory = currentFocus;
  const uniqueCategories = Array.from(new Set(tasks.map(t => t.category))).filter(Boolean);

  const displayTasks = [...tasks]
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      if (focusedCategory) {
        if (a.category === focusedCategory && b.category !== focusedCategory) return -1;
        if (a.category !== focusedCategory && b.category === focusedCategory) return 1;
      }
      return 0;
    });

  const activeProjects = projects.filter(p => p.status !== "Completed");
  const focusedProjects = focusedCategory ? activeProjects.filter(p => p.category === focusedCategory) : [];
  const otherProjects = focusedCategory ? activeProjects.filter(p => p.category !== focusedCategory) : activeProjects;

  const mostUsedWorkspace = workspaces.length > 0
    ? workspaces.reduce((prev, current) => (prev.launchCount > current.launchCount) ? prev : current)
    : null;

  const recommendedWorkspace = currentFocus
    ? workspaces.find(ws => ws.type === currentFocus)
    : null;

  const openLaunchModal = (ws: Workspace) => {
    playClickSound();
    setActiveWorkspace(ws);
    setLaunchMessage("");
    setIsLaunchModalOpen(true);
  };

  const handleTaskToggle = (taskId: string, wasCompleted: boolean) => {
    if (!wasCompleted) playSuccessSound();
    else playClickSound();
    toggleTask(taskId);
  };

  const executeLaunch = () => {
    if (!activeWorkspace) return;
    playClickSound();
    launchWorkspace(activeWorkspace.id);
    let openedCount = 0;
    activeWorkspace.websites.forEach(url => {
      const newWin = window.open(url, "_blank");
      if (newWin) openedCount++;
    });

    if (openedCount < activeWorkspace.websites.length && activeWorkspace.websites.length > 0) {
      setLaunchMessage("WARNING: BROWSER POP-UP BLOCKER DETECTED. OVERRIDE REQUIRED.");
    } else {
      setLaunchMessage("INITIATING LAUNCH SEQUENCE...");
      setTimeout(() => {
        setIsLaunchModalOpen(false);
        setActiveWorkspace(null);
      }, 2000);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-transparent min-h-screen relative overflow-hidden text-[#DFF6FF]">

      {/* Background Decorators */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00BFFF]/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Cinematic Welcome Banner Overlay */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020508]/95 backdrop-blur-xl pointer-events-none"
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,191,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,191,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,191,255,0.2)_50%,rgba(0,191,255,0.2))] bg-[length:100%_4px] pointer-events-none" />

            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative text-center animate-flicker"
            >
              <h1 className="text-5xl md:text-7xl font-header font-black text-transparent bg-clip-text bg-gradient-to-b from-[#DFF6FF] to-[#00E5FF] tracking-[0.2em] mb-4 drop-shadow-[0_0_25px_rgba(0,229,255,0.8)]">
                DADDY&apos;S HOME
              </h1>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, delay: 1 }}
                className="h-[2px] bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent shadow-[0_0_10px_#00E5FF] mb-6 mx-auto"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.5 }}
                className="text-sm md:text-base font-data text-[#A8C7FA] tracking-widest uppercase"
              >
                {subtitle}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10">
        <div className="animate-flicker">
          <h1 className="text-3xl font-header font-bold text-glow-strong text-[#00E5FF] mb-2 uppercase flex items-center">
            <ShieldAlert size={28} className="mr-3" /> COMMAND CENTER
          </h1>
          <p className="text-[#00BFFF] font-data tracking-widest text-sm">SYSTEM AWAITING COMMANDS, COMMANDER.</p>
        </div>

        <div className="hud-panel p-2 flex items-center space-x-3">
          <span className="text-sm font-header tracking-widest text-[#00BFFF] pl-2 uppercase">Deep Work Mode:</span>
          <select
            value={currentFocus || ""}
            onChange={(e) => {
              playClickSound();
              setFocus(e.target.value || null);
            }}
            onMouseEnter={playHoverSound}
            className="bg-[#020508] border border-[#00BFFF]/30 text-[#00E5FF] rounded px-3 py-1.5 text-sm font-data focus:outline-none focus:border-[#00E5FF] cursor-pointer"
          >
            <option value="">STANDBY</option>
            {uniqueCategories.map(category => (
              <option key={category} value={category}>
                {category.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Command Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* LEFT COLUMN: Telemetry & Missions */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Telemetry Panel */}
          <div className="hud-panel p-5">
            <h3 className="font-header text-[#00BFFF] text-sm tracking-widest flex items-center mb-4">
              <Activity size={16} className="mr-2" /> SYSTEM VITALS
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-data text-[#DFF6FF] mb-1 uppercase tracking-wider">
                  <span>Mission Completion</span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="w-full bg-[#020508] border border-[#00BFFF]/20 h-2 p-[1px]">
                  <motion.div
                    className="bg-[#00E5FF] h-full shadow-[0_0_8px_#00E5FF]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 font-data text-xs uppercase tracking-wider">
                <div className="bg-[#00BFFF]/5 border border-[#00BFFF]/20 p-2 text-center">
                  <div className="text-[#00BFFF] font-bold mb-1">Missions Done</div>
                  <div className="text-xl text-glow text-[#00E5FF]">{completedTasks}</div>
                </div>
                <div className="bg-[#00BFFF]/5 border border-[#00BFFF]/20 p-2 text-center">
                  <div className="text-[#00BFFF] font-bold mb-1">Goals Met</div>
                  <div className="text-xl text-glow text-[#00E5FF]">{completedGoals}</div>
                </div>
                <div className="bg-[#00BFFF]/5 border border-[#00BFFF]/20 p-2 text-center">
                  <div className="text-[#00BFFF] font-bold mb-1">Active Ops</div>
                  <div className="text-xl text-glow text-[#00E5FF]">{activeProjectsCount}</div>
                </div>
                <div className="bg-[#00BFFF]/5 border border-[#00BFFF]/20 p-2 text-center">
                  <div className="text-[#00BFFF] font-bold mb-1">Mission Streak</div>
                  <div className="text-xl text-glow text-[#00E5FF]">{streakData.currentStreak} <span className="text-[10px]">DAYS</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Deep Work Target */}
          <div className="hud-panel p-5">
            <h3 className="font-header text-[#00BFFF] text-sm tracking-widest flex items-center mb-3 uppercase">
              <Crosshair size={16} className="mr-2" /> Active Target
            </h3>
            <div className="border border-[#00BFFF]/30 bg-[#00BFFF]/10 p-4 text-center">
              <div className="text-xl font-header text-[#00E5FF] text-glow mb-2 uppercase">
                {currentFocus ? getFocusName(currentFocus) : "NO TARGET AQUIRED"}
              </div>
              <div className="text-xs font-data text-[#DFF6FF] tracking-wider leading-relaxed">
                {getFocusDescription(currentFocus)}
              </div>
            </div>
          </div>

          {/* Motivation Easter Egg */}
          <div className="hud-panel p-5 group relative cursor-default overflow-hidden flex flex-col items-center justify-center text-center flex-1">
            <div className="absolute inset-0 bg-[#00BFFF]/10 blur-xl opacity-30 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>

            <p className="font-header text-[10px] sm:text-xs text-[#00E5FF] tracking-widest leading-relaxed drop-shadow-[0_0_5px_rgba(0,229,255,0.8)] relative z-10 italic">
              &quot;{quote}&quot;
            </p>
          </div>
        </div>

        {/* CENTER COLUMN: AI Reactor & Radar */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center min-h-[400px] hud-panel p-6 relative overflow-hidden">
          {/* Radar Sweep Effect */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-[200%] h-[200%] origin-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(0,229,255,0.8) 30deg, transparent 40deg)" }}
            />
          </div>

          <div className="relative z-10 w-64 h-64 flex items-center justify-center">
            {/* Outer Ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute w-full h-full border border-dashed border-[#00BFFF]/30 rounded-full"
            />
            {/* Inner Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute w-48 h-48 border-2 border-[#00E5FF]/50 rounded-full border-t-transparent shadow-[0_0_15px_#00E5FF]"
            />
            {/* Core */}
            <div className="absolute w-32 h-32 rounded-full bg-[#00BFFF]/20 border border-[#00BFFF] shadow-[0_0_30px_#00BFFF] flex flex-col items-center justify-center animate-pulse">
              <Cpu size={32} className="text-[#00E5FF] mb-2" />
              <span className="font-header text-[10px] tracking-widest text-[#00E5FF]">AI CORE</span>
              <span className="font-data text-[8px] text-[#00BFFF]">ONLINE</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 w-full text-center">
            <div className="border border-[#00BFFF]/20 p-3 bg-[#00BFFF]/5">
              <div className="font-data text-xs font-bold text-[#DFF6FF] tracking-widest">FAVORED WORKSPACE</div>
              <div className="font-header text-base text-[#00E5FF] text-glow uppercase mt-2 truncate">
                {mostUsedWorkspace ? mostUsedWorkspace.name : "NONE"}
              </div>
            </div>
            <div className="border border-[#00BFFF]/20 p-3 bg-[#00BFFF]/5">
              <div className="font-data text-xs font-bold text-[#DFF6FF] tracking-widest">LAST DEPLOYMENT</div>
              <div className="font-header text-base text-[#00E5FF] text-glow uppercase mt-2">
                {mostUsedWorkspace && mostUsedWorkspace.lastLaunched ? new Date(mostUsedWorkspace.lastLaunched).toLocaleDateString() : "NEVER"}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Mission Board */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Active Missions */}
          <div className="hud-panel p-5 flex-1 flex flex-col max-h-[600px]">
            <h3 className="font-header text-[#00BFFF] text-sm tracking-widest flex items-center justify-between mb-4 border-b border-[#00BFFF]/30 pb-2 uppercase">
              <span className="flex items-center"><Target size={16} className="mr-2" /> MISSION BOARD</span>
              <div className="flex items-center space-x-3">
                <button onClick={() => setIsNewTaskMode(!isNewTaskMode)} className="text-[#00E5FF] hover:text-white transition-colors" title="Deploy New Mission">
                  <Plus size={16} />
                </button>
                <span className="font-data text-[10px] text-[#00E5FF]">{completedTasks}/{tasks.length} SECURED</span>
              </div>
            </h3>

            {isNewTaskMode && (
              <div className="mb-4 p-3 border border-[#00E5FF]/50 bg-[#00E5FF]/10 shadow-[inset_0_0_10px_rgba(0,229,255,0.2)]">
                <input
                  type="text"
                  placeholder="MISSION OBJECTIVE..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="w-full bg-transparent border-b border-[#00E5FF]/30 text-[#DFF6FF] font-data text-xs mb-3 px-2 py-1 focus:outline-none focus:border-[#00E5FF]"
                />
                <input
                  type="text"
                  placeholder="CUSTOM CATEGORY..."
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  className="w-full bg-transparent border-b border-[#00E5FF]/30 text-[#DFF6FF] font-data text-xs mb-3 px-2 py-1 focus:outline-none focus:border-[#00E5FF]"
                />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setIsNewTaskMode(false)} className="px-2 py-1 text-xs font-header text-[#00BFFF] hover:bg-[#00BFFF]/10 border border-transparent hover:border-[#00BFFF]/30">CANCEL</button>
                  <button onClick={() => {
                    if (newTaskText.trim() && newTaskCategory.trim()) {
                      addTask(newTaskText, newTaskCategory);
                      setNewTaskText("");
                      setNewTaskCategory("");
                      setIsNewTaskMode(false);
                      try { playSuccessSound(); } catch (e) { }
                    }
                  }} className="px-2 py-1 text-xs font-header bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF] hover:bg-[#00E5FF]/30">DEPLOY</button>
                </div>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <CheckCircle2 size={32} className="text-[#00BFFF] mb-2" />
                <span className="font-data text-xs uppercase">ALL MISSIONS ACCOMPLISHED</span>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {displayTasks.map(task => {
                  const isFocused = focusedCategory && task.category === focusedCategory;
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleTaskToggle(task.id, task.completed)}
                      onMouseEnter={playHoverSound}
                      className={`p-3 relative cursor-pointer border transition-all duration-300 group ${task.completed
                          ? "border-[#00BFFF]/20 bg-[#00BFFF]/5"
                          : isFocused
                            ? "border-[#00E5FF]/50 bg-[#00E5FF]/10 shadow-[inset_0_0_10px_rgba(0,229,255,0.2)]"
                            : "border-[#00BFFF]/30 hover:border-[#00E5FF]/50 hover:bg-[#00BFFF]/10"
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`mt-0.5 ${task.completed ? "text-[#00BFFF]/50" : "text-[#00E5FF]"}`}>
                            {task.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                          </div>
                          <div>
                            <p className={`font-header text-xs tracking-wider transition-colors uppercase ${task.completed ? "text-[#A8C7FA]/50 line-through" : "text-[#DFF6FF] group-hover:text-glow text-shadow-sm"
                              }`}>
                              {task.text}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {isFocused && !task.completed && (
                                <span className="font-data text-[10px] bg-[#00E5FF]/20 text-[#00E5FF] px-1 py-0.5 border border-[#00E5FF]/30 tracking-widest font-bold">
                                  TARGET LOCKED
                                </span>
                              )}
                              <span className="font-data text-xs text-[#00BFFF] font-bold tracking-widest">[{task.category}]</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Holographic corners */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00BFFF]/50" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00BFFF]/50" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Launch Deployment */}
          <div className="hud-panel p-5">
            <h3 className="font-header text-[#00BFFF] text-sm tracking-widest flex items-center mb-4 uppercase border-b border-[#00BFFF]/30 pb-2">
              <Briefcase size={16} className="mr-2" /> RAPID DEPLOYMENT
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {workspaces.filter(ws => ["dsa", "datascience", "hackathon", "machinelearning"].includes(ws.type)).map(ws => (
                <button
                  key={ws.id}
                  onClick={() => openLaunchModal(ws)}
                  onMouseEnter={playHoverSound}
                  className="hud-button flex items-center justify-between p-3 text-left"
                  title="Deploy Workspace"
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="text-[#00E5FF] shrink-0">{getWorkspaceIcon(ws.type, 18)}</span>
                    <span className="text-xs font-bold truncate tracking-widest">{ws.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Launch Summary Modal (Military Overlay) */}
      <AnimatePresence>
        {isLaunchModalOpen && activeWorkspace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#020508]/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="hud-panel w-full max-w-lg border border-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.2)] flex flex-col"
            >
              <div className="p-4 border-b border-[#00E5FF]/30 text-center relative bg-[#00E5FF]/10">
                <button
                  onClick={() => { playClickSound(); setIsLaunchModalOpen(false); }}
                  className="absolute right-4 top-4 text-[#00BFFF] hover:text-[#00E5FF]"
                >
                  <X size={20} />
                </button>
                <Radar size={32} className="mx-auto mb-2 text-[#00E5FF] animate-spin-slow" />
                <h2 className="text-2xl font-header font-bold text-[#00E5FF] text-glow uppercase tracking-widest">
                  DEPLOYING: {activeWorkspace.name}
                </h2>
                <p className="text-[#DFF6FF] font-data text-sm font-bold tracking-widest mt-1">REVIEW DEPLOYMENT PARAMETERS</p>
              </div>

              <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4 font-data text-sm">
                <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-3 flex space-x-3">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span><strong>SECURE CLEARANCE REQUIRED:</strong> Local applications and directories require manual access protocols. Web endpoints will deploy automatically. Allow pop-up overrides.</span>
                </div>

                {activeWorkspace.applications.length > 0 && (
                  <div>
                    <h4 className="text-[#00E5FF] font-bold mb-1 uppercase tracking-widest border-b border-[#00BFFF]/30 pb-1">Manual Executables:</h4>
                    <ul className="text-[#A8C7FA] space-y-1 mt-2">
                      {activeWorkspace.applications.map((app, i) => <li key={i} className="flex items-center"><div className="w-1 h-1 bg-[#00BFFF] mr-2" />{app}</li>)}
                    </ul>
                  </div>
                )}

                {activeWorkspace.websites.length > 0 && (
                  <div>
                    <h4 className="text-[#00E5FF] font-bold mb-1 uppercase tracking-widest border-b border-[#00BFFF]/30 pb-1">Automated Endpoints:</h4>
                    <ul className="text-[#A8C7FA] space-y-1 mt-2">
                      {activeWorkspace.websites.map((url, i) => <li key={i} className="flex items-center"><div className="w-1 h-1 bg-[#00E5FF] mr-2" />{url}</li>)}
                    </ul>
                  </div>
                )}

                {activeWorkspace.localFolders.length > 0 && (
                  <div>
                    <h4 className="text-[#00E5FF] font-bold mb-1 uppercase tracking-widest border-b border-[#00BFFF]/30 pb-1">Local Directories:</h4>
                    <ul className="text-[#A8C7FA] space-y-1 mt-2">
                      {activeWorkspace.localFolders.map((f, i) => <li key={i} className="flex items-center"><div className="w-1 h-1 bg-[#00BFFF] mr-2" />{f}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {launchMessage && (
                <div className="px-6 py-2 bg-[#020508] border-t border-[#00E5FF]/30 text-center text-[10px] font-data text-[#00E5FF] animate-pulse">
                  {launchMessage}
                </div>
              )}

              <div className="p-4 border-t border-[#00E5FF]/30 flex space-x-3 bg-[#020508]">
                <button
                  onClick={() => { playClickSound(); setIsLaunchModalOpen(false); }}
                  onMouseEnter={playHoverSound}
                  className="flex-1 py-2 border border-[#00BFFF]/30 text-[#00BFFF] font-header text-sm tracking-widest hover:bg-[#00BFFF]/10 transition-colors uppercase"
                >
                  ABORT
                </button>
                <button
                  onClick={executeLaunch}
                  onMouseEnter={playHoverSound}
                  className="flex-1 py-2 bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] font-header text-sm tracking-widest hover:bg-[#00E5FF]/30 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all uppercase flex justify-center items-center"
                >
                  <Play size={14} fill="currentColor" className="mr-2" />
                  INITIATE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
