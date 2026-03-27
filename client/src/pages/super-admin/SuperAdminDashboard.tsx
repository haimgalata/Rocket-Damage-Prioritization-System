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
    <PageContainer title="System Overview">
      {/* ── Top 3 nav cards ─────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: 'Organizations',
            count: orgs.length,
            sub: 'Registered orgs',
            icon: <Building2 className="w-6 h-6 text-blue-600" />,
            iconBg: 'bg-blue-100',
            chevronColor: 'group-hover:text-blue-500',
            route: '/super-admin/organizations',
          },
          {
            title: 'Users',
            count: users.length,
            sub: 'All roles',
            icon: <Users className="w-6 h-6 text-violet-600" />,
            iconBg: 'bg-violet-100',
            chevronColor: 'group-hover:text-violet-500',
            route: '/admin/users',
          },
          {
            title: 'Events',
            count: events.length,
            sub: 'Total damage events',
            icon: <FileText className="w-6 h-6 text-amber-600" />,
            iconBg: 'bg-amber-100',
            chevronColor: 'group-hover:text-amber-500',
            route: '/admin/events',
          },
        ].map(({ title, count, sub, icon, iconBg, chevronColor, route }) => (
          <div
            key={title}
            onClick={() => navigate(route)}
            className="cursor-pointer group rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">{title}</p>
            </div>
            <div className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{sub}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition ${chevronColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Status breakdown (clickable) ────────────────────────────── */}
      <div className="max-w-5xl mx-auto mt-6">
        <Card title="Events by Status" subtitle="Click a status to view its events">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                evts: byStatus.new,
                status: EventStatus.NEW,
                bg: 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100',
                textNum: 'text-yellow-800',
                textLbl: 'text-yellow-700',
              },
              {
                evts: byStatus.inProgress,
                status: EventStatus.IN_PROGRESS,
                bg: 'bg-blue-50 border-blue-100 hover:bg-blue-100',
                textNum: 'text-blue-800',
                textLbl: 'text-blue-700',
              },
              {
                evts: byStatus.done,
                status: EventStatus.DONE,
                bg: 'bg-green-50 border-green-100 hover:bg-green-100',
                textNum: 'text-green-800',
                textLbl: 'text-green-700',
              },
            ].map(({ evts, status, bg, textNum, textLbl }) => (
              <button
                key={status}
                onClick={() => setStatusModal({ label: getStatusLabel(status), events: evts })}
                className={`rounded-lg border p-4 text-left transition cursor-pointer ${bg}`}
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
              <p className="text-sm text-gray-400 text-center py-6">No events in this status.</p>
            ) : (
              statusModal.events.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  onClick={() => setStatusModal(null)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 transition group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                      {ev.name || ev.location.address || `Event #${String(ev.id).slice(-4)}`}
                    </p>
                    <p className="text-xs text-gray-500">{ev.location.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${
                      ev.priorityScore >= 7.5 ? 'text-red-600'
                      : ev.priorityScore >= 5 ? 'text-orange-500'
                      : 'text-green-600'
                    }`}>
                      {ev.priorityScore.toFixed(1)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
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
