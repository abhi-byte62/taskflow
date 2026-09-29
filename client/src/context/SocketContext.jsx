import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [notifications, setNotifications] = useState([]);
  const currentBoardRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws').replace(/:5173$/, ':5000') : 'http://localhost:5000');

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    newSocket.on('presence.joined', ({ users, user: joinedUser }) => {
      setOnlineUsers(users);
      if (joinedUser) {
        setNotifications((prev) => [
          {
            id: `presence-${Date.now()}`,
            type: 'info',
            message: `${joinedUser.name} joined the board`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    newSocket.on('presence.left', ({ users }) => {
      setOnlineUsers(users);
    });

    newSocket.on('task.created', ({ task }) => {
      if (task) {
        setNotifications((prev) => [
          {
            id: `task-created-${task.id}-${Date.now()}`,
            type: 'success',
            message: `New task created: ${task.title}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    newSocket.on('task.updated', ({ task }) => {
      if (task) {
        setNotifications((prev) => [
          {
            id: `task-updated-${task.id}-${Date.now()}`,
            type: 'info',
            message: `Task updated: ${task.title}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    newSocket.on('task.moved', ({ task }) => {
      if (task) {
        setNotifications((prev) => [
          {
            id: `task-moved-${task.id}-${Date.now()}`,
            type: 'info',
            message: `Task moved: ${task.title}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    newSocket.on('task.deleted', ({ taskId }) => {
      setNotifications((prev) => [
        {
          id: `task-deleted-${taskId}-${Date.now()}`,
          type: 'warning',
          message: 'A task was deleted',
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
    });

    newSocket.on('comment.created', ({ comment }) => {
      setNotifications((prev) => [
        {
          id: `comment-${comment.id}-${Date.now()}`,
          type: 'info',
          message: `New comment on task`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
    });

    newSocket.on('comment.typing', ({ userId, taskId }) => {
      if (userId !== user.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [taskId]: Array.from(new Set([...(prev[taskId] || []), userId])),
        }));
        setTimeout(() => {
          setTypingUsers((prev) => ({
            ...prev,
            [taskId]: (prev[taskId] || []).filter((id) => id !== userId),
          }));
        }, 3000);
      }
    });

    newSocket.on('notification.created', (notification) => {
      setNotifications((prev) => [notification, ...prev.slice(0, 19)]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const joinBoard = useCallback(
    (boardId) => {
      if (socket && currentBoardRef.current !== boardId) {
        if (currentBoardRef.current) {
          socket.emit('board:leave', currentBoardRef.current);
        }
        socket.emit('board:join', boardId);
        currentBoardRef.current = boardId;
      }
    },
    [socket]
  );

  const leaveBoard = useCallback(() => {
    if (socket && currentBoardRef.current) {
      socket.emit('board:leave', currentBoardRef.current);
      currentBoardRef.current = null;
      setOnlineUsers([]);
    }
  }, [socket]);

  const sendTyping = useCallback(
    (boardId, taskId) => {
      if (socket) {
        socket.emit('comment:typing', { boardId, taskId });
      }
    },
    [socket]
  );

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const value = {
    socket,
    onlineUsers,
    typingUsers,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    joinBoard,
    leaveBoard,
    sendTyping,
    markNotificationRead,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
