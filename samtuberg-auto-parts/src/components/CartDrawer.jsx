import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShoppingBag, X, Trash2, Plus, Minus, Send, CheckCircle2, MessageSquare } from 'lucide-react';

export const CartDrawer = () => {
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    isCartOpen,
    setIsCartOpen,
    setIsPaymentModalOpen,
    setPendingOrderDetails,
    formatPrice,
    placeOrder,
    user
  } = useApp();

  const [customerName, setCustomerName] = useState(user ? user.name : '');
  const [customerPhone, setCustomerPhone] = useState('053 043 1112');
  const [customerEmail, setCustomerEmail] = useState(user ? user.email : 'samtuberg34@gmail.com');
  const [shippingAddress, setShippingAddress] = useState('Accra, Ghana');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  if (!isCartOpen) return null;

  const totalAmountInUSD = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const orderData = {
      name: customerName || 'Valued Customer',
      email: customerEmail || 'samtuberg34@gmail.com',
      phone: customerPhone || '+233 24 123 4567',
      address: shippingAddress || 'Accra, Ghana',
      items: [...cart],
      total: totalAmountInUSD
    };

    setPendingOrderDetails(orderData);
    setIsCartOpen(false);
    setIsPaymentModalOpen(true);
  };

  const handleWhatsAppCheckout = () => {
    if (cart.length === 0) return;
    const name = customerName || 'Valued Customer';
    const itemsStr = cart.map((item, i) => `${i + 1}. ${item.name} (${item.yearOfManufacture || '2024'}) - Qty: ${item.quantity}`).join('%0A');
    const msg = `Hello Samtuberg Auto Parts!%0AI would like to place an order:%0A%0A*Customer:* ${name}%0A*Phone:* ${customerPhone}%0A%0A*Items:*%0A${itemsStr}%0A%0A*Total:* ${formatPrice(totalAmountInUSD)}`;
    
    window.open(`https://wa.me/233241234567?text=${msg}`, '_blank');
  };

  return (
    <div className="cart-backdrop fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="cart-panel bg-white dark:bg-slate-900 w-full max-w-lg h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="cart-header bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-amber-400" />
            <h2 className="font-bold text-lg tracking-wide uppercase">Your Shopping Cart</h2>
          </div>
          <button
            onClick={() => { setIsCartOpen(false); setSubmittedOrder(null); }}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {submittedOrder ? (
          /* SUCCESS CONFIRMATION PANEL */
          <div className="p-8 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white mb-2">Order Sent Successfully!</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Your order has been emailed to <strong>samtuberg34@gmail.com</strong>. We'll confirm availability and delivery with you shortly.
              </p>
            </div>

            <div className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs space-y-2 border border-slate-200 dark:border-slate-700 text-left">
              <p className="font-extrabold text-amber-600">Order ID: #{submittedOrder.id}</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Customer: {submittedOrder.customerName}</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Email: {submittedOrder.customerEmail}</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Phone: {submittedOrder.phone}</p>
              <p className="font-mono text-base font-extrabold text-orange-600 pt-2 border-t border-slate-200 dark:border-slate-700">
                Total: {formatPrice(submittedOrder.total)}
              </p>
            </div>

            <button
              onClick={() => { setSubmittedOrder(null); setIsCartOpen(false); }}
              className="bg-orange-700 hover:bg-orange-800 text-white font-bold text-sm py-3 px-8 rounded-lg uppercase cursor-pointer"
            >
              Done & Continue
            </button>
          </div>
        ) : (
          /* CART CONTENT & CHECKOUT FORM */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Item list */}
            <div className="cart-items flex-1 overflow-y-auto p-5 divide-y divide-slate-200 dark:divide-slate-800">
              {cart.length > 0 ? (
                cart.map(item => (
                  <div key={item.id} className="cart-item py-4 flex items-center gap-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl bg-slate-100 border border-slate-200" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.name}</h4>
                      <p className="text-xs text-slate-500 font-semibold">{item.modelCompatibility} &middot; {item.yearOfManufacture || '2024'}</p>
                      <p className="text-xs font-mono font-extrabold text-orange-600 mt-1">{formatPrice(item.price * item.quantity)}</p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                      <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="p-1 text-slate-600 dark:text-slate-300">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs px-2 text-slate-900 dark:text-white">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="p-1 text-slate-600 dark:text-slate-300">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:text-rose-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                  Your cart is empty. Add a part or a car to get started.
                </div>
              )}
            </div>

            {/* Checkout Footer Form */}
            {cart.length > 0 && (
              <form onSubmit={handleCheckout} className="checkout-form p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Total Amount:</span>
                  <span className="font-mono text-xl font-extrabold text-orange-600">{formatPrice(totalAmountInUSD)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full Name"
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white"
                  />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email (samtuberg34@gmail.com)"
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white"
                />

                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    className="checkout-primary w-full bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 hover:text-white font-black text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider shadow-xl transition-all transform active:scale-95 cursor-pointer border border-amber-400"
                  >
                    <span className="bg-slate-950 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full">MTN MoMo</span>
                    <span>Proceed to Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppCheckout}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-wide shadow-md transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Order via WhatsApp Direct
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
