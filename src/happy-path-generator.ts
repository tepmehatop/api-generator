/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 * 
 * Особенности:
 * - Читает данные из БД (qa.api_requests)
 * - Инкрементальная генерация (дополняет существующие файлы)
 * - Отслеживание сгенерированных тестов в БД
 * - Force режим для перегенерации
 * - Стандартная структура как в позитивных/негативных тестах
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

export interface HappyPathTestConfig {
  /**
   * Подключение к БД
   */
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  
  /**
   * Путь для сохранения тестов
   */
  outputDir: string;
  
  /**
   * Force режим - перегенерировать все тесты
   * @default false
   */
  force?: boolean;
  
  /**
   * Фильтр по endpoint (опционально)
   */
  endpointFilter?: string[];
  
  /**
   * Фильтр по HTTP методу (опционально)
   */
  methodFilter?: string[];
  
  /**
   * Максимальное количество тестов на один endpoint
   * @default 10
   */
  maxTestsPerEndpoint?: number;
  
  /**
   * Только успешные ответы (2xx)
   * @default true
   */
  onlySuccessful?: boolean;
  
  /**
   * Тег для тестов
   * @default '@apiHappyPath'
   */
  testTag?: string;
  
  /**
   * Путь к axiosHelpers
   * @default '../../../helpers/axiosHelpers'
   */
  axiosHelpersPath?: string;
}

interface UniqueRequest {
  id: number;
  endpoint: string;
  method: string;
  request_body: any;
  response_body: any;
  response_status: number;
  test_name: string;
  test_generated: boolean;
  test_file_path: string | null;
}

export class HappyPathTestGenerator {
  private sql: ReturnType<typeof postgres>;
  private config: Required<HappyPathTestConfig>;
  
  constructor(config: HappyPathTestConfig) {
    this.config = {
      ...config,
      force: config.force || false,
      endpointFilter: config.endpointFilter || [],
      methodFilter: config.methodFilter || [],
      maxTestsPerEndpoint: config.maxTestsPerEndpoint || 10,
      onlySuccessful: config.onlySuccessful !== false,
      testTag: config.testTag || '@apiHappyPath',
      axiosHelpersPath: config.axiosHelpersPath || '../../../helpers/axiosHelpers'
    };
    
    this.sql = postgres(config.database);
  }
  
  /**
   * Генерирует все Happy Path тесты
   */
  async generate(): Promise<void> {
    console.log('🔍 Подключаюсь к БД и собираю данные...');
    console.log(this.config.force ? '⚠️  FORCE режим - перегенерация всех тестов' : 'ℹ️  Инкрементальный режим - только новые данные');
    
    const uniqueRequests = await this.fetchUniqueRequests();
    console.log(`📊 Найдено ${uniqueRequests.length} уникальных запросов`);
    
    const grouped = this.groupByEndpoint(uniqueRequests);
    console.log(`📁 Сгруппировано по ${Object.keys(grouped).length} endpoints`);
    
    let totalTests = 0;
    let newTests = 0;
    
    for (const [endpoint, requests] of Object.entries(grouped)) {
      const { total, added } = await this.generateTestsForEndpoint(endpoint, requests);
      totalTests += total;
      newTests += added;
    }
    
    console.log(`\n✨ Генерация завершена!`);
    console.log(`   Всего тестов: ${totalTests}`);
    console.log(`   Новых тестов: ${newTests}`);
    
    await this.sql.end();
  }
  
  private async fetchUniqueRequests(): Promise<UniqueRequest[]> {
    const conditions = [];
    
    if (this.config.onlySuccessful) {
      conditions.push('response_status >= 200 AND response_status < 300');
    }
    
    if (this.config.endpointFilter.length > 0) {
      const endpoints = this.config.endpointFilter.map(e => `'${e}'`).join(',');
      conditions.push(`endpoint IN (${endpoints})`);
    }
    
    if (this.config.methodFilter.length > 0) {
      const methods = this.config.methodFilter.map(m => `'${m}'`).join(',');
      conditions.push(`method IN (${methods})`);
    }
    
    if (!this.config.force) {
      conditions.push('test_generated = FALSE');
    }
    
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    const query = `
      SELECT DISTINCT ON (endpoint, method, request_body::text)
        id, endpoint, method, request_body, response_body,
        response_status, test_name, test_generated, test_file_path
      FROM qa.api_requests
      ${where}
      ORDER BY endpoint, method, request_body::text, created_at DESC
    `;
    
    const requests = await this.sql.unsafe(query);
    return requests as unknown as UniqueRequest[];
  }
  
