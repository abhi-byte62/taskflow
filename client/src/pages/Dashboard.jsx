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
      const newWs = res.data?.data;
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700 font-medium">Failed to load workspaces</p>
        <p className="text-sm text-red-500 mt-1">{error.message}</p>
      </div>
    );
  }

  const workspaces = workspacesData || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your workspaces and collaborative boards</p>
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
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces yet</h3>
          <p className="text-gray-500 mb-6">Create your first workspace to start collaborating on tasks</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                className="card p-6 hover:shadow-md transition-all group cursor-pointer border border-gray-200 hover:border-primary-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                      <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <button
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                    {workspace.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {workspace.description || 'No description provided'}
                  </p>

                  {workspace.boards && workspace.boards.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Boards</p>
                      <div className="flex flex-wrap gap-1.5">
                        {workspace.boards.map((board) => (
                          <span
                            key={board.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/board/${board.id}`);
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-700 rounded-md transition-colors inline-flex items-center gap-1"
                          >
                            {board.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                  <span className="text-xs text-gray-500">
                    {workspace.boards?.length || 0} board{workspace.boards?.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-sm font-medium text-primary-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    Open <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Workspace</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label htmlFor="workspaceName" className="label">Workspace name</label>
                <input
                  id="workspaceName"
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="input"
                  placeholder="e.g., Engineering Team"
                  autoFocus
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="workspaceDesc" className="label">Description (optional)</label>
                <textarea
                  id="workspaceDesc"
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="What is this workspace for?"
                  maxLength={500}
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
                  {createWorkspace.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Workspace'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
