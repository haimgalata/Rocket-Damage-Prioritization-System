import React, { useState, useRef, useEffect } from 'react';
import { Building2, Plus, Search, Users, AlertTriangle, Calendar, Shield, X, BarChart3, ExternalLink, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { MOCK_ORGANIZATIONS, MOCK_USERS, MOCK_EVENTS } from '../../data/mockData';
import type { Organization, User, DamageEvent } from '../../types';
import { UserRole } from '../../types';
import { formatDate, formatScore } from '../../utils/helpers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEventStore } from '../../store/authStore';
import { API_BASE_URL } from '../../config/api';

const REGIONS = ['North', 'Center', 'South', 'Jerusalem', 'Tel Aviv', 'Haifa'];

const regionColor = (region?: string) => {
  switch (region) {
    case 'North':      return 'bg-blue-100 text-blue-700';
    case 'South':      return 'bg-orange-100 text-orange-700';
    case 'Jerusalem':  return 'bg-purple-100 text-purple-700';
    case 'Tel Aviv':   return 'bg-cyan-100 text-cyan-700';
    case 'Haifa':      return 'bg-teal-100 text-teal-700';
    default:           return 'bg-green-100 text-green-700';
  }
};

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  settlement_code: z.string().min(3, 'Code must be at least 3 characters'),
  region: z.string().min(1, 'Region is required'),
  description: z.string().optional(),
  adminMode: z.enum(['existing', 'new']),
  existingAdminId: z.string().optional(),
  newAdminName: z.string().optional(),
  newAdminEmail: z.string().optional(),
  newAdminJobTitle: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export const OrgManagement: React.FC = () => {
  const navigate = useNavigate();
  const { getOrganizationStats, events, setEvents } = useEventStore();
  const [orgs, setOrgs] = useState<Organization[]>(MOCK_ORGANIZATIONS);
  const [allUsers, setAllUsers] = useState<User[]>(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [briefOrg, setBriefOrg] = useState<Organization | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { adminMode: 'existing' },
  });

  const adminMode = watch('adminMode');
  const existingAdmins = allUsers.filter((u) => u.role === UserRole.ADMIN);

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.settlement_code.toLowerCase().includes(search.toLowerCase()) ||
      (o.region || '').toLowerCase().includes(search.toLowerCase())
  );

  const getOrgAdmin = (org: Organization) => allUsers.find((u) => u.id === org.adminId);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
  };

  const onSubmit = (data: FormData) => {
    let adminId: string | undefined;

    if (data.adminMode === 'existing' && data.existingAdminId) {
      adminId = data.existingAdminId;
    } else if (data.adminMode === 'new' && data.newAdminName && data.newAdminEmail) {
      const newAdmin: User = {
        id: `user-admin-${Date.now()}`,
        name: data.newAdminName,
        email: data.newAdminEmail,
        role: UserRole.ADMIN,
        organizationId: `org-${Date.now()}`,
        jobTitle: data.newAdminJobTitle || 'Operations Manager',
        createdAt: new Date(),
        isActive: true,
      };
      adminId = newAdmin.id;
      setAllUsers((prev) => [...prev, newAdmin]);
    }

    if (!adminId) {
      alert('Please assign an admin to this organization.');
      return;
    }

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: data.name,
      settlement_code: data.settlement_code,
      region: data.region,
      description: data.description,
      adminId,
      logoUrl: logoPreview || undefined,
      createdAt: new Date(),
      totalEvents: 0,
      totalUsers: 1,
    };

    if (data.adminMode === 'new') {
      setAllUsers((prev) =>
        prev.map((u) => u.id === adminId ? { ...u, organizationId: newOrg.id } : u)
      );
    }

    setOrgs((prev) => [...prev, newOrg]);
    reset();
    setLogoPreview(null);
    setIsCreateOpen(false);
  };

  const getBriefStats = (org: Organization) => {
    const stats = getOrganizationStats(org.id);
    const total = stats.totalEvents || org.totalEvents || 0;
    const avg = stats.averagePriorityScore || 0;
    return { total, avg };
  };

  const totalEvents = events.length;
  const userCountByOrg = orgs.reduce<Record<string, number>>((acc, o) => {
    acc[o.id] = allUsers.filter(u => u.organizationId === o.id).length;
    return acc;
  }, {});
  const totalUsers = Object.values(userCountByOrg).reduce((s, c) => s + c, 0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/events`);
        if (res.ok) {
          const data: DamageEvent[] = await res.json();
          if (data.length > 0) { setEvents(data); return; }
        }
      } catch { /* backend unavailable */ }
      if (events.length === 0) setEvents(MOCK_EVENTS);
    };
    load();
  }, []);

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
            <p className="text-3xl font-bold text-yellow-600">{events.filter(e => e.status === 'PENDING').length}</p>
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
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); reset(); setLogoPreview(null); }} title="Create Organization" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Organization Name"
            placeholder="City Municipality"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Settlement Code"
            placeholder="71005"
            error={errors.settlement_code?.message}
            {...register('settlement_code')}
          />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Region <span className="text-red-500">*</span></label>
            <select
              {...register('region')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select region...</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.region && <p className="text-xs text-red-600 mt-1">{errors.region.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Brief description..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Organization Logo (optional)</label>
            {logoPreview ? (
              <div className="flex items-center gap-3">
                <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => { setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition w-full"
              >
                <ImageIcon className="w-4 h-4" />
                Upload logo image
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-purple-500" />
              Assign Admin <span className="text-red-500">*</span>
            </p>

            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" value="existing" {...register('adminMode')} className="accent-blue-600" />
                Existing user
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" value="new" {...register('adminMode')} className="accent-blue-600" />
                Create new admin
              </label>
            </div>

            {adminMode === 'existing' && (
              <select
                {...register('existingAdminId')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select existing admin...</option>
                {existingAdmins.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            )}

            {adminMode === 'new' && (
              <div className="space-y-2">
                <Input label="Admin Name" placeholder="Jane Smith" {...register('newAdminName')} />
                <Input label="Admin Email" type="email" placeholder="admin@authority.gov" {...register('newAdminEmail')} />
                <Input label="Job Title" placeholder="Operations Manager" {...register('newAdminJobTitle')} />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setIsCreateOpen(false); reset(); setLogoPreview(null); }}>Cancel</Button>
            <Button type="submit">Create Organization</Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
};