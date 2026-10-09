import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Lock, User, Eye, EyeOff, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AdminLoginModal = () => {
  const { isAdminLoginOpen, setIsAdminLoginOpen, adminLogin } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isAdminLoginOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    const result = await adminLogin(username, password);
    setIsLoading(false);
    if (!result.success) setErrorMsg(result.message || 'Invalid username or password.');
    else setSuccessMsg('Signed in successfully.');
  };

  return (
    <div className="fixed inset-x-4 top-20 z-10 flex justify-end pointer-events-none">
      <div className="pointer-events-auto bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative shadow-black/50">
        
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-700"></div>

        {/* Modal Header */}
        <div className="p-5 pb-4 flex items-start justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                Samtuberg Security
              </span>
              <h3 className="font-extrabold text-lg text-white tracking-wide">
                Secure Admin Portal
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              setIsAdminLoginOpen(false);
              setErrorMsg('');
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-700/80 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Admin Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full py-2.5 pl-10 pr-4 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Secret Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full py-2.5 pl-10 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-200 p-0.5"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-orange-700 via-amber-600 to-orange-700 hover:from-orange-800 hover:to-amber-700 text-white font-extrabold py-3 px-4 rounded-xl text-sm shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>

          {/* Security Notice */}
          <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Authorized workshop management & inventory control.</span>
          </div>

        </form>

      </div>
    </div>
  );
};
