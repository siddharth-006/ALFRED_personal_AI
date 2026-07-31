"use client";

import React, { useState } from "react";
import { 
  Briefcase, Code, LineChart, Terminal, Brain, 
  Plus, Play, X, Trash2, Edit2, Globe, Monitor, 
  Folder as FolderIcon, LayoutGrid, BarChart2 
} from "lucide-react";
import { useWorkspaces, Workspace, WorkspaceType } from "@/context/WorkspaceContext";

export const getWorkspaceIcon = (type: WorkspaceType, size = 24) => {
  switch (type) {
    case "dsa": return <Code size={size} />;
    case "datascience": return <LineChart size={size} />;
    case "hackathon": return <Terminal size={size} />;
    case "machinelearning": return <Brain size={size} />;
    case "custom":
    default: return <Briefcase size={size} />;
  }
};

export default function WorkspacesPage() {
  const { workspaces, addWorkspace, updateWorkspace, deleteWorkspace, launchWorkspace } = useWorkspaces();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "custom" as WorkspaceType,
    applications: [] as string[],
    websites: [] as string[],
    localFolders: [] as string[],
  });

  const [formInput, setFormInput] = useState({
    app: "",
    website: "",
    folder: ""
  });

  const [launchMessage, setLaunchMessage] = useState("");

  const totalWorkspaces = workspaces.length;
  const totalApps = workspaces.reduce((acc, ws) => acc + ws.applications.length, 0);
  const totalWebsites = workspaces.reduce((acc, ws) => acc + ws.websites.length, 0);
  const totalFolders = workspaces.reduce((acc, ws) => acc + ws.localFolders.length, 0);

  // Form Handlers
  const openFormModal = (workspace?: Workspace) => {
    if (workspace) {
      setActiveWorkspace(workspace);
      setFormData({
        name: workspace.name,
        description: workspace.description,
        type: workspace.type,
        applications: [...workspace.applications],
        websites: [...workspace.websites],
        localFolders: [...workspace.localFolders],
      });
    } else {
      setActiveWorkspace(null);
      setFormData({
        name: "",
        description: "",
        type: "custom",
        applications: [],
        websites: [],
        localFolders: [],
      });
    }
    setFormInput({ app: "", website: "", folder: "" });
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setActiveWorkspace(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Name is required");

    if (activeWorkspace) {
      updateWorkspace(activeWorkspace.id, formData);
    } else {
      addWorkspace(formData);
    }
    closeFormModal();
  };

  const addItem = (field: "applications" | "websites" | "localFolders", value: string) => {
    if (!value.trim()) return;
    setFormData(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setFormInput(prev => ({ 
      ...prev, 
      [field === "applications" ? "app" : field === "websites" ? "website" : "folder"]: "" 
    }));
  };

  const removeItem = (field: "applications" | "websites" | "localFolders", index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Delete Handlers
  const confirmDelete = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveWorkspace(workspace);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = () => {
    if (activeWorkspace) {
      deleteWorkspace(activeWorkspace.id);
    }
    setIsDeleteModalOpen(false);
    setActiveWorkspace(null);
    setIsDetailsModalOpen(false);
  };

  // Launch Handlers
  const openLaunchModal = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveWorkspace(workspace);
    setLaunchMessage("");
    setIsLaunchModalOpen(true);
  };

  const executeLaunch = () => {
    if (!activeWorkspace) return;
    
    launchWorkspace(activeWorkspace.id);
    
    // Open websites
    let openedCount = 0;
    activeWorkspace.websites.forEach(url => {
      const newWin = window.open(url, "_blank");
      if (newWin) openedCount++;
    });

    if (openedCount < activeWorkspace.websites.length && activeWorkspace.websites.length > 0) {
      setLaunchMessage("Your browser may block multiple tabs. Allow popups for the best experience.");
    } else {
      setLaunchMessage("Launch successful! Check your browser tabs.");
      setTimeout(() => {
        setIsLaunchModalOpen(false);
        setActiveWorkspace(null);
      }, 2000);
    }
  };

  // Details Handler
  const openDetailsModal = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="p-4 md:p-8 bg-[#0f1115] min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Workspaces</h1>
          <p className="text-gray-400">Launch environments tailored for your productivity.</p>
        </div>
        <button 
          onClick={() => openFormModal()}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>New Workspace</span>
        </button>
      </header>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-blue-500/20 text-blue-500 rounded-lg"><LayoutGrid size={24} /></div>
          <div>
            <p className="text-gray-400 text-sm">Total Workspaces</p>
            <h3 className="text-2xl font-bold text-white">{totalWorkspaces}</h3>
          </div>
        </div>
        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-purple-500/20 text-purple-500 rounded-lg"><Monitor size={24} /></div>
          <div>
            <p className="text-gray-400 text-sm">Applications</p>
            <h3 className="text-2xl font-bold text-white">{totalApps}</h3>
          </div>
        </div>
        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-lg"><Globe size={24} /></div>
          <div>
            <p className="text-gray-400 text-sm">Websites</p>
            <h3 className="text-2xl font-bold text-white">{totalWebsites}</h3>
          </div>
        </div>
        <div className="bg-[#1e2128] border border-[#2d313b] p-6 rounded-xl flex items-center space-x-4">
          <div className="p-3 bg-orange-500/20 text-orange-500 rounded-lg"><FolderIcon size={24} /></div>
          <div>
            <p className="text-gray-400 text-sm">Local Folders</p>
            <h3 className="text-2xl font-bold text-white">{totalFolders}</h3>
          </div>
        </div>
      </div>

      {/* Workspace Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map(ws => (
          <div 
            key={ws.id} 
            onClick={() => openDetailsModal(ws)}
            className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 flex flex-col cursor-pointer hover:border-gray-500 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#2d313b] text-blue-400 rounded-lg">
                  {getWorkspaceIcon(ws.type)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{ws.name}</h3>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); openFormModal(ws); }}
                  className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                ><Edit2 size={16} /></button>
                <button 
                  onClick={(e) => confirmDelete(ws, e)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                ><Trash2 size={16} /></button>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm mb-6 flex-1 line-clamp-2">
              {ws.description || "No description provided."}
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-[#15181d] rounded-lg p-2 text-center border border-[#2d313b]">
                <Monitor size={14} className="mx-auto text-purple-400 mb-1" />
                <span className="text-xs font-bold text-white">{ws.applications.length}</span>
              </div>
              <div className="bg-[#15181d] rounded-lg p-2 text-center border border-[#2d313b]">
                <Globe size={14} className="mx-auto text-emerald-400 mb-1" />
                <span className="text-xs font-bold text-white">{ws.websites.length}</span>
              </div>
              <div className="bg-[#15181d] rounded-lg p-2 text-center border border-[#2d313b]">
                <FolderIcon size={14} className="mx-auto text-orange-400 mb-1" />
                <span className="text-xs font-bold text-white">{ws.localFolders.length}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-500 mb-4 border-t border-[#2d313b] pt-4">
              <span>Launched: {ws.launchCount} times</span>
              <span>{ws.lastLaunched ? new Date(ws.lastLaunched).toLocaleDateString() : 'Never'}</span>
            </div>

            <button 
              onClick={(e) => openLaunchModal(ws, e)}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-colors font-medium"
            >
              <Play size={18} fill="currentColor" />
              <span>Launch</span>
            </button>
          </div>
        ))}
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && activeWorkspace && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start p-6 border-b border-[#2d313b]">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-[#2d313b] text-blue-400 rounded-lg">
                  {getWorkspaceIcon(activeWorkspace.type)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{activeWorkspace.name}</h2>
                  <p className="text-gray-400 text-sm">Created {new Date(activeWorkspace.createdDate).toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <p className="text-gray-300">{activeWorkspace.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 mb-2">
                <div className="bg-[#15181d] p-3 rounded-lg border border-[#2d313b]">
                  Launch Count: <span className="text-white font-bold ml-2">{activeWorkspace.launchCount}</span>
                </div>
                <div className="bg-[#15181d] p-3 rounded-lg border border-[#2d313b]">
                  Last Launched: <span className="text-white font-bold ml-2">{activeWorkspace.lastLaunched ? new Date(activeWorkspace.lastLaunched).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-white font-bold mb-3 flex items-center"><Monitor size={16} className="mr-2 text-purple-400"/> Applications</h4>
                {activeWorkspace.applications.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-400 space-y-1">
                    {activeWorkspace.applications.map((app, i) => <li key={i}>{app}</li>)}
                  </ul>
                ) : <p className="text-gray-600 text-sm">No applications configured.</p>}
              </div>

              <div>
                <h4 className="text-white font-bold mb-3 flex items-center"><Globe size={16} className="mr-2 text-emerald-400"/> Websites</h4>
                {activeWorkspace.websites.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-400 space-y-1">
                    {activeWorkspace.websites.map((url, i) => <li key={i}>{url}</li>)}
                  </ul>
                ) : <p className="text-gray-600 text-sm">No websites configured.</p>}
              </div>

              <div>
                <h4 className="text-white font-bold mb-3 flex items-center"><FolderIcon size={16} className="mr-2 text-orange-400"/> Local Folders</h4>
                {activeWorkspace.localFolders.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-400 space-y-1">
                    {activeWorkspace.localFolders.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                ) : <p className="text-gray-600 text-sm">No local folders configured.</p>}
              </div>
            </div>
            
            <div className="p-6 border-t border-[#2d313b] flex space-x-3">
              <button 
                onClick={(e) => { setIsDetailsModalOpen(false); openLaunchModal(activeWorkspace, e); }}
                className="flex-1 py-3 flex justify-center items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Play size={18} fill="currentColor" />
                <span>Launch Workspace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Launch Summary Modal */}
      {isLaunchModalOpen && activeWorkspace && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-blue-500/30 rounded-xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="p-6 border-b border-[#2d313b] text-center">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                {getWorkspaceIcon(activeWorkspace.type, 32)}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Launching {activeWorkspace.name}</h2>
              <p className="text-gray-400 text-sm">Review the resources before launching.</p>
            </div>
            
            <div className="p-6 max-h-[50vh] overflow-y-auto space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm p-4 rounded-lg">
                <strong>Note:</strong> Desktop applications and local folders cannot be launched automatically from a standard web browser. They are displayed below for your reference to open manually. Websites will be opened automatically.
              </div>

              {activeWorkspace.applications.length > 0 && (
                <div>
                  <h4 className="text-gray-300 font-bold mb-2">Applications To Open (Manual):</h4>
                  <ul className="list-disc list-inside text-gray-400">
                    {activeWorkspace.applications.map((app, i) => <li key={i}>{app}</li>)}
                  </ul>
                </div>
              )}

              {activeWorkspace.websites.length > 0 && (
                <div>
                  <h4 className="text-gray-300 font-bold mb-2">Websites To Open:</h4>
                  <ul className="list-disc list-inside text-gray-400">
                    {activeWorkspace.websites.map((url, i) => <li key={i} className="truncate">{url}</li>)}
                  </ul>
                </div>
              )}

              {activeWorkspace.localFolders.length > 0 && (
                <div>
                  <h4 className="text-gray-300 font-bold mb-2">Local Folders (Manual):</h4>
                  <ul className="list-disc list-inside text-gray-400">
                    {activeWorkspace.localFolders.map((f, i) => <li key={i} className="truncate">{f}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {launchMessage && (
              <div className="px-6 py-3 bg-[#15181d] text-center text-sm font-medium text-orange-400 border-t border-[#2d313b]">
                {launchMessage}
              </div>
            )}
            
            <div className="p-6 border-t border-[#2d313b] flex space-x-3">
              <button 
                onClick={() => setIsLaunchModalOpen(false)}
                className="flex-1 py-3 bg-[#2d313b] hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeLaunch}
                className="flex-1 py-3 flex justify-center items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Play size={18} fill="currentColor" />
                <span>Confirm Launch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#2d313b] flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">
                {activeWorkspace ? "Edit Workspace" : "New Workspace"}
              </h2>
              <button onClick={closeFormModal} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <form id="workspace-form" onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
                    <input 
                      type="text" required value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Type/Icon</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as WorkspaceType})}
                      className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="dsa">DSA</option>
                      <option value="datascience">Data Science</option>
                      <option value="hackathon">Hackathon</option>
                      <option value="machinelearning">Machine Learning</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-[#15181d] border border-[#2d313b] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 min-h-[60px]"
                  />
                </div>
              </form>

              {/* Dynamic Lists */}
              <div className="space-y-6 pt-4 border-t border-[#2d313b]">
                {/* Applications */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Applications</label>
                  <div className="flex space-x-2 mb-2">
                    <input 
                      type="text" value={formInput.app}
                      onChange={e => setFormInput({...formInput, app: e.target.value})}
                      placeholder="e.g. VS Code"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem("applications", formInput.app); }}}
                      className="flex-1 bg-[#15181d] border border-[#2d313b] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={() => addItem("applications", formInput.app)} className="bg-[#2d313b] text-white px-3 rounded-lg hover:bg-gray-600"><Plus size={18} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.applications.map((item, i) => (
                      <span key={i} className="flex items-center space-x-1 bg-[#15181d] border border-[#2d313b] text-gray-300 px-2 py-1 rounded text-sm">
                        <span>{item}</span>
                        <button type="button" onClick={() => removeItem("applications", i)} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Websites */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Websites</label>
                  <div className="flex space-x-2 mb-2">
                    <input 
                      type="url" value={formInput.website}
                      onChange={e => setFormInput({...formInput, website: e.target.value})}
                      placeholder="e.g. https://github.com"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem("websites", formInput.website); }}}
                      className="flex-1 bg-[#15181d] border border-[#2d313b] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={() => addItem("websites", formInput.website)} className="bg-[#2d313b] text-white px-3 rounded-lg hover:bg-gray-600"><Plus size={18} /></button>
                  </div>
                  <div className="space-y-2">
                    {formData.websites.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#15181d] border border-[#2d313b] text-gray-300 px-3 py-2 rounded text-sm">
                        <span className="truncate pr-4">{item}</span>
                        <button type="button" onClick={() => removeItem("websites", i)} className="text-gray-500 hover:text-red-500 shrink-0"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Folders */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Local Folders</label>
                  <div className="flex space-x-2 mb-2">
                    <input 
                      type="text" value={formInput.folder}
                      onChange={e => setFormInput({...formInput, folder: e.target.value})}
                      placeholder="e.g. D:\Projects\MyProject"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem("localFolders", formInput.folder); }}}
                      className="flex-1 bg-[#15181d] border border-[#2d313b] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={() => addItem("localFolders", formInput.folder)} className="bg-[#2d313b] text-white px-3 rounded-lg hover:bg-gray-600"><Plus size={18} /></button>
                  </div>
                  <div className="space-y-2">
                    {formData.localFolders.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#15181d] border border-[#2d313b] text-gray-300 px-3 py-2 rounded text-sm">
                        <span className="truncate pr-4">{item}</span>
                        <button type="button" onClick={() => removeItem("localFolders", i)} className="text-gray-500 hover:text-red-500 shrink-0"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#2d313b] flex space-x-3">
              <button type="button" onClick={closeFormModal} className="flex-1 py-2.5 bg-[#2d313b] hover:bg-gray-600 text-white rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" form="workspace-form" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
                {activeWorkspace ? "Save Changes" : "Create Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2128] border border-[#2d313b] rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
            <Trash2 size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Delete Workspace?</h2>
            <p className="text-gray-400 mb-6">Are you sure you want to delete this workspace? This action cannot be undone.</p>
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
