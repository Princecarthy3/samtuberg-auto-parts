import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Target, Sparkles, Check, Info } from 'lucide-react';

export const VisualPartsExplorer = () => {
  const { setActiveTab, setSelectedModel } = useApp();
  const [activeHotspot, setActiveHotspot] = useState(null);

  const hotspots = [
    { id: 'headlights', label: 'Matrix Headlights', tab: 'headlights', x: '18%', y: '45%' },
    { id: 'bumpers', label: 'Front & Rear Bumpers', tab: 'bumpers', x: '12%', y: '68%' },
    { id: 'grilles', label: 'Radiator Grille Shells', tab: 'body_parts', x: '24%', y: '58%' },
    { id: 'mirrors', label: 'Side Mirrors', tab: 'body_parts', x: '42%', y: '32%' },
    { id: 'taillights', label: '3D LED Taillights', tab: 'taillights', x: '88%', y: '48%' },
    { id: 'hoods', label: 'Aluminum Bonnet Hood', tab: 'body_parts', x: '30%', y: '42%' }
  ];

  return (
    <div className="glass-panel p-6 border border-rose-500/30 rounded-2xl relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950/30">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Visual Parts Hotspot Explorer</span>
          </div>
          <h3 className="font-display font-extrabold text-xl text-white mt-1">
            Tap Any Body Component Below to Inspect Genuine Parts
          </h3>
          <p className="text-xs text-slate-400">
            Select a hotspot on the vehicle diagram to immediately filter matching Samtuberg body parts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-no-engine">100% Fitment Guaranteed</span>
        </div>
      </div>

      {/* Visual Car Silhouette Diagram with Hotspot Markers */}
      <div className="relative w-full h-64 sm:h-80 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-4">
        
        {/* Car Silhouette Image */}
        <img
          src="/images/rav4.jpg"
          alt="Samtuberg Body Diagram"
          className="w-full h-full object-cover opacity-60 filter contrast-125"
        />
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />

        {/* Hotspot Buttons overlay */}
        {hotspots.map((spot) => (
          <div
            key={spot.id}
            style={{ left: spot.x, top: spot.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
          >
            <button
              onClick={() => {
                setActiveHotspot(spot.id);
                setActiveTab(spot.tab);
              }}
              className={`relative flex items-center justify-center w-8 h-8 rounded-full font-bold transition-all shadow-lg ${
                activeHotspot === spot.id
                  ? 'bg-rose-600 text-white ring-4 ring-rose-500/50 scale-125'
                  : 'bg-slate-900/90 text-rose-400 border border-rose-500/50 hover:bg-rose-600 hover:text-white hover:scale-110'
              }`}
            >
              <Target className="w-4 h-4 animate-pulse" />

              {/* Tooltip Label */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-500/40 shadow-xl items-center gap-1">
                <span>{spot.label}</span>
              </span>
            </button>
          </div>
        ))}

        {/* Helper Footer overlay */}
        <div className="absolute bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Info className="w-4 h-4 text-rose-400" />
            Click any red target to view corresponding Headlights, Taillights, Bumpers or Mirrors.
          </span>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('headlights')}
              className="text-[11px] font-bold text-rose-400 hover:underline"
            >
              Headlights
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => setActiveTab('bumpers')}
              className="text-[11px] font-bold text-rose-400 hover:underline"
            >
              Bumpers
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
