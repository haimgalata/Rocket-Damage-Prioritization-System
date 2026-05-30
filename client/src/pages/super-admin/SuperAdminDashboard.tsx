import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Users, FileText, ChevronRight } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { fetchOrganizations } from '../../api/organizations';
import { fetchUsers } from '../../api/auth';
import { fetchEvents } from '../../api/events';
import { EventStatus } from '../../types';
import type { Organization } from '../../types';
import type { User } from '../../types';
import type { DamageEvent } from '../../types';
import { getStatusLabel } from '../../utils/helpers';

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<DamageEvent[]>([]);
  const [statusModal, setStatusModal] = useState<{ label: string; events: DamageEvent[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, u, e] = await Promise.all([fetchOrganizations(), fetchUsers(), fetchEvents()]);
        if (!cancelled) {
          setOrgs(o);
          setUsers(u);
          setEvents(e);
        }
      } catch {
        if (!cancelled) {
          setOrgs([]);
          setUsers([]);
          setEvents([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byStatus = useMemo(() => ({
    new: events.filter((e) => e.status === EventStatus.NEW),
    inProgress: events.filter((e) => e.status === EventStatus.IN_PROGRESS),
    done: events.filter((e) => e.status === EventStatus.DONE),
  }), [events]);

  return (
    <PageContainer title="לוח בקרה">
      {/* ── Top 3 nav cards ─────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {[
          {
            title: 'ארגונים',
            count: orgs.length,
            sub: 'ארגונים רשומים',
            icon: <Building2 className="w-6 h-6 text-blue-600" />,
            iconBg: 'bg-blue-100 dark:bg-blue-900/40',
            chevronColor: 'group-hover:text-blue-500',
            route: '/super-admin/organizations',
          },
          {
            title: 'משתמשים',
            count: users.length,
            sub: 'כל התפקידים',
            icon: <Users className="w-6 h-6 text-violet-600" />,
            iconBg: 'bg-violet-100 dark:bg-violet-900/40',
            chevronColor: 'group-hover:text-violet-500',
            route: '/admin/users',
          },
          {
            title: 'אירועים',
            count: events.length,
            sub: 'סה״כ אירועי נזק',
            icon: <FileText className="w-6 h-6 text-amber-600" />,
            iconBg: 'bg-amber-100 dark:bg-amber-900/40',
            chevronColor: 'group-hover:text-amber-500',
            route: '/admin/events',
          },
        ].map(({ title, count, sub, icon, iconBg, chevronColor, route }) => (
          <div
            key={title}
            onClick={() => navigate(route)}
            className="cursor-pointer group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
            </div>
            <div className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{sub}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition scale-x-[-1] ${chevronColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Status breakdown (clickable) ────────────────────────────── */}
      <div className="max-w-5xl mx-auto mt-6">
        <Card title="אירועים לפי סטטוס" subtitle="לחץ על סטטוס לצפייה באירועים">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {[
              {
                evts: byStatus.new,
                status: EventStatus.NEW,
                bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                textNum: 'text-yellow-800 dark:text-yellow-400',
                textLbl: 'text-yellow-700 dark:text-yellow-500',
              },
              {
                evts: byStatus.inProgress,
                status: EventStatus.IN_PROGRESS,
                bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                textNum: 'text-blue-800 dark:text-blue-400',
                textLbl: 'text-blue-700 dark:text-blue-500',
              },
              {
                evts: byStatus.done,
                status: EventStatus.DONE,
                bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30',
                textNum: 'text-green-800 dark:text-green-400',
                textLbl: 'text-green-700 dark:text-green-500',
              },
            ].map(({ evts, status, bg, textNum, textLbl }) => (
              <button
                key={status}
                onClick={() => setStatusModal({ label: getStatusLabel(status), events: evts })}
                className={`rounded-lg border p-4 text-right transition cursor-pointer ${bg}`}
              >
                <p className={`text-2xl font-bold ${textNum}`}>{evts.length}</p>
                <p className={`text-xs mt-1 ${textLbl}`}>{getStatusLabel(status)}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Status events modal ─────────────────────────────────────── */}
      <Modal
        isOpen={statusModal !== null}
        onClose={() => setStatusModal(null)}
        title={statusModal ? `${statusModal.label} (${statusModal.events.length})` : ''}
        size="md"
      >
        {statusModal && (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {statusModal.events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">אין אירועים בסטטוס זה.</p>
            ) : (
              statusModal.events.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  onClick={() => setStatusModal(null)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group"
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 scale-x-[-1]" />
                    <span className={`text-xs font-semibold ${
                      ev.priorityScore >= 7.5 ? 'text-red-600'
                      : ev.priorityScore >= 5 ? 'text-orange-500'
                      : 'text-green-600'
                    }`}>
                      {ev.priorityScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                      {ev.name || ev.location.address || `Event #${String(ev.id).slice(-4)}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ev.location.address}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};
