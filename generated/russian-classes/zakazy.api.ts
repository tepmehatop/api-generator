import { httpClient } from './http-client';

/**
 * Типы для модуля: Заказы
 */

export interface Order {
  id?: number;
  userId?: number;
}

/**
 * API класс для: Заказы
 */
export class ZakazyApi {

  /**
   * No Description
   *
   * @tags Заказы
   * @name getOrders
   * @request GET:/orders
   * @response '200' 'Order[]' Success
   */
  async getOrders(): Promise<Order[]> {
    const response = await httpClient.request({
      method: 'GET',
      url: `/orders`,
    });
    return response.data;
  }

}

// Экспортируем синглтон инстанс
export const zakazyApi = new ZakazyApi();