import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  LayoutDashboard,
  FolderKanban,
  Bell,
  Menu,
  X,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { getInitials } from '../utils/helpers';

export default function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount, notifications: socketNotifications, markNotificationRead } = useSocket();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    setNotifications(socketNotifications);
  }, [socketNotifications]);

  const markAsRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
      markNotificationRead(notification.id);
    }
    setNotificationsOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
    setNotificationsOpen(false);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Workspaces', href: '/workspaces', icon: FolderKanban },
  ];

  return (
    <div className="min-h-screen bg-[#0c0d12] text-[#e2e4ea] flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#13151c] border-r border-[#232634] flex flex-col transform transition-transform duration-150 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#232634]">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100 font-bold text-xs shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">TaskFlow</span>
          </Link>
          <button
            className="lg:hidden p-1 text-[#9ca3af] hover:text-white rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
          <p className="px-2.5 text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider mb-2">
            Navigation
          </p>
          {navigation.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#1e222e] text-white font-semibold border border-[#2c3040]'
                    : 'text-[#9ca3af] hover:bg-[#181b24] hover:text-[#f3f4f6]'
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? 'text-zinc-200' : 'text-[#6b7280]'}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-[#232634]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#181b24] border border-[#232634]">
            <div className="w-6 h-6 bg-zinc-700 text-zinc-100 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-[#6b7280] truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-[#0c0d12]/90 backdrop-blur-md border-b border-[#232634] px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 text-[#9ca3af] hover:text-white rounded-lg hover:bg-[#181b24]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#6b7280]">
              <span>TaskFlow</span>
              <span>/</span>
              <span className="text-[#e2e4ea] capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notifications */}
            <div className="relative">
              <button
                className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#181b24] transition-colors relative"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (!notificationsOpen) setUserMenuOpen(false);
                }}
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-[#181b24] rounded-xl shadow-xl border border-[#2c3040] py-1 z-50 max-h-96 flex flex-col overflow-hidden text-xs">
                    <div className="px-3.5 py-2.5 border-b border-[#232634] flex items-center justify-between bg-[#13151c]">
                      <span className="font-semibold text-white">Notifications</span>
                      {notifications.filter((n) => !n.read).length > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] text-zinc-300 hover:text-white underline font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-[#6b7280]">No new notifications</div>
                    ) : (
                      <div className="overflow-y-auto max-h-72 divide-y divide-[#232634]">
                        {notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`w-full p-3 text-left hover:bg-[#1f222e] transition-colors flex items-start gap-2.5 ${
                              !n.read ? 'bg-zinc-800/40' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${!n.read ? 'font-medium text-white' : 'text-[#9ca3af]'}`}>
                                {n.message}
                              </p>
                              <span className="text-[10px] text-[#6b7280] mt-0.5 block">
                                {new Date(n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {!n.read && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg bg-[#181b24] hover:bg-[#1f222e] border border-[#2c3040] transition-colors"
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  if (!userMenuOpen) setNotificationsOpen(false);
                }}
              >
                <div className="w-5 h-5 bg-zinc-700 text-zinc-100 rounded text-[10px] font-bold flex items-center justify-center">
                  {getInitials(user?.name)}
                </div>
                <span className="text-xs font-medium text-[#f3f4f6] max-w-[120px] truncate hidden sm:block">
                  {user?.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#6b7280]" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="dropdown">
                    <div className="px-3 py-2 border-b border-[#232634]">
                      <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-[10px] text-[#6b7280] truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#9ca3af] hover:text-white hover:bg-[#1f222e]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Dashboard
                    </Link>
                    <Link
                      to="/workspaces"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#9ca3af] hover:text-white hover:bg-[#1f222e]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <FolderKanban className="w-3.5 h-3.5" />
                      Workspaces
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}