import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { sendToShop } from '../services/email';
import { 
  Mail, 
  Search, 
  Trash2, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  ArrowLeft, 
  RefreshCw, 
  Send, 
  Check, 
  Tag, 
  X,
  AlertCircle
} from 'lucide-react';

const INBOX_STORAGE_KEY = 'samtuberg_gmail_threads_v1';

const buildInitialThreadForOrder = (order) => ([{
  id: `${order.id}-inbound-${Date.now()}`,
  direction: 'inbound',
  author: order.customerName,
  email: order.customerEmail,
  subject: `Order #${order.id} received`,
  text: `Hello Samtuberg, I would like to purchase the items listed in my order. Please confirm availability and delivery timing.`,
  timestamp: order.timestamp || new Date().toISOString(),
  read: false
}]);

export const GmailInboxPage = ({ onClose }) => {
  const { orders, markOrderAsRead, updateOrderStatus, triggerToast, formatPrice } = useApp();

  const [selectedOrderId, setSelectedOrderId] = useState(orders.length > 0 ? orders[0].id : null);
  const [filterQuery, setFilterQuery] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [mailThreads, setMailThreads] = useState(() => {
    try {
      const saved = localStorage.getItem(INBOX_STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(mailThreads));
    } catch (error) {
      console.warn('Could not persist Gmail threads:', error);
    }
  }, [mailThreads]);

  const filteredOrders = orders.filter(order => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      order.customerEmail.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.id.toLowerCase().includes(q)
    );
  });

  const activeOrder = orders.find(o => o.id === selectedOrderId) || (orders.length > 0 ? orders[0] : null);

  const activeThread = activeOrder
    ? (mailThreads[activeOrder.id] || buildInitialThreadForOrder(activeOrder))
    : [];

  useEffect(() => {
    if (!activeOrder) return;
    setMailThreads((prev) => {
      if (prev[activeOrder.id]) return prev;
      return {
        ...prev,
        [activeOrder.id]: buildInitialThreadForOrder(activeOrder)
      };
    });
  }, [activeOrder, mailThreads]);

  const handleSelectOrder = (order) => {
    setSelectedOrderId(order.id);
    markOrderAsRead(order.id);
    setMobileShowDetail(true);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeOrder) return;

    const messageText = replyMessage.trim();
    const reply = {
      id: `${activeOrder.id}-outbound-${Date.now()}`,
      direction: 'outbound',
      author: 'Samtuberg Auto Parts',
      email: 'support@samtuberg.com',
      subject: `Re: Order #${activeOrder.id}`,
      text: messageText,
      timestamp: new Date().toISOString(),
      read: true
    };

    setMailThreads((prev) => ({
      ...prev,
      [activeOrder.id]: [...((prev[activeOrder.id] || buildInitialThreadForOrder(activeOrder))), reply]
    }));

    try {
      const result = await sendToShop({
        subject: `Re: Order #${activeOrder.id}`,
        body: `Customer: ${activeOrder.customerName}\nEmail: ${activeOrder.customerEmail}\n\n${messageText}`,
        replyTo: activeOrder.customerEmail,
        fields: {
          order_id: activeOrder.id,
          customer_name: activeOrder.customerName,
          customer_email: activeOrder.customerEmail,
          message: messageText,
          mail_type: 'reply'
        }
      });

      if (result?.delivered) {
        triggerToast(`Email reply sent to ${activeOrder.customerEmail}!`, 'success');
      } else {
        triggerToast(`Reply saved locally and queued: ${result?.reason || 'Email gateway unavailable'}`, 'info');
      }
    } catch (error) {
      triggerToast(`Reply saved locally. External email service unavailable: ${error.message}`, 'info');
    }

    setReplyMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/90 backdrop-blur-md flex justify-center items-center p-2 sm:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* TOP GMAIL HEADER BAR */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white font-extrabold text-xl shadow">
              M
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg flex items-center gap-2">
                <span>Samtuberg Gmail Order Inbox</span>
                <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {orders.length} Messages
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Official Order Notifications Inbox • Receiving Customer Order Emails in Real-Time
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Close Inbox"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* MAIN RESPONSIVE INBOX BODY */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* LEFT SIDEBAR: EMAIL MESSAGES LIST */}
          <div className={`w-full md:w-5/12 lg:w-4/12 border-r border-slate-200 bg-slate-50 flex flex-col ${
            mobileShowDetail ? 'hidden md:flex' : 'flex'
          }`}>
            
            {/* Search Input in Inbox */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search Gmail messages..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Email List Scrollable Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const isSelected = activeOrder && activeOrder.id === order.id;

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-orange-100/90 border-l-4 border-orange-500'
                          : !order.read
                          ? 'bg-white font-extrabold border-l-4 border-rose-500'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-extrabold text-xs text-slate-900 truncate max-w-[170px]">
                          {order.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-rose-600 truncate max-w-[180px]">
                          {order.customerEmail}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {formatPrice(order.total)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate">
                        New Auto Parts Order #{order.id} • {order.items.length} Items
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {order.status}
                        </span>

                        {!order.read && (
                          <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                            UNREAD
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                  No Gmail order messages found.
                </div>
              )}
            </div>

          </div>

          {/* RIGHT PANEL: SELECTED EMAIL MESSAGE DETAIL BODY */}
          <div className={`w-full md:w-7/12 lg:w-8/12 bg-white flex flex-col overflow-hidden ${
            !mobileShowDetail ? 'hidden md:flex' : 'flex'
          }`}>
            
            {activeOrder ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Email Header Bar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileShowDetail(false)}
                    className="md:hidden flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Inbox
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      Order Notification #{activeOrder.id}
                    </span>
                    <span className="text-xs bg-orange-100 text-orange-900 px-2 py-0.5 rounded font-bold">
                      Gmail Verified
                    </span>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Update Status:</span>
                    <select
                      value={activeOrder.status}
                      onChange={(e) => updateOrderStatus(activeOrder.id, e.target.value)}
                      className="bg-white border border-slate-300 text-xs font-bold text-orange-600 py-1 px-2 rounded-lg"
                    >
                      <option value="New Order Received">New Order Received</option>
                      <option value="Packaging Body Parts">Packaging Body Parts</option>
                      <option value="Shipped / In Transit">Shipped / In Transit</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>

                </div>

                {/* Email Content Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Sender Info Banner */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-rose-500 text-white font-extrabold text-lg flex items-center justify-center shadow">
                        {activeOrder.customerName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">{activeOrder.customerName}</h3>
                        <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {activeOrder.customerEmail}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5" /> Phone: {activeOrder.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <p className="font-semibold">{new Date(activeOrder.timestamp).toLocaleDateString()}</p>
                      <p>{new Date(activeOrder.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Delivery Address Box */}
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-xs text-slate-800 space-y-1">
                    <span className="font-bold text-orange-900 uppercase tracking-wider block flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-orange-600" /> Delivery & Shipping Destination:
                    </span>
                    <p className="font-bold text-slate-900 text-sm">{activeOrder.address}</p>
                  </div>

                  {/* Itemized Order Table */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm text-slate-900">Purchased Items Breakdown</h4>
                    <table className="w-full border-collapse border border-slate-200 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold">
                          <th className="p-2.5 text-left border-b">Item</th>
                          <th className="p-2.5 text-center border-b">Qty</th>
                          <th className="p-2.5 text-right border-b">Price</th>
                          <th className="p-2.5 text-right border-b">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeOrder.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="p-2.5 font-bold text-slate-800">{item.name}</td>
                            <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                            <td className="p-2.5 text-right">{formatPrice(item.price)}</td>
                            <td className="p-2.5 text-right font-extrabold text-orange-600">
                              {formatPrice(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Payment Summary */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">Total Order Pay Amount:</span>
                    <span className="text-2xl font-extrabold font-mono text-orange-400">
                      {formatPrice(activeOrder.total)}
                    </span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-slate-900">Message Thread</h4>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Inbox sync ON</span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                      {activeThread.map((message) => {
                        const isOutgoing = message.direction === 'outbound';
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`w-full max-w-md rounded-2xl border p-3 ${
                                isOutgoing
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] opacity-80">
                                  {isOutgoing ? 'You' : message.author}
                                </span>
                                <span className={`text-[10px] ${isOutgoing ? 'text-orange-100' : 'text-slate-400'}`}>
                                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className={`text-xs leading-5 ${isOutgoing ? 'text-white' : 'text-slate-700'}`}>
                                {message.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reply Email Input Box */}
                  <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Send Quick Email Reply to {activeOrder.customerEmail}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="e.g. Your auto body parts have been packaged and dispatched!"
                        className="flex-1 p-2.5 text-xs bg-slate-100 border border-slate-300 rounded-xl font-semibold"
                      />
                      <button
                        type="submit"
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  </form>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs font-bold">
                Select an order message from the inbox list to view details.
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
