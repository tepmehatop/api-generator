import { httpClient } from './http-client';

/**
 * Типы для модуля: orders
 */

export interface OrderListResponse {
  orders?: Order[];
  pagination?: PageMetadata;
}

export interface Order {
  id?: number;
  user?: User;
  status?: string;
}

export interface PageMetadata {
  page?: number;
  total?: number;
  sortBy?: SortObject;
}

export interface SortObject {
  field?: string;
  order?: 'asc' | 'desc';
}

export interface User {
  id?: number;
  name?: string;
  role?: Role;
}

export interface Role {
  id?: number;
  name?: string;
}

/**
 * API методы для: orders
 */

/**
 * No Description
 *
 * @tags orders
 * @name listOrders
 * @request GET:/orders
 * @response '200' 'OrderListResponse' Success
 */
export async function listOrders(): Promise<OrderListResponse> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/orders`,
  });
  return response.data;
}
