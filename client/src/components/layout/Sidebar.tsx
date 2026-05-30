import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Users,
  LogOut, ChevronDown, Building2, FileText, BarChart3, UserCircle,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../hooks';
import { UserRole } from '../../types';
import { formatRole, getInitials } from '../../utils/helpers';
import { useSidebarStore } from '../../store/authStore';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
  badge?: string;
  children?: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { user, hasRole, logoutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const { mobileOpen, closeMobile } = useSidebarStore();

  const navigationItems: NavItem[] = [
    {
      label: 'לוח בקרה',
      path: '/super-admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: [UserRole.SUPER_ADMIN],
    },
    {
      label: 'ארגונים',
      path: '/super-admin/organizations',
      icon: <Building2 className="w-5 h-5" />,
      roles: [UserRole.SUPER_ADMIN],
    },
    {
      label: 'לוח בקרה',
      path: '/admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: [UserRole.ADMIN],
    },
    {
      label: 'אירועים',
      path: '/admin/events',
      icon: <FileText className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR],
    },
    {
      label: 'אירוע חדש',
      path: '/operator/events/new',
      icon: <FileText className="w-5 h-5" />,
      roles: [UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
    },
    {
      label: 'לוח בקרה',
      path: '/operator/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: [UserRole.OPERATOR],
    },
    {
      label: 'ניהול',
      path: '__management__',
      icon: <Settings className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
      children: [
        {
          label: 'משתמשים',
          path: '/admin/users',
          icon: <Users className="w-4 h-4" />,
          roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
        {
          label: 'מודלי AI',
          path: '/admin/models',
          icon: <BarChart3 className="w-4 h-4" />,
          roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
      ],
    },
  ];

  const visibleItems = navigationItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  const handleNavClick = (item: NavItem) => {
    if (item.children) {
      setExpandedMenu(expandedMenu === item.path ? null : item.path);
    } else {
      closeMobile();
    }
  };

  const isActive = (path: string): boolean => {
    if (path === '/admin/events' && location.pathname.startsWith('/events/')) return true;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const handleBrandClick = () => {
    if (user?.role === UserRole.SUPER_ADMIN) navigate('/super-admin/dashboard');
    else if (user?.role === UserRole.ADMIN) navigate('/admin/dashboard');
    else navigate('/operator/dashboard');
    closeMobile();
  };

  const handleProfileClick = () => {
    navigate('/profile');
    closeMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`
          fixed right-0 top-0 h-screen bg-gradient-to-b from-blue-50 to-gray-50
          dark:from-gray-900 dark:to-gray-800
          border-l border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 z-40
          flex flex-col
          ${isOpen ? 'w-64' : 'w-20'}
          md:static md:h-screen md:translate-x-0 md:z-auto md:flex-shrink-0
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 h-16">
          <button
            onClick={handleBrandClick}
            className={`flex items-center gap-3 hover:opacity-80 transition ${!isOpen && 'justify-center w-full'}`}
          >
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              PA
            </div>
            {isOpen && <span className="font-bold text-lg text-gray-800 dark:text-white">PrioritAI</span>}
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:block p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition mr-auto"
            title={isOpen ? 'כווץ' : 'הרחב'}
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          {/* Mobile close button */}
          <button
            onClick={closeMobile}
            className="md:hidden p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* User profile card */}
        {isOpen && user && (
          <button
            onClick={handleProfileClick}
            className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mx-2 mt-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition w-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{formatRole(user.role)}</p>
              </div>
              <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          </button>
        )}

        {!isOpen && user && (
          <button
            onClick={handleProfileClick}
            className="flex items-center justify-center mt-3 mx-auto w-10 h-10 bg-blue-600 rounded-full text-white font-bold text-sm hover:bg-blue-700 transition"
            title="הפרופיל שלי"
          >
            {getInitials(user.name)}
          </button>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const navItemClass = `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full
                ${item.children
                  ? expandedMenu === item.path || item.children.some((c) => isActive(c.path))
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `;
              const navContent = (
                <>
                  <span className="flex-shrink-0">{item.icon}</span>
                  {isOpen && (
                    <>
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
                      {item.children && (
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${expandedMenu === item.path ? 'rotate-180' : ''}`}
                        />
                      )}
                    </>
                  )}
                </>
              );

              return (
                <li key={item.path + item.label}>
                  {item.children ? (
                    <button type="button" className={navItemClass} onClick={() => handleNavClick(item)}>
                      {navContent}
                    </button>
                  ) : (
                    <Link to={item.path} onClick={() => handleNavClick(item)} className={navItemClass}>
                      {navContent}
                    </Link>
                  )}

                  {item.children && expandedMenu === item.path && isOpen && (
                    <ul className="mt-1 mr-3 space-y-1 border-r-2 border-blue-300 dark:border-blue-700 pr-2">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            to={child.path}
                            onClick={() => { closeMobile(); }}
                            className={`
                              flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                              ${isActive(child.path)
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
                            `}
                          >
                            <span className="flex-shrink-0">{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all ${isOpen ? '' : 'justify-center'}`}
            title="התנתק"
          >
            <LogOut className="w-5 h-5" />
            {isOpen && <span className="text-sm font-medium">התנתק</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
