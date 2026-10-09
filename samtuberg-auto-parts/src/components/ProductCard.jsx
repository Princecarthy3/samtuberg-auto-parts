import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Edit3, Check } from 'lucide-react';

export const ProductCard = ({ product }) => {
  const {
    cart,
    addToCart,
    removeFromCart,
    isAdmin,
    updateProductPrice,
    triggerToast,
    formatPrice,
    setSelectedProductDetail
  } = useApp();

  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editedPrice, setEditedPrice] = useState(product.price.toString());

  const isInCart = cart.some(item => item.id === product.id);

  const handleCartToggle = (e) => {
    e.stopPropagation();
    if (isInCart) {
      removeFromCart(product.id);
      triggerToast(`Removed "${product.name}" from cart.`, 'info');
    } else {
      addToCart(product);
      triggerToast(`Added "${product.name}" to cart!`, 'success');
    }
  };

  const handleSavePrice = async (e) => {
    e.stopPropagation();
    const success = await updateProductPrice(product.id, editedPrice);
    if (success) {
      setIsEditingPrice(false);
      triggerToast(`Price for "${product.name}" updated to $${parseFloat(editedPrice).toLocaleString()}!`, 'success');
    }
  };

  const isCar = product.isVehicle || product.category === 'cars';

  return (
    <div className={`product-card ${isCar ? 'card-cars' : ''}`}>
      
      {/* Visual Image Container with License Plate Price Badge */}
      <div 
        className="card-visual cursor-pointer"
        onClick={() => setSelectedProductDetail(product)}
      >
        {/* LICENSE PLATE SPEC BADGE */}
        <span className="spec-plate">
          {formatPrice(product.price)}
        </span>

        <img src={product.image} alt={product.name} />
      </div>

      {/* Card Details */}
      <div className="card-body">
        <span className="card-category font-mono text-[11px] font-bold tracking-widest text-orange-600 uppercase">
          {isCar ? 'Used Vehicle' : (product.subCategory || product.category).replace('_', ' ')}
        </span>

        <h3 className="card-name font-bold text-base text-slate-900 dark:text-slate-100">
          {product.name}
        </h3>

        <p className="card-fit text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
          {product.modelCompatibility} &middot; Year: {product.yearOfManufacture || '2024'}
        </p>

        {/* Store Owner Price Edit Bar if Admin */}
        {isAdmin && (
          <div className="mb-3 p-2 bg-amber-100 rounded border border-amber-300 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900">Owner Edit Price:</span>
            {isEditingPrice ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={editedPrice}
                  onChange={(e) => setEditedPrice(e.target.value)}
                  className="w-20 p-1 text-xs border border-amber-500 rounded font-bold"
                />
                <button onClick={handleSavePrice} className="bg-emerald-600 text-white p-1 rounded">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingPrice(true)}
                className="text-amber-700 font-bold flex items-center gap-1 underline"
              >
                <Edit3 className="w-3 h-3" /> Change Price
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleCartToggle}
          className={`add-cart-btn mt-auto ${isInCart ? 'in-cart' : ''}`}
        >
          {isInCart ? 'In Cart ✓' : 'Add to Cart'}
        </button>
      </div>

    </div>
  );
};
