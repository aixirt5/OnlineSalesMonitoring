'use client';

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { getSalesDb } from '@/lib/salesDb';
import { Order, OrderDetail, OrderComposition, OrderTaxDetail, OrderPayment } from '@/types/sales';

interface BranchInfo {
  branch_name: string;
  branch_code: string;
}

interface TerminalInfo {
  terminal_no: string;
  branch_code: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  itemsPerPage: number;
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<((Order & { 
    id: number; 
    details?: (OrderDetail & { 
      id: number; 
      compositions?: (OrderComposition & { id: number })[] 
    })[]; 
    tax_detail?: OrderTaxDetail;
    payments?: OrderPayment[];
  })[])>([]);
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
  const [expandedTransaction, setExpandedTransaction] = useState<number | null>(null);
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageTicket: 0,
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    itemsPerPage: 10
  });

  // Fetch unique branches and terminals from orders
  useEffect(() => {
    const fetchBranchesAndTerminals = async () => {
      try {
        const salesDb = getSalesDb();
        
        // Fetch unique branches from orders
        const { data: branchData, error: branchError } = await salesDb
          .from('orders')
          .select('branch_name, branch_code')
          .not('branch_name', 'is', null)
          .not('branch_code', 'is', null);
        
        if (branchError) throw branchError;

        // Remove duplicates and sort by branch name
        const uniqueBranches = Array.from(
          new Map(
            (branchData || []).map(item => 
              [`${item.branch_code}-${item.branch_name}`, item]
            )
          ).values()
        ).sort((a, b) => a.branch_name.localeCompare(b.branch_name));

        setBranchList(uniqueBranches);

        // Fetch unique terminals from orders
        const { data: terminalData, error: terminalError } = await salesDb
          .from('orders')
          .select('terminal_no, branch_code')
          .not('terminal_no', 'is', null)
          .not('branch_code', 'is', null);
        
        if (terminalError) throw terminalError;

        // Remove duplicates and sort by terminal number
        const uniqueTerminals = Array.from(
          new Map(
            (terminalData || []).map(item => 
              [`${item.branch_code}-${item.terminal_no}`, item]
            )
          ).values()
        ).sort((a, b) => a.terminal_no.localeCompare(b.terminal_no));

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

  // Fetch summary statistics
  const fetchSummaryStats = async () => {
      try {
        const salesDb = getSalesDb();
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        let query = salesDb
          .from('orders')
        .select('net_total', { count: 'exact' })
        .eq('is_cancelled', false)
        .eq('is_suspended', false)
          .gte('log_date', startDate.toISOString())
          .lte('log_date', endDate.toISOString());


        if (selectedBranch !== 'all') {
          query = query.eq('branch_code', selectedBranch);
        }
        if (selectedTerminal !== 'all') {
          query = query.eq('terminal_no', selectedTerminal);
        }

      const { data: orders, count } = await query;

      const totalSales = orders?.reduce((sum, order) => sum + (order.net_total || 0), 0) || 0;
      const totalTransactions = count || 0;
      const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      setSummaryStats({
        totalSales,
        totalTransactions,
        averageTicket,
      });
    } catch (err) {
      console.error('Error fetching summary stats:', err);
    }
  };

  // Fetch transactions with pagination
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const salesDb = getSalesDb();

      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      // First, get the total count with proper error handling
      let countQuery = salesDb
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('is_cancelled', false)
        .eq('is_suspended', false)
        .gte('log_date', startDate.toISOString())
        .lte('log_date', endDate.toISOString());

      if (selectedBranch !== 'all') {
        countQuery = countQuery.eq('branch_code', selectedBranch);
      }
      if (selectedTerminal !== 'all') {
        countQuery = countQuery.eq('terminal_no', selectedTerminal);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error fetching count:', countError);
        throw new Error(`Failed to fetch count: ${countError.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pagination.itemsPerPage);

      // Fetch orders for the current page with all necessary fields
      const { data: orders, error: ordersError } = await salesDb
        .from('orders')
        .select(`
          id,
          order_id,
          log_date,
          datetime,
          or_number,
          terminal_no,
          trn,
          table_no,
          guest_no,
          mandated_no,
          is_finish,
          cashier_name,
          unit_price,
          total_amount,
          addon_amount,
          amount_discount,
          service_charge,
          net_total,
          branch_code,
          branch_name,
          branch_address,
          created_at
        `)
        .eq('is_cancelled', false)
        .eq('is_suspended', false)
        .gte('log_date', startDate.toISOString())
        .lte('log_date', endDate.toISOString())
        .order('log_date', { ascending: false })
        .range(
          (pagination.currentPage - 1) * pagination.itemsPerPage,
          pagination.currentPage * pagination.itemsPerPage - 1
        );

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      if (!orders || orders.length === 0) {
        setTransactions([]);
        setPagination(prev => ({
          ...prev,
          totalPages,
          totalCount
        }));
        return;
      }

      // Fetch tax details for the orders
      const { data: taxDetails, error: taxError } = await salesDb
              .from('order_tax_details')
              .select('*')
        .in('order_id', orders.map(o => o.order_id))
        .in('branch_code', orders.map(o => o.branch_code))
        .in('terminal_no', orders.map(o => o.terminal_no));

      if (taxError) {
        console.error('Error fetching tax details:', taxError);
        throw new Error(`Failed to fetch tax details: ${taxError.message}`);
      }

      // Fetch payment details for the orders
      const { data: payments, error: paymentsError } = await salesDb
        .from('order_payments')
        .select('*')
        .in('order_id', orders.map(o => o.order_id))
        .in('branch_code', orders.map(o => o.branch_code))
        .in('terminal_no', orders.map(o => o.terminal_no));

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
        throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
      }

      // Fetch order details for the orders
      const { data: orderDetails, error: detailsError } = await salesDb
        .from('order_details')
        .select(`
          id,
          order_detail_id,
          order_id,
          log_date,
          datetime,
          terminal_no,
          unit_price,
          total_amount,
          discount_amount,
          service_charge,
          addon_amount,
          amount_refund,
          qty_refund,
          category_id,
          category_name,
          menu_name,
          menu_id,
          item_qty,
          discount_name,
          mandated_discount,
          voided,
          refunded,
          branch_code,
          created_at
        `)
        .in('order_id', orders.map(o => o.order_id))
        .in('branch_code', orders.map(o => o.branch_code))
        .in('terminal_no', orders.map(o => o.terminal_no));

      if (detailsError) {
        console.error('Error fetching order details:', detailsError);
        throw new Error(`Failed to fetch order details: ${detailsError.message}`);
      }

      // Fetch compositions for the order details
      const { data: compositions, error: compositionsError } = await salesDb
        .from('order_compositions')
        .select(`
          id,
          order_detail_id,
          compo_id,
          product_name,
          product_code,
          quantity,
          amount,
          is_addon,
          voided,
          terminal_code,
          branch_code,
          created_at
        `)
        .in('order_detail_id', (orderDetails || []).map(d => d.order_detail_id));

      if (compositionsError) {
        console.error('Error fetching compositions:', compositionsError);
        throw new Error(`Failed to fetch compositions: ${compositionsError.message}`);
      }

      // Process and combine the data
      const processedOrders = orders.map(order => {
        try {
          // Get tax details for this order
          const orderTaxDetails = (taxDetails || []).filter(tax => 
            tax.order_id === order.order_id && 
            tax.branch_code === order.branch_code && 
            tax.terminal_no === order.terminal_no
          );

          // Get payment details for this order
          const orderPayments = (payments || []).filter(payment => 
            payment.order_id === order.order_id && 
            payment.branch_code === order.branch_code && 
            payment.terminal_no === order.terminal_no
          );

          // Get order details for this order
          const details = (orderDetails || [])
            .filter(detail => 
              detail.order_id === order.order_id && 
              detail.branch_code === order.branch_code && 
              detail.terminal_no === order.terminal_no
            )
            .filter(detail => !detail.voided && !detail.refunded)
            .map(detail => ({
              ...detail,
              id: detail.id,
              compositions: (compositions || [])
                .filter(comp => comp.order_detail_id === detail.order_detail_id)
                .map(comp => ({
                  ...comp,
                  id: comp.id
                }))
            }));

          // Aggregate tax details
          let aggregatedTaxDetail = undefined;
          if (orderTaxDetails.length > 0) {
            aggregatedTaxDetail = {
              ...orderTaxDetails[0],
              vatable_sales: orderTaxDetails.reduce((sum, tax) => sum + Number(tax.vatable_sales || 0), 0),
              vat_amount: orderTaxDetails.reduce((sum, tax) => sum + Number(tax.vat_amount || 0), 0),
              vat_exempt: orderTaxDetails.reduce((sum, tax) => sum + Number(tax.vat_exempt || 0), 0),
              zero_rated: orderTaxDetails.reduce((sum, tax) => sum + Number(tax.zero_rated || 0), 0),
              sc_vat_deduction: orderTaxDetails.reduce((sum, tax) => sum + Number(tax.sc_vat_deduction || 0), 0)
            };
          }

          return {
            ...order,
            id: order.id,
            details,
            tax_detail: aggregatedTaxDetail,
            payments: orderPayments
          };
        } catch (processError) {
          console.error('Error processing order:', order.order_id, processError);
          return {
            ...order,
            id: order.id,
            details: [],
            tax_detail: undefined,
            payments: []
          };
        }
      }) as (Order & { 
        id: number; 
        details?: (OrderDetail & { 
          id: number; 
          compositions?: (OrderComposition & { id: number; })[] 
        })[];
        tax_detail?: OrderTaxDetail;
        payments?: OrderPayment[];
      })[];

      setTransactions(processedOrders);
      setPagination(prev => ({
        ...prev,
        totalPages,
        totalCount
      }));

      // Fetch summary stats
      await fetchSummaryStats();
      } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transaction data');
      } finally {
        setLoading(false);
      }
    }, [dateRange, selectedBranch, selectedTerminal, pagination.currentPage, pagination.itemsPerPage]);

  // Fetch transactions when filters change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  const toggleTransaction = (order: Order & { id: number }) => {
    if (expandedTransaction === order.id) {
      setExpandedTransaction(null);
    } else {
      setExpandedTransaction(order.id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300 p-2 sm:p-4 md:p-6 max-w-[1600px] mx-auto w-full overflow-x-hidden box-border">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-sky-700 tracking-tight drop-shadow-sm">Sales Report</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-sky-600">Detailed transaction report with comprehensive analytics</p>
      </div>

      {/* Filters and Summary Section */}
      <div className="mb-6 sm:mb-8 bg-white/90 rounded-2xl shadow-lg border border-sky-100">
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          {/* Filters Section */}
          <div className="grid grid-cols-1 gap-4 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range Selector */}
            <div className="lg:col-span-2">
              <h3 className="text-xs sm:text-sm font-bold text-sky-600 mb-2 sm:mb-3">Select Date Range</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 right-2 sm:right-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <span className="text-sky-500 font-medium text-xs sm:text-sm text-center">to</span>
                <div className="flex-1 relative">
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 right-2 sm:right-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Selector */}
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-sky-600 mb-2 sm:mb-3">Select Branch</h3>
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    setSelectedBranch(e.target.value);
                    setSelectedTerminal('all'); // Reset terminal when branch changes
                  }}
                  className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 appearance-none"
                >
                  <option value="all">All Branches</option>
                  {branchList.map((branch) => (
                    <option key={branch.branch_code} value={branch.branch_code}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 sm:right-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Terminal Selector */}
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-sky-600 mb-2 sm:mb-3">Select Terminal</h3>
              <div className="relative">
                <select
                  value={selectedTerminal}
                  onChange={(e) => setSelectedTerminal(e.target.value)}
                  className="w-full border border-sky-300 bg-white/70 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 appearance-none"
                >
                  <option value="all">All Terminals</option>
                  {filteredTerminals.map((terminal) => (
                    <option key={`${terminal.branch_code}-${terminal.terminal_no}`} value={terminal.terminal_no}>
                      {terminal.terminal_no}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 sm:right-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 gap-4 sm:gap-8 md:grid-cols-3">
            <div className="bg-gradient-to-br from-sky-50 to-white p-4 sm:p-8 rounded-2xl border border-sky-100 shadow-md">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-sky-100 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-sky-500">Total Sales</div>
                  <div className="text-lg sm:text-2xl font-bold text-sky-700 mt-1">{formatCurrency(summaryStats.totalSales)}</div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-white p-4 sm:p-8 rounded-2xl border border-cyan-100 shadow-md">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-cyan-100 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-cyan-500">Transactions</div>
                  <div className="text-lg sm:text-2xl font-bold text-cyan-700 mt-1">{summaryStats.totalTransactions}</div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-white p-4 sm:p-8 rounded-2xl border border-indigo-100 shadow-md">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-medium text-indigo-500">Average Ticket</div>
                  <div className="text-lg sm:text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(summaryStats.averageTicket)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-sky-500"></div>
          <p className="text-xs sm:text-sm text-sky-500">Loading transactions...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-3 sm:p-4 rounded-full bg-red-100">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-red-600 font-semibold text-xs sm:text-base">{error}</div>
          <p className="text-xs sm:text-sm text-sky-500">Please try again later</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-3 sm:p-4 rounded-full bg-sky-100">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-xs sm:text-sm text-sky-500">No transactions found for the selected date range</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 sm:space-y-6">
            {transactions.map((transaction, tIndex) => (
              <div
                key={transaction.id ?? `${transaction.order_id}-${tIndex}`}
                className="bg-white/90 rounded-2xl shadow-lg border border-sky-100 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-sky-200"
              >
                {/* Transaction Header */}
                <button
                  onClick={() => toggleTransaction(transaction)}
                  className="w-full px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/80 hover:bg-sky-50 transition-colors duration-200 gap-2 sm:gap-0"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-sky-100 to-sky-50 flex items-center justify-center">
                        <span className="text-sky-700 font-semibold text-sm sm:text-base">#{transaction.trn}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                        <p className="text-sm sm:text-base font-semibold text-sky-900 truncate">
                          TRN: {transaction.trn}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 mt-1 sm:mt-0">
                          {transaction.terminal_no}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 mt-1 sm:mt-0">
                          {transaction.datetime ? formatDate(transaction.datetime) : formatDate(transaction.log_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-end sm:items-end space-x-2 sm:space-x-0 sm:space-y-1 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-base sm:text-lg font-semibold text-sky-900">
                        {formatCurrency(
                          transaction.details?.reduce((sum, detail) => {
                            if (!detail.voided && !detail.refunded) {
                              return sum + detail.total_amount + detail.service_charge;
                            }
                            return sum;
                          }, 0) || 0
                        )}
                      </p>
                      <div className="flex items-center mt-1 space-x-1 text-xs sm:text-sm text-sky-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{transaction.cashier_name}</span>
                      </div>
                    </div>
                    <div className={`transform transition-transform duration-200 ${
                      expandedTransaction === transaction.id ? 'rotate-180' : ''
                    }`}>
                      <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Transaction Details */}
                {expandedTransaction === transaction.id && (
                  <div className="border-t border-sky-100 px-2 sm:px-8 py-4 sm:py-5 animate-fadeIn bg-sky-50/50">
                    {/* Order Details Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-sky-100 text-xs sm:text-sm">
                        <thead>
                          <tr>
                            <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-widest bg-sky-50 rounded-l-lg">Item</th>
                            <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest bg-sky-50">Qty</th>
                            <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest bg-sky-50">Unit Price</th>
                            <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest bg-sky-50 rounded-r-lg">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-sky-50">
                          {transaction.details?.map((detail, dIndex) => (
                            <React.Fragment key={detail.id ?? `${detail.order_detail_id}-${dIndex}`}>
                              {/* Main menu item */}
                              <tr className={`${detail.voided ? 'bg-red-50' : ''} transition-colors duration-150 hover:bg-sky-50`}>
                                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-900">
                                  <div className="flex items-center">
                                    <span className={`font-medium ${detail.voided ? 'text-red-700' : ''}`}>{detail.menu_name}</span>
                                    {detail.voided && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                        Voided
                                      </span>
                                    )}
                                    {detail.refunded && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                        Refunded
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{detail.item_qty}</td>
                                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(detail.unit_price)}</td>
                                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatCurrency(detail.item_qty * detail.unit_price)}</td>
                              </tr>
                              
                              {/* Menu compositions */}
                              {(detail.compositions?.filter(composition =>
                                (detail.compositions && detail.compositions.length > 1) || composition.product_name !== detail.menu_name
                              ) || []).map((composition, cIndex) => (
                                <tr 
                                  key={composition.id ?? `${composition.compo_id}-${cIndex}`}
                                  className={`${detail.voided ? 'bg-red-50/50' : 'bg-sky-50/50'} text-xs sm:text-sm`}
                                >
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 pl-8 whitespace-nowrap text-gray-600">
                                    <div className="flex items-center space-x-2">
                                      <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span>{composition.product_name}</span>
                                      {composition.is_addon && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                          Add-on
                                        </span>
                                      )}
                                      {composition.voided && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                          Voided
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">{composition.quantity}</td>
                                  {/* MENU COMPOSITIONS ADD ONS PRICE AND TOTAL PRICE*/}
                                  {/* <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">{formatCurrency(composition.amount)}</td> */}
                                  {/* <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">{formatCurrency(composition.amount * composition.quantity)}</td> */}
                                </tr>
                              ))}

                              {/* Service charge row if applicable */}
                              {detail.service_charge > 0 && !detail.voided && !detail.refunded && (
                                <tr className="bg-sky-50/30 text-xs sm:text-sm">
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 pl-8 whitespace-nowrap text-gray-600">
                                    <div className="flex items-center">
                                      <span>Service Charge</span>
                                    </div>
                                  </td>
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">1</td>
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">{formatCurrency(detail.service_charge)}</td>
                                  <td className="px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap text-right">{formatCurrency(detail.service_charge)}</td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-sky-50">
                            <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">Subtotal</td>
                            <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                              {formatCurrency(
                                transaction.details?.reduce((sum, detail) => {
                                  if (!detail.voided && !detail.refunded) {
                                    return sum + detail.item_qty * detail.unit_price;
                                  }
                                  return sum;
                                }, 0) || 0
                              )}
                            </td>
                          </tr>
                          {/* Show voided items total if any exist */}
                          {transaction.details?.some(detail => detail.voided || detail.refunded) && (
                            <tr className="bg-red-50">
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-red-700 font-medium">Voided/Refunded Items</td>
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-red-700 text-right font-semibold">
                                -{formatCurrency(
                                  transaction.details.reduce((sum, detail) => {
                                    if (detail.voided || detail.refunded) {
                                      return sum + detail.total_amount;
                                    }
                                    return sum;
                                  }, 0)
                                )}
                              </td>
                            </tr>
                          )}
                          {/* Service Charge Total */}
                          {transaction.service_charge > 0 && (
                              <tr className="bg-sky-50">
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">Total Service Charge</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(
                                    transaction.details?.reduce((sum, detail) => {
                                      if (!detail.voided && !detail.refunded) {
                                        return sum + detail.service_charge;
                                      }
                                      return sum;
                                    }, 0) || 0
                                  )}
                                </td>
                              </tr>
                          )}
                          {/* Discount */}
                          {transaction.amount_discount > 0 && (
                            <tr className="bg-sky-50">
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">Discount</td>
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                -{formatCurrency(transaction.amount_discount)}
                              </td>
                            </tr>
                          )}
                          {/* Grand Total */}
                          <tr className="bg-sky-100 font-bold">
                            <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-700">Grand Total</td>
                            <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right">
                              {formatCurrency(
                                (transaction.details?.reduce((sum, detail) => {
                                  if (!detail.voided && !detail.refunded) {
                                    return sum + detail.total_amount + detail.service_charge;
                                  }
                                  return sum;
                                }, 0) || 0)
                              )}
                            </td>
                          </tr>
                          {/* VAT Details */}
                          {transaction.tax_detail && (
                            <>
                              <tr className="bg-sky-50/80">
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">Vatable Sales</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(transaction.tax_detail.vatable_sales)}
                                </td>
                              </tr>
                              <tr className="bg-sky-50/80">
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">VAT Amount</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(transaction.tax_detail.vat_amount)}
                                </td>
                              </tr>
                              <tr className="bg-sky-50/80">
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">VAT Exempt</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(transaction.tax_detail.vat_exempt)}
                                </td>
                              </tr>
                              <tr className="bg-sky-50/80">
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">Zero Rated</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(transaction.tax_detail.zero_rated)}
                                </td>
                              </tr>
                              <tr className="bg-sky-50/80">
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-500 font-medium">SC VAT Deduction</td>
                                <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-sky-900 text-right font-semibold">
                                  {formatCurrency(transaction.tax_detail.sc_vat_deduction)}
                                </td>
                              </tr>
                            </>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                {/* Payment Details Section */}
                {transaction.payments && transaction.payments.length > 0 && (
                  <div className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-sky-100">
                    <h4 className="text-sm font-semibold text-sky-700 mb-3">Payment Details</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-sky-100">
                        <thead>
                          <tr className="text-xs">
                            <th className="px-3 py-2 text-left text-sky-500 font-semibold">Payment Type</th>
                            <th className="px-3 py-2 text-right text-sky-500 font-semibold">Amount</th>
                            <th className="px-3 py-2 text-right text-sky-500 font-semibold">Change</th>
                            <th className="px-3 py-2 text-center text-sky-500 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100">
                          {transaction.payments.map((payment, index) => (
                            <tr key={payment.id || index} className={`text-sm ${payment.is_cancelled ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2">
                                <div className="flex items-center">
                                  <span className="font-medium text-sky-900">{payment.tender_type}</span>
                                  {payment.charge_type && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-sky-100 text-sky-800">
                                      {payment.charge_type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-sky-900">
                                {formatCurrency(payment.tender_amount)}
                              </td>
                              <td className="px-3 py-2 text-right text-sky-900">
                                {payment.change_amount > 0 ? formatCurrency(payment.change_amount) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {payment.is_cancelled ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Cancelled
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Completed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-sky-50">
                            <td className="px-3 py-2 font-semibold text-sky-900">Total Payments</td>
                            <td className="px-3 py-2 text-right font-bold text-sky-900">
                              {formatCurrency(
                                transaction.payments
                                  .filter(p => !p.is_cancelled)
                                  .reduce((sum, p) => sum + p.tender_amount, 0)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-sky-900">
                              {formatCurrency(
                                transaction.payments
                                  .filter(p => !p.is_cancelled)
                                  .reduce((sum, p) => sum + (p.change_amount || 0), 0)
                              )}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-8 space-x-4">
            <button
              className="px-4 py-2 rounded bg-sky-200 text-sky-700 font-medium disabled:opacity-50"
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              Previous
            </button>
            <span className="text-sky-700 font-medium">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              className="px-4 py-2 rounded bg-sky-200 text-sky-700 font-medium disabled:opacity-50"
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
} 