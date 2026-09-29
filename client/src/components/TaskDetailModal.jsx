import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, Users, Flag, Tag, Trash2, MessageSquare,
  Activity, Check, Clock, Send, Loader2, UserCheck, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PRIORITY_CONFIG, formatRelativeTime, getInitials } from '../utils/helpers';

export default function TaskDetailModal({
  task,
  columns = [],
  boardMembers = [],
  boardLabels = [],
  boardId,
  onClose,
  onUpdate,
  onDelete,
}) {
  const { user } = useAuth();
  const { sendTyping, typingUsers } = useSocket();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments' | 'activity'
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [columnId, setColumnId] = useState(task?.columnId || columns[0]?.id || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : '');
  const [assigneeIds, setAssigneeIds] = useState(task?.assignees?.map((a) => a.user.id) || []);
  const [labelIds, setLabelIds] = useState(task?.labels?.map((l) => l.label.id) || []);
  const [newComment, setNewComment] = useState('');

  // Fetch comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', task?.id],
    queryFn: async () => {
      const { data } = await api.get(`/comments/task/${task.id}`);
      return data.data?.data !== undefined ? data.data.data : (data.data || []);
    },
    enabled: !!task?.id,
  });

  // Fetch task activity log
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activity', task?.id],
    queryFn: async () => {
      const { data } = await api.get(`/activity/task/${task.id}`);
      return data.data?.data !== undefined ? data.data.data : (data.data || []);
    },
    enabled: !!task?.id && activeTab === 'activity',
  });

  // Comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (content) => api.post(`/comments/task/${task.id}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', task.id] });
      setNewComment('');
      toast.success('Comment posted');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to post comment');
    },
  });

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleCommentChange = (e) => {
    setNewComment(e.target.value);
    sendTyping(boardId, task.id);
  };

  const isTyping = typingUsers[task?.id]?.length > 0;

  const toggleAssignee = (uid) => {
    setAssigneeIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleLabel = (lid) => {
    setLabelIds((prev) =>
      prev.includes(lid) ? prev.filter((id) => id !== lid) : [...prev, lid]
    );
  };

  const handleSave = (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      columnId,
      priority,
      dueDate: dueDate || null,
      assigneeIds,
      labelIds,
      version: task.version,
    };

    onUpdate(task.id, payload);
  };

  const priorityMeta = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#13151c] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-[#232634] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#232634] flex items-center justify-between bg-[#181b24]">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-4">
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded border ${priorityMeta.color}`}>
              {priorityMeta.label}
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-400 truncate">
              Column: <span className="text-zinc-200 font-medium">{columns.find((c) => c.id === columnId)?.name || 'Column'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onDelete(task)}
              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-[#202430] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#232634] px-5 gap-6 bg-[#13151c] text-xs font-medium">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'details'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments
            {comments.length > 0 && (
              <span className="bg-[#181b24] text-zinc-300 border border-[#232634] px-1.5 py-0.2 rounded-full text-[10px]">
                {comments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'border-white text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-custom">
          {activeTab === 'details' && (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm font-semibold px-3 py-2 border border-[#232634] rounded-lg bg-[#181b24] text-white focus:outline-none focus:border-zinc-400"
                  placeholder="Task title..."
                  required
                  maxLength={200}
                />
              </div>

              {/* Grid Properties */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#181b24] border border-[#232634]">
                {/* Column / Status */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Status
                  </label>
                  <select
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-[#232634] bg-[#13151c] text-zinc-200 focus:outline-none focus:border-zinc-400"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-[#232634] bg-[#13151c] text-zinc-200 focus:outline-none focus:border-zinc-400"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-[#232634] bg-[#13151c] text-zinc-200 focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="input min-h-[90px] resize-y"
                  placeholder="Add details or notes for this task..."
                  maxLength={5000}
                />
              </div>

              {/* Assignees Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Assignees ({assigneeIds.length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {boardMembers.map((m) => {
                    const memberUser = m.user || m;
                    const isAssigned = assigneeIds.includes(memberUser.id);
                    return (
                      <button
                        key={memberUser.id}
                        type="button"
                        onClick={() => toggleAssignee(memberUser.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isAssigned
                            ? 'bg-zinc-800 border-zinc-500 text-white'
                            : 'bg-[#181b24] border-[#232634] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center text-[9px] font-bold">
                          {getInitials(memberUser.name)}
                        </div>
                        <span>{memberUser.name}</span>
                        {isAssigned && <Check className="w-3 h-3 text-zinc-300 ml-0.5" />}
                      </button>
                    );
                  })}
                  {boardMembers.length === 0 && (
                    <p className="text-xs text-zinc-500 italic">No team members assigned to this board.</p>
                  )}
                </div>
              </div>

              {/* Labels Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Labels ({labelIds.length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {boardLabels.map((lbl) => {
                    const isSelected = labelIds.includes(lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => toggleLabel(lbl.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-opacity ${
                          isSelected
                            ? 'border-zinc-300 text-white opacity-100'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${lbl.color}15`,
                          borderColor: isSelected ? '#a1a1aa' : lbl.color,
                          color: lbl.color,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                        <span>{lbl.name}</span>
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                  {boardLabels.length === 0 && (
                    <p className="text-xs text-zinc-500 italic">No labels created for this board.</p>
                  )}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Comment Input */}
              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <div className="relative">
                  <textarea
                    value={newComment}
                    onChange={handleCommentChange}
                    rows={3}
                    placeholder="Write a comment..."
                    className="input resize-none pb-10"
                    maxLength={2000}
                  />
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || createCommentMutation.isPending}
                      className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5 h-7"
                    >
                      {createCommentMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Comment
                    </button>
                  </div>
                </div>
                {isTyping && (
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    Someone is typing...
                  </p>
                )}
              </form>

              {/* Comments Thread */}
              <div className="space-y-2.5 pt-1">
                {commentsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500">
                    <MessageSquare className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-zinc-400" />
                    <p className="text-xs">No comments yet.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex items-start gap-2.5 p-3 rounded-lg bg-[#181b24] border border-[#232634]"
                    >
                      <div className="w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 border border-zinc-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {getInitials(comment.author?.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-zinc-200">
                            {comment.author?.name || 'User'}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activitiesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-6 text-zinc-500">
                  <Activity className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-zinc-400" />
                  <p className="text-xs">No activity recorded for this task.</p>
                </div>
              ) : (
                <div className="relative border-l border-[#232634] ml-3 pl-3.5 space-y-4">
                  {activities.map((act) => (
                    <div key={act.id} className="relative group">
                      <div className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-zinc-400" />
                      <div>
                        <p className="text-xs text-zinc-200">
                          <span className="font-semibold text-zinc-100">{act.actor?.name || 'User'}</span>{' '}
                          <span className="text-zinc-400">{act.detail || act.action}</span>
                        </p>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatRelativeTime(act.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#181b24] border-t border-[#232634] flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            v{task.version || 1}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary text-xs">
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
