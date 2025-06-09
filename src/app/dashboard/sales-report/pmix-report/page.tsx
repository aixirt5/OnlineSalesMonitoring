'use client';

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { getSalesDb } from '@/lib/salesDb';

interface BranchInfo {
  branch_name: string;
  branch_code: string;
}

interface TerminalInfo {
  terminal_no: string;
  branch_code: string;
}

interface PMIXItem {
  menu_name: string;
  menu_id: string;
  category_name: string;
  total_quantity: number;
  total_amount: number;
  unit_price: number;
  service_charge: number;
  discount_amount: number;
  compositions: {
    product_name: string;
    product_code: string;
    total_quantity: number;
    is_addon: boolean;
    amount: number;
  }[];
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  itemsPerPage: number;
}

export default function PMIXReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pmixData, setPmixData] = useState<PMIXItem[]>([]);
  const [branchList, setBranchList] = useState<BranchInfo[]>([]);
  const [terminalList, setTerminalList] = useState<TerminalInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      start: today,
      end: today
    };
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    itemsPerPage: 10
  });

  // Fetch unique branches and terminals
  useEffect(() => {
    const fetchBranchesAndTerminals = async () => {
      try {
        const salesDb = getSalesDb();
        
        // Fetch branches
        const { data: branchData, error: branchError } = await salesDb
          .from('order_details')
          .select('branch_code')
          .not('branch_code', 'is', null);
        
        if (branchError) throw branchError;

        // Get unique branches and map them
        const uniqueBranches = Array.from(new Set((branchData || []).map(item => item.branch_code)))
          .map((branch_code: string) => ({
            branch_code,
            branch_name: branch_code // You might want to replace this with actual branch names
          }))
          .sort((a: BranchInfo, b: BranchInfo) => a.branch_name.localeCompare(b.branch_name));

        setBranchList(uniqueBranches);

        // Fetch terminals
        const { data: terminalData, error: terminalError } = await salesDb
          .from('order_details')
          .select('terminal_no, branch_code')
          .not('terminal_no', 'is', null)
          .not('branch_code', 'is', null);
        
        if (terminalError) throw terminalError;

        // Get unique terminal combinations
        const uniqueTerminals = Array.from(
          new Set((terminalData || []).map(item => `${item.terminal_no}-${item.branch_code}`))
        ).map((key: string) => {
          const [terminal_no, branch_code] = key.split('-');
          return { terminal_no, branch_code };
        });

        setTerminalList(uniqueTerminals);
      } catch (err) {
        console.error('Error fetching branches and terminals:', err);
        setError('Failed to load branch and terminal data');
      }
    };

    fetchBranchesAndTerminals();
  }, []);

  // Filter terminals based on selected branch
  const filteredTerminals = terminalList.filter(terminal => 
    selectedBranch === 'all' || terminal.branch_code === selectedBranch
  );

  // Fetch PMIX data
  const fetchPMIXData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const salesDb = getSalesDb();

      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      // First, get the total count of unique menu items
      let countQuery = salesDb
        .from('order_details')
        .select('menu_id, menu_name')
        .eq('voided', false)
        .eq('refunded', false)
        .gte('log_date', startDate.toISOString())
        .lte('log_date', endDate.toISOString());

      if (selectedBranch !== 'all') {
        countQuery = countQuery.eq('branch_code', selectedBranch);
      }
      if (selectedTerminal !== 'all') {
        countQuery = countQuery.eq('terminal_no', selectedTerminal);
      }

      const { data: menuItems, error: countError } = await countQuery;
      
      if (countError) throw new Error(`Failed to fetch count: ${countError.message}`);

      // Get unique menu items
      const uniqueMenus = Array.from(new Map(
        (menuItems || []).map(item => [item.menu_id, item])
      ).values()).sort((a, b) => a.menu_name.localeCompare(b.menu_name));

      const totalCount = uniqueMenus.length;
      const totalPages = Math.ceil(totalCount / pagination.itemsPerPage);

      // Get the menu IDs for the current page
      const startIdx = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIdx = startIdx + pagination.itemsPerPage;
      const currentPageMenus = uniqueMenus.slice(startIdx, endIdx);
      const currentPageMenuIds = currentPageMenus.map(menu => menu.menu_id);

      // Fetch order details for the current page menu items
      const { data: orderDetails, error: detailsError } = await salesDb
        .from('order_details')
        .select(`
          order_detail_id,
          menu_id,
          menu_name,
          category_name,
          item_qty,
          total_amount,
          unit_price,
          service_charge,
          discount_amount
        `)
        .eq('voided', false)
        .eq('refunded', false)
        .gte('log_date', startDate.toISOString())
        .lte('log_date', endDate.toISOString())
        .in('menu_id', currentPageMenuIds)
        .order('menu_name', { ascending: true });

      if (detailsError) throw new Error(`Failed to fetch order details: ${detailsError.message}`);

      if (!orderDetails || orderDetails.length === 0) {
        setPmixData([]);
        setPagination(prev => ({
          ...prev,
          totalPages,
          totalCount
        }));
        return;
      }

      // Get unique menu IDs and their order_detail_ids
      const menuItemsMap = orderDetails?.reduce((acc: Record<string, any>, detail) => {
        const key = detail.menu_id;
        if (!acc[key]) {
          acc[key] = {
            menu_id: detail.menu_id,
            menu_name: detail.menu_name,
            category_name: detail.category_name,
            total_quantity: 0,
            total_amount: 0,
            unit_price: detail.unit_price,
            service_charge: 0,
            discount_amount: 0,
            order_detail_ids: []
          };
        }
        acc[key].total_quantity += detail.item_qty;
        acc[key].total_amount += detail.total_amount;
        acc[key].service_charge += detail.service_charge;
        acc[key].discount_amount += detail.discount_amount;
        acc[key].order_detail_ids.push(detail.order_detail_id);
        return acc;
      }, {});

      // Fetch compositions for all order details
      const allOrderDetailIds = orderDetails.map(d => d.order_detail_id);
      const { data: compositions, error: compositionsError } = await salesDb
        .from('order_compositions')
        .select(`
          order_detail_id,
          product_name,
          product_code,
          quantity,
          is_addon,
          amount
        `)
        .in('order_detail_id', allOrderDetailIds);

      if (compositionsError) throw new Error(`Failed to fetch compositions: ${compositionsError.message}`);

      // Process and aggregate the data
      const pmixItems: PMIXItem[] = Object.values(menuItemsMap)
        .sort((a, b) => a.menu_name.localeCompare(b.menu_name))
        .map(menuItem => {
          const menuCompositions = compositions?.filter(c => 
            menuItem.order_detail_ids.includes(c.order_detail_id) &&
            c.product_name.toLowerCase() !== menuItem.menu_name.toLowerCase()
          ) || [];

          const aggregatedCompositions = menuCompositions.reduce((acc, comp) => {
            const key = `${comp.product_code}-${comp.is_addon}`;
            if (!acc[key]) {
              acc[key] = {
                product_name: comp.product_name,
                product_code: comp.product_code,
                total_quantity: 0,
                is_addon: comp.is_addon,
                amount: comp.amount || 0
              };
            }
            acc[key].total_quantity += comp.quantity;
            return acc;
          }, {} as Record<string, {
            product_name: string;
            product_code: string;
            total_quantity: number;
            is_addon: boolean;
            amount: number;
          }>);

          const sortedCompositions = Object.values(aggregatedCompositions).sort((a, b) => 
            a.product_name.localeCompare(b.product_name)
          );

          return {
            menu_name: menuItem.menu_name,
            menu_id: menuItem.menu_id,
            category_name: menuItem.category_name,
            total_quantity: menuItem.total_quantity,
            total_amount: menuItem.total_amount,
            unit_price: menuItem.unit_price,
            service_charge: menuItem.service_charge,
            discount_amount: menuItem.discount_amount,
            compositions: sortedCompositions
          };
        });

      setPmixData(pmixItems);
      setPagination(prev => ({
        ...prev,
        totalPages,
        totalCount
      }));
    } catch (err) {
      console.error('Error fetching PMIX data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PMIX data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedBranch, selectedTerminal, pagination.currentPage, pagination.itemsPerPage]);

  // Fetch data when filters change
  useEffect(() => {
    fetchPMIXData();
  }, [fetchPMIXData]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(quantity);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300 p-2 sm:p-4 md:p-6 max-w-[1600px] mx-auto w-full overflow-x-hidden box-border">
      {/* Header Section */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-extrabold text-sky-800 tracking-tight drop-shadow-sm">Menu Performance Report</h1>
        <p className="mt-1 text-sm sm:text-base text-sky-700">Product Mix Analysis with Menu Compositions</p>
      </div>

      {/* Filters Section */}
      <div className="mb-4 sm:mb-6 bg-white/90 rounded-2xl shadow-lg border border-sky-100">
        <div className="p-3 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Date Range Selector */}
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute -top-2 left-2 px-1 bg-white text-xs font-medium text-sky-600">
                  From
                </div>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full border border-sky-200 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm text-sky-900 transition-all duration-200 pt-3"
                />
              </div>
              <div className="flex-1 relative">
                <div className="absolute -top-2 left-2 px-1 bg-white text-xs font-medium text-sky-600">
                  To
                </div>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full border border-sky-200 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm text-sky-900 transition-all duration-200 pt-3"
                />
              </div>
            </div>

            {/* Branch and Terminal Selectors */}
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute -top-2 left-2 px-1 bg-white text-xs font-medium text-sky-600">
                  Select Branch
                </div>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full border border-sky-200 bg-white rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm text-sky-900 appearance-none transition-all duration-200 pt-3"
                >
                  <option value="all">All Branches</option>
                  {branchList.map((branch) => (
                    <option key={branch.branch_code} value={branch.branch_code}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 relative">
                <div className="absolute -top-2 left-2 px-1 bg-white text-xs font-medium text-sky-600">
                  Select Terminal
                </div>
                <select
                  value={selectedTerminal}
                  onChange={(e) => setSelectedTerminal(e.target.value)}
                  className="w-full border border-sky-200 bg-white rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm text-sky-900 appearance-none transition-all duration-200 pt-3"
                >
                  <option value="all">All Terminals</option>
                  {filteredTerminals.map((terminal) => (
                    <option key={`${terminal.branch_code}-${terminal.terminal_no}`} value={terminal.terminal_no}>
                      {terminal.terminal_no}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PMIX Data Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-sky-500"></div>
          <p className="text-xs sm:text-sm text-sky-500">Loading data...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-3 sm:p-4 rounded-full bg-red-100">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-red-600 font-semibold text-center text-xs sm:text-base px-4">{error}</div>
        </div>
      ) : pmixData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-3 sm:p-4 rounded-full bg-sky-100">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-xs sm:text-sm text-sky-500 text-center px-4">No data found for the selected filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View - Hidden on Mobile */}
          <div className="hidden sm:block bg-white/90 rounded-2xl shadow-lg border border-sky-100 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-sky-100">
                  <thead>
                    <tr className="bg-sky-50">
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-wider">Menu Item</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-wider">Category</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Unit Price</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Qty</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sky-50">
                    {pmixData.map((item, index) => (
                      <React.Fragment key={`desktop-${item.menu_id}-${index}`}>
                        {/* Main menu item row */} 
                        <tr className="hover:bg-sky-50 transition-colors duration-150">
                          <td className="px-4 py-3 text-sm font-medium text-sky-900">{item.menu_name}</td>
                          <td className="px-4 py-3 text-sm text-sky-600">{item.category_name}</td>
                          <td className="px-4 py-3 text-sm text-right text-sky-900">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-sm text-right text-sky-900">{formatQuantity(item.total_quantity)}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-sky-900">
                            {formatCurrency(item.total_amount)}
                          </td>
                        </tr>
                        {/* Composition rows */}
                        {item.compositions.map((comp, compIndex) => (
                          <tr key={`desktop-${item.menu_id}-${comp.product_code}-${compIndex}`} className="bg-sky-50/30">
                            <td className="px-4 py-2 text-xs text-sky-600 pl-8">
                              <div className="flex items-center space-x-2">
                                <svg className="h-3 w-3 text-sky-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span>{comp.product_name}</span>
                                {comp.is_addon && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Add-on
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs text-sky-600"></td>
                            <td className="px-4 py-2 text-xs text-right text-sky-600">{comp.amount > 0 ? formatCurrency(comp.amount) : '-'}</td>
                            <td className="px-4 py-2 text-xs text-right text-sky-600">{formatQuantity(comp.total_quantity)}</td>
                            <td className="px-4 py-2 text-xs text-right text-sky-600">{comp.amount > 0 ? formatCurrency(comp.amount * comp.total_quantity) : '-'}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile Card View - Shown only on Mobile */}
          <div className="sm:hidden space-y-4">
            {pmixData.map((item, index) => (
              <div key={`mobile-${item.menu_id}-${index}`} className="bg-white/90 rounded-xl shadow-md border border-sky-100 overflow-hidden">
                {/* Menu Item Header */}
                <div className="p-4 border-b border-sky-100 bg-sky-50/50">
                  <h3 className="font-medium text-sky-900">{item.menu_name}</h3>
                  <p className="text-sm text-sky-600 mt-1">{item.category_name}</p>
                </div>
                
                {/* Menu Item Details */}
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-sky-600">Unit Price:</div>
                    <div className="text-right text-sky-900">{formatCurrency(item.unit_price)}</div>
                    
                    <div className="text-sky-600">Quantity:</div>
                    <div className="text-right text-sky-900">{formatQuantity(item.total_quantity)}</div>
                    
                    {item.service_charge > 0 && (
                      <>
                        <div className="text-sky-600">Service Charge:</div>
                        <div className="text-right text-sky-900">{formatCurrency(item.service_charge)}</div>
                      </>
                    )}
                    
                    {item.discount_amount > 0 && (
                      <>
                        <div className="text-sky-600">Discount:</div>
                        <div className="text-right text-sky-900">-{formatCurrency(item.discount_amount)}</div>
                      </>
                    )}
                    
                    <div className="text-sky-600 font-medium">Total Sales:</div>
                    <div className="text-right text-sky-900 font-medium">
                      {formatCurrency(item.unit_price * item.total_quantity + item.service_charge - item.discount_amount)}
                    </div>
                  </div>

                  {/* Compositions */}
                  {item.compositions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-sky-100">
                      <div className="text-sm font-medium text-sky-700 mb-2">Compositions:</div>
                      <div className="space-y-3">
                        {item.compositions.map((comp, compIndex) => (
                          <div key={`mobile-${item.menu_id}-${comp.product_code}-${compIndex}`} 
                               className="bg-sky-50/30 rounded-lg p-3 text-sm">
                            <div className="flex items-start space-x-2 mb-2">
                              <svg className="h-3 w-3 text-sky-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="flex-grow text-sky-700">{comp.product_name}</span>
                              {comp.is_addon && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                                  Add-on
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 pl-5 text-xs">
                              {comp.amount > 0 && (
                                <>
                                  <div className="text-sky-600">Price:</div>
                                  <div className="text-right text-sky-700">{formatCurrency(comp.amount)}</div>
                                </>
                              )}
                              <div className="text-sky-600">Quantity:</div>
                              <div className="text-right text-sky-700">{formatQuantity(comp.total_quantity)}</div>
                              {comp.amount > 0 && (
                                <>
                                  <div className="text-sky-600">Total:</div>
                                  <div className="text-right text-sky-700">{formatCurrency(comp.amount * comp.total_quantity)}</div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
            <div className="text-sm text-sky-600">
              Showing page {pagination.currentPage} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded bg-sky-100 text-sky-700 font-medium disabled:opacity-50 text-sm hover:bg-sky-200 transition-colors duration-200"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded bg-sky-100 text-sky-700 font-medium disabled:opacity-50 text-sm hover:bg-sky-200 transition-colors duration-200"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 