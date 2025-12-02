import { httpClient } from './http-client';

/**
 * Типы для модуля: products
 */

export interface Product {
  id?: number;
  name?: string;
  price?: number;
  category?: string;
}

/**
 * API методы для: products
 */

/**
 * List products
 */
export async function listProducts(category?: string): Promise<Product[]> {
  const url = `/products`;
  const params = {
    category: category,
  };
  const response = await httpClient.request({
    method: 'GET',
    url,
    params,
  });
  return response.data;
}
