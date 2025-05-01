'use client';

import React, { useState } from 'react';
import { useRecommendedProducts } from '@/queries/product';
import { sha256 } from 'js-sha256';
import isEmail from '@/utils/is-email';
import Image from 'next/image';
import { ProductVectorResult } from '@/products/types';

// Helper function to validate image URLs
const getValidImageUrl = (url: string | undefined | null): string => {
  if (!url) return '/placeholder.png';

  // Check if URL is valid
  try {
    new URL(url);
    return url;
  } catch {
    return '/placeholder.png';
  }
};

export default function EmailRecommendationsPage() {
  const [email, setEmail] = useState('');
  const [budget, setBudget] = useState(':'); // Default budget
  const [hash, setHash] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const {
    data: recommendationData,
    isError: isFetchProductsError,
    isFetching: isFetchingProducts,
  } = useRecommendedProducts(hash, budget, {
    enabled: !!hash, // Only run the query when hash is available
  });

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setError(null);
  };

  const handleBudgetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setBudget(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!isEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Generate hash from email
    const emailHash = sha256(email.trim().toLowerCase());
    setHash(emailHash);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Email Recommendations</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-grow">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter email address"
              className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          <div className="w-full sm:w-48">
            <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
              Budget
            </label>
            <select
              id="budget"
              value={budget}
              onChange={handleBudgetChange}
              className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value=":">All</option>
              <option value=":30">Up to $30</option>
              <option value=":50">Up to $50</option>
              <option value=":100">Up to $100</option>
              <option value="100:">$100+</option>
            </select>
          </div>

          <div className="self-end">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              disabled={isFetchingProducts}
            >
              {isFetchingProducts ? 'Loading...' : 'Get Recommendations'}
            </button>
          </div>
        </div>
      </form>

      {isFetchingProducts && (
        <div className="p-4 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Fetching recommendations...</p>
        </div>
      )}

      {isFetchProductsError && (
        <div className="p-4 text-red-600 text-center">
          Error loading recommendations. Please try again.
        </div>
      )}

      {recommendationData && recommendationData.products && recommendationData.products.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">User Interests</h2>
            <div className="flex flex-wrap gap-2">
              {recommendationData.interests.map((interest, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-100 px-3 py-1 rounded-full text-sm"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Recommended Products</h2>
          <div className="text-sm text-gray-600 mb-3">Products are sorted by most matching interests first</div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b text-left">Image</th>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-left">Interests <span className="text-xs text-indigo-600">(✓ = match)</span></th>
                  <th className="py-2 px-4 border-b text-left">Description</th>
                  <th className="py-2 px-4 border-b text-left">Active</th>
                </tr>
              </thead>
              <tbody>
                {[...recommendationData.products]
                  .map(product => ({
                    ...product,
                    matchCount: product.interests?.filter(interest =>
                      recommendationData.interests.includes(interest)
                    ).length || 0
                  }))
                  .sort((a, b) => b.matchCount - a.matchCount)
                  .map((product: ProductVectorResult & { matchCount: number }) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">
                      <div className="relative w-32 h-32 bg-gray-100">
                        <Image
                          src={getValidImageUrl(product.imageUrl)}
                          alt={product.productName}
                          width={128}
                          height={128}
                          className="object-cover"
                          onError={(e) => {
                            console.log(`Image failed to load: ${product.imageUrl}`);
                            (e.target as HTMLImageElement).src = '/placeholder.png';
                          }}
                          unoptimized={true}
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdQIQcSWQCwAAAABJRU5ErkJggg=="
                        />
                      </div>
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
                      {(() => {
                        const matches = product.interests?.filter(interest =>
                          recommendationData.interests.includes(interest)
                        ) || [];

                        return (
                          <>
                            {matches.length > 0 && (
                              <p className="mb-2 bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded">
                                {matches.length} matching interest{matches.length !== 1 ? 's' : ''}
                              </p>
                            )}
                            {product.interests?.map((interest) => {
                              const isMatching = recommendationData.interests.includes(interest);
                              return (
                                <p
                                  key={interest}
                                  className={`${isMatching ? 'font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded' : ''}`}
                                >
                                  {isMatching ? '✓ ' : ''}{interest}
                                </p>
                              );
                            })}
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-4 border-b max-w-xs" title={product.description}>
                      {product.description}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {product.active === true ? '✅' : product.active === false ? '❌' : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {recommendationData && recommendationData.products && recommendationData.products.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          No recommendations found for this email.
        </div>
      )}
    </div>
  );
}
