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
import { createUserApi, patchUserStatusApi } from '../../api/auth';

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
    name: z.string().min(2, 'השם חייב להכיל לפחות 2 תווים'),
    email: z.string().email('כתובת אימייל לא תקינה'),
    jobTitle: z.string().optional(),
    role: z.enum(
      isSuperAdmin
        ? [UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]
        : [UserRole.OPERATOR]
    ),
    organizationId: z.string().min(1, 'יש לבחור ארגון'),
  });

type UserFormData = z.infer<ReturnType<typeof makeSchema>>;

const roleConfig: Record<UserRole, { label: string; variant: 'danger' | 'warning' | 'info'; icon: React.ReactNode }> = {
  [UserRole.SUPER_ADMIN]: { label: 'צוות טכני', variant: 'danger',  icon: <Shield className="w-3 h-3" /> },
  [UserRole.ADMIN]:       { label: 'מנהל',      variant: 'warning', icon: <User className="w-3 h-3" /> },
  [UserRole.OPERATOR]:    { label: 'מפעיל',     variant: 'info',    icon: <Wrench className="w-3 h-3" /> },
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
      alert(e instanceof Error ? e.message : 'יצירת המשתמש נכשלה');
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

  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggleActive = async (id: number) => {
    const target = allUsers.find((u) => u.id === id);
    if (!target) return;
    setToggleError(null);
    try {
      const updated = await patchUserStatusApi(id, !target.isActive);
      setAllUsers((prev: UserType[]) =>
        prev.map((u) => u.id === id ? { ...u, isActive: updated.isActive } : u)
      );
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'עדכון סטטוס המשתמש נכשל');
    }
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
        label="שם מלא"
        placeholder="ישראל ישראלי"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="כתובת אימייל"
        type="email"
        placeholder="user@authority.gov"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="תפקיד"
        placeholder="מעריך נזקים שטחי"
        {...register('jobTitle')}
      />
      {isSuperAdmin && (
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">ארגון</label>
          <select
            {...register('organizationId')}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">בחר ארגון...</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          {errors.organizationId && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.organizationId.message}</p>
          )}
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">הרשאה</label>
        <select
          {...register('role')}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={UserRole.OPERATOR}>מפעיל</option>
          {isSuperAdmin && <option value={UserRole.ADMIN}>מנהל</option>}
          {isSuperAdmin && <option value={UserRole.SUPER_ADMIN}>מנהל-על</option>}
        </select>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {isSuperAdmin ? 'מנהלי-על יכולים ליצור מנהלים ומפעילים.' : 'מנהלים יכולים ליצור מפעילים בלבד.'}
        </p>
      </div>
    </div>
  );

  const displayUsers =
    isSuperAdmin && selectedOrgId != null ? orgFilteredUsers : isSuperAdmin ? [] : orgFilteredUsers;

  return (
    <PageContainer title="ניהול משתמשים">
      <div className="max-w-5xl mx-auto space-y-6">

        {isSuperAdmin && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">בחר ארגון</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">כמנהל-על, בחר ארגון לצפייה וניהול המשתמשים שלו.</p>
            </div>
            <div className="relative">
              <select
                value={selectedOrgId != null ? String(selectedOrgId) : ''}
                onChange={(e) =>
                  setSelectedOrgId(e.target.value === '' ? null : Number(e.target.value))
                }
                className="appearance-none border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              >
                <option value="">בחר ארגון...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {(!isSuperAdmin || selectedOrgId != null) && (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'סה"כ משתמשים', value: displayUsers.length },
              { label: 'פעילים',        value: displayUsers.filter((u) => u.isActive).length },
              { label: 'לא פעילים',    value: displayUsers.filter((u) => !u.isActive).length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        )}

        {toggleError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-600 dark:text-red-400 text-sm font-medium">{toggleError}</span>
            <button onClick={() => setToggleError(null)} className="mr-auto text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
        )}

        {isSuperAdmin && selectedOrgId == null ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">בחר ארגון למעלה לצפייה במשתמשיו.</p>
          </div>
        ) : (
          <Card
            title="חברי צוות"
            noPadding
            headerRight={
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="חיפוש משתמשים..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-9 pl-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <Button icon={<UserPlus className="w-4 h-4" />} size="sm" onClick={openCreate}>
                  הוסף משתמש
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">משתמש</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">הרשאה</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">אירועים</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">הצטרף</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                        לא נמצאו משתמשים.
                      </td>
                    </tr>
                  )}
                  {filtered.map((u) => {
                    const rc = roleConfig[u.role];
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <React.Fragment key={u.id}>
                      <tr className={`border-b border-gray-100 dark:border-gray-700 transition ${u.isActive ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-gray-50 dark:bg-gray-900/30 opacity-60'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${u.isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <button
                                onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400 hover:underline"
                              >
                                {u.name}
                                {isSelf && <span className="ml-1.5 text-xs text-blue-500 font-normal">(אתה)</span>}
                              </button>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                              {u.jobTitle && <p className="text-xs text-gray-400 dark:text-gray-500 italic">{u.jobTitle}</p>}
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
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-full transition"
                            >
                              {userEventCount[u.id]} {userEventCount[u.id] !== 1 ? 'אירועים' : 'אירוע'}
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
                            title={isSelf ? 'לא ניתן להשבית את עצמך' : u.isActive ? 'השבת' : 'הפעל'}
                          >
                            {u.isActive
                              ? <ToggleRight className="w-5 h-5 text-green-500" />
                              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                            <span className={`text-xs font-medium ${u.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                              {u.isActive ? 'פעיל' : 'לא פעיל'}
                            </span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(u.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                              title="ערוך משתמש"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => !isSelf && openDelete(u)}
                              disabled={isSelf}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? 'לא ניתן למחוק את עצמך' : 'מחק משתמש'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === u.id && (
                        <tr className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                          <td colSpan={6} className="px-6 py-3">
                            {(userEventList[u.id] || []).length === 0 ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 italic">טרם נוצרו אירועים.</p>
                            ) : (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                                  אירועים שנוצרו על ידי {u.name}:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {(userEventList[u.id] || []).map((ev, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs">
                                      <span className="font-medium text-gray-800 dark:text-gray-200">{ev.name}</span>
                                      <span className="text-gray-400 dark:text-gray-500">·</span>
                                      <span className="text-gray-500 dark:text-gray-400">{formatDate(ev.createdAt)}</span>
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

      <Modal isOpen={modalMode === 'create'} onClose={closeModal} title="הוסף משתמש חדש" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>ביטול</Button>
            <Button onClick={handleSubmit(onCreate)}>צור משתמש</Button>
          </div>
        }
      >
        <UserFormFields />
      </Modal>

      <Modal isOpen={modalMode === 'password'} onClose={closeModal} title="המשתמש נוצר בהצלחה" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-400">המשתמש {selectedUser?.name} נוצר</p>
              <p className="text-xs text-green-600 dark:text-green-500">{selectedUser?.email}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">סיסמה ראשונית</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              שתף סיסמה זו בצורה מאובטחת. על המשתמש לשנות אותה בהתחברות הראשונה.
            </p>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
              <code className="flex-1 text-green-400 font-mono text-sm tracking-widest select-all">
                {generatedPassword}
              </code>
              <button
                onClick={copyPassword}
                className="text-gray-400 hover:text-white transition flex-shrink-0"
                title="העתק סיסמה"
              >
                {passwordCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-3 py-2">
            <p className="text-xs text-yellow-800 dark:text-yellow-400 font-medium">
              ⚠ סיסמה זו לא תוצג שוב. העתק אותה עכשיו.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={closeModal}>סיום</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalMode === 'edit'} onClose={closeModal} title={`עריכה: ${selectedUser?.name}`} size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>ביטול</Button>
            <Button onClick={handleSubmit(onEdit)}>שמור שינויים</Button>
          </div>
        }
      >
        <UserFormFields />
      </Modal>

      <Modal isOpen={modalMode === 'delete'} onClose={closeModal} title="מחיקת משתמש" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeModal}>ביטול</Button>
            <Button variant="danger" onClick={onDelete}>מחק משתמש</Button>
          </div>
        }
      >
        <div className="text-center py-2">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            האם אתה בטוח שברצונך למחוק את{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{selectedUser?.name}</span>?
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">פעולה זו אינה ניתנת לביטול.</p>
        </div>
      </Modal>
    </PageContainer>
  );
};