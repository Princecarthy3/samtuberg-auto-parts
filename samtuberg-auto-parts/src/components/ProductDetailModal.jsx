import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, ShoppingBag, Edit3, Check } from 'lucide-react';

export const ProductDetailModal = () => {
  const {
    selectedProductDetail,
    setSelectedProductDetail,
    addToCart,
    isAdmin,
    updateProductPrice,
    triggerToast,
    formatPrice
  } = useApp();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editedPrice, setEditedPrice] = useState('');

  if (!selectedProductDetail) return null;

  const product = selectedProductDetail;

  const handleSavePrice = async () => {
    const success = await updateProductPrice(product.id, editedPrice);
    if (success) {
      setIsEditingPrice(false);
      setSelectedProductDetail(prev => ({ ...prev, price: parseFloat(editedPrice) }));
      triggerToast(`Price updated to $${parseFloat(editedPrice).toLocaleString()}!`, 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 bg-orange-500 text-white flex justify-between items-center">
          <h3 className="font-extrabold text-lg uppercase tracking-wide">{product.name}</h3>
          <button onClick={() => setSelectedProductDetail(null)} className="text-white hover:text-orange-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Product Details */}
        <div className="p-6 space-y-4">
          <div className="h-56 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xl text-slate-900">{product.name}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
          </div>

          {/* Manufacture Metadata Box */}
          <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-200 space-y-1.5 text-xs text-slate-800 font-medium">
            <div className="flex justify-between">
              <span className="font-bold text-orange-900">Year of Manufacture:</span>
              <span className="font-extrabold text-orange-600">{product.yearOfManufacture || '2024'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-orange-900">Type of Manufacture:</span>
              <span className="font-semibold text-slate-900">{product.manufactureType || 'Genuine OEM Original'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-orange-900">Compatible Vehicle:</span>
              <span className="font-semibold text-slate-900">{product.modelCompatibility}</span>
            </div>
          </div>

          {/* Price & Action */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-500 block font-bold uppercase">Listed Price</span>
              {isAdmin && isEditingPrice ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    defaultValue={product.price}
                    onChange={(e) => setEditedPrice(e.target.value)}
                    className="w-28 py-1 px-2 text-xs border border-orange-500 rounded font-bold"
                  />
                  <button onClick={handleSavePrice} className="bg-emerald-600 p-1 rounded text-white">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-orange-600 font-mono">
                    {formatPrice(product.price)}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => { setIsEditingPrice(true); setEditedPrice(product.price.toString()); }}
                      className="text-orange-700 text-xs flex items-center gap-1 font-bold underline"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                addToCart(product);
                triggerToast(`Added "${product.name}" to cart!`, 'success');
                setSelectedProductDetail(null);
              }}
              className="shop-btn w-auto px-6 h-12 text-sm"
            >
              Add to Cart
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
