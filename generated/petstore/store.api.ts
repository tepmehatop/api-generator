import { httpClient } from './http-client';

/**
 * Типы для модуля: store
 */

export interface Order {
  id?: number;
  petId?: number;
  quantity?: number;
  shipDate?: string;
  /** Order Status */
  status?: 'placed' | 'approved' | 'delivered';
  complete?: boolean;
}

/**
 * API методы для: store
 */

/**
 * Place an order for a pet
 *
 * @tags store
 * @name placeOrder
 * @request POST:/store/order
 * @response '200' 'Order' successful operation
 * @response '400' 'void' Invalid Order
 */
export async function placeOrder(body: Order): Promise<Order> {
  const response = await httpClient.request({
    method: 'POST',
    url: `/store/order`,
    data: body,
  });
  return response.data;
}

/**
 * Find purchase order by ID
 *
 * @tags store
 * @name getOrderById
 * @request GET:/store/order/{orderId}
 * @response '200' 'Order' successful operation
 * @response '400' 'void' Invalid ID supplied
 * @response '404' 'void' Order not found
 */
export async function getOrderById(orderId: number): Promise<Order> {
  const response = await httpClient.request({
    method: 'GET',
    url: `/store/order/${orderId}`,
  });
  return response.data;
}

/**
 * Delete purchase order by ID
 *
 * @tags store
 * @name deleteOrder
 * @request DELETE:/store/order/{orderId}
 * @response '400' 'void' Invalid ID supplied
 * @response '404' 'void' Order not found
 */
export async function deleteOrder(orderId: number): Promise<void> {
  const response = await httpClient.request({
    method: 'DELETE',
    url: `/store/order/${orderId}`,
  });
  return response.data;
}
