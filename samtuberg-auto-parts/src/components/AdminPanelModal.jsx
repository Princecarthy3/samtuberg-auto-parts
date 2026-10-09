import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  DollarSign,
  Bell,
  Plus,
  Package,
  Save,
  Clock,
  Mail,
  MapPin,
  Check,
  TrendingUp,
  Sliders,
  Send,
  Trash2,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Users,
  Wallet,
  Percent,
  LayoutPanelTop,
  Star,
  PackageSearch
} from 'lucide-react';

export const AdminPanelModal = () => {
  const {
    products,
    updateProductPrice,
    applyBulkPriceAdjustment,
    addProduct,
    deleteProduct,
    orders,
    salesBackup,
    markOrderAsRead,
    updateOrderStatus,
    exportSalesBackup,
    clearSalesBackup,
    isAdminModalOpen,
    setIsAdminModalOpen,
    triggerToast,
    formatPrice,
    setProductStock,
    applyProductDiscount,
    toggleFeaturedProduct,
    updateSiteContent,
    discounts,
    setDiscounts,
    siteContent,
    adminRole,
    canEditAdminPanel,
    adminActiveTab,
    setAdminActiveTab
  } = useApp();

  const [priceMap, setPriceMap] = useState({});
  const [bulkPercent, setBulkPercent] = useState('5');
  const [bulkCategory, setBulkCategory] = useState('all');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('body_parts');
  const [newProdSubCategory, setNewProdSubCategory] = useState('bumpers');
  const [newProdModel, setNewProdModel] = useState('Toyota Hilux');
  const [newProdYear, setNewProdYear] = useState('2024');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdImage, setNewProdImage] = useState('https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=600&auto=format&fit=crop&q=80');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [previewEmailOrder, setPreviewEmailOrder] = useState(null);

  const customerRows = useMemo(() => {
    const rows = new Map();
    orders.forEach(order => {
      const key = (order.customerEmail || order.customerName || order.phone || 'guest').toLowerCase();
      if (!rows.has(key)) {
        rows.set(key, {
          id: key,
          name: order.customerName,
          email: order.customerEmail,
          phone: order.phone,
          location: order.address,
          orders: 0,
          total: 0,
          lastOrder: order.timestamp
        });
      }
      const entry = rows.get(key);
      entry.orders += 1;
      entry.total += Number(order.total || 0);
      entry.lastOrder = new Date(order.timestamp) > new Date(entry.lastOrder) ? order.timestamp : entry.lastOrder;
    });
    return [...rows.values()].sort((a, b) => b.total - a.total);
  }, [orders]);

  const paymentRows = useMemo(
    () => orders.map(order => ({
      id: order.id,
      customer: order.customerName,
      amount: Number(order.total || 0),
      method: 'Paystack',
      status: order.status || 'Paid',
      date: order.timestamp
    })),
    [orders]
  );

  if (!isAdminModalOpen) return null;

  if (!canEditAdminPanel) {
    return (
      <div className="admin-panel-shell fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="admin-panel-content bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl">
          <div className="admin-panel-header p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-400">Read-only access</p>
              <h3 className="font-extrabold text-lg text-white mt-1">Store tracking dashboard</h3>
            </div>
            <button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              You are logged in as a viewer. You can monitor products, orders, and payments, but only the store admin can create, edit, delete, or change inventory.
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Orders</p><p className="text-2xl font-black text-white mt-2">{orders.length}</p></div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Products</p><p className="text-2xl font-black text-white mt-2">{products.length}</p></div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Revenue</p><p className="text-2xl font-black text-emerald-400 mt-2">{formatPrice(orders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</p></div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Inventory</p><p className="text-2xl font-black text-amber-300 mt-2">{products.reduce((sum, product) => sum + Number(product.stock ?? product.quantity ?? 0), 0)}</p></div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Product overview</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                  {products.slice(0, 12).map(product => (
                    <div key={product.id} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-semibold text-white">{product.name}</p>
                        <p className="text-[11px] text-slate-400">{product.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-300">{formatPrice(product.price)}</p>
                        <p className="text-[11px] text-slate-400">Stock: {product.stock ?? product.quantity ?? 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Recent orders</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                  {orders.slice(0, 12).map(order => (
                    <div key={order.id} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{order.id}</p>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-violet-300">{order.status || 'Paid'}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{order.customerName} • {order.customerEmail}</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${(order.tracking?.progress || 0)}%` }} />
                      </div>
                      <p className="text-xs text-emerald-400 mt-1 font-bold">{formatPrice(Number(order.total || 0))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const unreadCount = orders.filter(order => !order.read).length;
  const totalRevenue = salesBackup.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const inventoryCount = products.reduce((sum, product) => sum + Number(product.stock ?? product.quantity ?? 0), 0);

  const featuredProducts = products.filter(product => (siteContent?.featuredProductIds || []).includes(product.id));
  const currentBanner = siteContent?.banners?.[0] || { eyebrow: '', title: '', subtitle: '', ctaPrimary: '', ctaSecondary: '' };

  const handlePriceChange = (id, val) => {
    setPriceMap(prev => ({ ...prev, [id]: val }));
  };

  const handleSavePrice = async (id, currentPrice) => {
    const targetVal = priceMap[id] !== undefined ? priceMap[id] : currentPrice;
    const success = await updateProductPrice(id, targetVal);
    if (success) {
      triggerToast(`Price updated to $${parseFloat(targetVal).toLocaleString()}!`, 'success');
    } else {
      triggerToast('Invalid price entered.', 'error');
    }
  };

  const handleApplyBulk = async () => {
    const val = parseFloat(bulkPercent);
    if (isNaN(val)) return;
    await applyBulkPriceAdjustment(val, bulkCategory);
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setNewProdImage(loadEvt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;

    const product = await addProduct({
      name: newProdName,
      category: newProdCategory,
      subCategory: newProdCategory === 'cars' ? undefined : newProdSubCategory,
      isVehicle: newProdCategory === 'cars',
      modelCompatibility: newProdModel,
      yearOfManufacture: newProdYear,
      price: parseFloat(newProdPrice),
      stock: 1,
      image: newProdImage || 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=600&auto=format&fit=crop&q=80',
      description: newProdDesc || 'Genuine body part supplied by Samtuberg Auto Parts.',
      specs: { Fitment: newProdModel }
    });

    if (!product) return;
    setNewProdName('');
    setNewProdPrice('');
    setNewProdDesc('');
    setImageFileName('');
    setAdminActiveTab('products');
  };

  return (
    <div className="admin-panel-shell fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="admin-panel-content bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="admin-panel-header p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold">👑</div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-white">Samtuberg Owner World-Class Admin Panel</h3>
              <p className="text-xs text-slate-400">Products, customers, payments, sales, discounts, and website content control</p>
            </div>
          </div>
          <button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="admin-panel-stats grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><Bell className="w-4 h-4" /></div>
            <div><span className="text-slate-400 block">Orders</span><span className="text-base font-extrabold text-white">{orders.length}</span></div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg"><Users className="w-4 h-4" /></div>
            <div><span className="text-slate-400 block">Customers</span><span className="text-base font-extrabold text-violet-300">{customerRows.length}</span></div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><TrendingUp className="w-4 h-4" /></div>
            <div><span className="text-slate-400 block">Revenue</span><span className="text-base font-extrabold text-emerald-400">${totalRevenue.toLocaleString()}</span></div>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg"><Package className="w-4 h-4" /></div>
            <div><span className="text-slate-400 block">Inventory</span><span className="text-base font-extrabold text-amber-300">{inventoryCount}</span></div>
          </div>
        </div>

        <div className="admin-panel-tabs flex flex-wrap border-b border-slate-800 bg-slate-950 px-4 pt-2 gap-2">
          {[
            ['orders', 'Orders', Bell],
            ['products', 'Products', Package],
            ['customers', 'Customers', Users],
            ['track-orders', 'Track Orders', PackageSearch],
            ['payments', 'Payments', Wallet],
            ['sales', 'Sales', TrendingUp],
            ['discounts', 'Discounts', Percent],
            ['content', 'Website Content', LayoutPanelTop]
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setAdminActiveTab(key)}
              className={`admin-panel-tab py-2 px-4 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
                adminActiveTab === key ? 'bg-slate-900 text-rose-400 border-t border-x border-slate-800' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === 'orders' && unreadCount > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">{unreadCount}</span>}
            </button>
          ))}
        </div>

        <div className="admin-panel-body flex-1 overflow-y-auto p-4">
          {adminActiveTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-violet-500/30 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Backup Plan</p>
                  <p className="text-xs text-slate-300 mt-1">Orders are stored locally and can be exported as a JSON archive for business continuity.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportSalesBackup} className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 text-[11px] font-bold rounded-lg">Export Backup</button>
                  <button onClick={clearSalesBackup} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 text-[11px] font-bold rounded-lg border border-slate-700">Clear Archive</button>
                </div>
              </div>

              {orders.length > 0 ? orders.map(order => (
                <div key={order.id} className={`admin-order-card bg-slate-950 p-4 rounded-xl border transition-all ${!order.read ? 'border-rose-500/60 shadow-lg shadow-rose-950/20' : 'border-slate-800'}`} onClick={() => markOrderAsRead(order.id)}>
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white">Order #{order.id}</span>
                        {!order.read && <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">NEW MESSAGE</span>}
                      </div>
                      <p className="text-xs text-slate-300 flex items-center gap-2 mt-1"><Mail className="w-3.5 h-3.5 text-rose-400" /><span><strong>{order.customerName}</strong> ({order.customerEmail})</span></p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-rose-400 block">${Number(order.total || 0).toLocaleString()}</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{new Date(order.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="py-3 space-y-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Items Ordered:</span>
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/60">
                        <span className="text-slate-200 font-semibold">{item.quantity}x {item.name}</span>
                        <span className="text-slate-300 font-bold">${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-wrap justify-between items-center gap-2 text-xs border-t border-slate-900">
                    <span className="text-slate-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-500" />Ship to: {order.address} ({order.phone})</span>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setPreviewEmailOrder(order); }} className="bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-700 py-1 px-2.5 rounded font-bold text-[11px] flex items-center gap-1"><Send className="w-3 h-3" /> Preview Email</button>
                      <span className="text-slate-400 font-semibold">Status:</span>
                      <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="bg-slate-900 border border-slate-700 text-xs text-rose-300 font-bold rounded py-1 px-2">
                        <option value="New Order Received">New Order Received</option>
                        <option value="Packaging Body Parts">Packaging Body Parts</option>
                        <option value="Shipped / In Transit">Shipped / In Transit</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>
                </div>
              )) : <p className="text-center text-slate-500 py-8 text-xs">No orders received yet.</p>}
            </div>
          )}

          {adminActiveTab === 'products' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateProduct} className="space-y-4 max-w-3xl mx-auto bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" />Add New Product</h4>
                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/60">Live Sync</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Product Name</label><input type="text" required value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Base Price (USD)</label><input type="number" required min="1" step="any" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Category</label><select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"><option value="body_parts">Auto Body Part</option><option value="cars">Vehicle</option></select></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">{newProdCategory === 'cars' ? 'Body Style' : 'Sub-Category'}</label><select value={newProdSubCategory} onChange={(e) => setNewProdSubCategory(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs">{newProdCategory === 'cars' ? <><option value="suv">SUV</option><option value="sedan">Sedan</option><option value="pickup">Pickup</option></> : <><option value="bumpers">Bumpers</option><option value="headlights">Headlights</option><option value="taillights">Taillights</option><option value="mirrors">Mirrors</option><option value="grilles">Grilles</option></>}</select></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Compatible Model</label><input type="text" required value={newProdModel} onChange={(e) => setNewProdModel(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Year</label><input type="text" required value={newProdYear} onChange={(e) => setNewProdYear(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                </div>
                <div className="space-y-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5 text-amber-400" />Product Image</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/40 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"><Upload className="w-3.5 h-3.5" /><span>Upload</span><input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" /></label>
                    <input type="url" value={newProdImage} onChange={(e) => setNewProdImage(e.target.value)} placeholder="Paste image URL" className="flex-1 min-w-[200px] p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                  </div>
                  {newProdImage && <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 p-2 rounded-lg"><img src={newProdImage} alt="Preview" className="w-14 h-14 object-cover rounded-md" /><div className="flex-1 min-w-0"><span className="text-xs font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Attached</span><p className="text-[11px] text-slate-400 truncate">{imageFileName || newProdImage}</p></div><button type="button" onClick={() => { setNewProdImage('https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=600&auto=format&fit=crop&q=80'); setImageFileName(''); }} className="text-xs text-slate-400 hover:text-white p-1"><RotateCcw className="w-3.5 h-3.5" /></button></div>}
                </div>
                <div><label className="text-xs font-bold text-slate-300 block mb-1">Description</label><textarea rows="2" value={newProdDesc} onChange={(e) => setNewProdDesc(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs resize-none" /></div>
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2"> <Plus className="w-4 h-4" /> Publish Product </button>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-white">Manage Product Stock & Pricing</h3>
                {products.map(product => (
                  <div key={product.id} className="admin-product-mobile-row bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="admin-product-mobile-main flex items-center gap-3 min-w-0">
                      <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-lg bg-slate-900 shrink-0" />
                      <div className="min-w-0"><h4 className="font-bold text-xs text-white truncate">{product.name}</h4><p className="text-[10px] text-slate-400">{product.modelCompatibility}</p></div>
                    </div>
                    <div className="admin-product-mobile-actions flex flex-wrap items-center justify-end gap-2">
                      <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rose-400 font-bold text-xs">$</span><input type="number" value={priceMap[product.id] ?? product.price} onChange={(e) => handlePriceChange(product.id, e.target.value)} className="w-24 pl-6 pr-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-white font-extrabold rounded-lg" /></div>
                      <input type="number" min="0" value={product.stock ?? product.quantity ?? 0} onChange={(e) => setProductStock(product.id, e.target.value)} className="w-20 px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-white font-bold rounded-lg" />
                      <button onClick={() => handleSavePrice(product.id, product.price)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-[11px] font-bold">Save</button>
                      <button onClick={async () => { if (window.confirm(`Delete "${product.name}" from catalog?`)) await deleteProduct(product.id); }} className="bg-slate-800 hover:bg-slate-700 text-rose-300 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-700">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminActiveTab === 'customers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-extrabold text-white"><Users className="w-4 h-4 text-violet-400" />Customer Directory</div><span className="text-xs text-slate-400">{customerRows.length} active buyers</span></div>
              {customerRows.map(customer => (
                <div key={customer.id} className="admin-customer-card bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{customer.name}</p>
                    <p className="text-xs text-slate-400">{customer.email} • {customer.phone}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{customer.location}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>{customer.orders} orders</p>
                    <p className="font-bold text-emerald-400">${customer.total.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500">Last: {new Date(customer.lastOrder).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminActiveTab === 'track-orders' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-sm font-extrabold text-white mb-3"><PackageSearch className="w-4 h-4 text-amber-400" />Track Order Lookup</div>
                <input
                  type="text"
                  placeholder="Search by order ID, customer email, or name"
                  onChange={(event) => {
                    const query = event.target.value;
                    const nextMatches = query.trim() ? orders.filter(order => {
                      const normalized = query.toLowerCase();
                      return [order.id, order.customerEmail, order.customerName].some(value => String(value || '').toLowerCase().includes(normalized));
                    }) : [];
                    setPreviewEmailOrder(nextMatches[0] || null);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 text-white px-3 py-3 text-sm"
                />
              </div>

              <div className="space-y-3">
                {(orders.length ? orders : []).map(order => (
                  <div key={order.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Order</p>
                        <p className="font-extrabold text-white">{order.id}</p>
                      </div>
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">{order.status || 'New Order Received'}</span>
                    </div>

                    <div className="mt-3 space-y-2">
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

                    <div className="mt-3 text-xs text-slate-300 space-y-1">
                      <p><span className="text-slate-400">Customer:</span> {order.customerName}</p>
                      <p><span className="text-slate-400">Email:</span> {order.customerEmail}</p>
                      <p><span className="text-slate-400">Location:</span> {order.address || 'Accra, Ghana'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminActiveTab === 'payments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-extrabold text-white"><Wallet className="w-4 h-4 text-emerald-400" />Payment Ledger</div><span className="text-xs text-slate-400">Paystack & secure checkout</span></div>
              {paymentRows.map(payment => (
                <div key={payment.id} className="admin-payment-card bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{payment.customer}</p>
                    <p className="text-xs text-slate-400">Invoice #{payment.id} • {payment.method}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p className="font-bold text-emerald-400">${Number(payment.amount || 0).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500">{new Date(payment.date).toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{payment.status}</span>
                </div>
              ))}
            </div>
          )}

          {adminActiveTab === 'sales' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-[11px] uppercase tracking-wider text-slate-400">Order Value</p><p className="mt-2 text-2xl font-extrabold text-emerald-400">${totalSales.toLocaleString()}</p></div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-[11px] uppercase tracking-wider text-slate-400">Saved Backup</p><p className="mt-2 text-2xl font-extrabold text-violet-300">{salesBackup.length}</p></div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-[11px] uppercase tracking-wider text-slate-400">Average Order</p><p className="mt-2 text-2xl font-extrabold text-amber-300">${orders.length ? (totalSales / orders.length).toFixed(0) : '0'}</p></div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-extrabold text-white">Recent transactions</h3><span className="text-[11px] text-slate-400">Updated live</span></div>
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="admin-sales-card flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                      <div>
                        <p className="font-bold text-xs text-white">{order.customerName}</p>
                        <p className="text-[10px] text-slate-500">{order.id} • {new Date(order.timestamp).toLocaleDateString()}</p>
                      </div>
                      <span className="font-extrabold text-emerald-400">${Number(order.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminActiveTab === 'discounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-extrabold text-white"><Percent className="w-4 h-4 text-amber-400" />Discount & Promo Manager</div>
                <button onClick={() => setDiscounts(prev => [...prev, { id: `promo-${Date.now()}`, label: 'New Coupon', percent: 5, active: true }])} className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-2 rounded-lg text-[11px] font-bold">Add Discount</button>
              </div>
              {discounts.map(discount => (
                <div key={discount.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold">{discount.percent}%</div>
                    <div>
                      <input value={discount.label} onChange={(e) => handleDiscountField(discount.id, 'label', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold" />
                      <p className="text-[10px] text-slate-500 mt-1">Auto-applied at checkout when active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-slate-300">Active<input type="checkbox" checked={Boolean(discount.active)} onChange={(e) => handleDiscountField(discount.id, 'active', e.target.checked)} /></label>
                    <input type="number" min="0" max="100" value={discount.percent} onChange={(e) => handleDiscountField(discount.id, 'percent', e.target.value)} className="w-20 px-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-white font-bold rounded-lg" />
                    <button onClick={() => setDiscounts(prev => prev.filter(item => item.id !== discount.id))} className="bg-slate-800 hover:bg-slate-700 text-rose-300 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminActiveTab === 'content' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-white"><LayoutPanelTop className="w-4 h-4 text-violet-400" />Hero Banner Management</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Eyebrow</label><input value={currentBanner.eyebrow || ''} onChange={(e) => handleBannerField('eyebrow', e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Primary CTA</label><input value={currentBanner.ctaPrimary || ''} onChange={(e) => handleBannerField('ctaPrimary', e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-300 block mb-1">Title</label><textarea rows="3" value={currentBanner.title || ''} onChange={(e) => handleBannerField('title', e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs resize-none" /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-300 block mb-1">Subtitle</label><textarea rows="2" value={currentBanner.subtitle || ''} onChange={(e) => handleBannerField('subtitle', e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs resize-none" /></div>
                  <div><label className="text-xs font-bold text-slate-300 block mb-1">Secondary CTA</label><input value={currentBanner.ctaSecondary || ''} onChange={(e) => handleBannerField('ctaSecondary', e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs" /></div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 text-sm font-extrabold text-white"><Star className="w-4 h-4 text-amber-400" />Featured Products</div><span className="text-[11px] text-slate-400">{featuredProducts.length} selected</span></div>
                <div className="space-y-2">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-md shrink-0" />
                        <div className="min-w-0"><p className="text-xs font-bold text-white truncate">{product.name}</p><p className="text-[10px] text-slate-500">{product.modelCompatibility}</p></div>
                      </div>
                      <button onClick={() => toggleFeaturedProduct(product.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${ (siteContent?.featuredProductIds || []).includes(product.id) ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                        {(siteContent?.featuredProductIds || []).includes(product.id) ? 'Featured' : 'Mark Featured'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {previewEmailOrder && (
          <div className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center">
            <div className="bg-white text-slate-900 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl text-xs">
              <div className="flex justify-between items-center border-b pb-2"><span className="font-extrabold text-rose-600 text-sm">SAMTUBERG ORDER INVOICE</span><button onClick={() => setPreviewEmailOrder(null)} className="text-slate-500">✕</button></div>
              <div className="space-y-1"><p><strong>To:</strong> {previewEmailOrder.customerEmail}</p><p><strong>From:</strong> orders@samtubergautoparts.com</p><p><strong>Subject:</strong> Order Confirmation #{previewEmailOrder.id}</p></div>
              <div className="bg-slate-100 p-3 rounded space-y-2"><p className="font-bold">Items Purchased:</p>{previewEmailOrder.items.map((item, idx) => (<div key={idx} className="flex justify-between"><span>{item.quantity}x {item.name}</span><span className="font-bold">${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</span></div>))}<div className="border-t pt-1 flex justify-between font-extrabold text-sm"><span>Total Amount:</span><span className="text-rose-600">${Number(previewEmailOrder.total || 0).toLocaleString()}</span></div></div>
              <button onClick={() => setPreviewEmailOrder(null)} className="w-full bg-slate-900 text-white py-2 rounded font-bold">Close Preview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
