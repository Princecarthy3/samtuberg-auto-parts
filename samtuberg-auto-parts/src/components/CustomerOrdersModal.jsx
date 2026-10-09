import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Package, Clock, ShieldCheck, Mail, LogOut } from 'lucide-react';

export const CustomerOrdersModal = () => {
  const {
    user,
    orders,
    logout,
    isCustomerOrdersOpen,
    setIsCustomerOrdersOpen
  } = useApp();

  if (!isCustomerOrdersOpen) return null;

  // Filter orders matching logged-in user email
  const userOrders = orders.filter(
    o => user && o.customerEmail.toLowerCase() === user.email.toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar}
              alt={user?.name}
              className="w-9 h-9 rounded-xl object-cover border border-rose-500"
            />
            <div>
              <h3 className="font-display font-extrabold text-base text-white">{user?.name}</h3>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => setIsCustomerOrdersOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orders Body */}
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold">My Purchased Parts & Vehicles</span>
            <span className="text-rose-400 font-bold">{userOrders.length} Records</span>
          </div>

          {userOrders.length > 0 ? (
            userOrders.map(order => {
              const tracking = order.tracking || { progress: 0, steps: [] };
              return (
                <div key={order.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="font-extrabold text-xs text-white">Order #{order.id}</span>
                      <span className="block text-[11px] text-slate-400">
                        {new Date(order.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="badge-tag bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Tracking progress</span>
                      <span className="font-bold text-amber-300">{tracking.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${tracking.progress}%` }} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {(tracking.steps || []).map((step) => (
                        <span
                          key={`${order.id}-${step.title}`}
                          className={`text-[9px] px-2 py-1 rounded-full border ${step.current ? 'border-amber-500 text-amber-200 bg-amber-500/10' : step.completed ? 'border-emerald-500 text-emerald-200 bg-emerald-500/10' : 'border-slate-700 text-slate-400 bg-slate-800/50'}`}
                        >
                          {step.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-bold text-white">${(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Charged:</span>
                    <span className="font-extrabold text-rose-400 text-sm font-display">
                      ${order.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 space-y-2 text-xs">
              <Package className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="font-bold text-slate-300">No past orders found for this Gmail account</p>
              <p className="text-slate-500">Items you purchase will appear here automatically.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
          <button
            onClick={() => {
              logout();
              setIsCustomerOrdersOpen(false);
            }}
            className="text-xs text-rose-400 hover:underline font-bold flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Gmail</span>
          </button>

          <button
            onClick={() => setIsCustomerOrdersOpen(false)}
            className="btn-secondary py-1.5 px-4 text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
