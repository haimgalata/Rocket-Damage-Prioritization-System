import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Search, User, LogOut, ChevronDown, X, CheckCheck, Moon, Sun, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useDarkMode } from '../../hooks';
import { useNotificationStore, useSidebarStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
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
  const { events } = useEventStore();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { toggleMobile } = useSidebarStore();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = unreadCount();

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return events
      .filter((e) =>
        (e.name ?? '').toLowerCase().includes(term) ||
        String(e.id).includes(term) ||
        e.description.toLowerCase().includes(term) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(term)) ||
        e.location.address.toLowerCase().includes(term) ||
        e.location.city?.toLowerCase().includes(term)
      )
      .slice(0, 7);
  }, [searchTerm, events]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setSearchOpen(val.trim().length > 0);
  };

  const handleSearchSelect = (eventId: number) => {
    setSearchTerm('');
    setSearchOpen(false);
    setMobileSearchOpen(false);
    navigate(`/events/${eventId}`);
  };

  const SearchResults = () => (
    <div className="absolute top-full mt-1 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
      {searchResults.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-sm">{`אין תוצאות עבור "${searchTerm}"`}</div>
      ) : (
        <div className="py-1">
          {searchResults.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleSearchSelect(ev.id)}
              className="w-full text-right px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-start gap-3"
            >
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${ev.priorityScore >= 7.5 ? 'bg-red-500' : ev.priorityScore >= 5 ? 'bg-orange-500' : 'bg-green-500'}`} />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {ev.name || ev.location.address || `Event #${ev.id}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ev.location.address}</p>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${ev.priorityScore >= 7.5 ? 'text-red-600' : ev.priorityScore >= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                {ev.priorityScore.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="h-14 md:h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 md:px-6 flex items-center justify-between flex-shrink-0 z-40 gap-2">

      {/* Right side: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobile}
          className="md:hidden flex-shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          aria-label="פתח תפריט"
        >
          <Menu className="w-5 h-5" />
        </button>
        {pageTitle && (
          <h1 className="text-base md:text-xl font-semibold text-gray-900 dark:text-white truncate">{pageTitle}</h1>
        )}
      </div>

      {/* Left side: search + icons */}
      <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">

        {/* Desktop search */}
        <div className="hidden md:block relative" ref={searchRef}>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5 w-64">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setSearchTerm(''), setSearchOpen(false))}
              onFocus={() => searchTerm.trim() && setSearchOpen(true)}
              placeholder="חיפוש אירועים..."
              className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full text-right"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setSearchOpen(false); }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchOpen && searchTerm && <SearchResults />}
        </div>

        {/* Mobile search icon */}
        <div className="md:hidden relative" ref={mobileSearchOpen ? searchRef : undefined}>
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <Search className="w-5 h-5" />
          </button>

          {mobileSearchOpen && (
            <div className="absolute left-0 top-10 w-72 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-3">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="חיפוש אירועים..."
                  className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none flex-1 text-right"
                />
              </div>
              {searchTerm && searchResults.length > 0 && (
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {searchResults.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleSearchSelect(ev.id)}
                      className="w-full text-right px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition rounded-lg flex items-start gap-2"
                    >
                      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${ev.priorityScore >= 7.5 ? 'bg-red-500' : ev.priorityScore >= 5 ? 'bg-orange-500' : 'bg-green-500'}`} />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ev.name || ev.location.address}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ev.location.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          title={isDark ? 'מצב בהיר' : 'מצב כהה'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen((v) => !v); setUserMenuOpen(false); }}
            className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 left-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute left-0 top-12 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">התראות</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> סמן הכל
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">אין התראות</div>
                ) : (
                  notifications.map((n) => {
                    const cfg = notifTypeConfig[n.type];
                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`px-4 py-3 border-b border-gray-50 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition ${!n.read ? 'bg-blue-50/40 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-gray-300' : cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>{n.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-1.5 md:gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1.5 md:px-2 py-1 transition"
            >
              {/* Name — hidden on small mobile */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatRole(user.role)}</p>
              </div>
              <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <ChevronDown className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute left-0 top-11 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  הפרופיל שלי
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    התנתק
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
