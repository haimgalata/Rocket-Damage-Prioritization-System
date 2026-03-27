import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Users, FileText } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { fetchOrganizations } from '../../api/organizations';
import { fetchUsers } from '../../api/auth';
import { fetchEvents } from '../../api/events';
import { EventStatus } from '../../types';
import type { Organization } from '../../types';
import type { User } from '../../types';
import type { DamageEvent } from '../../types';

export const SuperAdminDashboard: React.FC = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<DamageEvent[]>([]);

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

  const byStatus = useMemo(() => {
    return {
      new: events.filter((e) => e.status === EventStatus.NEW).length,
      inProgress: events.filter((e) => e.status === EventStatus.IN_PROGRESS).length,
      done: events.filter((e) => e.status === EventStatus.DONE).length,
    };
  }, [events]);

  return (
    <PageContainer title="System overview">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="Organizations" noPadding>
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{orgs.length}</p>
              <p className="text-sm text-gray-500">Registered orgs</p>
            </div>
          </div>
        </Card>
        <Card title="Users" noPadding>
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{users.length}</p>
              <p className="text-sm text-gray-500">All roles</p>
            </div>
          </div>
        </Card>
        <Card title="Events" noPadding>
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{events.length}</p>
              <p className="text-sm text-gray-500">Total damage events</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-5xl mx-auto mt-6">
        <Card title="Events by workflow status" subtitle="Matches event_status table">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-4">
              <p className="text-2xl font-bold text-yellow-800">{byStatus.new}</p>
              <p className="text-xs text-yellow-700 mt-1">new</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
              <p className="text-2xl font-bold text-blue-800">{byStatus.inProgress}</p>
              <p className="text-xs text-blue-700 mt-1">in_progress</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 p-4">
              <p className="text-2xl font-bold text-green-800">{byStatus.done}</p>
              <p className="text-xs text-green-700 mt-1">done</p>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
