import { formatDistanceToNow, format, isPast, isToday } from 'date-fns';

export const PRIORITY_CONFIG = {
  LOW: {
    label: 'Low',
    color: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60',
    dot: '#71717a',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: '#60a5fa',
  },
  HIGH: {
    label: 'High',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: '#f59e0b',
  },
  URGENT: {
    label: 'Urgent',
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    dot: '#f43f5e',
  },
};

export const PRESET_LABEL_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#64748b', // Slate
];

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatDueDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const formatted = format(date, 'MMM d');
  const overdue = isPast(date) && !isToday(date);
  return { formatted, overdue };
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}
