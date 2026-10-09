import React, { useMemo, useState } from 'react';
import { X, PackageSearch, MapPinned, ShoppingBag, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TrackOrderModal = () => {
  const { isTrackOrderOpen, setIsTrackOrderOpen, orders, trackOrderByQuery } = useApp();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return trackOrderByQuery(query);
  }, [query, trackOrderByQuery]);

  if (!isTrackOrderOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <PackageSearch className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400">Track your purchase</p>
              <h3 className="font-extrabold text-base text-white">Order lookup</h3>
            </div>
          </div>
          <button onClick={() => setIsTrackOrderOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 block mb-2">Order ID, email, or customer name</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. ORD-1024 or customer@gmail.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            />
          </div>

          {!query.trim() ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
              Enter your order ID or email address to check the current delivery status.
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              No matching order was found. Please check the email, name, or order number and try again.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Order</p>
                      <p className="font-extrabold text-white">{order.id}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                      {order.status || 'New Order Received'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Tracking progress</span>
                      <span className="text-amber-300 font-bold">{order.tracking?.progress || 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${order.tracking?.progress || 0}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(order.tracking?.steps || []).map((step) => (
                        <span key={`${order.id}-${step.title}`} className={`text-[9px] px-2 py-1 rounded-full border ${step.current ? 'border-amber-500 text-amber-200 bg-amber-500/10' : step.completed ? 'border-emerald-500 text-emerald-200 bg-emerald-500/10' : 'border-slate-700 text-slate-400 bg-slate-800/50'}`}>
                          {step.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
                      <span>{order.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPinned className="w-3.5 h-3.5 text-rose-400" />
                      <span>{order.address || order.city || 'Accra, Ghana'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={() => setIsTrackOrderOpen(false)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.18em]"
          >
            Close
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
