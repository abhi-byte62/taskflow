import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Loader2, MoreVertical, Trash2, Edit,
  Users, Flag, Calendar, MessageSquare, X, Check, GripVertical,
  ArrowUpDown, Bell, Tag, Search, Layers, Kanban
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { PRIORITY_CONFIG, formatDueDate, getInitials } from '../utils/helpers';
import TaskDetailModal from '../components/TaskDetailModal';
import LabelManagerModal from '../components/LabelManagerModal';

// ─────────────────────────────────────────────────────────────
// Task Card Component
// ─────────────────────────────────────────────────────────────
function SortableTaskCard({ task, onClick, isOverlay = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const priorityMeta = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const dueDateInfo = formatDueDate(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(task)}
      className={`group relative bg-[#181b24] hover:bg-[#1e222e] text-zinc-100 rounded-lg p-3 border border-[#232634] hover:border-[#383d50] transition-colors cursor-pointer shadow-sm ${
        isOverlay ? 'border-zinc-400 shadow-2xl bg-[#1e222e] rotate-1 z-50' : ''
      }`}
    >
      {/* Drag handle & title */}
      <div className="flex items-start gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag task"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <h4 className="text-xs font-medium text-zinc-100 leading-snug flex-1 break-words group-hover:text-white transition-colors">
          {task.title}
        </h4>
      </div>

      {/* Description Preview */}
      {task.description && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2.5">
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.labels.map((tl) => (
            <span
              key={tl.label.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${tl.label.color}15`,
                color: tl.label.color,
                border: `1px solid ${tl.label.color}30`,
              }}
            >
              {tl.label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer / Badges */}
      <div className="flex items-center justify-between pt-2 border-t border-[#232634]/80 text-xs">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${priorityMeta.color}`}>
            {priorityMeta.label}
          </span>

          {/* Due date */}
          {dueDateInfo && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] ${
                dueDateInfo.overdue
                  ? 'text-rose-400 font-medium'
                  : 'text-zinc-400'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {dueDateInfo.formatted}
            </span>
          )}
        </div>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-1.5 overflow-hidden">
            {task.assignees.slice(0, 3).map((a) => (
              <div
                key={a.user.id}
                title={a.user.name}
                className="w-5 h-5 rounded-full bg-zinc-700 text-zinc-200 border border-[#181b24] flex items-center justify-center text-[9px] font-medium"
              >
                {getInitials(a.user.name)}
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-[#232634] text-zinc-400 border border-[#181b24] flex items-center justify-center text-[8px] font-medium">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Column Component (Sortable Column + Droppable Container)
// ─────────────────────────────────────────────────────────────
function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onDeleteColumn,
  isOverlay = false,
}) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const handleTaskSubmit = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    onAddTask(column.id, taskTitle.trim());
    setTaskTitle('');
    setIsAddingTask(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col w-80 shrink-0 bg-[#13151c] rounded-xl border border-[#232634] max-h-full ${
        isOverlay ? 'border-zinc-400 shadow-2xl' : ''
      }`}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between border-b border-[#232634] bg-[#181b24]/50 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-zinc-500 hover:text-zinc-200 cursor-grab active:cursor-grabbing rounded"
            aria-label="Drag column"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider truncate">
            {column.name}
          </h3>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#181b24] text-zinc-400 border border-[#232634]">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onDeleteColumn(column.id)}
          className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
          title="Delete column"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Task List (Droppable area) */}
      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[160px] scrollbar-custom"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>
      </div>

      {/* Column Footer — Quick Add */}
      <div className="p-2.5 border-t border-[#232634] bg-[#13151c] rounded-b-xl">
        {isAddingTask ? (
          <form onSubmit={handleTaskSubmit} className="space-y-2 bg-[#181b24] p-2.5 rounded-lg border border-[#232634]">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task name..."
              className="w-full text-xs p-2 rounded-md border border-[#232634] bg-[#13151c] text-white focus:outline-none focus:border-zinc-400"
              autoFocus
            />
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setTaskTitle('');
                }}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!taskTitle.trim()}
                className="btn-primary px-3 py-1 text-xs h-7"
              >
                Add
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#181b24] border border-transparent hover:border-[#232634] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Board Component
// ─────────────────────────────────────────────────────────────
export default function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { joinBoard, leaveBoard, onlineUsers } = useSocket();

  const [activeItem, setActiveItem] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch Board Data
  const { data: boardData, isLoading, error } = useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const { data } = await api.get(`/boards/${boardId}/data`);
      const board = data.data?.data !== undefined ? data.data.data : (data.data || data);
      return board;
    },
    enabled: !!boardId,
  });

  // Socket room connection
  useEffect(() => {
    if (boardId) joinBoard(boardId);
    return () => {
      if (boardId) leaveBoard();
    };
  }, [boardId, joinBoard, leaveBoard]);

  const rawColumns = useMemo(() => boardData?.columns || [], [boardData]);
  const boardLabels = useMemo(() => boardData?.labels || [], [boardData]);
  const boardMembers = useMemo(() => {
    const direct = boardData?.members || [];
    const ws = boardData?.workspace?.members || [];
    const map = new Map();
    [...ws, ...direct].forEach((m) => {
      if (m?.user) map.set(m.user.id, m);
    });
    return Array.from(map.values());
  }, [boardData]);

  // Filter tasks by search query if present
  const columns = useMemo(() => {
    if (!searchQuery.trim()) return rawColumns;
    const query = searchQuery.toLowerCase();
    return rawColumns.map((col) => ({
      ...col,
      tasks: (col.tasks || []).filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          (t.labels && t.labels.some((l) => l.label.name.toLowerCase().includes(query)))
      ),
    }));
  }, [rawColumns, searchQuery]);

  // ── Mutations ──────────────────────────────────────────────
  const createColumnMutation = useMutation({
    mutationFn: (name) => api.post(`/columns/board/${boardId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setNewColumnName('');
      setIsAddingColumn(false);
      toast.success('Column created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create column'),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId) => api.delete(`/columns/${columnId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      toast.success('Column deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete column'),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => api.post(`/tasks/board/${boardId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create task'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setSelectedTask(null);
      toast.success('Task updated');
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        toast.error('Task modified by another collaborator. Refreshing...');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to update task');
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/tasks/${id}/move`, data),
    onError: (err) => {
      if (err.response?.status === 409) {
        toast.error('Concurrency conflict: Reloading board');
      } else {
        toast.error(err.response?.data?.error?.message || 'Failed to move task');
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setSelectedTask(null);
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete task'),
  });

  // ── Drag & Drop Handlers ────────────────────────────────────
  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'Column') {
      const col = rawColumns.find((c) => c.id === active.id);
      setActiveItem({ type: 'Column', data: col });
    } else if (type === 'Task') {
      const allTasks = rawColumns.flatMap((c) => c.tasks || []);
      const t = allTasks.find((item) => item.id === active.id);
      setActiveItem({ type: 'Task', data: t });
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // 1. Column Drag
    if (activeType === 'Column') {
      const activeIdx = rawColumns.findIndex((c) => c.id === active.id);
      const overIdx = rawColumns.findIndex((c) => c.id === over.id);
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        const reordered = Array.from(rawColumns);
        const [moved] = reordered.splice(activeIdx, 1);
        reordered.splice(overIdx, 0, moved);

        // Optimistically update query client
        queryClient.setQueryData(['board', boardId], (old) => ({
          ...old,
          columns: reordered,
        }));

        // Persist new position
        api.patch(`/columns/${moved.id}`, { position: overIdx * 100 }).catch(() => {
          queryClient.invalidateQueries({ queryKey: ['board', boardId] });
        });
      }
      return;
    }

    // 2. Task Drag
    if (activeType === 'Task') {
      const allTasks = rawColumns.flatMap((c) => c.tasks || []);
      const activeTask = allTasks.find((t) => t.id === active.id);
      if (!activeTask) return;

      let targetColumnId = null;
      let beforeTaskId = null;

      if (overType === 'Column') {
        targetColumnId = over.id;
      } else if (overType === 'Task') {
        const overTask = allTasks.find((t) => t.id === over.id);
        if (overTask) {
          targetColumnId = overTask.columnId;
          beforeTaskId = overTask.id;
        }
      }

      if (!targetColumnId) return;

      // Execute move
      moveTaskMutation.mutate({
        id: activeTask.id,
        data: {
          columnId: targetColumnId,
          version: activeTask.version,
          ...(beforeTaskId && { beforeTaskId }),
        },
      });
    }
  };

  // ── Quick Action Handlers ───────────────────────────────────
  const handleQuickAddTask = (columnId, title) => {
    if (title?.trim()) {
      createTaskMutation.mutate({
        title: title.trim(),
        columnId,
      });
    }
  };

  const handleAddColumnSubmit = (e) => {
    e.preventDefault();
    if (newColumnName.trim()) {
      createColumnMutation.mutate(newColumnName.trim());
    }
  };

  const handleDeleteColumn = (columnId) => {
    if (confirm('Delete this column and all contained tasks?')) {
      deleteColumnMutation.mutate(columnId);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        <p className="text-xs text-zinc-400 font-medium">Loading board...</p>
      </div>
    );
  }

  if (error || !boardData) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
          <Flag className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">Failed to load board</h2>
        <p className="text-xs text-zinc-400 mb-4">Board not found or insufficient permissions.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col -mt-2">
      {/* Board Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232634]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {boardData.name}
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#181b24] text-zinc-300 font-medium border border-[#232634]">
              {boardData.workspace?.name || 'Workspace'}
            </span>
          </div>
          {boardData.description && (
            <p className="text-xs text-zinc-400 mt-0.5">{boardData.description}</p>
          )}
        </div>

        {/* Actions & Presence */}
        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-3 py-1 text-xs rounded-lg border border-[#232634] bg-[#13151c] text-zinc-200 focus:outline-none focus:border-zinc-400 w-40 md:w-52 placeholder-zinc-500"
            />
          </div>

          {/* Manage Labels */}
          <button
            onClick={() => setShowLabelModal(true)}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Tag className="w-3.5 h-3.5 text-zinc-400" />
            Labels ({boardLabels.length})
          </button>

          {/* Add Column Button */}
          <button
            onClick={() => setIsAddingColumn(true)}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Column
          </button>

          {/* Live Presence */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#232634]">
            <div className="flex -space-x-1.5">
              {onlineUsers.map((uid) => {
                const member = boardMembers.find((m) => (m.user || m).id === uid);
                const name = member?.user?.name || member?.name || 'User';
                return (
                  <div
                    key={uid}
                    title={`${name} is viewing`}
                    className="w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 border border-[#0c0d12] flex items-center justify-center text-[10px] font-medium"
                  >
                    {getInitials(name)}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{onlineUsers.length} online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pt-4 pb-2 scrollbar-custom">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-start gap-3.5 h-full pb-4">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={column.tasks || []}
                  onTaskClick={(t) => setSelectedTask(t)}
                  onAddTask={handleQuickAddTask}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}

              {/* Add Column Card */}
              <div className="w-80 shrink-0">
                {isAddingColumn ? (
                  <form onSubmit={handleAddColumnSubmit} className="bg-[#13151c] p-3.5 rounded-xl border border-[#232634] space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-200">New column</h4>
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="Column name (e.g. In Review)..."
                      className="w-full text-xs p-2 rounded-lg border border-[#232634] bg-[#181b24] text-white focus:outline-none focus:border-zinc-400"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingColumn(false);
                          setNewColumnName('');
                        }}
                        className="btn-secondary text-xs py-1 px-3 h-7"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newColumnName.trim() || createColumnMutation.isPending}
                        className="btn-primary text-xs py-1 px-3 h-7 flex items-center gap-1.5"
                      >
                        {createColumnMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Create
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full h-24 rounded-xl border border-dashed border-[#232634] hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 hover:bg-[#13151c]/60 flex flex-col items-center justify-center gap-1.5 transition-colors group"
                  >
                    <div className="p-1.5 rounded-md bg-[#181b24] group-hover:bg-[#202430] transition-colors">
                      <Plus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                    </div>
                    <span className="text-xs font-medium">Add Column</span>
                  </button>
                )}
              </div>
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeItem?.type === 'Column' && (
              <KanbanColumn
                column={activeItem.data}
                tasks={activeItem.data.tasks || []}
                onTaskClick={() => {}}
                onAddTask={() => {}}
                onDeleteColumn={() => {}}
                isOverlay
              />
            )}
            {activeItem?.type === 'Task' && (
              <SortableTaskCard task={activeItem.data} onClick={() => {}} isOverlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={rawColumns}
          boardMembers={boardMembers}
          boardLabels={boardLabels}
          boardId={boardId}
          onClose={() => setSelectedTask(null)}
          onUpdate={(id, data) => updateTaskMutation.mutate({ id, data })}
          onDelete={(task) => {
            if (confirm(`Delete task "${task.title}"?`)) {
              deleteTaskMutation.mutate(task.id);
            }
          }}
        />
      )}

      {/* Label Manager Modal */}
      {showLabelModal && (
        <LabelManagerModal
          boardId={boardId}
          labels={boardLabels}
          onClose={() => setShowLabelModal(false)}
        />
      )}
    </div>
  );
}