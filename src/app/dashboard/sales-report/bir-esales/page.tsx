'use client';

import { useState } from 'react';

export default function BirEsalesReport() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-sky-800 mb-6">
          BIR e-Sales Report
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-sky-600 mb-4">
            This report is currently under development. We&apos;re working on implementing the BIR&apos;s e-Sales reporting requirements.
          </p>

          {/* Filters Section */}
          <div className="mb-4 sm:mb-6 md:mb-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100 p-3 sm:p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range Filters */}
              <div className="w-full">
                <label className="block text-sm font-medium text-sky-700 mb-1.5">From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm"
                />
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-sky-700 mb-1.5">To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm"
                />
              </div>
              <div className="w-full flex items-end">
                <button
                  onClick={() => {
                    // TODO: Implement report generation
                    console.log('Generating report for:', dateRange);
                  }}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100">
              <div className="text-center p-6">
                <div className="text-sky-600 text-lg font-semibold mb-2">Loading...</div>
                <p className="text-sky-500 text-sm">Please wait while we prepare your report.</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100">
              <div className="text-center p-6">
                <div className="text-red-600 text-lg font-semibold mb-2">{error}</div>
                <p className="text-red-500 text-sm">Please try refreshing the page or contact support if the issue persists.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100 p-6">
              <p className="text-sky-600 text-center">
                Select a date range and click &quot;Generate Report&quot; to view BIR E-Sales data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 