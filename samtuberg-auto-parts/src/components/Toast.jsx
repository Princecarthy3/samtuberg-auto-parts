import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export const Toast = () => {
  const { toastMessage } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="toast-banner">
      <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg shrink-0 border border-rose-500/30">
        <Bell className="w-5 h-5" />
      </div>
      <div className="text-xs font-semibold text-white max-w-sm leading-tight">
        {toastMessage.text}
      </div>
    </div>
  );
};
