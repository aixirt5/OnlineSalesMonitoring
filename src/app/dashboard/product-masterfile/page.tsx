'use client';

import { useEffect, useState } from 'react';
import { getSalesDb } from '@/lib/salesDb';

interface Product {
  id: number;
  category: string;
  productcode: string;
  menudescription: string;
  printto: string;
  taxable: string;
  srp: number;
  quantity: number;
  item1: string;
  status: string;
  updated_by: string;
  branchcode: string;
  created_at: string;
  updated_at: string;
}

export default function ProductMasterfile() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    category: '',
    productcode: '',
    menudescription: '',
    printto: '',
    taxable: '',
    srp: 0,
    quantity: 0,
    item1: '',
    status: 'Active',
    branchcode: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const salesDb = getSalesDb();
      const { data, error } = await salesDb
        .from('itemlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const salesDb = getSalesDb();
      if (selectedProduct) {
        // Update existing product
        const { error } = await salesDb
          .from('itemlist')
          .update(formData)
          .eq('id', selectedProduct.id);
        if (error) throw error;
      } else {
        // Create new product
        const { error } = await salesDb
          .from('itemlist')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      setSelectedProduct(null);
      setFormData({
        category: '',
        productcode: '',
        menudescription: '',
        printto: '',
        taxable: '',
        srp: 0,
        quantity: 0,
        item1: '',
        status: 'Active',
        branchcode: '',
      });
      fetchProducts();
    } catch (err) {
      console.error(err);
      setError('Failed to save product');
    }
  };

  const filteredProducts = products.filter(product =>
    product.menudescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.productcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-sky-100 to-sky-300">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-sky-700">Product Masterfile (Upcoming Feature)</h1>
           {/* ADD NEW PRODUCT BUTTON */}
            {/* <button
              onClick={() => {
                setSelectedProduct(null);
                setFormData({
                  category: '',
                  productcode: '',
                  menudescription: '',
                  printto: '',
                  taxable: '',
                  srp: 0,
                  quantity: 0,
                  item1: '',
                  status: 'Active',
                  branchcode: '',
                });
                setIsModalOpen(true);
              }}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors"
            >
              Add New Product
            </button> */}
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-sky-300 rounded-lg focus:ring-sky-400 focus:border-sky-400"
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
          ) : error ? (
            <div className="text-red-600 text-center py-4">{error}</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-sky-200">
                  <thead className="bg-sky-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">Product Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">SRP</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">Status</th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-sky-500 uppercase tracking-wider">Actions</th> */}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-sky-200">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-sky-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-900">{product.productcode}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-900">{product.menudescription}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-900">{product.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-900">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'PHP'
                          }).format(product.srp || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-900">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-sky-600 hover:text-sky-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold text-sky-700 mb-4">
              {selectedProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-sky-700">Product Code</label>
                  <input
                    type="text"
                    value={formData.productcode}
                    onChange={(e) => setFormData({ ...formData, productcode: e.target.value })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-sky-700">Description</label>
                  <input
                    type="text"
                    value={formData.menudescription}
                    onChange={(e) => setFormData({ ...formData, menudescription: e.target.value })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700">SRP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.srp}
                    onChange={(e) => setFormData({ ...formData, srp: parseFloat(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700">Branch Code</label>
                  <input
                    type="text"
                    value={formData.branchcode}
                    onChange={(e) => setFormData({ ...formData, branchcode: e.target.value })}
                    className="mt-1 block w-full rounded-md border-sky-300 shadow-sm focus:border-sky-400 focus:ring-sky-400"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-sky-300 rounded-md text-sky-700 hover:bg-sky-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                >
                  {selectedProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 