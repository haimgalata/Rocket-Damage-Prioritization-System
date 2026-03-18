import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, LogOut, Settings, ChevronDown, X, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useNotificationStore } from '../../store/authStore';
import { getInitials, formatRole, formatTimeAgo } from '../../utils/helpers';

interface NavbarProps {
  pageTitle?: string;
}

const notifTypeConfig = {
  critical: { bg: 'bg-red-100', dot: 'bg-red-500', text: 'text-red-700' },
  warning:  { bg: 'bg-orange-100', dot: 'bg-orange-500', text: 'text-orange-700' },
  success:  { bg: 'bg-green-100', dot: 'bg-green-500', text: 'text-green-700' },
  info:     { bg: 'bg-blue-100', dot: 'bg-blue-500', text: 'text-blue-700' },
};

export const Navbar: React.FC<NavbarProps> = ({ pageTitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = unreadCount();

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 z-40">
      <div className="flex items-center gap-3">
        {pageTitle && (
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 w-56">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
          />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">No notifications</div>
                ) : (
                  notifications.map((n) => {
                    const cfg = notifTypeConfig[n.type];
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${!n.read ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-gray-300' : cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                            {n.type}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-2 pl-3 border-l border-gray-200 hover:bg-gray-50 rounded-lg px-2 py-1 transition"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{formatRole(user.role)}</p>
                {user.jobTitle && <p className="text-[10px] text-blue-500 truncate max-w-[120px]">{user.jobTitle}</p>}
              </div>
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {getInitials(user.name)}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  {user.jobTitle && (
                    <p className="text-xs text-blue-600 mt-0.5">{user.jobTitle}</p>
                  )}
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  My Profile
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Account Settings
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};