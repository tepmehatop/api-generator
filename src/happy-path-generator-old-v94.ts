/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 */

import * as fs from 'fs';
import * as path from 'path';

export interface HappyPathTestConfig {
  outputDir: string;
  dbConnectionMethod: string;
  dbSchema?: string;
  endpointFilter?: string[];
  methodFilter?: string[];
  maxTestsPerEndpoint?: number;
  onlySuccessful?: boolean;
  testTag?: string;
  force?: boolean;
}

interface UniqueRequest {
  id: number;
  endpoint: string;
  method: string;
  request_body: any;
  response_body: any;
  response_status: number;
  test_name: string;
  test_generated?: boolean;
  test_file_path?: string;
}

export class HappyPathTestGenerator {
  private sql: any; // Postgres connection
  private config: Required<HappyPathTestConfig>;

  constructor(config: HappyPathTestConfig, sqlConnection: any) {
    this.config = {
      endpointFilter: [],
      methodFilter: [],
      maxTestsPerEndpoint: 5,
      onlySuccessful: true,
      testTag: '@apiHappyPath',
      force: false,
      dbSchema: 'qa',
      ...config
    };

    this.sql = sqlConnection;
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
    console.log(`📁 Сгруппировано по ${Object.keys(grouped).length} endpoints\n`);

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
  }

  /**
   * Получает уникальные запросы из БД
   * ✅ ИСПРАВЛЕНО: Используем tagged template literal!
   */
  private async fetchUniqueRequests(): Promise<UniqueRequest[]> {
    const schema = this.config.dbSchema;

    // Строим условия для WHERE
    const conditions: string[] = [];

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
      conditions.push('(test_generated IS NULL OR test_generated = FALSE)');
    }

    // ✅ ПРАВИЛЬНО: Используем tagged template literal с this.sql.unsafe для WHERE
    let requests;

    if (conditions.length > 0) {
      const whereClause = conditions.join(' AND ');

      requests = await this.sql`
        SELECT DISTINCT ON (endpoint, method, request_body::text)
          id,
          endpoint,
          method,
          request_body,
          response_body,
          response_status,
          test_name,
          test_generated,
          test_file_path
        FROM ${this.sql(schema + '.api_requests')}
        WHERE ${this.sql.unsafe(whereClause)}
        ORDER BY endpoint, method, request_body::text, created_at DESC
      `;
    } else {
      requests = await this.sql`
        SELECT DISTINCT ON (endpoint, method, request_body::text)
          id,
          endpoint,
          method,
          request_body,
          response_body,
          response_status,
          test_name,
          test_generated,
          test_file_path
        FROM ${this.sql(schema + '.api_requests')}
        ORDER BY endpoint, method, request_body::text, created_at DESC
      `;
    }

