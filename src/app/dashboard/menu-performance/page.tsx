'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { getSalesDb } from '@/lib/salesDb';

interface MenuPerformance {
  menu_name: string;
  menu_id: number;
  category_name: string;
  unit_price: number;
  total_quantity: number;
  total_amount: number;
  total_service_charge: number;
  total_sales_with_service: number;
  total_orders: number;
  average_order_value: number;
  compositions: {
    [key: string]: {
      product_name: string;
      product_code: string;
      total_quantity: number;
      total_amount: number;
      is_addon: boolean;
    };
  };
  is_expanded?: boolean;
}

interface MenuPerformanceWithOrderIds extends MenuPerformance {
  order_ids: Set<number>;
  order_detail_ids: Set<number>;
}

interface BranchInfo {
  branch_code: string;
  branch_name: string;
}

export default function MenuPerformanceReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuPerformance, setMenuPerformance] = useState<MenuPerformance[]>([]);
  const [branchList, setBranchList] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today
    };
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItemExpansion = (menuName: string) => {
    const newExpandedItems = new Set(expandedItems);
    if (newExpandedItems.has(menuName)) {
      newExpandedItems.delete(menuName);
    } else {
      newExpandedItems.add(menuName);
    }
    setExpandedItems(newExpandedItems);
  };

  // Fetch branch list
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const salesDb = getSalesDb();
        
        // Fetch unique branches with names from orders table
        const { data: branchData, error: branchError } = await salesDb
          .from('orders')
          .select('branch_code, branch_name')
          .not('branch_code', 'is', null)
          .not('branch_name', 'is', null);
        
        if (branchError) throw branchError;

        // Remove duplicates and sort by branch name
        const uniqueBranches = Array.from(
          new Map(
            (branchData || [])
              .map(item => [item.branch_code, item])
          ).values()
        ).sort((a, b) => (a.branch_name || '').localeCompare(b.branch_name || ''));

        setBranchList(uniqueBranches);
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    const fetchMenuPerformance = async () => {
      try {
        setLoading(true);
        const salesDb = getSalesDb();

        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        // Build query with branch filter
        let query = salesDb
          .from('order_details')
          .select('menu_name, menu_id, category_name, unit_price, item_qty, total_amount, service_charge, order_id, order_detail_id')
          .gte('log_date', startDate.toISOString())
          .lte('log_date', endDate.toISOString())
          .is('voided', false)
          .is('refunded', false);

        // Add branch filter if a specific branch is selected
        if (selectedBranch !== 'all') {
          query = query.eq('branch_code', selectedBranch);
        }

        const { data: orderDetails, error: orderDetailsError } = await query;

        if (orderDetailsError) throw orderDetailsError;

        // Aggregate menu performance data
        const menuPerformanceMap = new Map<string, MenuPerformanceWithOrderIds>();

        // Process order details first
        orderDetails?.forEach(detail => {
          const existing = menuPerformanceMap.get(detail.menu_name);
          const itemQty = Number(detail.item_qty) || 0;
          const totalAmount = Number(detail.total_amount) || 0;
          const serviceCharge = Number(detail.service_charge) || 0;
          const totalWithService = totalAmount + serviceCharge;

          if (existing) {
            existing.total_quantity += itemQty;
            existing.total_amount += totalAmount;
            existing.total_service_charge += serviceCharge;
            existing.total_sales_with_service += totalWithService;
            if (!existing.order_ids.has(detail.order_id)) {
              existing.total_orders += 1;
              existing.order_ids.add(detail.order_id);
            }
            existing.order_detail_ids.add(detail.order_detail_id);
            existing.average_order_value = existing.total_sales_with_service / existing.total_orders;
          } else {
            const order_ids = new Set([detail.order_id]);
            const order_detail_ids = new Set([detail.order_detail_id]);
            menuPerformanceMap.set(detail.menu_name, {
              menu_name: detail.menu_name,
              menu_id: detail.menu_id,
              category_name: detail.category_name,
              unit_price: Number(detail.unit_price) || 0,
              total_quantity: itemQty,
              total_amount: totalAmount,
              total_service_charge: serviceCharge,
              total_sales_with_service: totalWithService,
              total_orders: 1,
              average_order_value: totalWithService,
              compositions: {},
              order_ids,
              order_detail_ids
            });
          }
        });

        // Fetch and process compositions for all order details
        for (const menuItem of menuPerformanceMap.values()) {
          const orderDetailIds = Array.from(menuItem.order_detail_ids);
          const { data: compositions, error: compositionsError } = await salesDb
            .from('order_compositions')
            .select('*')
            .in('order_detail_id', orderDetailIds)
            .is('voided', false);

          if (compositionsError) throw compositionsError;

          compositions?.forEach(comp => {
            const key = `${comp.product_code}-${comp.is_addon}`;
            const existing = menuItem.compositions[key];
            if (existing) {
              existing.total_quantity += Number(comp.quantity) || 0;
              existing.total_amount += Number(comp.amount) || 0;
            } else {
              menuItem.compositions[key] = {
                product_name: comp.product_name,
                product_code: comp.product_code,
                total_quantity: Number(comp.quantity) || 0,
                total_amount: Number(comp.amount) || 0,
                is_addon: comp.is_addon || false
              };
            }
          });
        }

        // Convert map to array, remove temporary fields, and sort by total sales with service
        const sortedPerformance = Array.from(menuPerformanceMap.values())
          .map(({ ...item }) => item)
          .sort((a, b) => b.total_sales_with_service - a.total_sales_with_service);

        setMenuPerformance(sortedPerformance);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch menu performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchMenuPerformance();
  }, [dateRange, selectedBranch]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300 p-2 sm:p-4 md:p-6 max-w-[1600px] mx-auto w-full overflow-x-hidden box-border">
      {/* Enhanced Header Section */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-sky-700 tracking-tight drop-shadow-sm">
          Menu Performance Report
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-sky-600 max-w-3xl">
          Analyze menu item sales and performance metrics with detailed composition breakdown
        </p>
      </div>

      {/* Enhanced Filters Section */}
      <div className="mb-4 sm:mb-6 md:mb-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100 p-3 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Updated Branch Filter */}
          <div className="w-full">
            <label className="block text-sm font-medium text-sky-700 mb-1.5">Branch</label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm appearance-none pr-8"
              >
                <option value="all">All Branches</option>
                {branchList.map((branch) => (
                  <option key={branch.branch_code} value={branch.branch_code}>
                    {branch.branch_name || branch.branch_code}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

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
        </div>
      </div>

      {/* Enhanced Loading, Error, and Empty States */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            <p className="text-sky-600 font-medium">Loading report data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-red-100">
          <div className="text-center p-6">
            <div className="text-red-600 text-lg font-semibold mb-2">{error}</div>
            <p className="text-red-500 text-sm">Please try refreshing the page or contact support if the issue persists.</p>
          </div>
        </div>
      ) : menuPerformance.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100">
          <div className="text-center p-6">
            <div className="text-sky-600 text-lg font-semibold mb-2">No Data Available</div>
            <p className="text-sky-500 text-sm">Try adjusting your filters to see menu performance data.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-sky-100 overflow-hidden">
          {/* Mobile View */}
          <div className="block lg:hidden">
            {menuPerformance.map((item, index) => (
              <div key={index} className="border-b border-sky-100 last:border-b-0">
                <div 
                  className="p-4 cursor-pointer hover:bg-sky-50/50 transition-colors duration-150"
                  onClick={() => toggleItemExpansion(item.menu_name)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-sky-900">{item.menu_name}</h3>
                      <p className="text-sm text-sky-600">{item.category_name}</p>
                    </div>
                    <button className="text-sky-600 hover:text-sky-800 transition-colors duration-200 p-1">
                      {expandedItems.has(item.menu_name) ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-sky-600">Unit Price:</span>
                      <span className="ml-1 font-medium">{formatCurrency(item.unit_price)}</span>
                    </div>
                    <div>
                      <span className="text-sky-600">Qty Sold:</span>
                      <span className="ml-1 font-medium">{item.total_quantity}</span>
                    </div>
                    <div>
                      <span className="text-sky-600">Total Sales:</span>
                      <span className="ml-1 font-medium">{formatCurrency(item.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-sky-600">Service:</span>
                      <span className="ml-1 font-medium">{formatCurrency(item.total_service_charge)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sky-600">Total with Service:</span>
                      <span className="ml-1 font-medium">{formatCurrency(item.total_sales_with_service)}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile Compositions View */}
                {expandedItems.has(item.menu_name) && Object.values(item.compositions).length > 0 && (
                  <div className="px-4 py-3 bg-sky-50/50 border-t border-sky-100">
                    <div className="text-sm font-medium text-sky-700 mb-2">Composition Details:</div>
                    <div className="space-y-3">
                      {Object.values(item.compositions).map((comp, compIndex) => (
                        <div key={compIndex} className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-sky-800">{comp.product_name}</div>
                              <div className="text-sm text-sky-600">{comp.product_code}</div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              comp.is_addon ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                            }`}>
                              {comp.is_addon ? 'Addon' : 'Regular'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-sky-600">Quantity:</span>
                              <span className="ml-1 font-medium">{comp.total_quantity}</span>
                            </div>
                            <div>
                              <span className="text-sky-600">Amount:</span>
                              <span className="ml-1 font-medium">{formatCurrency(comp.total_amount)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-100">
              <thead className="bg-sky-50/80 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-sky-500 uppercase tracking-wider">Menu Item</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-sky-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Quantity Sold</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Total Sales</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Service Charge</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Total with Service</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Total Orders</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Avg. Order Value</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-sky-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-sky-50">
                {menuPerformance.map((item, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-sky-50/50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-normal text-sm font-medium text-sky-900">{item.menu_name}</td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-sky-600">{item.category_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-sky-600">{formatCurrency(item.unit_price)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-sky-600">{item.total_quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-sky-900">{formatCurrency(item.total_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-sky-600">{formatCurrency(item.total_service_charge)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-sky-900">{formatCurrency(item.total_sales_with_service)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-sky-600">{item.total_orders}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-sky-900">{formatCurrency(item.average_order_value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => toggleItemExpansion(item.menu_name)}
                          className="text-sky-600 hover:text-sky-800 transition-colors duration-200 p-1 rounded-full hover:bg-sky-100"
                        >
                          {expandedItems.has(item.menu_name) ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedItems.has(item.menu_name) && Object.values(item.compositions).length > 0 && (
                      <tr>
                        <td colSpan={10} className="px-6 py-4 bg-sky-50/50">
                          <div className="text-sm font-medium text-sky-700 mb-3">Composition Details:</div>
                          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-sky-100">
                              <thead className="bg-sky-50/80">
                                <tr className="text-xs font-medium text-sky-500 uppercase">
                                  <th className="px-4 py-3 text-left">Product Name</th>
                                  <th className="px-4 py-3 text-left">Product Code</th>
                                  <th className="px-4 py-3 text-right">Quantity</th>
                                  <th className="px-4 py-3 text-right">Amount</th>
                                  <th className="px-4 py-3 text-center">Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sky-50">
                                {Object.values(item.compositions).map((comp, compIndex) => (
                                  <tr key={compIndex} className="text-sm hover:bg-sky-50/30 transition-colors duration-150">
                                    <td className="px-4 py-3 text-sky-800 font-medium">{comp.product_name}</td>
                                    <td className="px-4 py-3 text-sky-600">{comp.product_code}</td>
                                    <td className="px-4 py-3 text-right text-sky-600">{comp.total_quantity}</td>
                                    <td className="px-4 py-3 text-right text-sky-800 font-medium">{formatCurrency(comp.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        comp.is_addon ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                                      }`}>
                                        {comp.is_addon ? 'Addon' : 'Regular'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 