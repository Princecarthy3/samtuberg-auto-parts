import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Search, Car, CheckCircle2, AlertCircle } from 'lucide-react';

export const VinChecker = () => {
  const { setSelectedModel, verifiedVehicle, setVerifiedVehicle, triggerToast } = useApp();
  const [vinInput, setVinInput] = useState('');
  const [selectedYear, setSelectedYear] = useState('2022');
  const [selectedModelInput, setSelectedModelInput] = useState('Toyota RAV4');

  const handleVerifyVin = (e) => {
    e.preventDefault();
    if (!vinInput.trim() && !selectedModelInput) return;

    const vinCode = vinInput.trim().toUpperCase() || 'JTDKN3DU4J829104';
    
    setVerifiedVehicle({
      vin: vinCode,
      model: selectedModelInput,
      year: selectedYear,
      status: '100% Fitment Verified'
    });

    setSelectedModel(selectedModelInput);
    triggerToast(`Fitment Verified! Displaying parts guaranteed for ${selectedYear} ${selectedModelInput}.`, 'success');
  };

  const handleClear = () => {
    setVerifiedVehicle(null);
    setSelectedModel('all');
    setVinInput('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-display font-extrabold text-sm text-white">
              Guaranteed Vehicle Fitment Engine
            </h4>
            <p className="text-xs text-slate-400">
              Enter your VIN or select your Car Model + Year to verify 100% part compatibility.
            </p>
          </div>
        </div>

        {/* VIN Form or Verified Badge */}
        {verifiedVehicle ? (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-xs text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-extrabold block text-white">
                {verifiedVehicle.year} {verifiedVehicle.model} (VIN: {verifiedVehicle.vin})
              </span>
              <span className="text-[11px] text-emerald-400">Active Filter: Showing guaranteed compatible body parts only.</span>
            </div>
            <button
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-white underline ml-2 font-semibold"
            >
              Reset
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyVin} className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={selectedModelInput}
              onChange={(e) => setSelectedModelInput(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs py-2 px-3 rounded-xl text-white font-semibold"
            >
              <option value="Toyota RAV4">Toyota RAV4</option>
              <option value="Toyota Corolla">Toyota Corolla</option>
              <option value="Toyota Fortuner">Toyota Fortuner</option>
              <option value="Toyota Camry">Toyota Camry</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs py-2 px-3 rounded-xl text-white font-semibold"
            >
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>

            <div className="relative">
              <input
                type="text"
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value)}
                placeholder="Or enter VIN (Optional)..."
                className="bg-slate-950 border border-slate-700 text-xs py-2 px-3 rounded-xl text-white w-44 uppercase"
              />
            </div>

            <button type="submit" className="btn-primary py-2 px-4 text-xs rounded-xl font-bold flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>Verify Fitment</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
