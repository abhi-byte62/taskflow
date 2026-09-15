import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Loader2, MoreVertical, Trash2, Edit, ChevronDown,
  Users, Flag, Calendar, MessageSquare, X, Check, GripVertical,
  ArrowUpDown, Bell, AlertTriangle, UserCheck, Send, Tag, Trash,
  Activity, Star, RotateCcw, Copy, Download, Maximize2, Minimize2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Column component with sortable tasks
// ─────────────────────────────────────────────────────────────
function Column({ column, tasks, onTaskMove, onAddTask, onEditTask, onDeleteTask, onDeleteColumn }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onTaskMove}
    >
      <SortableContext
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card flex flex-col min-h-[500px] w-72 flex-shrink-0 bg-gray-50">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="p-1 text-gray-300 hover:text-gray-500"
                aria-label="Drag column"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <h3 className="font-semibold text-gray-900">
                {column.name}
              </h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </div>
            <button
              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
              onClick={() => onDeleteColumn(column.id)}
              aria-label="Delete column"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[400px]">
            {tasks.map((task, index) => (
              <SortableTask
                key={task.id}
                task={task}
                index={index}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
            <button
              onClick={() => onAddTask(column.id)}
              className="w-full py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─────────────────────────────────────────────────────────────
// Sortable Task component with keyboard accessibility
// ─────────────────────────────────────────────────────────────
function SortableTask({ task, index, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'card p-3 cursor-grab active:cursor-grabbing transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary-500'
      )}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-grabbed={isDragging}
      aria-label={`Task: ${task.title}, priority ${task.priority}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0"
          aria-label="Drag handle"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={clsx('px-1.5 py-0.5 text-xs rounded', priorityColors[task.priority])}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
              </span>
            )}
            {task.assignees?.length && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Users className="w-3 h-3" />
                {task.assignees.length}
              </span>
            )}
            {task.labels?.length && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Flag className="w-3 h-3" />
                {task.labels.length}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            aria-label="Edit task"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Task Modal (Create/Edit)
// ─────────────────────────────────────────────────────────────
function TaskModal({ task, columnId, onClose, onSubmit, loading }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : '');
  const [assigneeIds, setAssigneeIds] = useState(task?.assignees?.map(a => a.user.id) || []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      columnId: columnId,
      ...(task && { version: task.version }),
    };
    onSubmit(data);
  };

  if (!onClose) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{task ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              required
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[100px] resize-y"
              placeholder="Optional details..."
              maxLength={5000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="label">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label htmlFor="dueDate" className="label">Due date</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                task ? 'Save' : 'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Board Page
// ─────────────────────────────────────────────────────────────
export default function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { joinBoard, leaveBoard, onlineUsers, sendTyping } = useSocket();

  const [columns, setColumns] = useState([]);
  const [modalColumnId, setModalColumnId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  // Column sorting
  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleColumnDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = columns.findIndex(c => c.id === active.id);
    const overIndex = columns.findIndex(c => c.id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const newColumns = Array.from(columns);
    const [removed] = newColumns.splice(activeIndex, 1);
    newColumns.splice(overIndex, 0, removed);

    setColumns(newColumns);

    // Persist new order
    const updates = newColumns.map((col, i) =>
      api.patch(`/columns/${col.id}`, { position: i * 100 })
    );
    Promise.all(updates)
      .then(() => queryClient.invalidateQueries({ queryKey: ['board', boardId] }))
      .catch(() => toast.error('Failed to reorder columns'));
  }, [columns, boardId, queryClient]);

  // Fetch board data (columns + tasks)
  const { data: boardData, isLoading, error } = useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const { data } = await api.get(`/boards/${boardId}/data`);
      return data.data.data;
    },
    enabled: !!boardId,
  });

  // Join/leave socket room
  useEffect(() => {
    if (boardId) joinBoard(boardId);
    return () => { if (boardId) leaveBoard(); };
  }, [boardId, joinBoard, leaveBoard]);

  // Sync board data from server
  useEffect(() => {
    if (boardData) {
      setColumns(boardData.columns || []);
    }
  }, [boardData]);

  // Find task helper needs to handle nested columns.tasks
  const findTaskInBoard = useCallback((cols, taskId) => {
    if (!cols || !Array.isArray(cols)) return null;
    for (const col of cols) {
      // Check both nested tasks and flat tasks arrays for compatibility
      const taskList = col.tasks || [];
      const found = taskList.find(t => t.id === taskId);
      if (found) return found;
    }
    return null;
  }, []);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data) => api.post(`/tasks/board/${boardId}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setModalColumnId(null);
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to create task'),
  });

  // Update task mutation (optimistic)
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previousBoard = queryClient.getQueryData(['board', boardId]);
      queryClient.setQueryData(['board', boardId], (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map(col => ({
            ...col,
            tasks: col.tasks.map(t =>
              t.id === id ? { ...t, ...data, version: (t.version || 1) + 1 } : t
            ),
          })),
        };
      });
      return { previousBoard };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['board', boardId], context?.previousBoard);
      toast.error(err.response?.data?.error?.message || 'Failed to update task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed to delete task'),
  });

  // Move task mutation (handles 409 conflict)
  const moveTaskMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/tasks/${id}/move`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previousBoard = queryClient.getQueryData(['board', boardId]);
      const task = findTaskInBoard(previousBoard, id);
      if (task) {
        queryClient.setQueryData(['board', boardId], (old) => {
          if (!old) return old;
          return {
            ...old,
            columns: old.columns.map(col => ({
              ...col,
              tasks: col.tasks.map(t => {
                if (t.id === id) {
                  const newPos = data.position ?? col.tasks.length * 100;
                  return { ...t, columnId: data.columnId, position: newPos, version: t.version + 1 };
                }
                return t;
              }),
            })),
          };
        });
      }
      return { previousBoard };
    },
    onError: (err, _, context) => {
      if (err.response?.status === 409) {
        toast.error('Task was modified by another user. Refreshing...');
      }
      queryClient.setQueryData(['board', boardId], context?.previousBoard);
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  // Handle drag end
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const targetColumnId = over.id;

    const task = findTaskInBoard(columns, taskId);
    if (!task) return;

    // Find position in target column
    const targetColumn = columns.find(c => c.id === targetColumnId);
    const overTask = over.data.current?.sortable?.index !== undefined
      ? targetColumn?.tasks[over.data.current.sortable.index]
      : null;

    moveTaskMutation.mutate({
      id: taskId,
      data: {
        columnId: targetColumnId,
        version: task.version,
        ...(overTask && { beforeTaskId: overTask.id }),
      },
    });
  }, [columns, moveTaskMutation, findTaskInBoard]);

  // Handlers
  const handleAddTask = (columnId) => {
    setEditingTask(null);
    setModalColumnId(columnId);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
  };

  const handleDeleteTask = (task) => {
    if (confirm('Delete this task?')) {
      deleteTaskMutation.mutate(task.id);
    }
  };

  const handleDeleteColumn = (columnId) => {
    if (confirm('Delete this column and all its tasks?')) {
      api.delete(`/columns/${columnId}`)
        .then(() => queryClient.invalidateQueries({ queryKey: ['board', boardId] }))
        .catch(() => toast.error('Failed to delete column'));
    }
  };

  const handleTaskSubmit = (data) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
      setEditingTask(null);
    } else {
      createTaskMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load board</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col">
      {/* Board Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{boardData?.name || 'Board'}</h1>
          <p className="text-gray-500">{boardData?.description || ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            {onlineUsers.length} online
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={columnSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-x-auto flex gap-4 pb-4">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                tasks={column.tasks || []}
                onTaskMove={handleDragEnd}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onDeleteColumn={handleDeleteColumn}
              />
            ))}
            {/* Add Column */}
            <div className="w-72 flex-shrink-0">
              <div className="card h-[500px] bg-gray-50 border-dashed border-2 border-gray-200 flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                  <button
                    onClick={() => {
                      const name = prompt('Column name:');
                      if (name) {
                        api.post(`/columns/board/${boardId}`, { name })
                          .then(() => queryClient.invalidateQueries({ queryKey: ['board', boardId] }))
                          .catch(() => toast.error('Failed to create column'));
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 flex flex-col items-center gap-2"
                  >
                    <Plus className="w-10 h-10" />
                    <span>Add column</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {/* Task Modal (create or edit) */}
      {(editingTask || modalColumnId) && (
        <TaskModal
          task={editingTask}
          columnId={editingTask?.columnId || modalColumnId}
          onClose={() => { setEditingTask(null); setModalColumnId(null); }}
          onSubmit={handleTaskSubmit}
          loading={createTaskMutation.isPending || updateTaskMutation.isPending}
        />
      )}
    </div>
  );
}