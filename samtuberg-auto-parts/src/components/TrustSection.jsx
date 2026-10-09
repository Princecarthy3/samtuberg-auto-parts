import React from 'react';
import { ShieldCheck, Truck, Tag, MailCheck } from 'lucide-react';

export const TrustSection = () => {
  return (
    <section className="trust-section">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="section-eyebrow">Why Choose Samtuberg</p>
          <h2 className="section-title">The Samtuberg Quality Standard</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="trust-card">
            <ShieldCheck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Genuine OEM Body Parts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Factory original bumpers, headlights, taillights, and body shells.
              </p>
            </div>
          </div>

          <div className="trust-card">
            <Tag className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Ghana Cedis Price Lock</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upfront pricing in GH₵ with no hidden import or surprise charges.
              </p>
            </div>
          </div>

          <div className="trust-card">
            <Truck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Nationwide Ghana Delivery</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fast dispatch across Accra, Kumasi, Takoradi, Tamale, and all towns.
              </p>
            </div>
          </div>

          <div className="trust-card">
            <MailCheck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h3 className="text-base font-bold mb-1 text-slate-900 dark:text-white">Instant Email Confirmation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All order details delivered straight to samtuberg34@gmail.com.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