  private groupByEndpoint(requests: UniqueRequest[]): Record<string, UniqueRequest[]> {
    const grouped: Record<string, UniqueRequest[]> = {};
    
    for (const request of requests) {
      const key = `${request.method}:${request.endpoint}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      if (grouped[key].length < this.config.maxTestsPerEndpoint) {
        grouped[key].push(request);
      }
    }
    
    return grouped;
  }
  
  private async generateTestsForEndpoint(
    endpointKey: string, 
    requests: UniqueRequest[]
  ): Promise<{ total: number; added: number }> {
    const [method, endpoint] = endpointKey.split(':');
    const fileName = this.endpointToFileName(endpoint, method);
    const filePath = path.join(this.config.outputDir, `${fileName}.happy-path.spec.ts`);
    
    const fileExists = fs.existsSync(filePath);
    
    let existingTests: string[] = [];
    let newTestsAdded = 0;
    
    if (fileExists && !this.config.force) {
      const content = fs.readFileSync(filePath, 'utf-8');
      existingTests = this.extractTestIds(content);
      
      requests = requests.filter(r => !existingTests.includes(`db-id-${r.id}`));
      newTestsAdded = requests.length;
      
      if (requests.length === 0) {
        console.log(`  ⏭️  ${fileName}.happy-path.spec.ts - нет новых данных`);
        return { total: existingTests.length, added: 0 };
      }
      
      await this.appendTestsToFile(filePath, endpoint, method, requests, existingTests.length);
      console.log(`  ✓ ${fileName}.happy-path.spec.ts (+${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    } else {
      const testCode = this.generateTestFile(endpoint, method, requests);
      fs.writeFileSync(filePath, testCode, 'utf-8');
      newTestsAdded = requests.length;
      
      const mode = this.config.force ? '🔄' : '✨';
      console.log(`  ${mode} ${fileName}.happy-path.spec.ts (${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    }
    
    await this.markAsGenerated(requests.map(r => r.id), filePath);
    
    return { 
      total: existingTests.length + newTestsAdded, 
      added: newTestsAdded 
    };
  }
  
  private extractTestIds(content: string): string[] {
    const regex = /\/\/ DB ID: (db-id-\d+)/g;
    const ids: string[] = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      ids.push(match[1]);
    }
    
    return ids;
  }
  
  private async appendTestsToFile(
    filePath: string,
    endpoint: string,
    method: string,
    requests: UniqueRequest[],
    existingCount: number
  ): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const lastClosingBrace = content.lastIndexOf('});');
    
    if (lastClosingBrace === -1) {
      throw new Error(`Не удалось найти закрывающую скобку в ${filePath}`);
    }
    
    const newTests = this.generateTestCases(endpoint, method, requests, existingCount + 1);
    
    const before = content.substring(0, lastClosingBrace);
    const after = content.substring(lastClosingBrace);
    
    const updated = before + '\n' + newTests + '\n' + after;
    
    fs.writeFileSync(filePath, updated, 'utf-8');
  }
  
  private generateTestFile(endpoint: string, method: string, requests: UniqueRequest[]): string {
    const lines: string[] = [];
    
    lines.push(`/**`);
    lines.push(` * Happy Path тесты для ${method} ${endpoint}`);
    lines.push(` * `);
    lines.push(` * Сгенерировано автоматически из реальных данных с фронта`);
    lines.push(` * Дата: ${new Date().toISOString()}`);
    lines.push(` * `);
    lines.push(` * SQL запрос для поиска данных в БД:`);
    lines.push(` * SELECT * FROM qa.api_requests `);
    lines.push(` * WHERE endpoint = '${endpoint}' AND method = '${method}'`);
    lines.push(` * ORDER BY created_at DESC;`);
    lines.push(` */`);
    lines.push('');
    
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push(`import axios from 'axios';`);
    lines.push(`import { configApiHeaderAdmin } from '${this.config.axiosHelpersPath}';`);
    lines.push('');
    
    const describeTitle = `${method} ${endpoint} - Happy Path`;
    lines.push(`test.describe('${describeTitle}', () => {`);
    lines.push(`  test.describe.configure({ tag: '${this.config.testTag}' });`);
    lines.push('');
    
    lines.push(`  const endpoint = '${endpoint}';`);
    lines.push(`  const httpMethod = '${method}';`);
    lines.push(`  const success = ${this.getSuccessCode(method)};`);
    lines.push('');
    
    lines.push('  // ============================================');
    lines.push('  // HAPPY PATH ТЕСТЫ (Данные с фронта)');
    lines.push('  // ============================================');
    lines.push('');
    
    const testCases = this.generateTestCases(endpoint, method, requests, 1);
    lines.push(testCases);
    
    lines.push(`});`);
    lines.push('');
    
    return lines.join('\n');
  }
  
  private generateTestCases(
    endpoint: string,
    method: string,
    requests: UniqueRequest[],
    startIndex: number
  ): string {
    const lines: string[] = [];
    
    requests.forEach((request, index) => {
      const testNumber = startIndex + index;
      const testTitle = this.generateTestTitle(request, testNumber);
      
      lines.push(`  test(\`\${httpMethod} ${testTitle} (\${success}) ${this.config.testTag}\`, async ({ page }, testInfo) => {`);
      lines.push(`    // Данные из UI теста: ${request.test_name}`);
      lines.push(`    // DB ID: db-id-${request.id}`);
      lines.push('');
      
      const hasRequestBody = request.request_body && Object.keys(request.request_body).length > 0;
      
      if (hasRequestBody) {
        lines.push(`    // Request Body (реальные данные с фронта):`);
        lines.push(`    const requestData = ${JSON.stringify(request.request_body, null, 6).replace(/\n/g, '\n    ')};`);
        lines.push('');
      }
      
      if (request.response_body) {
        lines.push(`    // Expected Response:`);
        lines.push(`    const expectedResponse = ${JSON.stringify(request.response_body, null, 6).replace(/\n/g, '\n    ')};`);
        lines.push('');
      }
      
      const axiosCall = this.generateAxiosCall(method, hasRequestBody);
      lines.push(`    // Выполняем запрос`);
      lines.push(`    const response = await ${axiosCall};`);
      lines.push('');
      
      lines.push(`    // Проверки`);
      lines.push(`    await expect(response.status).toBe(${request.response_status});`);
      lines.push(`    await expect(response.data).toBeDefined();`);
      
      if (request.response_body) {
        lines.push(`    await expect(response.data).toMatchObject(expectedResponse);`);
      }
      
      lines.push(`  });`);
      lines.push('');
    });
    
    return lines.join('\n');
  }
  
  private generateAxiosCall(method: string, hasRequestBody: boolean): string {
    const methodLower = method.toLowerCase();
    
    if (hasRequestBody) {
      return `axios.${methodLower}(process.env.StandURL + endpoint, requestData, configApiHeaderAdmin)`;
    } else {
      return `axios.${methodLower}(process.env.StandURL + endpoint, configApiHeaderAdmin)`;
    }
  }
  
  private generateTestTitle(request: UniqueRequest, testNumber: number): string {
    if (request.request_body && typeof request.request_body === 'object') {
      const keys = Object.keys(request.request_body);
      
      if (keys.length > 0) {
        const firstKey = keys[0];
        const value = request.request_body[firstKey];
        const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
        return `Happy Path #${testNumber} (${firstKey}: ${displayValue})`;
      }
    }
    
    return `Happy Path #${testNumber}`;
  }
  
  private getSuccessCode(method: string): number {
    return method === 'POST' ? 201 : 200;
  }
  
  private endpointToFileName(endpoint: string, method: string): string {
    return endpoint
      .replace(/^\/api\/v\d+\//, '')
      .replace(/\{(\w+)\}/g, '$1')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase() + '-' + method.toLowerCase();
  }
  
  private async markAsGenerated(ids: number[], filePath: string): Promise<void> {
    for (const id of ids) {
      await this.sql`
        UPDATE qa.api_requests
        SET 
          test_generated = TRUE,
          test_file_path = ${filePath},
          generated_at = NOW()
        WHERE id = ${id}
      `;
    }
  }
}

export async function generateHappyPathTests(config: HappyPathTestConfig): Promise<void> {
  const generator = new HappyPathTestGenerator(config);
  await generator.generate();
}
