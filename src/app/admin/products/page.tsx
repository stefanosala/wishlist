'use client'; // Required for useEffect and useState

import { DbProduct } from '@/products/types';
import Image from 'next/image';
import React, { useState, useEffect, useCallback, useRef } from 'react';

const PAGE_SIZE = 10; // Define page size constant
const DEBOUNCE_DELAY = 500; // milliseconds for shop name input debounce

export default function AdminProductsPage() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [shopFilter, setShopFilter] = useState('');
  const [debouncedShopFilter, setDebouncedShopFilter] = useState('');
  const [interestsFilter, setInterestsFilter] = useState('');
  const [debouncedInterestsFilter, setDebouncedInterestsFilter] = useState('');

  // Ref for debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interestsDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce shop filter input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedShopFilter(shopFilter);
      setCurrentPage(1); // Reset page when debounced filter changes
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [shopFilter]);

  // Debounce interests filter input
  useEffect(() => {
    if (interestsDebounceTimerRef.current) {
      clearTimeout(interestsDebounceTimerRef.current);
    }
    interestsDebounceTimerRef.current = setTimeout(() => {
      setDebouncedInterestsFilter(interestsFilter);
      setCurrentPage(1); // Reset page when debounced filter changes
    }, DEBOUNCE_DELAY);

    return () => {
      if (interestsDebounceTimerRef.current) {
        clearTimeout(interestsDebounceTimerRef.current);
      }
    };
  }, [interestsFilter]);

  // Reset page when active filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const fetchProducts = useCallback(async (page: number, currentActiveFilter: string, currentShopFilter: string, currentInterestsFilter: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (currentActiveFilter !== 'all') {
        params.set('active', currentActiveFilter);
      }
      if (currentShopFilter.trim() !== '') {
        params.set('shopName', currentShopFilter.trim());
      }
      if (currentInterestsFilter.trim() !== '') {
        params.set('interests', currentInterestsFilter.trim());
      }

      const response = await fetch(`/api/admin?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data && Array.isArray(data.products) && typeof data.totalCount === 'number') {
        setProducts(data.products);
        setTotalCount(data.totalCount);
        setError(null);
      } else {
        throw new Error('Invalid data format received from API');
      }
    } catch (e) {
      console.error('Failed to fetch products:', e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies, relies on arguments

  // Fetch products when page or filters change
  useEffect(() => {
    fetchProducts(currentPage, activeFilter, debouncedShopFilter, debouncedInterestsFilter);
  }, [currentPage, activeFilter, debouncedShopFilter, debouncedInterestsFilter, fetchProducts]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleActiveFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveFilter(event.target.value as 'all' | 'true' | 'false');
  };

  const handleShopFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShopFilter(event.target.value);
  };

  const handleInterestsFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInterestsFilter(event.target.value);
  };

  if (loading && products.length === 0 && currentPage === 1) { // Show initial loading only on first load
    return <div className="p-4 text-center">Loading products...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600 text-center">Error loading products: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">All Products</h1>

      {/* Filter Controls */}
      <div className="flex space-x-4 mb-4">
        <div>
          <label htmlFor="activeFilter" className="block text-sm font-medium text-gray-700 mr-2">
            Status:
          </label>
          <select
            id="activeFilter"
            value={activeFilter}
            onChange={handleActiveFilterChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div>
          <label htmlFor="shopFilter" className="block text-sm font-medium text-gray-700 mr-2">
            Shop Name:
          </label>
          <input
            type="text"
            id="shopFilter"
            value={shopFilter}
            onChange={handleShopFilterChange}
            placeholder="Filter by shop..."
            className="mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="interestsFilter" className="block text-sm font-medium text-gray-700 mr-2">
            Interests:
          </label>
          <input
            type="text"
            id="interestsFilter"
            value={interestsFilter}
            onChange={handleInterestsFilterChange}
            placeholder="Filter by interests (comma-separated)..."
            className="mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {loading && <div className="p-4 text-center text-gray-500">Updating...</div>}

      <div className="overflow-x-auto mb-4">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b text-left">Image</th>
              <th className="py-2 px-4 border-b text-left">Name</th>
              <th className="py-2 px-4 border-b text-left">Interests</th>
              <th className="py-2 px-4 border-b text-left">Description</th>
              <th className="py-2 px-4 border-b text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="py-4 px-4 text-center text-gray-500">No products match the current filters.</td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">
                    <Image
                      src={product.imageUrl || '/placeholder.png'}
                      alt={product.productName}
                      width={128}
                      height={128}
                      className="object-cover bg-gray-200"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                    />
                  </td>
                  <td className="py-2 px-4 border-b">
                    <p>
                      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {product.productName}
                      </a>
                    </p>
                    <p className="mt-2 text-gray-400">
                      {product.id}
                    </p>
                    <p className="mt-2">
                      {product.shopName}
                    </p>
                    <p className="mt-2 text-gray-600">
                      {product.priceMin?.toLocaleString("en-US", { style: "currency", currency: product.currency ?? "USD" }) ?? 'N/A'}
                    </p>
                  </td>
                  <td className="py-2 px-4 border-b max-w-xs">
                    {product.interests?.map((interest) => (<p key={interest}>{interest}</p>))}
                  </td>
                  <td className="py-2 px-4 border-b max-w-xs" title={product.description}>
                    {product.description}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {product.active === true ? '✅' : product.active === false ? '❌' : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1 || loading}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages} (Total: {totalCount} products)
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages || loading}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
