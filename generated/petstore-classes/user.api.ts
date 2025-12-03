import { httpClient } from './http-client';

/**
 * Типы для модуля: user
 */

export interface User {
  id?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  /** User Status */
  userStatus?: number;
}

/**
 * API класс для: user
 */
export class UserApi {

  /**
   * Create user
   *
   * @tags user
   * @name createUser
   * @request POST:/user
   * @response 'default' 'void' successful operation
   */
  async createUser(body: User): Promise<void> {
    const response = await httpClient.request({
      method: 'POST',
      url: `/user`,
      data: body,
    });
    return response.data;
  }

  /**
   * Logs user into the system
   *
   * @tags user
   * @name loginUser
   * @request GET:/user/login
   * @response '200' 'string' successful operation
   * @response '400' 'void' Invalid username/password supplied
   */
  async loginUser(username: string, password: string): Promise<string> {
    const response = await httpClient.request({
      method: 'GET',
      url: `/user/login`,
      params: {
        username: username,
        password: password,
      },
    });
    return response.data;
  }

  /**
   * Get user by user name
   *
   * @tags user
   * @name getUserByName
   * @request GET:/user/{username}
   * @response '200' 'User' successful operation
   * @response '400' 'void' Invalid username supplied
   * @response '404' 'void' User not found
   */
  async getUserByName(username: string): Promise<User> {
    const response = await httpClient.request({
      method: 'GET',
      url: `/user/${username}`,
    });
    return response.data;
  }

  /**
   * Delete user
   *
   * @tags user
   * @name deleteUser
   * @request DELETE:/user/{username}
   * @response '400' 'void' Invalid username supplied
   * @response '404' 'void' User not found
   */
  async deleteUser(username: string): Promise<void> {
    const response = await httpClient.request({
      method: 'DELETE',
      url: `/user/${username}`,
    });
    return response.data;
  }

}

// Экспортируем синглтон инстанс
export const userApi = new UserApi();