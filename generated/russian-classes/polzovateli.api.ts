import { httpClient } from './http-client';

/**
 * Типы для модуля: Пользователи
 */

export interface User {
  id?: number;
  name?: string;
}

/**
 * API класс для: Пользователи
 */
export class PolzovateliApi {

  /**
   * No Description
   *
   * @tags Пользователи
   * @name getUsers
   * @request GET:/users
   * @response '200' 'User[]' Success
   */
  async getUsers(): Promise<User[]> {
    const response = await httpClient.request({
      method: 'GET',
      url: `/users`,
    });
    return response.data;
  }

}

// Экспортируем синглтон инстанс
export const polzovateliApi = new PolzovateliApi();