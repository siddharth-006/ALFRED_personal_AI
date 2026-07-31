"use client";

import React, { useState } from "react";
import { Folder, Plus, Edit2, Trash2, CheckCircle, BarChart2, Calendar, LayoutGrid, LayoutList } from "lucide-react";
import { useProjects, Project, ProjectCategory, ProjectStatus } from "@/context/ProjectContext";

export default function ProjectsPage() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Personal" as ProjectCategory,
    status: "Not Started" as ProjectStatus,
    progress: 0,
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status !== "Completed").length;
  const completedProjects = projects.filter(p => p.status === "Completed").length;
  const averageProgress = totalProjects > 0 ? Math.round(projects.reduce((acc, curr) => acc + curr.progress, 0) / totalProjects) : 0;

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProjectId(project.id);
      setFormData({
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        progress: project.progress,
      });
    } else {
      setEditingProjectId(null);
      setFormData({
        name: "",
        description: "",
        category: "Personal",
        status: "Not Started",
        progress: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProjectId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name.trim()) {
      alert("Project Name is required.");
      return;
    }
    if (formData.progress < 0 || formData.progress > 100) {
      alert("Progress must be between 0 and 100.");
      return;
    }

    if (editingProjectId) {
      updateProject(editingProjectId, {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        status: formData.status,
        progress: Number(formData.progress),
      });
    } else {
      addProject({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        status: formData.status,
        progress: Number(formData.progress),
        createdDate: new Date().toISOString().split("T")[0],
      });
    }

    handleCloseModal();
  };

  const confirmDelete = (id: string) => {
    setProjectToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
    }
    setIsDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch(status) {
      case "Completed": return "bg-green-500/20 text-green-500 border-green-500/30";
      case "In Progress": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "Not Started": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="p-4 md:p-8 bg-[#0f1115] min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-gray-400">Manage and track your active projects.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>New Project</span>
        </button>
      </header>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-blue-500/20 text-blue-500 rounded-lg">
            <Folder size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Projects</p>
            <h3 className="text-2xl font-bold text-white">{totalProjects}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-orange-500/20 text-orange-500 rounded-lg">
            <LayoutGrid size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Active Projects</p>
            <h3 className="text-2xl font-bold text-white">{activeProjects}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-green-500/20 text-green-500 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Completed Projects</p>
            <h3 className="text-2xl font-bold text-white">{completedProjects}</h3>
          </div>
        </div>

        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-purple-500/20 text-purple-500 rounded-lg">
            <BarChart2 size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Average Progress</p>
            <h3 className="text-2xl font-bold text-white">{averageProgress}%</h3>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-12 text-center">
          <Folder size={48} className="mx-auto text-gray-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Projects Found</h2>
          <p className="text-gray-400 mb-6">You haven&apos;t added any projects yet.</p>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Create First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <div key={project.id} className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 flex flex-col transition-all hover:border-gray-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1 truncate">{project.name}</h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="bg-[#2d313b] text-gray-300 px-2 py-1 rounded">
                      {project.category}
                    </span>
                    <span className={`border px-2 py-1 rounded ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleOpenModal(project)}
                    className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                    title="Edit Project"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => confirmDelete(project.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title="Delete Project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-400 text-sm mb-6 flex-1 line-clamp-3">
                {project.description || "No description provided."}
              </p>

              <div className="mt-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-400">Progress</span>
                  <span className="text-sm font-bold text-white">{project.progress}%</span>
                </div>
                <div className="w-full bg-[#15181d] rounded-full h-2 mb-4">
                  <div 
                    className={`${project.progress === 100 ? 'bg-green-500' : 'bg-blue-500'} h-2 rounded-full transition-all duration-500`} 
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar size={14} className="mr-1" />
                  <span>Created {new Date(project.createdDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingProjectId ? "Edit Project" : "New Project"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Project Name *</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., AI Research"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 min-h-[80px]"
                  placeholder="What is this project about?"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as ProjectCategory})}
                    className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="DSA">DSA</option>
                    <option value="Data Science">Data Science</option>
                    <option value="College">College</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as ProjectStatus})}
                    className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Progress: {formData.progress}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={formData.progress}
                  onChange={(e) => setFormData({...formData, progress: Number(e.target.value)})}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-[#2d313b] hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  {editingProjectId ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
            <Trash2 size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Delete Project?</h2>
            <p className="text-gray-400 mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2 bg-[#2d313b] hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
