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
      return data.data.data;
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
      const board = res.data?.data;
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
        <h2 className="text-xl font-semibold text-red-800">Error loading workspaces</h2>
        <p className="text-red-600 mt-2">{error.message}</p>
      </div>
    );
  }

  const workspaces = workspacesData || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-gray-600">Manage your organizations and their Kanban boards</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-base font-semibold text-gray-900">No workspaces</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new workspace.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-50 rounded-lg text-primary-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{workspace.name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {workspace.description || 'No description'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateBoardModal(workspace.id)}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Board
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete workspace "${workspace.name}"?`)) {
                        deleteWorkspace.mutate(workspace.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                    title="Delete Workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Boards in this workspace */}
              <div className="p-6 bg-gray-50/50">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Boards in this workspace
                </h3>
                {workspace.boards && workspace.boards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {workspace.boards.map((board) => (
                      <div
                        key={board.id}
                        onClick={() => navigate(`/board/${board.id}`)}
                        className="bg-white p-4 rounded-lg border border-gray-200 hover:border-primary-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Kanban className="w-4 h-4 text-primary-600" />
                          <h4 className="font-semibold text-gray-900 truncate">{board.name}</h4>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1 mb-3">
                          {board.description || 'Kanban board'}
                        </p>
                        <div className="flex items-center justify-between text-xs font-medium text-primary-600 pt-2 border-t border-gray-100">
                          <span>Open Board</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-white rounded-lg border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No boards yet.</p>
                    <button
                      onClick={() => setShowCreateBoardModal(workspace.id)}
                      className="mt-2 text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      + Create the first board
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Workspace</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="label">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="input"
                  placeholder="e.g. Design Team"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  rows={3}
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className="input"
                  placeholder="Workspace description..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWorkspace.isPending || !newWorkspaceName.trim()}
                  className="btn-primary"
                >
                  {createWorkspace.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Board Modal */}
      {showCreateBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Board</h2>
            <form onSubmit={handleCreateBoardSubmit} className="space-y-4">
              <div>
                <label className="label">Board Name</label>
                <input
                  type="text"
                  required
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="input"
                  placeholder="e.g. Sprint 24"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  rows={3}
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  className="input"
                  placeholder="Board description..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBoardModal(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBoard.isPending || !newBoardName.trim()}
                  className="btn-primary"
                >
                  {createBoard.isPending ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
