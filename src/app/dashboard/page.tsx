"use client";

import { useEffect, useState } from "react";
import { getSalesDb } from "@/lib/salesDb";
import React from "react";

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

  // Sales metrics
  const [totalSales, setTotalSales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [topProducts, setTopProducts] = useState<
    { menu_name: string; total_quantity: number; total_amount: number }[]
  >([]);
  const [salesByBranch, setSalesByBranch] = useState<BranchSales[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

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
    const fetchSalesData = async () => {
      try {
        const salesDb = getSalesDb();

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
        console.error("Error in fetchSalesData:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch sales data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [dateRange, topProductsSort, selectedBranch]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300">
      {/* Navigation Bar without burger menu */}
      <nav className="bg-white/90 shadow-md border-b border-sky-200 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between py-4 sm:py-0">
            <div className="flex items-center justify-center sm:justify-start h-16">
              <h1 className="text-xl sm:text-2xl font-extrabold text-sky-800 tracking-tight drop-shadow-sm">
                Sales Monitoring System
              </h1>
            </div>
            <div className="flex items-center justify-center sm:justify-end pb-4 sm:pb-0">
              <div className="flex flex-row space-x-3">
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
                      className="w-full border border-sky-300 bg-white/70 rounded-lg pl-9 pr-8 py-1.5 text-sm focus:ring-2 focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200 text-sky-900 appearance-none hover:bg-sky-50/50"
                    >
                      <option value="all">All Branches</option>
                      {branchList.map((branch) => (
                        <option key={branch.branch_code} value={branch.branch_code}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg 
                        className="h-4 w-4 text-sky-500" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 9l-7 7-7-7" 
                        />
                      </svg>
                    </div>
                  </div>
                  {selectedBranch !== 'all' && (
                    <p className="mt-1 text-xs text-sky-600">
                      Showing data for selected branch only
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

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
          </div>
        )}
      </main>
    </div>
  );
}
