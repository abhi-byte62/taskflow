import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, MoreVertical, Loader2, ArrowRight, LayoutDashboard } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  const { data: workspacesData, isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspaces');
      return data.data?.data !== undefined ? data.data.data : (data.data || []);
    },
  });

  const createWorkspace = useMutation({
    mutationFn: (payload) => api.post('/workspaces', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      toast.success('Workspace created');
      const newWs = res.data?.data?.data || res.data?.data;
      if (newWs?.boards?.[0]?.id) {
        navigate(`/board/${newWs.boards[0].id}`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create workspace'),
  });

  const deleteWorkspace = useMutation({
    mutationFn: (id) => api.delete(`/workspaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete workspace'),
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (newWorkspaceName.trim()) {
      createWorkspace.mutate({
        name: newWorkspaceName.trim(),
        description: newWorkspaceDescription.trim() || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        <p className="text-xs text-zinc-400">Loading workspaces...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-rose-500/10 rounded-xl border border-rose-500/20">
        <p className="text-rose-400 font-medium text-sm">Failed to load workspaces</p>
        <p className="text-xs text-zinc-400 mt-1">{error.message}</p>
      </div>
    );
  }

  const workspaces = workspacesData || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workspaces</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Manage your team boards, tasks, and sprints</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3.5"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {/* Workspace Cards */}
      {workspaces.length === 0 ? (
        <div className="bg-[#13151c] rounded-xl border border-[#232634] p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#181b24] border border-[#232634] flex items-center justify-center text-zinc-400 mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No workspaces yet</h3>
          <p className="text-xs text-zinc-400 mb-5">Create your first workspace to start organizing boards and tracking tasks.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => {
            const firstBoard = workspace.boards?.[0];
            return (
              <div
                key={workspace.id}
                onClick={() => {
                  if (firstBoard) {
                    navigate(`/board/${firstBoard.id}`);
                  } else {
                    navigate('/workspaces');
                  }
                }}
                className="bg-[#13151c] hover:bg-[#181b24] rounded-xl p-5 transition-colors group cursor-pointer border border-[#232634] hover:border-[#383d50] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-[#181b24] border border-[#232634] text-zinc-300 rounded-lg flex items-center justify-center group-hover:border-zinc-500 transition-colors">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <button
                      className="p-1 rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete workspace "${workspace.name}"?`)) {
                          deleteWorkspace.mutate(workspace.id);
                        }
                      }}
                      title="Delete Workspace"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1 group-hover:text-zinc-100 transition-colors">
                    {workspace.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mb-4 line-clamp-2">
                    {workspace.description || 'No description provided.'}
                  </p>

                  {workspace.boards && workspace.boards.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Boards ({workspace.boards.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {workspace.boards.map((b) => (
                          <span
                            key={b.id}
                            className="text-[11px] py-0.5 px-2 rounded-md bg-[#181b24] border border-[#232634] text-zinc-300"
                          >
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#232634] flex items-center justify-between text-xs text-zinc-500">
                  <span>{workspace.boards?.length || 0} boards</span>
                  <span className="text-zinc-300 group-hover:text-white group-hover:translate-x-0.5 transition-all flex items-center gap-1 font-medium">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#13151c] rounded-xl shadow-2xl w-full max-w-md border border-[#232634] p-5">
            <h2 className="text-base font-semibold text-white mb-1">New Workspace</h2>
            <p className="text-xs text-zinc-400 mb-4">Create a workspace for your team and boards.</p>
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="input"
                  placeholder="e.g. Engineering, Marketing"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className="input min-h-[80px] resize-none"
                  placeholder="What is this workspace for?..."
                  maxLength={500}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#232634]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspaceName.trim() || createWorkspace.isPending}
                  className="btn-primary text-xs"
                >
                  {createWorkspace.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
