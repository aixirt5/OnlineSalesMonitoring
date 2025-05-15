'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSalesDb } from '@/lib/salesDb';
import { Order, OrderDetail, OrderPayment } from '@/types/sales';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Sales metrics
  const [totalSales, setTotalSales] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [topProducts, setTopProducts] = useState<{ menu_name: string; total_quantity: number; total_amount: number }[]>([]);
  const [salesByBranch, setSalesByBranch] = useState<{ branch_name: string; total_sales: number }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ tender_type: string; total_amount: number }[]>([]);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const salesDb = getSalesDb();

        // Fetch orders within date range
        const { data: orders, error: ordersError } = await salesDb
          .from('orders')
          .select('*, amount_discount')
          .gte('log_date', dateRange.start)
          .lte('log_date', dateRange.end)
          .not('is_cancelled', 'eq', true)
          .not('is_suspended', 'eq', true);

        if (ordersError) throw ordersError;

        // Calculate total sales and order count
        const total = orders?.reduce((sum, order) => sum + (order.net_total || 0), 0) || 0;
        setTotalSales(total);
        setOrderCount(orders?.length || 0);
        setAverageOrderValue(orders?.length ? total / orders.length : 0);

        // Fetch top products
        const { data: topProductsData } = await salesDb
          .from('order_details')
          .select('menu_name, item_qty, total_amount')
          .gte('log_date', dateRange.start)
          .lte('log_date', dateRange.end)
          .not('voided', 'eq', true)
          .order('total_amount', { ascending: false })
          .limit(5);

        if (topProductsData) {
          const aggregatedProducts = topProductsData.reduce((acc, curr) => {
            const existing = acc.find(item => item.menu_name === curr.menu_name);
            if (existing) {
              existing.total_quantity += curr.item_qty;
              existing.total_amount += curr.total_amount;
            } else {
              acc.push({
                menu_name: curr.menu_name,
                total_quantity: curr.item_qty,
                total_amount: curr.total_amount
              });
            }
            return acc;
          }, [] as { menu_name: string; total_quantity: number; total_amount: number }[]);

          setTopProducts(aggregatedProducts);
        }

        // Fetch sales by branch
        const branchSales = orders?.reduce((acc, order) => {
          const existing = acc.find((item: { branch_name: string; total_sales: number }) => item.branch_name === order.branch_name);
          if (existing) {
            existing.total_sales += order.net_total;
          } else {
            acc.push({
              branch_name: order.branch_name,
              total_sales: order.net_total
            });
          }
          return acc;
        }, [] as { branch_name: string; total_sales: number }[]) || [];

        setSalesByBranch(branchSales);

        // Fetch payment methods
        const { data: payments } = await salesDb
          .from('order_payments')
          .select('tender_type, tender_amount')
          .gte('log_date', dateRange.start)
          .lte('log_date', dateRange.end);

        if (payments) {
          const aggregatedPayments = payments.reduce((acc, curr) => {
            const existing = acc.find(item => item.tender_type === curr.tender_type);
            if (existing) {
              existing.total_amount += curr.tender_amount;
            } else {
              acc.push({
                tender_type: curr.tender_type,
                total_amount: curr.tender_amount
              });
            }
            return acc;
          }, [] as { tender_type: string; total_amount: number }[]);

          setPaymentMethods(aggregatedPayments);
        }

      } catch (err) {
        console.error(err);
        setError('Failed to fetch sales data');
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300">
      {/* Enhanced Navigation Bar with better mobile responsiveness */}
      <nav className="sticky top-0 z-50 bg-white/80 shadow-md border-b border-sky-200 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between py-4 sm:py-0">
            <div className="flex items-center justify-center sm:justify-start h-16">
              <h1 className="text-xl sm:text-2xl font-extrabold text-sky-700 tracking-tight drop-shadow-sm">
                Sales Monitoring System
              </h1>
            </div>
            <div className="flex items-center justify-center sm:justify-end pb-4 sm:pb-0">
              <div className="flex flex-row space-x-3">
                <div className="flex flex-col">
                  <label className="text-xs text-sky-600 mb-1 font-semibold">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-sky-600 mb-1 font-semibold">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full border border-sky-300 bg-white/70 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-sky-400 focus:border-sky-400 shadow-sm transition-all duration-200"
                  />
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
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest">Total Sales</h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-700 drop-shadow-sm break-words">{formatCurrency(totalSales)}</p>
                <div className="mt-2 text-sm text-sky-600">For the selected period</div>
              </div>
              <div className="bg-white/90 rounded-2xl shadow-lg p-6 sm:p-8 border border-sky-100 hover:shadow-xl transition-all duration-200">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest">Total Orders</h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-700 drop-shadow-sm">{orderCount}</p>
                <div className="mt-2 text-sm text-sky-600">Number of transactions</div>
              </div>
              <div className="bg-white/90 rounded-2xl shadow-lg p-6 sm:p-8 border border-sky-100 hover:shadow-xl transition-all duration-200">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest">Average Order Value</h3>
                <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-extrabold text-sky-700 drop-shadow-sm break-words">{formatCurrency(averageOrderValue)}</p>
                <div className="mt-2 text-sm text-sky-600">Per transaction</div>
              </div>
            </div>

            {/* Enhanced Top Products */}
            <div className="bg-white/90 rounded-2xl shadow-lg overflow-hidden border border-sky-100">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                <h3 className="text-lg font-bold text-sky-700">Top Products</h3>
                <p className="mt-1 text-sm text-sky-500">Best performing products by sales amount</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-sky-100">
                  <thead className="bg-sky-50">
                    <tr>
                      <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-widest">Product</th>
                      <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest">Quantity</th>
                      <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sky-50">
                    {topProducts.slice(0, 10).map((product, index) => (
                      <tr key={index} className="hover:bg-sky-50 transition-colors duration-150">
                        <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm font-semibold text-sky-700">{product.menu_name}</td>
                        <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-600 text-right">{product.total_quantity}</td>
                        <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-700 text-right font-bold">{formatCurrency(product.total_amount)}</td>
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
                  <h3 className="text-lg font-bold text-sky-700">Sales by Branch</h3>
                  <p className="mt-1 text-sm text-sky-500">Performance across different locations</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50">
                      <tr>
                        <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-widest">Branch</th>
                        <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-sky-50">
                      {salesByBranch.map((branch, index) => (
                        <tr key={index} className="hover:bg-sky-50 transition-colors duration-150">
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm text-sky-700 font-semibold">{branch.branch_name}</td>
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-700 text-right font-bold">{formatCurrency(branch.total_sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enhanced Payment Methods */}
              <div className="bg-white/90 rounded-2xl shadow-lg overflow-hidden border border-sky-100">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                  <h3 className="text-lg font-bold text-sky-700">Payment Methods</h3>
                  <p className="mt-1 text-sm text-sky-500">Distribution of payment types</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50">
                      <tr>
                        <th className="px-4 sm:px-8 py-3 text-left text-xs font-bold text-sky-500 uppercase tracking-widest">Method</th>
                        <th className="px-4 sm:px-8 py-3 text-right text-xs font-bold text-sky-500 uppercase tracking-widest">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-sky-50">
                      {paymentMethods.map((method, index) => (
                        <tr key={index} className="hover:bg-sky-50 transition-colors duration-150">
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-normal sm:whitespace-nowrap text-sm text-sky-700 font-semibold">{method.tender_type}</td>
                          <td className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap text-sm text-sky-700 text-right font-bold">{formatCurrency(method.total_amount)}</td>
                        </tr>
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