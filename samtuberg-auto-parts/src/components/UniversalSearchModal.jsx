import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X, ShoppingBag, Eye, Car, Layers, ArrowRight } from 'lucide-react';

export const UniversalSearchModal = () => {
  const {
    isUniversalSearchOpen,
    setIsUniversalSearchOpen,
    products,
    formatPrice,
    addToCart,
    setSelectedProductDetail,
    triggerToast
  } = useApp();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'parts', 'cars', 'headlights', 'bumpers', 'taillights'

  if (!isUniversalSearchOpen) return null;

  const searchResults = products.filter(product => {
    // Type Filter
    if (filterType === 'parts' && (product.isVehicle || product.category === 'cars')) return false;
    if (filterType === 'cars' && (!product.isVehicle && product.category !== 'cars')) return false;
    if (filterType === 'headlights' && product.subCategory !== 'headlights') return false;
    if (filterType === 'bumpers' && product.subCategory !== 'bumpers') return false;
    if (filterType === 'taillights' && product.subCategory !== 'taillights') return false;

    // Search query matching across name, model, year, description, and manufacturer type
    if (query.trim() !== '') {
      const q = query.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchModel = product.modelCompatibility.toLowerCase().includes(q);
      const matchYear = product.yearOfManufacture ? product.yearOfManufacture.toLowerCase().includes(q) : false;
      const matchDesc = product.description ? product.description.toLowerCase().includes(q) : false;
      const matchType = product.manufactureType ? product.manufactureType.toLowerCase().includes(q) : false;
      return matchName || matchModel || matchYear || matchDesc || matchType;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 pt-12">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* TOP SEARCH BAR HEADER */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 flex items-center">
            <Search className="w-6 h-6 absolute left-4 text-amber-500 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all cars & products — e.g. RAV4, HR-V, CR-V, Camry, Civic, 2020, 2026, Headlight, Bumper, Mirror..."
              className="w-full py-3.5 pl-13 pr-10 text-base font-bold bg-slate-900 border-2 border-amber-500/60 rounded-xl text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-500 font-body"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsUniversalSearchOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Close Search"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SEARCH FILTER CHIPS */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest mr-1">
              Filter Results:
            </span>

            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterType === 'all' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Items ({products.length})
            </button>

            <button
              onClick={() => setFilterType('parts')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterType === 'parts' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Auto Body Parts
            </button>

            <button
              onClick={() => setFilterType('cars')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterType === 'cars' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-700 hover:bg-slate-700'
              }`}
            >
              Vehicles for Sale
            </button>

            <button
              onClick={() => setFilterType('headlights')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterType === 'headlights' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Headlights
            </button>

            <button
              onClick={() => setFilterType('bumpers')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterType === 'bumpers' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Bumpers
            </button>
          </div>

          <span className="text-xs font-mono text-amber-400 font-bold">
            {searchResults.length} Match{searchResults.length !== 1 ? 'es' : ''} Found
          </span>
        </div>

        {/* SEARCH RESULTS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {searchResults.length > 0 ? (
            searchResults.map(product => (
              <div
                key={product.id}
                className="bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg bg-slate-900 border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                      {product.modelCompatibility} &middot; Year: {product.yearOfManufacture || '2024'}
                    </span>
                    <h4 className="font-extrabold text-sm text-white truncate my-0.5">
                      {product.name}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {product.manufactureType || 'Genuine OEM Original'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="font-mono text-base font-extrabold text-amber-400 block">
                      {formatPrice(product.price)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">
                      {product.isVehicle ? 'Vehicle' : 'Body Part'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedProductDetail(product);
                        setIsUniversalSearchOpen(false);
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1"
                      title="Inspect Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        addToCart(product);
                        triggerToast(`Added "${product.name}" to cart!`, 'success');
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 p-2 rounded-lg font-extrabold text-xs flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

              </div>
            ))
          ) : (
            <div className="text-center py-16 space-y-3 text-slate-400">
              <Search className="w-12 h-12 text-amber-500/50 mx-auto" />
              <h3 className="text-lg font-bold text-white">No cars or products match your search query</h3>
              <p className="text-xs text-slate-400">
                Try searching for specific model names like "RAV4", "Civic", "HR-V", "CR-V", "Camry" or body part types like "Headlight", "Bumper".
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
