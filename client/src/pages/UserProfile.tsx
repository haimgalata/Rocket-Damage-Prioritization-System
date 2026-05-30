import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Briefcase, Shield, CheckCircle2, Key, Eye, EyeOff } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks';
import { changePasswordApi } from '../api/auth';
import { getInitials, formatRole, formatDate } from '../utils/helpers';
import { UserRole } from '../types';

const profileSchema = z.object({
  name: z.string().min(2, 'השם חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת דוא״ל לא תקינה'),
  jobTitle: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'יש להזין את הסיסמה הנוכחית'),
  newPassword: z.string().min(4, 'הסיסמה חייבת להכיל לפחות 4 תווים'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});
type PasswordFormData = z.infer<typeof passwordSchema>;

const roleVariantMap: Record<UserRole, 'danger' | 'warning' | 'info'> = {
  [UserRole.SUPER_ADMIN]: 'danger',
  [UserRole.ADMIN]: 'warning',
  [UserRole.OPERATOR]: 'info',
};

export const UserProfile: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || '',
    },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: passwordSubmitting },
  } = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) });

  const onSaveProfile = async (data: ProfileFormData) => {
    await new Promise((r) => setTimeout(r, 600));
    updateUserProfile({ name: data.name, email: data.email, jobTitle: data.jobTitle });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const onChangePassword = async (data: PasswordFormData) => {
    setPasswordError('');
    try {
      await changePasswordApi(data.currentPassword, data.newPassword);
      resetPassword();
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to change password');
    }
  };

  if (!user) return null;

  return (
    <PageContainer title="הפרופיל שלי">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white flex items-center gap-5">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {getInitials(user.name)}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-blue-200 text-sm">{user.email}</p>
            {user.jobTitle && <p className="text-blue-300 text-sm mt-0.5">{user.jobTitle}</p>}
            <div className="mt-2">
              <Badge variant={roleVariantMap[user.role]}>
                {formatRole(user.role)}
              </Badge>
            </div>
          </div>
          <div className="ml-auto text-right text-xs text-blue-300">
            <p>נוצר בתאריך</p>
            <p className="font-semibold text-white">{formatDate(user.createdAt)}</p>
          </div>
        </div>

        <Card title="עריכת פרופיל" subtitle="עדכון פרטים אישיים">
          <form onSubmit={handleProfile(onSaveProfile)} className="space-y-4">
            <div className="relative">
              <Input
                label="שם מלא"
                placeholder="שמך המלא"
                error={profileErrors.name?.message}
                {...regProfile('name')}
              />
              <User className="absolute right-3 top-9 w-4 h-4 text-gray-400" />
            </div>
            <div className="relative">
              <Input
                label="כתובת דוא״ל"
                type="email"
                placeholder="your@email.gov"
                error={profileErrors.email?.message}
                {...regProfile('email')}
              />
              <Mail className="absolute right-3 top-9 w-4 h-4 text-gray-400" />
            </div>
            <div className="relative">
              <Input
                label="תפקיד"
                placeholder="לדוגמה: מעריך נזקים שטחי"
                {...regProfile('jobTitle')}
              />
              <Briefcase className="absolute right-3 top-9 w-4 h-4 text-gray-400" />
            </div>

            <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">תפקיד</p>
                <p className="text-xs text-gray-500">{formatRole(user.role)} — לשינוי תפקיד, צור קשר עם מנהל-על.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> נשמר
                </span>
              )}
              <Button type="submit" loading={profileSubmitting}>שמור פרופיל</Button>
            </div>
          </form>
        </Card>

        <Card title="שינוי סיסמה" subtitle="עדכון סיסמת החשבון">
          <form onSubmit={handlePassword(onChangePassword)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">סיסמה נוכחית</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...regPassword('currentPassword')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.currentPassword.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">סיסמה חדשה</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="מינימום 4 תווים"
                  {...regPassword('newPassword')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.newPassword && <p className="text-xs text-red-600 mt-1">{passwordErrors.newPassword.message}</p>}
            </div>

            <Input
              label="אישור סיסמה חדשה"
              type="password"
              placeholder="חזור על הסיסמה החדשה"
              error={passwordErrors.confirmPassword?.message}
              {...regPassword('confirmPassword')}
            />

            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}

            <div className="flex items-center justify-end gap-3">
              {passwordSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> הסיסמה עודכנה
                </span>
              )}
              <Button type="submit" loading={passwordSubmitting} icon={<Key className="w-4 h-4" />}>
                שנה סיסמה
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
};