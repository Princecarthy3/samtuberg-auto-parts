import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, CheckCircle, ShieldCheck, Mail, MapPin, Phone, CreditCard, Send } from 'lucide-react';
import confetti from 'canvas-confetti';

export const CheckoutModal = () => {
  const {
    cart,
    user,
    isCheckoutOpen,
    setIsCheckoutOpen,
    createOrder,
    triggerToast
  } = useApp();

  const [fullName, setFullName] = useState(user ? user.name : '');
  const [email, setEmail] = useState(user ? user.email : '');
  const [phone, setPhone] = useState('+1 555-234-8901');
  const [address, setAddress] = useState('104 Auto Parts Blvd');
  const [city, setCity] = useState('New York');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  if (!isCheckoutOpen) return null;

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!email || !fullName || !address) {
      triggerToast('Please complete all required fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({ fullName, email, phone, address, city });
      if (!order) {
        return;
      }

      setPlacedOrder(order);
      setIsSuccess(true);

      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch (err) {
        console.log(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsCheckoutOpen(false);
    setIsSuccess(false);
    setPlacedOrder(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-rose-500" />
            <h3 className="font-display font-extrabold text-base text-white">
              {isSuccess ? 'Order Confirmation' : 'Samtuberg Checkout'}
            </h3>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess && placedOrder ? (
          /* Success Screen */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h3 className="font-display font-extrabold text-xl text-white">Order Placed Successfully!</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              Thank you for ordering with Samtuberg Auto Parts! A copy of your receipt has been logged under your Gmail account (<strong className="text-rose-400">{placedOrder.customerEmail}</strong>).
            </p>

            {/* Notification alert summary */}
            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-left text-xs space-y-1">
              <p className="font-bold text-rose-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Store Owner Notification Sent!
              </p>
              <p className="text-slate-300">
                Order <strong className="text-white">#{placedOrder.id}</strong> has been transmitted directly to the store admin inbox.
              </p>
            </div>

            {/* Receipt Summary Box */}
            <div className="bg-slate-950 p-4 rounded-xl text-left text-xs space-y-2 border border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Order Reference:</span>
                <span className="font-bold text-white">#{placedOrder.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Amount Paid:</span>
                <span className="font-bold text-rose-400">${placedOrder.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping Address:</span>
                <span className="font-semibold text-slate-200">{placedOrder.address}</span>
              </div>
            </div>

            <button onClick={handleClose} className="w-full btn-primary py-3 rounded-xl text-sm font-bold">
              Done & Return to Store
            </button>
          </div>
        ) : (
          /* Checkout Form */
          <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
            
            {/* Account Binding Banner */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-rose-400" />
                <div>
                  <span className="text-slate-400">Ordering as:</span>
                  <p className="font-bold text-white">{email || 'Not logged in'}</p>
                </div>
              </div>
              <span className="badge-tag">Gmail Verified</span>
            </div>

            {/* Input fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Gmail Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 0192"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Delivery Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street Address"
                />
              </div>
            </div>

            {/* Order Total Summary */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">Total Pay Amount:</span>
              <span className="text-lg font-extrabold text-rose-400 font-display">
                ${totalAmount.toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Order...' : 'Confirm Order & Notify Store Owner'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
