import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit, Loader2, ArrowRight, Building2, Kanban, MoreVertical } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Workspaces() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(null); // workspaceId
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');

  const { data: workspacesData, isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await api.get('/workspaces');
      return data.data?.data !== undefined ? data.data.data : (data.data || []);
    },
  });

  const createWorkspace = useMutation({
    mutationFn: (payload) => api.post('/workspaces', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      toast.success('Workspace created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create workspace'),
  });

  const createBoard = useMutation({
    mutationFn: ({ workspaceId, data }) => api.post(`/boards/workspace/${workspaceId}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setShowCreateBoardModal(null);
      setNewBoardName('');
      setNewBoardDescription('');
      toast.success('Board created');
      const board = res.data?.data?.data || res.data?.data;
      if (board?.id) {
        navigate(`/board/${board.id}`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create board'),
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

  const handleCreateBoardSubmit = (e) => {
    e.preventDefault();
    if (newBoardName.trim() && showCreateBoardModal) {
      createBoard.mutate({
        workspaceId: showCreateBoardModal,
        data: {
          name: newBoardName.trim(),
          description: newBoardDescription.trim() || undefined,
        },
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
      <div className="text-center p-8 bg-rose-500/10 rounded-xl border border-rose-500/20">
        <h2 className="text-sm font-semibold text-rose-400">Error loading workspaces</h2>
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Workspaces & Boards</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Manage workspaces, boards, and access permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3.5"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {/* Workspaces List */}
      <div className="space-y-4">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className="bg-[#13151c] rounded-xl border border-[#232634] p-5 space-y-4"
          >
            {/* Workspace Heading */}
            <div className="flex items-start justify-between border-b border-[#232634] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#181b24] border border-[#232634] flex items-center justify-center text-zinc-300">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{ws.name}</h2>
                  <p className="text-xs text-zinc-400">{ws.description || 'Workspace'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateBoardModal(ws.id)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-400" />
                  Add Board
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete workspace "${ws.name}" and all associated boards?`)) {
                      deleteWorkspace.mutate(ws.id);
                    }
                  }}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Delete Workspace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Boards Grid */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                Boards ({ws.boards?.length || 0})
              </p>

              {ws.boards && ws.boards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ws.boards.map((board) => (
                    <div
                      key={board.id}
                      onClick={() => navigate(`/board/${board.id}`)}
                      className="group p-3.5 rounded-lg bg-[#181b24] border border-[#232634] hover:border-[#383d50] cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[#13151c] border border-[#232634] text-zinc-400 flex items-center justify-center group-hover:text-zinc-200">
                          <Kanban className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                            {board.name}
                          </h4>
                          <p className="text-[11px] text-zinc-500 truncate">
                            {board.description || 'Sprint & task board'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#181b24]/50 border border-dashed border-[#232634] text-center">
                  <p className="text-xs text-zinc-400 mb-1.5">No boards created yet for this workspace.</p>
                  <button
                    onClick={() => setShowCreateBoardModal(ws.id)}
                    className="text-xs text-zinc-300 hover:text-white underline font-medium"
                  >
                    + Create board
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#13151c] rounded-xl shadow-2xl w-full max-w-md border border-[#232634] p-5">
            <h2 className="text-base font-semibold text-white mb-1">New Workspace</h2>
            <p className="text-xs text-zinc-400 mb-4">Create a workspace for your team.</p>
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="input"
                  placeholder="e.g. Core Team"
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
                  placeholder="Workspace description..."
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

      {/* Create Board Modal */}
      {showCreateBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#13151c] rounded-xl shadow-2xl w-full max-w-md border border-[#232634] p-5">
            <h2 className="text-base font-semibold text-white mb-1">Create Board</h2>
            <p className="text-xs text-zinc-400 mb-4">Add a new Kanban board to this workspace.</p>
            <form onSubmit={handleCreateBoardSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Board Name</label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="input"
                  placeholder="e.g. Sprint 24, Infrastructure"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  className="input min-h-[80px] resize-none"
                  placeholder="Board description..."
                  maxLength={500}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#232634]">
                <button
                  type="button"
                  onClick={() => setShowCreateBoardModal(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newBoardName.trim() || createBoard.isPending}
                  className="btn-primary text-xs"
                >
                  {createBoard.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
