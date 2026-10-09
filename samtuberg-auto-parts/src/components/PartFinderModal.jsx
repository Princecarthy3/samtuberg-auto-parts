import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, X, Send, CheckCircle2 } from 'lucide-react';
import { ORDER_EMAIL, sendToShop } from '../services/email';

export const PartFinderModal = () => {
  const { isPartFinderOpen, setIsPartFinderOpen, triggerToast, user } = useApp();

  const [carMake, setCarMake] = useState('Toyota');
  const [carModel, setCarModel] = useState('RAV4');
  const [carYear, setCarYear] = useState('2020');
  const [partNeeded, setPartNeeded] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+233 24 123 4567');
  const [customerEmail, setCustomerEmail] = useState(user ? user.email : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isPartFinderOpen) return null;

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!partNeeded.trim() || !customerPhone.trim() || !customerEmail.trim()) return;

    setIsSubmitting(true);

    const subject = `RARE AUTO PART REQUEST — ${carMake} ${carModel} (${carYear})`;
    const bodyLines = [
      `Special Auto Body Part Request`,
      ``,
      `Vehicle: ${carMake} ${carModel} (${carYear})`,
      `Part Needed: ${partNeeded.trim()}`,
      `Customer Contact: ${customerPhone}`,
      `Customer Email: ${customerEmail}`,
      ``,
      `Request sent from Samtuberg's Custom Part Finder`
    ];

    const result = await sendToShop({
      subject,
      body: bodyLines.join('\n'),
      replyTo: customerEmail.trim(),
      fields: { phone: customerPhone.trim() }
    });
    setIsSubmitting(false);
    if (!result.delivered) {
      triggerToast(`Could not email ${ORDER_EMAIL}: ${result.reason}`, 'error');
      return;
    }
    setSubmitted(true);
    triggerToast(`Custom part request sent to ${ORDER_EMAIL}!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-700 to-amber-600 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6" />
            <div>
              <h3 className="font-extrabold text-base uppercase tracking-wide">Custom Auto Part Finder</h3>
              <p className="text-xs text-orange-100 font-medium">Request rare body parts not listed in shop catalog</p>
            </div>
          </div>

          <button
            onClick={() => { setIsPartFinderOpen(false); setSubmitted(false); }}
            className="text-white hover:text-orange-200 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-xl text-white">Part Request Dispatched!</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              We received your request for <strong>{carMake} {carModel} ({carYear}) - {partNeeded}</strong>. Our workshop team will inspect inventory and email you at <strong>{customerEmail}</strong>.
            </p>
            <button
              onClick={() => { setIsPartFinderOpen(false); setSubmitted(false); }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-3 px-6 rounded-lg uppercase"
            >
              Done & Return to Shop
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Make</label>
                <input
                  type="text"
                  required
                  value={carMake}
                  onChange={(e) => setCarMake(e.target.value)}
                  placeholder="Toyota"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Model</label>
                <input
                  type="text"
                  required
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="RAV4"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Year</label>
                <input
                  type="text"
                  required
                  value={carYear}
                  onChange={(e) => setCarYear(e.target.value)}
                  placeholder="2020"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold">Exact Body Part Needed</label>
              <textarea
                rows={3}
                required
                value={partNeeded}
                onChange={(e) => setPartNeeded(e.target.value)}
                placeholder="e.g. Front left fender panel, chrome radiator grille, or outer mirror housing..."
                className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+233 24 123 4567"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block">Email</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="samtuberg34@gmail.com"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm py-3.5 rounded-lg flex items-center justify-center gap-2 uppercase tracking-wide shadow-lg"
            >
              <Send className="w-4 h-4" /> {isSubmitting ? 'Submitting Request...' : 'Submit Part Request to Workshop'}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};
