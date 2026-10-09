import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Mail, ShieldCheck, CheckCircle2, User } from 'lucide-react';

export const AuthModal = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithGmail, triggerToast } = useApp();
  const [emailInput, setEmailInput] = useState('customer.samtuberg@gmail.com');
  const [nameInput, setNameInput] = useState('Alex Johnson');

  if (!isAuthModalOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (!emailInput) return;
    loginWithGmail(emailInput, nameInput);
    triggerToast(`Logged in as ${emailInput}`, 'success');
    setIsAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-rose-500" />
            <h3 className="font-display font-extrabold text-base text-white">Gmail Customer Login</h3>
          </div>
          <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
              G
            </div>
            <h4 className="font-bold text-white text-lg">Sign in to Samtuberg</h4>
            <p className="text-xs text-slate-400">
              Enter your Gmail address to place auto body parts & car orders and receive order updates.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Your Full Name</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Alex Johnson"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Gmail Email Address</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your.name@gmail.com"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Simulated OAuth for instant order binding & receipt logging.</span>
          </div>

          <button
            type="submit"
            className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <span>Continue with Gmail</span>
          </button>
        </form>

      </div>
    </div>
  );
};