    return requests as UniqueRequest[];
  }

  /**
   * Группирует запросы по endpoint
   */
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

  /**
   * Генерирует тесты для одного endpoint
   */
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
      // Инкрементальный режим
      const content = fs.readFileSync(filePath, 'utf-8');
      existingTests = this.extractTestIds(content);

      requests = requests.filter(r => !existingTests.includes(`db-id-${r.id}`));
      newTestsAdded = requests.length;

      if (requests.length === 0) {
        console.log(`  ⏭️  ${fileName}.happy-path.spec.ts - нет новых данных`);
        return { total: existingTests.length, added: 0 };
      }

      await this.appendTestsToFile(filePath, endpoint, method, requests);
      console.log(`  ✓ ${fileName}.happy-path.spec.ts (+${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    } else {
      // Создаём новый файл
      const testCode = this.generateTestFile(endpoint, method, requests);

      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }

      fs.writeFileSync(filePath, testCode, 'utf-8');
      newTestsAdded = requests.length;

      const mode = this.config.force ? '🔄' : '✨';
      console.log(`  ${mode} ${fileName}.happy-path.spec.ts (${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    }

    // Помечаем в БД как сгенерированные
    await this.markAsGenerated(requests.map(r => r.id), filePath);

    return {
      total: existingTests.length + newTestsAdded,
      added: newTestsAdded
    };
  }

  /**
   * Извлекает ID тестов из существующего файла
   */
  private extractTestIds(content: string): string[] {
    const matches = content.matchAll(/\/\/\s*DB ID:\s*(db-id-\d+)/g);
    return Array.from(matches, m => m[1]);
  }

  /**
   * Добавляет новые тесты в существующий файл
   */
  private async appendTestsToFile(
      filePath: string,
      endpoint: string,
      method: string,
      requests: UniqueRequest[]
  ): Promise<void> {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Находим конец describe блока
    const lastBraceIndex = content.lastIndexOf('});');

    if (lastBraceIndex === -1) {
      throw new Error(`Не удалось найти конец describe блока в ${filePath}`);
    }

    // Генерируем новые тесты
    const newTests = requests.map((req, index) =>
        this.generateSingleTest(endpoint, method, req, index + 1)
    ).join('\n\n');

    // Вставляем перед последней закрывающей скобкой
    content = content.slice(0, lastBraceIndex) + '\n' + newTests + '\n' + content.slice(lastBraceIndex);

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Генерирует полный файл теста
   */
  private generateTestFile(endpoint: string, method: string, requests: UniqueRequest[]): string {
    const tests = requests.map((req, index) =>
        this.generateSingleTest(endpoint, method, req, index + 1)
    ).join('\n\n');

    return `import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('${method} ${endpoint} - Happy Path', () => {
  test.describe.configure({ tag: '${this.config.testTag}' });
  
  const endpoint = '${endpoint}';
  const httpMethod = '${method}';
  
  // ============================================
  // HAPPY PATH ТЕСТЫ (Данные с фронта)
  // ============================================
  
${tests}
});
`;
  }

  /**
   * Генерирует один тест
   */
  private generateSingleTest(
      endpoint: string,
      method: string,
      request: UniqueRequest,
      testNumber: number
  ): string {
    const requestData = JSON.stringify(request.request_body, null, 2).replace(/^/gm, '    ');
    const expectedResponse = JSON.stringify(request.response_body, null, 2).replace(/^/gm, '    ');
    const testName = request.test_name || `Happy Path #${testNumber}`;

    return `  test('${method} ${testName}', async ({ request }, testInfo) => {
    // Данные из UI теста
    // DB ID: db-id-${request.id}
    
    const requestData = ${requestData};
    
    const response = await request.${method.toLowerCase()}(endpoint, {
      data: requestData
    });
    
    expect(response.status()).toBe(${request.response_status});
    
    const responseData = await response.json();
    const expectedResponse = ${expectedResponse};
    
    // Проверяем структуру ответа
    expect(responseData).toMatchObject(expectedResponse);
  });`;
  }

  /**
   * Преобразует endpoint в имя файла
   */
  private endpointToFileName(endpoint: string, method: string): string {
    // /api/v1/orders/{id}/items -> orders-id-items
    let fileName = endpoint
        .replace(/^\/api\/v[0-9]+\//, '')
        .replace(/\{[^}]+\}/g, 'id')
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/gi, '')
        .toLowerCase();

    // Добавляем метод в начало
    fileName = `${method.toLowerCase()}-${fileName}`;

    return fileName;
  }

  /**
   * Помечает запросы как сгенерированные в БД
   * ✅ ИСПРАВЛЕНО: Используем tagged template literal!
   */
  private async markAsGenerated(ids: number[], filePath: string): Promise<void> {
    const schema = this.config.dbSchema;

    for (const id of ids) {
      // ✅ ПРАВИЛЬНО: Используем tagged template literal
      await this.sql`
        UPDATE ${this.sql(schema + '.api_requests')}
        SET 
          test_generated = TRUE,
          test_file_path = ${filePath},
          generated_at = NOW()
        WHERE id = ${id}
      `;
    }
  }
}

/**
 * Экспортируемая функция для удобства использования
 */
export async function generateHappyPathTests(
    config: HappyPathTestConfig,
    sqlConnection: any
): Promise<void> {
  const generator = new HappyPathTestGenerator(config, sqlConnection);
  await generator.generate();
}
