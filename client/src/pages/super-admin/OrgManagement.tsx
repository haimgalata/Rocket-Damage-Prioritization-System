import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Users, AlertTriangle, Calendar, Shield, X, BarChart3, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { fetchUsers } from '../../api/auth';
import {
  fetchOrganizations,
  fetchSettlements,
  createOrganization,
  type SettlementOption,
} from '../../api/organizations';
import type { Organization, User } from '../../types';
import { UserRole, EventStatus } from '../../types';
import { formatDate, formatScore } from '../../utils/helpers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEventStore } from '../../store/eventStore';
import { fetchEvents } from '../../api/events';

const regionColor = (_region?: string) => 'bg-gray-100 text-gray-700';

const orgCreateSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  settlement_id: z.string().min(1, 'Select a settlement'),
  existingAdminId: z.string().optional(),
});
type OrgCreateFormValues = z.infer<typeof orgCreateSchema>;

export const OrgManagement: React.FC = () => {
  const navigate = useNavigate();
  const { getOrganizationStats, events, setEvents } = useEventStore();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [briefOrg, setBriefOrg] = useState<Organization | null>(null);

  const [settlements, setSettlements] = useState<SettlementOption[]>([]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrgCreateFormValues>({
    resolver: zodResolver(orgCreateSchema),
    defaultValues: { name: '', settlement_id: '', existingAdminId: '' },
  });

  const existingAdmins = allUsers.filter((u) => u.role === UserRole.ADMIN);

  const loadData = useCallback(async () => {
    try {
      const [eventsData, orgsRes, usersRes, settlementsRes] = await Promise.all([
        fetchEvents(),
        fetchOrganizations(),
        fetchUsers(),
        fetchSettlements(),
      ]);
      setEvents(eventsData);
      setOrgs(orgsRes);
      setAllUsers(usersRes);
      setSettlements(settlementsRes);
    } catch { /* backend unavailable */ }
  }, [setEvents]);

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.settlement_code.toLowerCase().includes(search.toLowerCase()) ||
      (o.region || '').toLowerCase().includes(search.toLowerCase())
  );

  const getOrgAdmin = (org: Organization) => allUsers.find((u) => u.id === org.adminId);

  const onSubmit = async (data: OrgCreateFormValues) => {
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const settlement_id = Number(data.settlement_id);
      if (!Number.isFinite(settlement_id) || settlement_id < 1) {
        setCreateError('Select a valid settlement');
        setCreateSubmitting(false);
        return;
      }
      await createOrganization({
        name: data.name.trim(),
        settlement_id,
        assign_admin_external_id: data.existingAdminId?.trim() || null,
      });
      await loadData();
      reset({ name: '', settlement_id: '', existingAdminId: '' });
      setIsCreateOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create organization');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getBriefStats = (org: Organization) => {
    const stats = getOrganizationStats(org.id);
    const total = stats.totalEvents || org.totalEvents || 0;
    const avg = stats.averagePriorityScore || 0;
    return { total, avg };
  };

  const totalEvents = events.length;
  const userCountByOrg = orgs.reduce<Record<number, number>>((acc, o) => {
    acc[o.id] = allUsers.filter(u => u.organizationId === o.id).length;
    return acc;
  }, {});
  const totalUsers = Object.values(userCountByOrg).reduce((s, c) => s + c, 0);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <PageContainer title="Organization Management">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Organizations</p>
            <p className="text-3xl font-bold text-gray-900">{orgs.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Events</p>
            <p className="text-3xl font-bold text-gray-900">{totalEvents}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{events.filter(e => e.status === EventStatus.NEW).length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
          </div>
        </div>

        {/* Table */}
        <Card
          title="Organizations"
          noPadding
          headerRight={
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, code, region..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                />
              </div>
              <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={() => setIsCreateOpen(true)}>
                New Org
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Events</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => {
                  const admin = getOrgAdmin(org);
                  return (
                    <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                          ) : (
                            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                          <div>
                            <button
                              onClick={() => setBriefOrg(org)}
                              className="text-sm font-semibold text-blue-700 hover:underline text-left"
                            >
                              {org.name}
                            </button>
                            {org.description && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">{org.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{org.settlement_code}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${regionColor(org.region)}`}>
                          {org.region || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {admin ? (
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-purple-500" />
                            <div>
                              <p className="text-xs font-medium text-gray-800">{admin.name}</p>
                              <p className="text-xs text-gray-400">{admin.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">No admin assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                          {getOrganizationStats(org.id).totalEvents || org.totalEvents || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          {userCountByOrg[org.id] ?? 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(org.createdAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Quick Brief Modal */}
      {briefOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBriefOrg(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {briefOrg.logoUrl ? (
                  <img src={briefOrg.logoUrl} alt={briefOrg.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-gray-900">{briefOrg.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${regionColor(briefOrg.region)}`}>
                    {briefOrg.region}
                  </span>
                </div>
              </div>
              <button onClick={() => setBriefOrg(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const { total, avg } = getBriefStats(briefOrg);
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <p className="text-xs text-gray-500 font-medium">Total Events</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{total}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <p className="text-xs text-gray-500 font-medium">Avg Priority</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatScore(avg)}</p>
                  </div>
                </div>
              );
            })()}

            <Button
              className="w-full justify-center"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={() => {
                setBriefOrg(null);
                navigate(`/admin/events?org=${briefOrg.id}`);
              }}
            >
              View Full Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Create Org Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError(null);
          reset({ name: '', settlement_id: '', existingAdminId: '' });
        }}
        title="Create Organization"
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-xs text-gray-500">
            Organizations are saved in PostgreSQL. Choose a settlement that already exists (seed or migrations).
          </p>
          <Input
            label="Organization Name"
            placeholder="City Municipality"
            error={errors.name?.message}
            {...register('name')}
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Settlement <span className="text-red-500">*</span>
            </label>
            <select
              {...register('settlement_id')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select settlement...</option>
              {settlements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.settlement_code})
                </option>
              ))}
            </select>
            {errors.settlement_id && (
              <p className="text-xs text-red-600 mt-1">{errors.settlement_id.message}</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-500" />
              Assign admin (optional)
            </p>
            <p className="text-xs text-gray-500 mb-2">
              If you pick an admin, their account is updated to belong to the new organization.
            </p>
            <select
              {...register('existingAdminId')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No reassignment</option>
              {existingAdmins.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {createError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {createError}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setCreateError(null);
                reset({ name: '', settlement_id: '', existingAdminId: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSubmitting}>
              {createSubmitting ? 'Saving…' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
};