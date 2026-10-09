import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Eye, Flame, Layers, CircleDot, Grid, Car } from 'lucide-react';

export const BodyMapSelector = () => {
  const { setActiveTab, activeTab } = useApp();

  const bodySections = [
    { id: 'all', label: 'All Body Sections', icon: Layers },
    { id: 'bumpers', label: 'Front & Rear Bumpers', icon: Shield },
    { id: 'headlights', label: 'Headlights & Lighting', icon: Eye },
    { id: 'taillights', label: 'Rear Taillights', icon: Flame },
    { id: 'body_parts', label: 'Shells, Hoods & Fenders', icon: Car },
    { id: 'mirrors', label: 'Side Mirrors', icon: CircleDot },
    { id: 'grilles', label: 'Front Grille Shells', icon: Grid }
  ];

  return (
    <div className="max-w-5xl mx-auto mb-10">
      <p className="text-center text-xs font-mono font-bold text-amber-500 uppercase tracking-widest mb-3">
        🎯 Interactive Body Section Selector:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {bodySections.map(sec => {
          const IconComponent = sec.icon;
          const isActive = activeTab === sec.id;

          return (
            <button
              key={sec.id}
              onClick={() => setActiveTab(sec.id)}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-lg scale-105'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 font-semibold'
              }`}
            >
              <IconComponent className="w-5 h-5 shrink-0" />
              <span className="text-[11px] leading-tight">{sec.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
