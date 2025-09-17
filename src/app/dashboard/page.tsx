"use client";

import { useEffect, useState, useCallback } from "react";
import { getSalesDb } from "@/lib/salesDb";
import React from "react";
import { Notification } from "@/components/ui/Notification";

type Terminal = {
  terminal_id: string;
  terminal_no: string;
  amount: number;
};

type Order = {
  order_id: number;
  net_total: number;
  branch_name: string;
  terminal_no: string;
};

type IntermediateBranchSales = {
  branch_name: string;
  total_sales: number;
  terminals: Map<string, number>;
};

type BranchSales = {
  branch_name: string;
  total_sales: number;
  terminals: Terminal[];
};

type PaymentMethod = {
  tender_type: string;
  total_amount: number;
  terminals: {
    terminal_no: string;
    amount: number;
  }[];
};

type BranchInfo = {
  branch_code: string;
  branch_name: string;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [topProductsSort, setTopProductsSort] = useState<'quantity' | 'sales'>('quantity');
  const [branchList, setBranchList] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Add new state for sync modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncDateRange, setSyncDateRange] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Add new state for sync status with type definition
  type SyncStatus = 'pending' | 'in_progress' | 'success' | 'failed';
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSyncId, setActiveSyncId] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Sales metrics
  const [totalSales, setTotalSales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [topProducts, setTopProducts] = useState<
    { menu_name: string; total_quantity: number; total_amount: number }[]
  >([]);
  const [salesByBranch, setSalesByBranch] = useState<BranchSales[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  // Inline collapse state and cache for per-branch payment methods
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [branchPaymentsCache, setBranchPaymentsCache] = useState<Record<string, PaymentMethod[]>>({});
  const [branchPaymentsLoading, setBranchPaymentsLoading] = useState<Record<string, boolean>>({});

  // Add new state for notification
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Function to fetch sales data
  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      const salesDb = getSalesDb();

      // Fetch branches if list is empty
      if (branchList.length === 0) {
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
      }

      // Fetch orders within date range
      let query = salesDb
        .from("orders")
        .select("*")
        .gte("log_date", dateRange.start)
        .lte("log_date", dateRange.end)
        .not("is_cancelled", "eq", true)
        .not("is_suspended", "eq", true);

      // Add branch filter if a specific branch is selected
      if (selectedBranch !== 'all') {
        query = query.eq('branch_code', selectedBranch);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        throw new Error(`Database error: ${ordersError.message}`);
      }

      if (!orders || orders.length === 0) {
        console.log("No orders found for the selected date range");
        setTotalSales(0);
        setOrderCount(0);
        setAverageOrderValue(0);
        setTopProducts([]);
        setSalesByBranch([]);
        setPaymentMethods([]);
        return;
      }

      // Fetch discounts for these orders
      const { data: discounts, error: discountsError } = await salesDb
        .from("orders_discounts")
        .select("*")
        .gte("log_date", dateRange.start)
        .lte("log_date", dateRange.end);

      if (discountsError) {
        console.error("Error fetching discounts:", discountsError);
        throw new Error(`Database error: ${discountsError.message}`);
      }

      // Create a map of order_id to total discounts
      const discountsByOrder = (discounts || []).reduce((acc, discount) => {
        // Convert order_id to string for comparison since orders_discounts.order_id is varchar
        const orderId = discount.order_id;
        acc.set(
          orderId,
          (acc.get(orderId) || 0) + (discount.subtotal_discount || 0)
        );
        return acc;
      }, new Map<string, number>());

      // Calculate total sales and order count with discounts
      const total = orders.reduce((sum, order) => {
        const netTotal = order.net_total || 0;
        // Convert order.order_id to string for comparison
        const orderDiscount =
          discountsByOrder.get(order.order_id.toString()) || 0;
        return sum + (netTotal - orderDiscount);
      }, 0);

      setTotalSales(total);
      setOrderCount(orders.length);
      setAverageOrderValue(orders.length ? total / orders.length : 0);

      // Process sales by branch with discounts
      const branchSales = orders.reduce((acc, order: Order) => {
        const branchKey = order.branch_name;
        const terminalKey = order.terminal_no || "Unknown Terminal";

        // Get discount for this order
        const orderDiscount =
          discountsByOrder.get(order.order_id.toString()) || 0;
        const netSalesAfterDiscount = (order.net_total || 0) - orderDiscount;

        // Find or create branch entry
        let branch = acc.find(
          (item: IntermediateBranchSales) => item.branch_name === branchKey
        );
        if (!branch) {
          branch = {
            branch_name: branchKey,
            total_sales: 0,
            terminals: new Map<string, number>(),
          };
          acc.push(branch);
        }

        // Update branch total
        branch.total_sales += netSalesAfterDiscount;

        // Update terminal data
        const currentTerminalTotal = branch.terminals.get(terminalKey) || 0;
        branch.terminals.set(
          terminalKey,
          currentTerminalTotal + netSalesAfterDiscount
        );

        return acc;
      }, [] as IntermediateBranchSales[]);

      // Convert Map to array for each branch and sort terminals by number
      const processedBranchSales: BranchSales[] = branchSales.map(
        (branch: IntermediateBranchSales) => ({
          branch_name: branch.branch_name,
          total_sales: branch.total_sales,
          terminals: Array.from(branch.terminals.entries())
            .sort((a: [string, number], b: [string, number]) =>
              a[0].localeCompare(b[0])
            )
            .map(([terminal_no, amount]: [string, number]) => ({
              terminal_id: terminal_no,
              terminal_no,
              amount,
            })),
        })
      );

      setSalesByBranch(processedBranchSales);

      // Fetch payment methods with discounts applied
      let paymentQuery = salesDb
        .from("order_payments")
        .select(
          "tender_type, tender_amount, change_amount, refund_amount, terminal_no, branch_code"
        )
        .gte("log_date", dateRange.start)
        .lte("log_date", dateRange.end);

      // Add branch filter if a specific branch is selected
      if (selectedBranch !== 'all') {
        paymentQuery = paymentQuery.eq('branch_code', selectedBranch);
      }

      const { data: payments } = await paymentQuery;

      if (payments) {
        // First, aggregate by payment method and terminal
        const paymentsByMethodAndTerminal = payments.reduce((acc, curr) => {
          const netAmount =
            (curr.tender_amount || 0) -
            (curr.change_amount || 0) -
            (curr.refund_amount || 0);
          const terminalNo = curr.terminal_no || "Unknown Terminal";
          const key = curr.tender_type;

          if (!acc.has(key)) {
            acc.set(key, {
              tender_type: key,
              total_amount: 0,
              terminals: new Map<string, number>(),
            });
          }

          const methodData = acc.get(key)!;
          methodData.total_amount += netAmount;

          // Update terminal amount
          const currentTerminalAmount = methodData.terminals.get(terminalNo) || 0;
          methodData.terminals.set(terminalNo, currentTerminalAmount + netAmount);

          return acc;
        }, new Map<string, { tender_type: string; total_amount: number; terminals: Map<string, number> }>());

        // Convert to array and format terminal data
        const processedPaymentMethods = Array.from(paymentsByMethodAndTerminal.values())
          .map((method) => ({
            tender_type: method.tender_type,
            total_amount: method.total_amount,
            terminals: Array.from(method.terminals.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([terminal_no, amount]) => ({
                terminal_no,
                amount,
              })),
          }))
          .sort((a, b) => b.total_amount - a.total_amount); // Sort by total amount descending

        setPaymentMethods(processedPaymentMethods);
      }

      // Fetch top products
      let topProductsQuery = salesDb
        .from("order_details")
        .select(`
          menu_name,
          menu_id,
          item_qty,
          qty_refund,
          total_amount,
          branch_code
        `)
        .gte("log_date", dateRange.start)
        .lte("log_date", dateRange.end)
        .eq("voided", false);

      // Add branch filter if a specific branch is selected
      if (selectedBranch !== 'all') {
        topProductsQuery = topProductsQuery.eq('branch_code', selectedBranch);
      }

      const { data: topProductsData } = await topProductsQuery.order("item_qty", { ascending: false });

      if (topProductsData) {
        const aggregatedProducts = topProductsData.reduce((acc, curr) => {
          const existing = acc.find(
            (item) => item.menu_name === curr.menu_name
          );
          if (existing) {
            // Calculate actual quantity by subtracting refunds
            const actualQty = curr.item_qty - (curr.qty_refund || 0);
            existing.total_quantity += actualQty;
            existing.total_amount += curr.total_amount;
          } else {
            // Initialize with actual quantity
            const actualQty = curr.item_qty - (curr.qty_refund || 0);
            acc.push({
              menu_name: curr.menu_name,
              total_quantity: actualQty,
              total_amount: curr.total_amount,
            });
          }
          return acc;
        }, [] as { menu_name: string; total_quantity: number; total_amount: number }[]);

        // Sort top products based on selected criteria and limit to top 10
        const sortedTopProducts = [...aggregatedProducts]
          .sort((a, b) => 
            topProductsSort === 'quantity' 
              ? b.total_quantity - a.total_quantity
              : b.total_amount - a.total_amount
          )
          .slice(0, 10); // Limit to top 10
        setTopProducts(sortedTopProducts);
      }
    } catch (err) {
      console.error("Error fetching sales data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [dateRange, topProductsSort, selectedBranch, branchList]);

  // Function to check sync status
  const checkSyncStatus = useCallback(async () => {
    if (!activeSyncId) return;

    try {
      const salesDb = getSalesDb();
      const { data, error } = await salesDb
        .from('sync_data')
        .select('status, records_synced, branch_code')
        .eq('id', activeSyncId)
        .single();

      if (error) throw error;

      if (data) {
        setSyncStatus(data.status as SyncStatus);
        
        // Handle different sync states
        switch (data.status) {
          case 'success':
            setActiveSyncId(null);
            setSyncStatus(null);
            setIsSyncing(false);
            // Refresh dashboard data
            await fetchSalesData();
            // Show success message with records synced
            setNotification({
              message: `Sync completed successfully for branch ${data.branch_code}${data.records_synced ? ` (${data.records_synced} records synced)` : ''}!`,
              type: 'success'
            });
            break;
          
          case 'failed':
            setActiveSyncId(null);
            setSyncStatus(null);
            setIsSyncing(false);
            setNotification({
              message: `Sync failed for branch ${data.branch_code}. Please try again.`,
              type: 'error'
            });
            break;
          
          case 'in_progress':
            // Update status text but keep polling
            break;
          
          case 'pending':
            // Keep polling until the other system picks it up
            break;
        }
      }
    } catch (err) {
      console.error('Error checking sync status:', err);
      // Don't clear the sync state on network errors, keep polling
    }
  }, [activeSyncId, fetchSalesData]);

  // Set up polling when there's an active sync
  useEffect(() => {
    if (!activeSyncId) return;

    const pollInterval = setInterval(checkSyncStatus, 5000); // Poll every 5 seconds to reduce server load

    return () => clearInterval(pollInterval);
  }, [activeSyncId, checkSyncStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(quantity);
  };

  // Update the sync button click handler
  const handleSync = async () => {
    try {
      setIsSyncing(true);

      // Check if Supabase credentials exist
      const projectUrl = localStorage.getItem("projectUrl");
      const projectKey = localStorage.getItem("projectKey");
      
      if (!projectUrl || !projectKey) {
        throw new Error("Database connection not configured. Please check your Supabase credentials.");
      }

      const salesDb = getSalesDb();
      
      // Validate branch selection
      if (selectedBranch === 'all') {
        setNotification({
          message: 'Please select a specific branch to sync',
          type: 'error'
        });
        setIsSyncing(false);
        return;
      }

      // Test connection before proceeding
      const { error: testError } = await salesDb
        .from('sync_data')
        .select('id')
        .limit(1);

      if (testError) {
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      // Check if there's already a pending sync for this branch
      const { data: existingSync, error: checkError } = await salesDb
        .from('sync_data')
        .select('id, status')
        .eq('branch_code', selectedBranch)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (checkError) throw checkError;

      if (existingSync && existingSync.length > 0) {
        throw new Error(`There is already a sync in progress for branch ${selectedBranch}. Please wait for it to complete.`);
      }

      // Convert dates to UTC for consistency
      const startDate = new Date(syncDateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const startDateUTC = startDate.toISOString();

      const endDate = new Date(syncDateRange.end);
      endDate.setHours(23, 59, 59, 999);
      const endDateUTC = endDate.toISOString();

      const now = new Date();
      const nowUTC = now.toISOString();

      // Create sync request in sync_data table
      const { data, error } = await salesDb
        .from('sync_data')
        .insert([{
          last_sync_time: nowUTC,
          branch_code: selectedBranch,
          logdate_from: startDateUTC,
          logdate_to: endDateUTC,
          status: 'pending'
        }])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Failed to create sync record: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No sync record was created');
      }

      // Set the active sync ID to start polling
      setActiveSyncId(data[0].id);
      setSyncStatus('pending');
      setIsSyncModalOpen(false);
      
    } catch (err) {
      console.error('Error initiating sync:', err);
      let errorMessage = 'Failed to initiate sync process. ';
      if (err instanceof Error) {
        errorMessage += err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage += JSON.stringify(err);
      }
      setNotification({
        message: errorMessage,
        type: 'error'
      });
      setIsSyncing(false);
    }
  };

  // Helper to aggregate payments into PaymentMethod[]
  const aggregatePayments = (
    payments: Array<{
      tender_type: string;
      tender_amount: number;
      change_amount: number;
      refund_amount: number;
      terminal_no: string | null;
    }>
  ): PaymentMethod[] => {
    const byMethodAndTerminal = payments.reduce((acc, curr) => {
      const netAmount = (curr.tender_amount || 0) - (curr.change_amount || 0) - (curr.refund_amount || 0);
      const terminalNo = curr.terminal_no || "Unknown Terminal";
      const key = curr.tender_type;
      if (!acc.has(key)) {
        acc.set(key, { tender_type: key, total_amount: 0, terminals: new Map<string, number>() });
      }
      const methodData = acc.get(key)!;
      methodData.total_amount += netAmount;
      const currentTerminalAmount = methodData.terminals.get(terminalNo) || 0;
      methodData.terminals.set(terminalNo, currentTerminalAmount + netAmount);
      return acc;
    }, new Map<string, { tender_type: string; total_amount: number; terminals: Map<string, number> }>());

    return Array.from(byMethodAndTerminal.values())
      .map((method) => ({
        tender_type: method.tender_type,
        total_amount: method.total_amount,
        terminals: Array.from(method.terminals.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([terminal_no, amount]) => ({ terminal_no, amount })),
      }))
      .sort((a, b) => b.total_amount - a.total_amount);
  };

  // Toggle branch collapse and fetch payments on first open, cache thereafter
  const toggleBranchPayments = async (branchName: string) => {
    if (expandedBranch === branchName) {
      setExpandedBranch(null);
      return;
    }

    setExpandedBranch(branchName);

    if (branchPaymentsCache[branchName]) return; // already cached

    try {
      setBranchPaymentsLoading((prev) => ({ ...prev, [branchName]: true }));

      // Map branch name to branch code
      const branch = branchList.find((b) => (b.branch_name || "") === branchName);
      if (!branch) {
        throw new Error(`Branch code not found for ${branchName}`);
      }

      const salesDb = getSalesDb();
      const { data: payments, error } = await salesDb
        .from("order_payments")
        .select("tender_type, tender_amount, change_amount, refund_amount, terminal_no, branch_code")
        .gte("log_date", dateRange.start)
        .lte("log_date", dateRange.end)
        .eq("branch_code", branch.branch_code);

      if (error) throw error;
      const aggregated = aggregatePayments((payments as any) || []);
      setBranchPaymentsCache((prev) => ({ ...prev, [branchName]: aggregated }));
    } catch (err) {
      console.error("Error loading branch payments:", err);
      setNotification({
        message: err instanceof Error ? err.message : "Failed to load branch payments",
        type: "error",
      });
    } finally {
      setBranchPaymentsLoading((prev) => ({ ...prev, [branchName]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      {/* Navigation Bar without burger menu */}
      <nav className="bg-white/90 shadow-md border-b border-sky-200 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col py-4">
            {/* Title Section */}
            <div className="flex items-center justify-center sm:justify-start h-12 mb-4">
              <h1 className="text-xl sm:text-2xl font-extrabold text-sky-800 tracking-tight drop-shadow-sm">
                Sales Monitoring System
              </h1>
            </div>
            
            {/* Controls Section - Reorganized for better mobile layout */}
            <div className="flex flex-col space-y-4">
              {/* Date Range Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs text-sky-600 mb-1 font-semibold">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 text-sky-900"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-sky-600 mb-1 font-semibold">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 text-sky-900"
                  />
                </div>
              </div>

              {/* Branch and Sync Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Branch Selection */}
                <div className="flex flex-col">
                  <label className="text-xs text-sky-600 mb-1 font-semibold">
                    Branch
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <svg 
                        className="h-5 w-5 text-sky-500" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
                        />
                      </svg>
                    </div>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full h-[38px] border border-sky-300 bg-white/70 rounded-lg pl-9 pr-8 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 text-sky-900 appearance-none hover:bg-sky-50/50"
                    >
                      <option value="all">All Branches</option>
                      {branchList.map((branch) => (
                        <option key={branch.branch_code} value={branch.branch_code}>
                          {branch.branch_name}
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

                {/* Sync Button */}
                <div className="flex items-end">
                  <button
                    onClick={() => setIsSyncModalOpen(true)}
                    className="w-full h-[38px] bg-[#0091EA] text-white rounded-lg hover:bg-[#0082d1] focus:ring-2 focus:ring-[#0091EA]/50 focus:outline-none transition-colors duration-200 flex items-center justify-center space-x-2 text-sm font-medium shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sync Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Sync Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50 p-4">
          <div className="bg-[#f5f5f5] rounded-lg shadow-lg w-full max-w-[400px]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-[16px] font-semibold text-gray-800">Sync Data</h2>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                disabled={isSyncing}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Branch Selection */}
              <div>
                <label className="block text-[13px] font-medium text-gray-600 mb-1">Select Branch</label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 focus:ring-1 focus:ring-[#0091EA] focus:border-[#0091EA] shadow-sm appearance-none pr-8"
                    disabled={isSyncing}
                  >
                    <option value="all">All Branches</option>
                    {branchList.map((branch) => (
                      <option key={branch.branch_code} value={branch.branch_code}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-600 mb-1">From Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={syncDateRange.start}
                    onChange={(e) => setSyncDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full h-9 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 focus:ring-1 focus:ring-[#0091EA] focus:border-[#0091EA] shadow-sm"
                    disabled={isSyncing}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-gray-600 mb-1">To Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={syncDateRange.end}
                    onChange={(e) => setSyncDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full h-9 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 focus:ring-1 focus:ring-[#0091EA] focus:border-[#0091EA] shadow-sm"
                    disabled={isSyncing}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="px-4 h-9 text-[#0091EA] hover:bg-[#0091EA]/5 transition-colors duration-200 text-sm font-medium rounded"
                  disabled={isSyncing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  className="px-4 h-9 bg-[#0091EA] text-white hover:bg-[#0082d1] focus:ring-1 focus:ring-[#0091EA]/50 focus:outline-none transition-colors duration-200 flex items-center space-x-1.5 text-sm font-medium rounded disabled:bg-[#0091EA]/50 disabled:cursor-not-allowed"
                  disabled={isSyncing || selectedBranch === 'all'}
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Start Sync</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 text-lg font-semibold">{error}</div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-8">
            {/* Enhanced Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
              <div className="bg-white/90 rounded-2xl shadow-lg p-6 sm:p-8 border border-sky-100 hover:shadow-xl transition-all duration-200">
                <h3 className="text-xs font-bold text-sky-700 uppercase tracking-widest">
                  Total Sales
                </h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-800 drop-shadow-sm break-words">
                  {formatCurrency(totalSales)}
                </p>
                <div className="mt-2 text-sm text-sky-700">
                  For the selected period
                </div>
              </div>
              <div className="bg-white/90 rounded-2xl shadow-lg p-6 sm:p-8 border border-sky-100 hover:shadow-xl transition-all duration-200">
                <h3 className="text-xs font-bold text-sky-700 uppercase tracking-widest">
                  Total Orders
                </h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-800 drop-shadow-sm">
                  {orderCount}
                </p>
                <div className="mt-2 text-sm text-sky-700">
                  Number of transactions
                </div>
              </div>
              <div className="bg-white/90 rounded-2xl shadow-lg p-6 sm:p-8 border border-sky-100 hover:shadow-xl transition-all duration-200">
                <h3 className="text-xs font-bold text-sky-700 uppercase tracking-widest">
                  Average Order Value
                </h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-800 drop-shadow-sm break-words">
                  {formatCurrency(averageOrderValue)}
                </p>
                <div className="mt-2 text-sm text-sky-700">Per transaction</div>
              </div>
            </div>

            {/* Enhanced Top Products */}
            <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-sky-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">Top 10 Products</h2>
                  <p className="text-sm text-gray-500">
                    Best selling products by {topProductsSort === 'quantity' ? 'quantity sold' : 'total sales'}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setTopProductsSort('quantity')}
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl transition-all duration-200 ${
                      topProductsSort === 'quantity'
                        ? 'bg-sky-500 text-white shadow-md hover:bg-sky-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    By Quantity
                  </button>
                  <button
                    onClick={() => setTopProductsSort('sales')}
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl transition-all duration-200 ${
                      topProductsSort === 'sales'
                        ? 'bg-sky-500 text-white shadow-md hover:bg-sky-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    By Sales
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-4 pr-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="py-4 px-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="py-4 pl-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topProducts.map((product, index) => (
                      <tr
                        key={product.menu_name}
                        className="group hover:bg-sky-50/50 transition-colors duration-200"
                      >
                        <td className="py-4 pr-4">
                          <div className="flex items-center">
                            <span className={`w-8 h-8 flex items-center justify-center rounded-full ${
                              index < 3 ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-600'
                            } mr-3 text-sm font-semibold`}>
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 group-hover:text-sky-700 transition-colors duration-200">
                              {product.menu_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-600">
                          {formatQuantity(product.total_quantity)}
                        </td>
                        <td className="py-4 pl-4 text-right font-medium text-gray-900">
                          {formatCurrency(product.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Enhanced Sales by Branch */}
              <div className="bg-white/90 rounded-2xl shadow-lg overflow-hidden border border-sky-100">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                  <h3 className="text-lg font-bold text-sky-800">
                    Sales by Branch
                  </h3>
                  <p className="mt-1 text-sm text-sky-700">
                    Performance across different locations
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50">
                      <tr>
                        <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-700 uppercase tracking-widest">
                          Branch
                        </th>
                        <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-700 uppercase tracking-widest">
                          Total Sales
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-sky-50">
                      {salesByBranch.map((branch, index) => (
                        <React.Fragment key={`branch-group-${index}`}>
                          <tr className="hover:bg-sky-50 transition-colors duration-150 border-t border-sky-100">
                            <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm text-sky-800 font-bold">
                              {branch.branch_name}
                            </td>
                            <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-800 text-right font-bold">
                              {formatCurrency(branch.total_sales)}
                            </td>
                          </tr>
                          {branch.terminals.length > 1 &&
                            branch.terminals.map(
                              (terminal: Terminal, tIndex: number) => (
                                <tr
                                  key={`terminal-${index}-${tIndex}`}
                                  className="hover:bg-sky-50/50 transition-colors duration-150"
                                >
                                  <td className="px-4 sm:px-8 py-2 pl-8 whitespace-normal sm:whitespace-nowrap text-sm text-sky-600">
                                    └ Terminal {terminal.terminal_no}
                                  </td>
                                  <td className="px-4 sm:px-8 py-2 whitespace-nowrap text-sm text-sky-600 text-right">
                                    {formatCurrency(terminal.amount)}
                                  </td>
                                </tr>
                              )
                            )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enhanced Payment Methods */}
              <div className="bg-white/90 rounded-2xl shadow-lg overflow-hidden border border-sky-100">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                  <h3 className="text-lg font-bold text-sky-800">
                    Payment Methods
                  </h3>
                  <p className="mt-1 text-sm text-sky-700">
                    Distribution of payment types
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50">
                      <tr>
                        <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-700 uppercase tracking-widest">
                          Method
                        </th>
                        <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-700 uppercase tracking-widest">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-sky-50">
                      {paymentMethods.map((method, index) => (
                        <React.Fragment key={`payment-group-${index}`}>
                          <tr className="hover:bg-sky-50 transition-colors duration-150 border-t border-sky-100">
                            <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm text-sky-800 font-bold">
                              {method.tender_type}
                            </td>
                            <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-800 text-right font-bold">
                              {formatCurrency(method.total_amount)}
                            </td>
                          </tr>
                          {method.terminals.length > 1 &&
                            method.terminals.map((terminal, tIndex) => (
                              <tr
                                key={`payment-terminal-${index}-${tIndex}`}
                                className="hover:bg-sky-50/50 transition-colors duration-150"
                              >
                                <td className="px-4 sm:px-8 py-2 pl-8 whitespace-normal sm:whitespace-nowrap text-sm text-sky-600">
                                  └ Terminal {terminal.terminal_no}
                                </td>
                                <td className="px-4 sm:px-8 py-2 whitespace-nowrap text-sm text-sky-600 text-right">
                                  {formatCurrency(terminal.amount)}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Branch Sales (Summary) - Only Branch Name and Total Sales */}
            <div className="bg-white/90 rounded-2xl shadow-lg overflow-hidden border border-sky-100">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                <h3 className="text-lg font-bold text-sky-800">
                  Branch Sales (Summary)
                </h3>
                <p className="mt-1 text-sm text-sky-700">Branch name and total sales only</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-sky-100">
                  <thead className="bg-sky-50">
                    <tr>
                      <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-700 uppercase tracking-widest">
                        Branch
                      </th>
                      <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-700 uppercase tracking-widest">
                        Total Sales
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sky-50">
                    {salesByBranch.map((branch, index) => (
                      <React.Fragment key={`branch-summary-${index}`}>
                        <tr
                          className="hover:bg-sky-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                          onClick={() => toggleBranchPayments(branch.branch_name)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleBranchPayments(branch.branch_name);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expandedBranch === branch.branch_name}
                        >
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm text-sky-800 font-medium">
                            <span className="text-sky-800">
                              {branch.branch_name}
                            </span>
                          </td>
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-800 text-right font-semibold">
                            {formatCurrency(branch.total_sales)}
                          </td>
                        </tr>
                        {expandedBranch === branch.branch_name && (
                          <tr>
                            <td colSpan={2} className="px-4 sm:px-8 py-2 bg-sky-50">
                              {branchPaymentsLoading[branch.branch_name] ? (
                                <div className="flex items-center justify-center py-6">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  {(!branchPaymentsCache[branch.branch_name] || branchPaymentsCache[branch.branch_name].length === 0) ? (
                                    <div className="text-center text-sm text-gray-600 py-4">No payment data for selected period.</div>
                                  ) : (
                                    <table className="min-w-full">
                                      <thead>
                                        <tr>
                                          <th className="py-2 text-left text-xs font-bold text-sky-700 uppercase tracking-widest">Method</th>
                                          <th className="py-2 text-right text-xs font-bold text-sky-700 uppercase tracking-widest">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {branchPaymentsCache[branch.branch_name].map((method, mIdx) => (
                                          <React.Fragment key={`branch-collapse-${index}-${mIdx}`}>
                                            <tr className="hover:bg-sky-100/50">
                                              <td className="py-2 text-sm text-sky-800 font-medium">{method.tender_type}</td>
                                              <td className="py-2 text-sm text-sky-800 text-right font-semibold">{formatCurrency(method.total_amount)}</td>
                                            </tr>
                                            {method.terminals.length > 1 && method.terminals.map((terminal, tIdx) => (
                                              <tr key={`branch-collapse-term-${index}-${mIdx}-${tIdx}`} className="hover:bg-sky-100/30">
                                                <td className="py-1 pl-6 text-sm text-sky-600">└ Terminal {terminal.terminal_no}</td>
                                                <td className="py-1 text-sm text-sky-600 text-right">{formatCurrency(terminal.amount)}</td>
                                              </tr>
                                            ))}
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Update sync status indicator */}
      {activeSyncId && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 border border-sky-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {syncStatus === 'pending' && (
                <>
                  <svg className="animate-spin h-5 w-5 text-sky-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Waiting for sync to begin...</span>
                </>
              )}
              {syncStatus === 'in_progress' && (
                <>
                  <svg className="animate-spin h-5 w-5 text-sky-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Syncing data...</span>
                </>
              )}
              {syncStatus === 'success' && (
                <>
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Sync complete!</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Sync failed</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Removed modal in favor of inline collapsible rows */}
    </div>
  );
}
