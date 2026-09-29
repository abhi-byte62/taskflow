import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, AlertCircle, Loader2, Kanban } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Signed in successfully');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Authentication failed');
      toast.error(err.response?.data?.error?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0d12] px-4 py-12 text-zinc-100">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2.5 mb-3 group">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 flex items-center justify-center shadow-sm">
              <Kanban className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">TaskFlow</span>
          </Link>
          <h1 className="text-xl font-semibold text-white">Sign in to your account</h1>
          <p className="mt-1 text-xs text-zinc-400">Welcome back. Enter your credentials to continue.</p>
        </div>

        {/* Card */}
        <div className="bg-[#13151c] rounded-xl border border-[#232634] p-6 shadow-xl space-y-5">
          {error && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9 text-xs"
                  placeholder="demo@taskflow.dev"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 text-xs"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-9 text-xs mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-zinc-200 hover:text-white underline font-medium">
              Create account
            </Link>
          </p>

          <div className="pt-3 border-t border-[#232634] text-center">
            <p className="text-[11px] text-zinc-500">
              Demo: <span className="text-zinc-300 font-mono">demo@taskflow.dev</span> / <span className="text-zinc-300 font-mono">password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}