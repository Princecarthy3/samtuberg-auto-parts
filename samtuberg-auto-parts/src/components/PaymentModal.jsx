import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPaystackConfig, normalizeGhanaPhone, verifyPaystackReference, getPaystackApiBase } from '../services/paystack';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  CheckCircle2, 
  Printer, 
  Copy, 
  FileText, 
  ArrowLeft, 
  Zap,
  Sparkles,
  Smartphone,
  Building2
} from 'lucide-react';

export const PaymentModal = () => {
  const {
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    pendingOrderDetails,
    placeOrder,
    triggerToast,
    formatPrice,
    clearCart
  } = useApp();

  // Mode: 'pre_receipt' (First Receipt) or 'paystack'
  const [activeTab, setActiveTab] = useState('pre_receipt');
  const [selectedChannel, setSelectedChannel] = useState('mtn'); // 'mtn', 'telecel', 'access', 'card'
  const [payerPhone, setPayerPhone] = useState('0530431112');
  const [isPaystackProcessing, setIsPaystackProcessing] = useState(false);
  const [showFinalReceiptView, setShowFinalReceiptView] = useState(false);

  // Receipt details
  const [invoiceNumber] = useState(`INV-STB-${Math.floor(100000 + Math.random() * 900000)}`);
  const [finalReceiptNumber, setFinalReceiptNumber] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [paidPaymentMethod, setPaidPaymentMethod] = useState('');
  const [paymentTimestamp, setPaymentTimestamp] = useState('');

  // Official Receiving Accounts
  const MOMO_RECEIVING_NUMBER = '0530431112';
  const ACCESS_BANK_ACC = '1045000004302';

  // Reset & Default to First Receipt when modal opens
  useEffect(() => {
    if (pendingOrderDetails) {
      setShowFinalReceiptView(false);
      setActiveTab('pre_receipt');
      setSelectedChannel('mtn');
      setPayerPhone(pendingOrderDetails.phone || '0530431112');
      setIsPaystackProcessing(false);
    }
  }, [pendingOrderDetails, isPaymentModalOpen]);

  if (!isPaymentModalOpen || !pendingOrderDetails) return null;

  const totalAmount = pendingOrderDetails.total || 0;
  const items = pendingOrderDetails.items || [];
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const finalizeOrder = (method, details, receiptNo, refCode) => {
    placeOrder({
      ...pendingOrderDetails,
      paymentMethod: method,
      paymentDetails: details,
      receiptNumber: receiptNo,
      transactionRef: refCode,
      paidAt: currentDate
    });
    clearCart();
    triggerToast(`Order confirmed & payment verified! (${receiptNo})`, 'success');
  };

  const getChannelName = (chan) => {
    switch (chan) {
      case 'mtn': return `MTN Mobile Money (Line: ${MOMO_RECEIVING_NUMBER})`;
      case 'telecel': return 'Telecel Cash (Vodafone)';
      case 'access': return `Access Bank Ghana PLC (Acc: ${ACCESS_BANK_ACC})`;
      case 'card': return 'Debit / Credit Card (Visa & Mastercard)';
      default: return 'Paystack Gateway';
    }
  };

  // Official Paystack Popup Handler
  const handleLaunchPaystack = async () => {
    setIsPaystackProcessing(true);
    const custEmail = pendingOrderDetails.email || 'samtuberg34@gmail.com';
    const chosenMethod = getChannelName(selectedChannel);

    try {
      const { apiBase, publicKey } = await fetchPaystackConfig();
      const pRef = `PSTK-GH-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

      if (!window.PaystackPop || typeof window.PaystackPop.setup !== 'function') {
        throw new Error('Paystack checkout script did not load. Please refresh the page and try again.');
      }

      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: custEmail,
        amount: Math.round(totalAmount * 100),
        currency: 'GHS',
        channels: ['mobile_money', 'card', 'bank_transfer', 'bank', 'qr'],
        ref: pRef,
        metadata: {
          custom_fields: [
            { display_name: 'Customer Name', variable_name: 'customer_name', value: pendingOrderDetails.name || 'Valued Customer' },
            { display_name: 'Customer Phone', variable_name: 'customer_phone', value: normalizeGhanaPhone(payerPhone) || payerPhone },
            { display_name: 'Selected Channel', variable_name: 'channel', value: chosenMethod },
            { display_name: 'Receiving Line', variable_name: 'receiving_line', value: MOMO_RECEIVING_NUMBER }
          ]
        },
        callback: async function(response) {
          try {
            const verified = await verifyPaystackReference(apiBase, response.reference || pRef, totalAmount, 'GHS');
            completeTransaction(`Paystack Gateway — ${chosenMethod}`, verified.reference || response.reference || pRef);
          } catch (error) {
            setIsPaystackProcessing(false);
            triggerToast(error.message || 'Paystack payment verification failed.', 'error');
          }
        },
        onClose: function() {
          setIsPaystackProcessing(false);
          triggerToast('Paystack checkout was closed before confirmation.', 'info');
        }
      });

      handler.openIframe();
    } catch (error) {
      setIsPaystackProcessing(false);
      triggerToast(error.message || 'Paystack could not start securely.', 'error');
    }
  };

  // 1-Click Authorize & Generate Final Paid Receipt
  const handleQuickAuthorize = async () => {
    setIsPaystackProcessing(true);
    const chosenMethod = getChannelName(selectedChannel);
    const authRef = `PSTK-AUTH-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const apiBase = getPaystackApiBase();
      if (!apiBase) {
        throw new Error('Paystack verification server is not configured.');
      }

      const verified = await verifyPaystackReference(apiBase, authRef, totalAmount, 'GHS');
      completeTransaction(`Paystack Verified Settlement — ${chosenMethod}`, verified.reference || authRef);
    } catch (error) {
      setIsPaystackProcessing(false);
      triggerToast(error.message || 'Secure verification failed for this payment.', 'error');
    }
  };

  const completeTransaction = (method, reference) => {
    const generatedReceiptNo = `REC-STB-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxnRef(reference);
    setFinalReceiptNumber(generatedReceiptNo);
    setPaidPaymentMethod(method);
    setPaymentTimestamp(currentDate);

    finalizeOrder(
      method,
      `Reference: ${reference} - Payer: ${payerPhone} - Destination: Samtuberg (${MOMO_RECEIVING_NUMBER})`,
      generatedReceiptNo,
      reference
    );

    setIsPaystackProcessing(false);
    setShowFinalReceiptView(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = (text) => {
    navigator.clipboard.writeText(text);
    triggerToast('Receipt summary copied to clipboard!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-100 print:bg-white print:border-none print:shadow-none print:m-0 print:p-0">
        
        {/* TOP MODAL HEADER WITH CLEAR CLOSE BUTTON */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              ST
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                {showFinalReceiptView 
                  ? 'Official Final Paid Receipt' 
                  : activeTab === 'pre_receipt' 
                    ? 'Pre-Payment Checkout Invoice (First Receipt)' 
                    : 'Paystack Secure Checkout'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {showFinalReceiptView 
                  ? 'Payment Confirmed & Settled' 
                  : `Receiving MoMo: ${MOMO_RECEIVING_NUMBER} &bull; Access Bank: ${ACCESS_BANK_ACC}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP NAVIGATOR TABS */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/90 border-b border-slate-800 text-xs print:hidden gap-2">
          <button
            type="button"
            onClick={() => { setShowFinalReceiptView(false); setActiveTab('pre_receipt'); }}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !showFinalReceiptView && activeTab === 'pre_receipt'
                ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. First Receipt (Invoice)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (showFinalReceiptView) {
                // remain on final receipt
              } else {
                setActiveTab('paystack');
              }
            }}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              showFinalReceiptView
                ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                : activeTab === 'paystack'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {showFinalReceiptView ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>2. Final Paid Receipt (Verified)</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>2. Choose Gateway &amp; Pay</span>
              </>
            )}
          </button>
        </div>

        {/* =========================================================
            STAGE 2: FINAL OFFICIAL PAID RECEIPT (POST-PAYMENT)
            ========================================================= */}
        {showFinalReceiptView ? (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-900 text-slate-100 print:p-2 print:bg-white print:text-black">
            
            <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 relative print:border-none print:shadow-none">
              {/* PAID STAMP */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 border-4 border-emerald-600 text-emerald-600 font-black text-xs sm:text-sm uppercase tracking-widest px-3 py-1 rounded-lg transform rotate-[-8deg] pointer-events-none opacity-90 shadow-sm">
                GH₵ PAID &amp; VERIFIED
              </div>

              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 text-amber-400 font-black text-base flex items-center justify-center">
                    ST
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">SAMTUBERG AUTO PARTS &amp; CARS</h2>
                    <p className="text-[11px] font-semibold text-slate-600">Official Payment Receipt &bull; Accra, Ghana</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between items-center text-xs pt-2 text-slate-600">
                  <p>Order Email: <strong>samtuberg34@gmail.com</strong></p>
                  <p className="font-mono text-[11px]">Issued: {paymentTimestamp || currentDate}</p>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Receipt No:</span>
                  <span className="font-mono font-black text-slate-900">{finalReceiptNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Transaction Ref:</span>
                  <span className="font-mono font-extrabold text-amber-700">{txnRef}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Channel:</span>
                  <span className="font-bold text-slate-900 truncate block">{paidPaymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Status:</span>
                  <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                </div>
              </div>

              {/* Customer Box */}
              <div className="text-xs mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-100 rounded-lg text-slate-800">
                <p><strong>Billed To:</strong> {pendingOrderDetails.name || 'Valued Customer'}</p>
                <p><strong>Payer Contact:</strong> {payerPhone}</p>
                <p><strong>Receiving Destination:</strong> {pendingOrderDetails.address || 'Accra, Ghana'}</p>
                <p><strong>Merchant MoMo Line:</strong> {MOMO_RECEIVING_NUMBER}</p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-700 font-black">
                      <th className="py-2">Item Description</th>
                      <th className="py-2">Model / Fit</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="py-2.5 text-slate-600">{item.modelCompatibility || 'Universal'} ({item.yearOfManufacture || '2024'})</td>
                        <td className="py-2.5 text-center font-bold text-slate-800">{item.quantity}</td>
                        <td className="py-2.5 text-right font-mono text-slate-700">{formatPrice(item.price)}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Row */}
              <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center mb-4">
                <div>
                  <span className="text-xs text-slate-600 block">Total Amount Paid in Ghana Cedis:</span>
                  <span className="text-[11px] text-emerald-700 font-bold">Processed securely via Paystack Ghana</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-slate-950">{formatPrice(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS FOR FINAL RECEIPT */}
            <div className="flex flex-wrap gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopySummary(`RECEIPT: ${finalReceiptNumber} | REF: ${txnRef} | TOTAL: GH₵${totalAmount.toLocaleString()} | SAMTUBERG AUTO PARTS`)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Summary</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done &amp; Continue Shopping</span>
              </button>
            </div>

          </div>
        ) : activeTab === 'pre_receipt' ? (
          /* =========================================================
             STAGE 1: FIRST RECEIPT (CHECKOUT INVOICE) — SHOWN FIRST!
             ========================================================= */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-900 text-slate-100 print:p-2 print:bg-white print:text-black">
            
            {/* Top Notification Banner */}
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-200 print:hidden">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>First Receipt Generated:</strong> Here is your official Pre-Payment Checkout Invoice. Review and proceed to choose payment method.</span>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1 bg-slate-950 text-amber-300 rounded border border-amber-400/40 hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3 h-3" /> Print
              </button>
            </div>

            <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 relative print:border-none print:shadow-none">
              
              {/* STATUS BADGE */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 border-2 border-amber-600 text-amber-700 bg-amber-50 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider px-2.5 py-1 rounded-lg">
                GH₵ READY FOR PAYMENT
              </div>

              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 text-amber-400 font-black text-base flex items-center justify-center">
                    ST
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">SAMTUBERG AUTO PARTS &amp; CARS</h2>
                    <p className="text-[11px] font-semibold text-slate-600">Pre-Payment Checkout Invoice (First Receipt) &bull; Accra, Ghana</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-between items-center text-xs pt-2 text-slate-600">
                  <p>Notification Address: <strong>samtuberg34@gmail.com</strong></p>
                  <p className="font-mono text-[11px]">Date: {currentDate}</p>
                </div>
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs mb-4">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Invoice ID:</span>
                  <span className="font-mono font-black text-slate-900">{invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Customer Name:</span>
                  <span className="font-bold text-slate-900">{pendingOrderDetails.name || 'Valued Customer'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Customer Contact:</span>
                  <span className="font-bold text-slate-900">{pendingOrderDetails.phone || '0530431112'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-700 font-black">
                      <th className="py-2">Item Description</th>
                      <th className="py-2">Compatibility</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Price</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2 font-bold text-slate-900">{item.name}</td>
                        <td className="py-2 text-slate-600">{item.modelCompatibility || 'Genuine'} ({item.yearOfManufacture || '2024'})</td>
                        <td className="py-2 text-center font-bold">{item.quantity}</td>
                        <td className="py-2 text-right font-mono">{formatPrice(item.price)}</td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ultra-Visible Amount Banner on Invoice */}
              <div className="p-4 bg-slate-950 border-2 border-amber-500 rounded-xl flex items-center justify-between mb-4 shadow-lg">
                <div>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-amber-300 block">TOTAL AMOUNT PAYABLE (GHANA CEDIS):</span>
                  <span className="text-[11px] text-slate-400">All prices in GH₵ &bull; Official Samtuberg Automotive Receipt</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-3xl font-black text-amber-400 drop-shadow-md">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              {/* Unified Settlement Channel Note */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950">
                <h4 className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" /> Receiving Destination Accounts:
                </h4>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  &bull; MTN Mobile Money: <strong>{MOMO_RECEIVING_NUMBER}</strong><br/>
                  &bull; Access Bank Ghana PLC: Account <strong>{ACCESS_BANK_ACC}</strong> (Samtuberg Auto Parts &amp; Cars)<br/>
                  &bull; Paystack Gateway: Automated push prompt directly to your phone.
                </p>
              </div>

            </div>

            {/* PRE-INVOICE ACTION BUTTONS — PROMINENT, HIGH CONTRAST & ALWAYS VISIBLE */}
            <div className="flex flex-wrap gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="bg-white hover:bg-rose-50 text-rose-600 font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border-2 border-rose-400 transition-all cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
                <span>Close Invoice</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-600 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paystack')}
                className="flex-1 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black py-3.5 px-5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer uppercase tracking-wider transform active:scale-98 border border-amber-400"
              >
                <span>Proceed to Choose Payment Method →</span>
              </button>
            </div>

          </div>
        ) : (
          /* =========================================================
             STAGE 2: INTERACTIVE GATEWAY SELECTOR (MTN, TELECEL, ACCESS, CARDS)
             ========================================================= */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            
            {/* ULTRA-PROMINENT AMOUNT PAYABLE DISPLAY (MASSIVE, HIGH-CONTRAST & UNMISSABLE) */}
            <div className="p-5 bg-black border-2 border-amber-500 rounded-2xl text-center shadow-2xl shadow-amber-500/20 space-y-1">
              <span className="text-xs uppercase tracking-widest font-black text-amber-300 block">
                ★ TOTAL AMOUNT PAYABLE ★
              </span>
              <div className="font-mono text-3xl sm:text-5xl font-black text-amber-400 drop-shadow-lg my-1">
                {formatPrice(totalAmount)}
              </div>
              <span className="text-[11px] text-slate-300 block">
                Official Samtuberg Store Checkout &bull; Ghana Cedis (GH₵)
              </span>
            </div>

            {/* INTERACTIVE PAYSTACK GATEWAY CHANNELS - CLICKABLE & RESPONSIVE */}
            <div className="space-y-2">
              <label className="text-xs font-black text-amber-300 uppercase tracking-wider block">
                Select Your Payment Channel (Click to Choose):
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. MTN Mobile Money */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('mtn')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'mtn'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-yellow-400 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> MTN MoMo
                    </span>
                    {selectedChannel === 'mtn' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-300">Receiving: <strong>{MOMO_RECEIVING_NUMBER}</strong></p>
                  <small className="text-[9.5px] text-amber-300/80">Direct Phone USSD Prompt</small>
                </button>

                {/* 2. Telecel Cash */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('telecel')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'telecel'
                      ? 'bg-rose-500/20 border-rose-400 text-white shadow-lg shadow-rose-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> Telecel Cash
                    </span>
                    {selectedChannel === 'telecel' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-300">Vodafone Wallet</p>
                  <small className="text-[9.5px] text-rose-300/80">Instant Mobile Authorisation</small>
                </button>

                {/* 3. Access Bank Ghana */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('access')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'access'
                      ? 'bg-blue-500/20 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-blue-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Access Bank
                    </span>
                    {selectedChannel === 'access' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-300">Acc: <strong>{ACCESS_BANK_ACC}</strong></p>
                  <small className="text-[9.5px] text-blue-300/80">Samtuberg Auto Parts &amp; Cars</small>
                </button>

                {/* 4. Debit Cards */}
                <button
                  type="button"
                  onClick={() => setSelectedChannel('card')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedChannel === 'card'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Visa / Mastercard
                    </span>
                    {selectedChannel === 'card' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-300">Bank Card / Gh-Link</p>
                  <small className="text-[9.5px] text-emerald-300/80">3D Secure 256-Bit SSL</small>
                </button>
              </div>
            </div>

            {/* SELECTED CHANNEL DETAIL BOX */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Active Channel Selected:</span>
                <strong className="text-amber-400 font-bold">
                  {selectedChannel === 'mtn' && 'MTN Mobile Money'}
                  {selectedChannel === 'telecel' && 'Telecel Cash (Vodafone)'}
                  {selectedChannel === 'access' && 'Access Bank Ghana PLC'}
                  {selectedChannel === 'card' && 'Visa / Mastercard'}
                </strong>
              </div>

              {(selectedChannel === 'mtn' || selectedChannel === 'telecel') && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Your Mobile Money Number (Payer):
                  </label>
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                    <span className="px-3 py-2 bg-slate-800 text-xs font-bold text-slate-300 border-r border-slate-700">
                      🇬🇭 +233
                    </span>
                    <input
                      type="tel"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent text-white text-sm font-semibold focus:outline-none"
                      placeholder="e.g. 0530431112"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-400 pt-0.5">
                    Money sent will be received on Samtuberg official line: <strong>{MOMO_RECEIVING_NUMBER}</strong>
                  </p>
                </div>
              )}

              {selectedChannel === 'access' && (
                <div className="space-y-1 pt-1 text-xs">
                  <p className="text-slate-300">
                    Official Corporate Account: <strong>{ACCESS_BANK_ACC}</strong>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Account Name: <strong>Samtuberg Auto Parts &amp; Cars</strong> &bull; Branch: Accra Hub
                  </p>
                </div>
              )}

              {selectedChannel === 'card' && (
                <div className="pt-1 text-xs text-slate-400">
                  <p>All local Ghanaian and international cards (Visa, Mastercard, Verve) accepted.</p>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS — GUARANTEED RESPONSIVE & WORKING */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleLaunchPaystack}
                disabled={isPaystackProcessing}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-600 to-amber-500 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black py-4 px-4 rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 transition-all cursor-pointer uppercase tracking-wider transform active:scale-98 border-2 border-amber-400"
              >
                <CreditCard className="w-5 h-5" />
                <span>
                  {isPaystackProcessing 
                    ? 'Processing Payment...' 
                    : `Pay ${formatPrice(totalAmount)} via Paystack`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleQuickAuthorize}
                disabled={isPaystackProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white font-black py-3.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                <Zap className="w-4 h-4 text-emerald-200" />
                <span>Authorize &amp; Generate Official Final Paid Receipt</span>
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('pre_receipt')}
                  className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Back to First Receipt (Invoice)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                >
                  Cancel &amp; Close
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
