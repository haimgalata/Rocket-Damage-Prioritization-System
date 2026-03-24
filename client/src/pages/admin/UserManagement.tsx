import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Search, Shield, User, Wrench, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, Copy, Check } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { fetchOrganizations } from '../../api/organizations';
import { fetchUsers } from '../../api/auth';
import { UserRole } from '../../types';
import type { User as UserType } from '../../types';
import { formatDate, getInitials } from '../../utils/helpers';
import { useAuth } from '../../hooks';
import { useEventStore } from '../../store/eventStore';
import { createUserApi } from '../../api/auth';

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  let pass = rand(upper) + rand(lower) + rand(digits) + rand(special);
  for (let i = 0; i < 8; i++) pass += rand(all);

  return pass.split('').sort(() => Math.random() - 0.5).join('');
}

const ROLE_DB_ID: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.OPERATOR]: 3,
};

const makeSchema = (isSuperAdmin: boolean) =>
  z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    jobTitle: z.string().optional(),
    role: z.enum(
      isSuperAdmin
        ? [UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]
        : [UserRole.OPERATOR]
    ),
    organizationId: z.string().min(1, 'Organization is required'),
  });

type UserFormData = z.infer<ReturnType<typeof makeSchema>>;

const roleConfig: Record<UserRole, { label: string; variant: 'danger' | 'warning' | 'info'; icon: React.ReactNode }> = {
  [UserRole.SUPER_ADMIN]: { label: 'Technical Team', variant: 'danger',  icon: <Shield className="w-3 h-3" /> },
  [UserRole.ADMIN]:       { label: 'Admin',           variant: 'warning', icon: <User className="w-3 h-3" /> },
  [UserRole.OPERATOR]:    { label: 'Operator',        variant: 'info',    icon: <Wrench className="w-3 h-3" /> },
};

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    isSuperAdmin ? null : currentUser?.organizationId ?? null,
  );

  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [organizations, setOrganizations] = useState<{ id: number; name: string }[]>([]);
  const users = isSuperAdmin
    ? allUsers
    : allUsers.filter(
        (u) => u.organizationId === currentUser?.organizationId && u.role !== UserRole.SUPER_ADMIN
      );

  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | 'password' | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const { events } = useEventStore();
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const userEventCount = useMemo(() => {
    const map: Record<number, number> = {};
    events.forEach(e => {
      if (e.createdBy) map[e.createdBy] = (map[e.createdBy] || 0) + 1;
    });
    return map;
  }, [events]);

  const userEventList = useMemo(() => {
    const map: Record<number, { name: string; createdAt: string }[]> = {};
    events.forEach(e => {
      if (e.createdBy) {
        if (!map[e.createdBy]) map[e.createdBy] = [];
        map[e.createdBy].push({
          name: e.name ?? `Event #${String(e.id).slice(-3)}`,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
        });
      }
    });
    return map;
  }, [events]);

  const schema = makeSchema(isSuperAdmin);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<UserFormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const load = async () => {
      try {
        const [orgsRes, usersRes] = await Promise.all([
          fetchOrganizations(),
          fetchUsers(),
        ]);
        setOrganizations(orgsRes.map(o => ({ id: o.id, name: o.name })));
        setAllUsers(usersRes);
      } catch { /* backend unavailable */ }
    };
    load();
  }, []);

  const orgFilteredUsers =
    isSuperAdmin && selectedOrgId != null
      ? users.filter((u) => u.organizationId === selectedOrgId)
      : isSuperAdmin
        ? []
        : users;

  const sortedUsers = [...orgFilteredUsers].sort((a, b) => {
    const order = { [UserRole.SUPER_ADMIN]: 0, [UserRole.ADMIN]: 1, [UserRole.OPERATOR]: 2 };
    return order[a.role] - order[b.role];
  });

  const filtered = sortedUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    reset({
      name: '',
      email: '',
      jobTitle: '',
      role: UserRole.OPERATOR,
      organizationId:
        selectedOrgId != null
          ? String(selectedOrgId)
          : currentUser?.organizationId != null
            ? String(currentUser.organizationId)
            : '',
    });
    setSelectedUser(null);
    setModalMode('create');
  };

  const openEdit = (u: UserType) => {
    setSelectedUser(u);
    setValue('name', u.name);
    setValue('email', u.email);
    setValue('jobTitle', u.jobTitle || '');
    setValue('role', u.role);
    setValue('organizationId', u.organizationId != null ? String(u.organizationId) : '');
    setModalMode('edit');
  };

  const openDelete = (u: UserType) => {
    setSelectedUser(u);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setGeneratedPassword('');
    setPasswordCopied(false);
    reset();
  };

  const onCreate = async (data: UserFormData) => {
    const password = generateStrongPassword();
    setGeneratedPassword(password);

    const organizationId = Number(data.organizationId);
    const oid =
      Number.isFinite(organizationId) && organizationId > 0
        ? organizationId
        : currentUser?.organizationId ?? 1;

    try {
      const created = await createUserApi({
        name: data.name,
        email: data.email,
        password,
        role: data.role,
        organizationId: oid,
      });
      setAllUsers((prev: UserType[]) => [created, ...prev]);
      setSelectedUser(created);
      setModalMode('password');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const onEdit = (data: UserFormData) => {
    if (!selectedUser) return;
    const organizationId = Number(data.organizationId);
    setAllUsers((prev: UserType[]) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              name: data.name,
              email: data.email,
              jobTitle: data.jobTitle,
              role: data.role,
              roleId: ROLE_DB_ID[data.role],
              organizationId: Number.isFinite(organizationId) && organizationId > 0
                ? organizationId
                : u.organizationId,
            }
          : u,
      ),
    );
    closeModal();
  };

  const onDelete = () => {
    if (!selectedUser) return;
    setAllUsers((prev: UserType[]) => prev.filter((u) => u.id !== selectedUser.id));
    closeModal();
  };

  const toggleActive = (id: number) => {
    setAllUsers((prev: UserType[]) =>
      prev.map((u) => u.id === id ? { ...u, isActive: !u.isActive } : u)
    );
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword).then(() => {
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    });
  };

  watch('organizationId');

  const UserFormFields = () => (
    <div className="space-y-4">
      <Input
        label="Full Name"
        placeholder="Jane Smith"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="Email Address"
        type="email"
        placeholder="user@authority.gov"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Job Title"
        placeholder="Field Damage Assessor"
        {...register('jobTitle')}
      />
      {isSuperAdmin && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Organization</label>
          <select
            {...register('organizationId')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select organization...</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          {errors.organizationId && (
            <p className="text-xs text-red-600 mt-1">{errors.organizationId.message}</p>
          )}
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Role</label>
        <select
          {...register('role')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={UserRole.OPERATOR}>Operator</option>
          {isSuperAdmin && <option value={UserRole.ADMIN}>Admin</option>}
          {isSuperAdmin && <option value={UserRole.SUPER_ADMIN}>Super Admin</option>}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {isSuperAdmin ? 'Super Admins can create Admins and Operators.' : 'Admins can only create Operators.'}
        </p>
      </div>
    </div>
  );

  const displayUsers =
    isSuperAdmin && selectedOrgId != null ? orgFilteredUsers : isSuperAdmin ? [] : orgFilteredUsers;

  return (
    <PageContainer title="User Management">
      <div className="max-w-5xl mx-auto space-y-6">

        {isSuperAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">Select Organization</p>
              <p className="text-xs text-blue-600">As Super Admin, select an organization to view and manage its users.</p>
            </div>
            <div className="relative">
              <select
                value={selectedOrgId != null ? String(selectedOrgId) : ''}
                onChange={(e) =>
                  setSelectedOrgId(e.target.value === '' ? null : Number(e.target.value))
                }
                className="appearance-none border border-blue-300 bg-white rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              >
                <option value="">Choose organization...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {(!isSuperAdmin || selectedOrgId != null) && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Users',    value: displayUsers.length },
              { label: 'Active',         value: displayUsers.filter((u) => u.isActive).length },
              { label: 'Inactive',       value: displayUsers.filter((u) => !u.isActive).length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        )}

        {isSuperAdmin && selectedOrgId == null ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">Select an organization above to view its users.</p>
          </div>
        ) : (
          <Card
            title="Team Members"
            subtitle={`${filtered.length} of ${displayUsers.length} users · Admin first`}
            noPadding
            headerRight={
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                  />
                </div>
                <Button icon={<UserPlus className="w-4 h-4" />} size="sm" onClick={openCreate}>
                  Add User
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Events</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((u) => {
                    const rc = roleConfig[u.role];
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <React.Fragment key={u.id}>
                      <tr className={`border-b border-gray-100 transition ${u.isActive ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${u.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <button
                                onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                className="text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline text-left"
                              >
                                {u.name}
                                {isSelf && <span className="ml-1.5 text-xs text-blue-500 font-normal">(you)</span>}
                              </button>
                              <p className="text-xs text-gray-500">{u.email}</p>
                              {u.jobTitle && <p className="text-xs text-gray-400 italic">{u.jobTitle}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={rc.variant}>
                            <span className="flex items-center gap-1">{rc.icon}{rc.label}</span>
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {(userEventCount[u.id] || 0) > 0 ? (
                            <button
                              onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition"
                            >
                              {userEventCount[u.id]} event{userEventCount[u.id] !== 1 ? 's' : ''}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => !isSelf && toggleActive(u.id)}
                            disabled={isSelf}
                            className="flex items-center gap-1.5 text-sm transition"
                            title={isSelf ? 'Cannot deactivate yourself' : u.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {u.isActive
                              ? <ToggleRight className="w-5 h-5 text-green-500" />
                              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                            <span className={`text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit user"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => !isSelf && openDelete(u)}
                              disabled={isSelf}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === u.id && (
                        <tr className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={6} className="px-6 py-3">
                            {(userEventList[u.id] || []).length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No events created yet.</p>
                            ) : (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">
                                  Events created by {u.name}:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {(userEventList[u.id] || []).map((ev, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs">
                                      <span className="font-medium text-gray-800">{ev.name}</span>
                                      <span className="text-gray-400">·</span>
                                      <span className="text-gray-500">{formatDate(ev.createdAt)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal isOpen={modalMode === 'create'} onClose={closeModal} title="Add New User" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit(onCreate)}>Create User</Button>
          </div>
        }
      >
        <UserFormFields />
      </Modal>

      <Modal isOpen={modalMode === 'password'} onClose={closeModal} title="User Created Successfully" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">{selectedUser?.name} has been created</p>
              <p className="text-xs text-green-600">{selectedUser?.email}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Initial Password</p>
            <p className="text-xs text-gray-500 mb-2">
              Share this password securely. The user should change it upon first login.
            </p>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
              <code className="flex-1 text-green-400 font-mono text-sm tracking-widest select-all">
                {generatedPassword}
              </code>
              <button
                onClick={copyPassword}
                className="text-gray-400 hover:text-white transition flex-shrink-0"
                title="Copy password"
              >
                {passwordCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <p className="text-xs text-yellow-800 font-medium">
              ⚠ This password will not be shown again. Copy it now.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={closeModal}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalMode === 'edit'} onClose={closeModal} title={`Edit: ${selectedUser?.name}`} size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit(onEdit)}>Save Changes</Button>
          </div>
        }
      >
        <UserFormFields />
      </Modal>

      <Modal isOpen={modalMode === 'delete'} onClose={closeModal} title="Delete User" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" onClick={onDelete}>Delete User</Button>
          </div>
        }
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-gray-700 text-sm">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{selectedUser?.name}</span>?
          </p>
          <p className="text-gray-400 text-xs mt-1">This action cannot be undone.</p>
        </div>
      </Modal>
    </PageContainer>
  );
};