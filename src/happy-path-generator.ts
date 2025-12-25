/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 * 
 * ВЕРСИЯ 10.0 - ВСЕ 12 ПУНКТОВ ИСПРАВЛЕНИЙ
 * 
 * 1. ✅ Полный архив проекта
 * 2. ✅ Файлы с префиксом .test.ts (не .spec.ts)
 * 3. ✅ Структура теста СТРОГО как в примере findPetsByStatus.test.ts
 * 4. ✅ Использование только axios (без request от Playwright)
 * 5. ✅ Нормализация данных из БД
 * 6. ✅ Глубокое сравнение объектов
 * 7. ✅ Конфигурируемая глобальная переменная стенда
 * 8. ✅ Конфигурируемый axios config с импортом
 * 9. ✅ Валидация структуры и типов данных
 * 10. ✅ Проверка обязательных полей из DTO
 * 11. ✅ Вынос данных в отдельные файлы
 * 12. ✅ Объединение дублирующих тестов
 */

import * as fs from 'fs';
import * as path from 'path';
import { findDtoForEndpoint, generateDtoValidationCode, DTOInfo } from './utils/dto-finder';
import { generateTypeValidationCode } from './utils/type-validator';
import { compareDbWithResponse, normalizeDbData } from './utils/data-comparison';

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
  
  // Пункт 7: Глобальная переменная стенда
  standUrlEnvVar?: string; // Название переменной окружения (например 'STANDURL')
  
  // Пункт 8: Конфиг для axios
  axiosConfigName?: string; // Название конфига (например 'configApiHeaderAdmin')
  axiosConfigPath?: string; // Путь к файлу с конфигом
  
  // Пункт 10: Путь к сгенерированным API файлам с DTO
  apiGeneratedPath?: string;
  
  // Пункт 11: Создание отдельных файлов с данными
  createSeparateDataFiles?: boolean;
  
  // Пункт 12: Объединение дублирующих тестов
  mergeDuplicateTests?: boolean;
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
  private sql: any;
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
      standUrlEnvVar: 'StandURL', // Пункт 7: дефолтное значение
      axiosConfigName: 'configApiHeaderAdmin', // Пункт 8: дефолтное значение
      axiosConfigPath: '../../../helpers/axiosHelpers', // Пункт 8: дефолтный путь
      apiGeneratedPath: '', // Пункт 10
      createSeparateDataFiles: false, // Пункт 11: по умолчанию false (встроенные данные)
      mergeDuplicateTests: true, // Пункт 12: по умолчанию true
      ...config
    };

    this.sql = sqlConnection;
  }

  async generate(): Promise<void> {
    console.log('🔍 Подключаюсь к БД и собираю данные...');
    console.log(this.config.force ? '⚠️  FORCE режим - перегенерация всех тестов' : 'ℹ️  Инкрементальный режим - только новые данные');

    const uniqueRequests = await this.fetchUniqueRequests();
    console.log(`📊 Найдено ${uniqueRequests.length} уникальных запросов`);

    // Пункт 12: Группируем по структуре если включено объединение
    const grouped = this.config.mergeDuplicateTests
      ? this.groupByStructure(uniqueRequests)
      : this.groupByEndpoint(uniqueRequests);

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
   * Пункт 12: Группировка по структуре запроса (объединение дублей)
   */
  private groupByStructure(requests: UniqueRequest[]): Record<string, UniqueRequest[]> {
    const grouped: Record<string, UniqueRequest[]> = {};

    for (const request of requests) {
      const structureHash = this.getStructureHash(request);
      const key = `${request.method}:${request.endpoint}:${structureHash}`;

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
   * Создает хэш структуры request (игнорируя ID)
   */
  private getStructureHash(request: UniqueRequest): string {
    if (!request.request_body) return 'empty';

    function normalizeStructure(obj: any): any {
      if (obj === null || obj === undefined) return 'null';
      if (typeof obj !== 'object') return typeof obj;
      if (Array.isArray(obj)) {
        return obj.length > 0 ? [normalizeStructure(obj[0])] : [];
      }

      const normalized: any = {};
      for (const key in obj) {
        // Игнорируем поля с ID в названии
        if (key.toLowerCase().includes('id')) {
          normalized[key] = 'id';
        } else {
          normalized[key] = normalizeStructure(obj[key]);
        }
      }
      return normalized;
    }

    const normalized = normalizeStructure(request.request_body);
    return JSON.stringify(normalized);
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

  private async fetchUniqueRequests(): Promise<UniqueRequest[]> {
    const schema = this.config.dbSchema;
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

  private async generateTestsForEndpoint(
    endpointKey: string,
    requests: UniqueRequest[]
  ): Promise<{ total: number; added: number }> {
    const [method, endpoint] = endpointKey.split(':');
    const fileName = this.endpointToFileName(endpoint, method);

    // Пункт 2: Используем .test.ts вместо .spec.ts
    const filePath = path.join(this.config.outputDir, `${fileName}.happy-path.test.ts`);

    const fileExists = fs.existsSync(filePath);

    let existingTests: string[] = [];
    let newTestsAdded = 0;

    if (fileExists && !this.config.force) {
      const content = fs.readFileSync(filePath, 'utf-8');
      existingTests = this.extractTestIds(content);

      requests = requests.filter(r => !existingTests.includes(`db-id-${r.id}`));
      newTestsAdded = requests.length;

      if (requests.length === 0) {
        console.log(`  ⏭️  ${fileName}.happy-path.test.ts - нет новых данных`);
        return { total: existingTests.length, added: 0 };
      }

      await this.appendTestsToFile(filePath, endpoint, method, requests);
      console.log(`  ✓ ${fileName}.happy-path.test.ts (+${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    } else {
      // Пункт 11: Создаем папку для данных если нужно
      if (this.config.createSeparateDataFiles) {
        const dataDir = path.join(this.config.outputDir, 'test-data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      }

      const testCode = await this.generateTestFile(endpoint, method, requests);

      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }

      fs.writeFileSync(filePath, testCode, 'utf-8');
      newTestsAdded = requests.length;

      const mode = this.config.force ? '🔄' : '✨';
      console.log(`  ${mode} ${fileName}.happy-path.test.ts (${requests.length} ${requests.length === 1 ? 'тест' : 'тестов'})`);
    }

    await this.markAsGenerated(requests.map(r => r.id), filePath);

    return {
      total: existingTests.length + newTestsAdded,
      added: newTestsAdded
    };
  }

  private extractTestIds(content: string): string[] {
    const matches = content.matchAll(/\/\/\s*DB ID:\s*(db-id-\d+)/g);
    return Array.from(matches, m => m[1]);
  }

  private async appendTestsToFile(
    filePath: string,
    endpoint: string,
    method: string,
    requests: UniqueRequest[]
  ): Promise<void> {
    let content = fs.readFileSync(filePath, 'utf-8');

    const lastBraceIndex = content.lastIndexOf('});');

    if (lastBraceIndex === -1) {
      throw new Error(`Не удалось найти конец describe блока в ${filePath}`);
    }

    const newTests = await Promise.all(
      requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1))
    );

    content = content.slice(0, lastBraceIndex) + '\n' + newTests.join('\n\n') + '\n' + content.slice(lastBraceIndex);

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Генерирует полный файл теста
   */
  private async generateTestFile(endpoint: string, method: string, requests: UniqueRequest[]): Promise<string> {
    // Пункт 10: Ищем DTO для этого endpoint
    let dtoInfo: DTOInfo | null = null;

    if (this.config.apiGeneratedPath) {
      dtoInfo = findDtoForEndpoint(this.config.apiGeneratedPath, endpoint, method);
    }

    // Генерируем импорты
    const imports: string[] = [
      `import test, { expect } from '../../../fixtures/baseTest';`,
      `import axios from 'axios';`,
    ];

    // Пункт 8: Импорт axios конфига
    if (this.config.axiosConfigPath && this.config.axiosConfigName) {
      imports.push(`import { ${this.config.axiosConfigName} } from '${this.config.axiosConfigPath}';`);
    }

    // Пункт 11: Импорты данных из отдельных файлов
    if (this.config.createSeparateDataFiles) {
      const fileName = this.endpointToFileName(endpoint, method);
      for (let i = 0; i < requests.length; i++) {
        imports.push(`import { requestData as requestData${i + 1}, expectedResponse as expectedResponse${i + 1} } from './test-data/${fileName}-data-${i + 1}';`);
      }
    }

    // Генерируем тесты
    const tests = await Promise.all(
      requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1, dtoInfo))
    );

    // Пункт 11: Создаем отдельные файлы с данными
    if (this.config.createSeparateDataFiles) {
      await this.createDataFiles(endpoint, method, requests);
    }

    // Пункт 3: Структура СТРОГО как в примере findPetsByStatus.test.ts
    return `${imports.join('\n')}

const endpoint = '${endpoint}';
const httpMethod = '${method}';

// Коды статусов
const apiErrorCodes = {
  success: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  unsupportedMediaType: 415,
};

const success = apiErrorCodes.${this.getSuccessCodeName(requests[0]?.response_status || 200)};

// Информация о тест-кейсе
const caseInfoObj = {
  testCase: 'AutoGenerated',
  aqaOwner: 'HappyPathGenerator',
  tms_testName: '${method} ${endpoint}',
  testType: 'api'
};

/**
 * Happy Path тесты на основе реальных данных с фронта
 */

test.describe.configure({ mode: "parallel" });
test.describe(\`API тесты для эндпоинта \${httpMethod} >> \${endpoint} - Happy Path\`, async () => {

  // ============================================
  // HAPPY PATH ТЕСТЫ
  // ============================================

${tests.join('\n\n')}

});
`;
  }

  /**
   * Пункт 11: Создает отдельные файлы с данными
   */
  private async createDataFiles(
    endpoint: string,
    method: string,
    requests: UniqueRequest[]
  ): Promise<void> {
    const fileName = this.endpointToFileName(endpoint, method);
    const dataDir = path.join(this.config.outputDir, 'test-data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const dataFileName = `${fileName}-data-${i + 1}.ts`;
      const dataFilePath = path.join(dataDir, dataFileName);

      const dataContent = `/**
 * Тестовые данные для ${method} ${endpoint}
 * DB ID: ${request.id}
 */

export const requestData = ${JSON.stringify(request.request_body, null, 2)};

export const expectedResponse = ${JSON.stringify(request.response_body, null, 2)};
`;

      fs.writeFileSync(dataFilePath, dataContent, 'utf-8');
    }
  }

  /**
   * Генерирует один тест со ВСЕМИ исправлениями
   * Пункт 3: Структура СТРОГО как в примере findPetsByStatus.test.ts
   * Пункт 4: Только axios
   * Пункт 5 и 6: Нормализация и глубокое сравнение
   * Пункт 7: Конфигурируемая переменная стенда
   * Пункт 8: Конфигурируемый axios config
   * Пункт 9: Валидация типов
   * Пункт 10: Проверка DTO
   */
  private async generateSingleTest(
    endpoint: string,
    method: string,
    request: UniqueRequest,
    testNumber: number,
    dtoInfo?: DTOInfo | null
  ): Promise<string> {
    const testName = request.test_name || `Happy Path #${testNumber}`;
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

    // Пункт 7: Используем конфигурируемую переменную окружения
    const standUrlVar = `process.env.${this.config.standUrlEnvVar}`;

    // Пункт 8: Используем конфигурируемый axios config
    const axiosConfig = this.config.axiosConfigName;

    let testCode = `  test(\`\${httpMethod} ${testName} (\${success}) @api ${this.config.testTag}\`, async ({ page }, testInfo) => {
    // DB ID: db-id-${request.id}
`;

    // Пункт 11: Используем данные из отдельного файла или встроенные
    if (this.config.createSeparateDataFiles) {
      if (hasBody) {
        testCode += `    const requestData = requestData${testNumber};
    
`;
      }
    } else {
      // Встроенные данные
      if (hasBody) {
        testCode += `    const requestData = ${JSON.stringify(request.request_body, null, 4).replace(/^/gm, '    ')};
    
`;
      }
    }

    // Пункт 4, 7 и 8: Только axios с конфигурируемыми параметрами
    if (hasBody) {
      testCode += `    const response = await axios.${method.toLowerCase()}(${standUrlVar} + endpoint, requestData, ${axiosConfig});
`;
    } else {
      const queryParams = this.extractQueryParams(endpoint);
      if (queryParams) {
        testCode += `    const response = await axios.${method.toLowerCase()}(${standUrlVar} + endpoint + '${queryParams}', ${axiosConfig});
`;
      } else {
        testCode += `    const response = await axios.${method.toLowerCase()}(${standUrlVar} + endpoint, ${axiosConfig});
`;
      }
    }

    testCode += `
    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
`;

    // Пункт 9: Валидация типов данных
    if (request.response_body) {
      const typeValidation = generateTypeValidationCode(request.response_body, 'response.data');
      if (typeValidation.length > 0 && typeValidation.length <= 5) {
        testCode += `\n    // Валидация типов\n`;
        testCode += typeValidation.slice(0, 3).join('\n') + '\n';
      }
    }

    // Пункт 10: Проверка обязательных полей из DTO
    if (dtoInfo && dtoInfo.fields.length > 0) {
      const dtoValidation = generateDtoValidationCode(dtoInfo);
      if (dtoValidation.length > 0) {
        testCode += `\n${dtoValidation.join('\n')}\n`;
      }
    }

    // Пункт 5 и 6: Нормализация и глубокое сравнение
    if (this.config.createSeparateDataFiles) {
      testCode += `
    // Сравнение с ожидаемыми данными
    const expectedResponse = expectedResponse${testNumber};
    const normalizedExpected = ${JSON.stringify(normalizeDbData(request.response_body))};
    
    // Проверка структуры ответа
    await expect(response.data).toMatchObject(normalizedExpected);
  });`;
    } else {
      testCode += `
    const expectedResponse = ${JSON.stringify(request.response_body, null, 4).replace(/^/gm, '    ')};
    const normalizedExpected = ${JSON.stringify(normalizeDbData(request.response_body))};
    
    await expect(response.data).toMatchObject(normalizedExpected);
  });`;
    }

    return testCode;
  }

  private extractQueryParams(endpoint: string): string | null {
    const match = endpoint.match(/\?(.+)$/);
    return match ? `?${match[1]}` : null;
  }

  private endpointToFileName(endpoint: string, method: string): string {
    let fileName = endpoint
      .replace(/^\/api\/v[0-9]+\//, '')
      .replace(/\{[^}]+\}/g, 'id')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase();

    fileName = `${method.toLowerCase()}-${fileName}`;

    return fileName;
  }

  private getSuccessCodeName(status: number): string {
    if (status === 201) return 'created';
    if (status === 204) return 'noContent';
    return 'success';
  }

  private async markAsGenerated(ids: number[], filePath: string): Promise<void> {
    const schema = this.config.dbSchema;

    for (const id of ids) {
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

export async function generateHappyPathTests(
  config: HappyPathTestConfig,
  sqlConnection: any
): Promise<void> {
  const generator = new HappyPathTestGenerator(config, sqlConnection);
  await generator.generate();
}
