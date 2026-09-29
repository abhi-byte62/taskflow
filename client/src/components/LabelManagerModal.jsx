import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Tag, Loader2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PRESET_LABEL_COLORS } from '../utils/helpers';

export default function LabelManagerModal({ boardId, labels = [], onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_LABEL_COLORS[0]);

  const createLabel = useMutation({
    mutationFn: (data) => api.post(`/labels/board/${boardId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setName('');
      toast.success('Label created');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create label');
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (id) => api.delete(`/labels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      toast.success('Label deleted');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete label');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createLabel.mutate({ name: name.trim(), color });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#13151c] rounded-xl shadow-2xl w-full max-w-md border border-[#232634] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#232634] flex items-center justify-between bg-[#181b24]">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">Manage Labels</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#202430] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Create Label Form */}
          <form onSubmit={handleSubmit} className="space-y-3 bg-[#181b24] p-3.5 rounded-lg border border-[#232634]">
            <h3 className="text-xs font-semibold text-zinc-300">Create new label</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Label name (e.g. Bug, Feature)..."
                className="input flex-1 text-xs"
                maxLength={50}
              />
              <button
                type="submit"
                disabled={!name.trim() || createLabel.isPending}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
              >
                {createLabel.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
            </div>

            {/* Color Palette */}
            <div>
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESET_LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      color === c
                        ? 'scale-110 ring-2 ring-offset-2 ring-offset-[#181b24] ring-zinc-300'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Existing Labels List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400">Existing Labels ({labels.length})</h3>
            {labels.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center italic">No labels created yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-custom">
                {labels.map((lbl) => (
                  <div
                    key={lbl.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#181b24] border border-[#232634]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                      <span className="text-xs font-medium text-zinc-200">{lbl.name}</span>
                    </div>
                    <button
                      onClick={() => deleteLabel.mutate(lbl.id)}
                      disabled={deleteLabel.isPending}
                      className="p-1 text-zinc-500 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors"
                      title="Delete label"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#181b24] border-t border-[#232634] flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
