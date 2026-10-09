import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ProductCard } from './ProductCard';
import { Zap, Clock, Flame } from 'lucide-react';

export const FlashDealsBanner = () => {
  const { products, formatPrice } = useApp();

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 32, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const flashDealProducts = products.filter(p => p.isFlashDeal);

  if (flashDealProducts.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-4">
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950/50 p-6 rounded-2xl border border-rose-500/40 shadow-2xl space-y-6">
        
        {/* Header with Jumia Flash Deal Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-extrabold shadow-lg animate-bounce">
              <Zap className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
                  FLASH SALES
                </h2>
                <span className="bg-rose-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> Up to 20% OFF
                </span>
              </div>
              <p className="text-xs text-slate-300">Limited quantity deals on genuine body parts & cars</p>
            </div>
          </div>

          {/* Live Countdown Box */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-2 rounded-xl border border-rose-500/30 text-xs">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300 font-bold uppercase tracking-wide">Ends in:</span>
            <div className="flex items-center gap-1 font-mono font-extrabold text-base text-rose-400">
              <span className="bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                {String(timeLeft.hours).padStart(2, '0')}h
              </span>
              <span>:</span>
              <span className="bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                {String(timeLeft.minutes).padStart(2, '0')}m
              </span>
              <span>:</span>
              <span className="bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                {String(timeLeft.seconds).padStart(2, '0')}s
              </span>
            </div>
          </div>
        </div>

        {/* Flash Deals Horizontal Carousel / Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {flashDealProducts.slice(0, 4).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

      </div>
    </section>
  );
};
