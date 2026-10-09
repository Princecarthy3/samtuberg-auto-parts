import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ProductCard } from './ProductCard';
import { MyGarageBar } from './MyGarageBar';
import { BodyMapSelector } from './BodyMapSelector';
import { Search, X, Calendar, Wrench } from 'lucide-react';

export const ProductGrid = () => {
  const {
    products,
    activeTab,
    setActiveTab,
    selectedModel,
    setSelectedModel,
    searchQuery,
    setSearchQuery,
    setIsPartFinderOpen
  } = useApp();

  const [selectedEra, setSelectedEra] = useState('all');

  const modelsList = [
    'all',
    'Honda HR-V',
    'Honda CR-V',
    'Toyota RAV4',
    'Toyota Corolla',
    'Toyota Camry',
    'Toyota Highlander',
    'Toyota Tacoma',
    'Honda Civic',
    'Honda Accord',
    'Ford Mustang',
    'Jeep Wrangler'
  ];

  const filteredProducts = products.filter(product => {
    if (activeTab === 'body_parts' && product.category !== 'body_parts') return false;
    if (activeTab === 'cars' && product.category !== 'cars') return false;
    if (activeTab === 'headlights' && product.subCategory !== 'headlights') return false;
    if (activeTab === 'taillights' && product.subCategory !== 'taillights') return false;
    if (activeTab === 'bumpers' && product.subCategory !== 'bumpers') return false;
    if (activeTab === 'mirrors' && product.subCategory !== 'mirrors') return false;
    if (activeTab === 'grilles' && product.subCategory !== 'grilles') return false;

    if (selectedModel !== 'all' && product.modelCompatibility !== selectedModel) return false;

    // Era Filter (2000 - 2026)
    if (selectedEra !== 'all') {
      const yearStr = product.yearOfManufacture || '';
      const yearsMatch = yearStr.match(/\d{4}/g);
      if (yearsMatch) {
        const startYear = parseInt(yearsMatch[0]);
        if (selectedEra === '2000-2009' && (startYear < 2000 || startYear > 2009)) return false;
        if (selectedEra === '2010-2018' && (startYear < 2010 || startYear > 2018)) return false;
        if (selectedEra === '2019-2026' && (startYear < 2019 || startYear > 2026)) return false;
      }
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchModel = product.modelCompatibility.toLowerCase().includes(q);
      const matchYear = product.yearOfManufacture ? product.yearOfManufacture.toLowerCase().includes(q) : false;
      const matchDesc = product.description ? product.description.toLowerCase().includes(q) : false;
      return matchName || matchModel || matchYear || matchDesc;
    }

    return true;
  });

  const partsProducts = filteredProducts.filter(p => !p.isVehicle && p.category !== 'cars');
  const vehicleProducts = filteredProducts.filter(p => p.isVehicle || p.category === 'cars');

  return (
    <div className="product-grid-wrapper">
      
      {/* 1. AUTO PARTS SECTION */}
      <section id="parts" className="max-w-6xl mx-auto mb-20">
        <div className="text-center mb-8">
          <p className="section-eyebrow">Our Main Business</p>
          <h2 className="section-title">Auto Body Parts ({products.length} Items)</h2>
          <p className="section-sub mx-auto">
            Bumpers, headlights, taillights, shells, fenders & mirrors — search or filter by category below.
          </p>
        </div>

        {/* MY GARAGE 100% FITMENT VERIFIER */}
        <MyGarageBar />

        {/* INTERACTIVE BODY MAP SELECTOR */}
        <BodyMapSelector />

        {/* ITEM SEARCH BAR */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search HR-V, CR-V, RAV4, Camry, 2015, 2020, 2026, Headlight, Bumper..."
              className="w-full py-4 pl-12 pr-12 text-base font-semibold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
            <Search className="w-5 h-5 absolute left-4 text-amber-500 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-slate-400 hover:text-slate-800 p-1"
                title="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center text-xs font-bold text-amber-600 mt-2">
              Showing results for: "{searchQuery}" ({filteredProducts.length} items found)
            </p>
          )}
        </div>

        {/* CUSTOM RARE PART REQUEST BUTTON */}
        <div className="text-center mb-8">
          <button
            onClick={() => setIsPartFinderOpen(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-700 to-amber-600 hover:from-orange-800 hover:to-amber-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Can't find your specific body part? Request Rare Part Here</span>
          </button>
        </div>

        {/* MODEL QUICK FILTER BAR */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 max-w-5xl mx-auto mb-8">
          <span className="block text-center text-xs uppercase tracking-widest font-extrabold text-slate-500 mb-3">
            ⚡ Filter by Car Model:
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {modelsList.map(modelName => {
              const count = modelName === 'all' 
                ? products.length 
                : products.filter(p => p.modelCompatibility === modelName).length;

              return (
                <button
                  key={modelName}
                  onClick={() => setSelectedModel(modelName)}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all ${
                    selectedModel === modelName 
                      ? 'bg-orange-700 text-white shadow' 
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-100'
                  }`}
                >
                  {modelName === 'all' ? 'All Models' : `${modelName} (${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* PARTS GRID */}
        {partsProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {partsProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-10 text-center rounded-xl shadow border border-slate-200 dark:border-slate-800 max-w-md mx-auto space-y-3">
            <p className="font-bold text-slate-700 dark:text-slate-300 text-base">No auto body parts match your search</p>
            <p className="text-xs text-slate-500">Try clearing filters or request a rare part.</p>
            <button
              onClick={() => setIsPartFinderOpen(true)}
              className="bg-orange-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg"
            >
              Request Custom Part
            </button>
          </div>
        )}
      </section>

      {/* 2. CARS FOR SALE SECTION */}
      <section id="cars" className="bg-slate-100 dark:bg-slate-950 py-16 px-6 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="section-eyebrow">A Smaller Selection</p>
            <h2 className="section-title">Cars For Sale</h2>
            <p className="section-sub mx-auto">A short, hand-picked list of clean used cars — updated as stock changes.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicleProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};
