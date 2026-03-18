import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Settings, Users,
  LogOut, ChevronDown, Building2, FileText, BarChart3, UserCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks';
import { UserRole } from '../../types';
import { formatRole, getInitials } from '../../utils/helpers';

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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const navigationItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    },
    {
      label: 'Events',
      path: '/admin/events',
      icon: <FileText className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    },
    {
      label: 'New Event',
      path: '/operator/new-event',
      icon: <FileText className="w-5 h-5" />,
      roles: [UserRole.OPERATOR],
    },
    {
      label: 'Organizations',
      path: '/super-admin/organizations',
      icon: <Building2 className="w-5 h-5" />,
      roles: [UserRole.SUPER_ADMIN],
    },
    {
      label: 'Management',
      path: '__management__',
      icon: <Settings className="w-5 h-5" />,
      roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
      children: [
        {
          label: 'Users',
          path: '/admin/users',
          icon: <Users className="w-4 h-4" />,
          roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
        {
          label: 'AI Models',
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
      setIsMobileOpen(false);
    }
  };

  const isActive = (path: string): boolean => location.pathname.startsWith(path);

  const handleLogout = () => logoutUser();

  // Clicking the logo/brand → go to role-appropriate home
  const handleBrandClick = () => {
    if (user?.role === UserRole.SUPER_ADMIN) navigate('/super-admin/organizations');
    else if (user?.role === UserRole.ADMIN) navigate('/admin/dashboard');
    else navigate('/operator/new-event');
  };

  // Clicking the user avatar → go to profile
  const handleProfileClick = () => {
    navigate('/profile');
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed md:hidden top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen bg-gradient-to-b from-blue-50 to-gray-50
          border-r border-gray-200 shadow-lg transition-all duration-300 z-40
          flex flex-col
          ${isOpen ? 'w-64' : 'w-20'}
          md:static md:h-screen md:translate-x-0 md:z-auto md:flex-shrink-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header — click brand to go home */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 h-16">
          <button
            onClick={handleBrandClick}
            className={`flex items-center gap-3 hover:opacity-80 transition ${!isOpen && 'justify-center w-full'}`}
          >
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              PA
            </div>
            {isOpen && <span className="font-bold text-lg text-gray-800">PrioritAI</span>}
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:block p-1 hover:bg-gray-200 rounded-lg transition ml-auto"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* User Profile Section — click avatar → /profile */}
        {isOpen && user && (
          <button
            onClick={handleProfileClick}
            className="p-4 border-b border-gray-200 bg-white mx-2 mt-2 rounded-lg hover:bg-blue-50 transition text-left w-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{formatRole(user.role)}</p>
              </div>
              <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          </button>
        )}

        {/* Collapsed — show avatar icon that goes to profile */}
        {!isOpen && user && (
          <button
            onClick={handleProfileClick}
            className="flex items-center justify-center mt-3 mx-auto w-10 h-10 bg-blue-600 rounded-full text-white font-bold text-sm hover:bg-blue-700 transition"
            title="My Profile"
          >
            {getInitials(user.name)}
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-2">
            {visibleItems.map((item) => {
              const navItemClass = `
                flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 w-full text-left
                ${item.children
                  ? expandedMenu === item.path || item.children.some((c) => isActive(c.path))
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-200'
                  : isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-200'
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
                <li key={item.path}>
                  {item.children ? (
                    <button className={navItemClass} onClick={() => handleNavClick(item)}>
                      {navContent}
                    </button>
                  ) : (
                    <Link to={item.path} onClick={() => handleNavClick(item)} className={navItemClass}>
                      {navContent}
                    </Link>
                  )}

                  {item.children && expandedMenu === item.path && isOpen && (
                    <ul className="mt-1 ml-3 space-y-1 border-l-2 border-blue-300 pl-2">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            to={child.path}
                            onClick={() => setIsMobileOpen(false)}
                            className={`
                              flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                              ${isActive(child.path)
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'}
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

        {/* Footer — Logout */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all ${isOpen ? '' : 'justify-center'}`}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {isOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;