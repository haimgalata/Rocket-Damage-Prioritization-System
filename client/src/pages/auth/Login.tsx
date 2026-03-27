import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Eye, EyeOff, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { loginRequest } from '../../api/auth';
import { UserRole } from '../../types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});
type FormData = z.infer<typeof schema>;

function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

/** Quick-fill demo accounts (password: 1234). Primary super admins: Haim, Linoy. */
const DEMO_ACCOUNTS = [
  { email: 'haimgalata@gmail.com', password: '1234', label: 'Super Admin (Haim)' },
  { email: 'linoysahalo@gmail.com', password: '1234', label: 'Super Admin (Linoy)' },
  { email: 'david@tel-aviv.gov', password: '1234', label: 'Admin' },
  { email: 'miriam@tel-aviv.gov', password: '1234', label: 'Operator' },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoginError('');
    try {
      const { accessToken, user, organization } = await loginRequest(data.email, data.password);
      loginUser(user, organization, accessToken);

      const ret = safeReturnPath(searchParams.get('returnUrl'));
      if (ret) {
        navigate(ret, { replace: true });
        return;
      }

      if (user.role === UserRole.SUPER_ADMIN) navigate('/super-admin/dashboard', { replace: true });
      else if (user.role === UserRole.ADMIN) navigate('/admin/dashboard', { replace: true });
      else navigate('/operator/dashboard', { replace: true });
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Network error. Is the API server running?');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle, #60a5fa 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/50 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">PrioritAI</h1>
          <p className="text-blue-300 mt-1 text-sm">Professional Damage Assessment System</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-blue-200 block mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@authority.gov"
                autoComplete="email"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-blue-300/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-blue-200 block mb-1">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 pr-10 text-white placeholder-blue-300/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {loginError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2.5 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-blue-300 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Demo accounts — click to fill (password: 1234)
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => { setValue('email', cred.email); setValue('password', cred.password); }}
                  className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-left transition"
                >
                  <div>
                    <p className="text-xs font-semibold text-blue-200">{cred.label}</p>
                    <p className="text-xs text-blue-400">{cred.email}</p>
                  </div>
                  <span className="text-xs text-slate-500">1234</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
