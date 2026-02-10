/**
 * Генератор API тестов из сгенерированных API методов
 * ВЕРСИЯ 14.0 - РАЗДЕЛЬНЫЕ МЕТОДЫ ГЕНЕРАЦИИ (negative, positive, pairwise)
 * ВЕРСИЯ 13.0 - ИНТЕГРАЦИЯ С HAPPY PATH ДАННЫМИ
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import {
  fetchHappyPathData,
  extractRequiredFieldsData,
  extractAllFieldsData,
  generatePairwiseCombinations,
  HappyPathData
} from './utils/happy-path-data-fetcher';
import { transliterate } from './utils/transliterate';

/**
 * НОВОЕ v14.0: Базовый конфиг для всех типов тестов
 */
export interface BaseTestConfig {
  /**
   * Путь к файлу или папке с API методами
   * Примеры:
   * - './src/api/pets.api.ts' - один файл
   * - './src/api/' - все файлы в папке
   */
  apiFilePath: string;

  /**
   * Папка для выгрузки тестов
   */
  outputDir: string;

  /**
   * Путь к baseTest фикстуре (например, ../../../fixtures/baseTest)
   */
  baseTestPath?: string;

  /**
   * Путь к axiosHelpers (например, ../../../helpers/axiosHelpers)
   */
  axiosHelpersPath?: string;

  /**
   * Путь к apiTestHelper (например, ../../../helpers/apiTestHelper)
   */
  apiTestHelperPath?: string;

  /**
   * НОВОЕ v13.0: Использовать данные из Happy Path тестов
   * @default true
   */
  useHappyPathData?: boolean;

  /**
   * НОВОЕ v13.0: Функция подключения к БД (sql tagged template)
   * Необходимо для получения данных из Happy Path тестов
   */
  dbConnection?: any;

  /**
   * НОВОЕ v13.0: Схема БД для Happy Path данных
   * @default 'qa'
   */
  dbSchema?: string;

  /**
   * НОВОЕ v13.0: Количество записей Happy Path для выборки
   * @default 15
   */
  happyPathSamplesCount?: number;

  /**
   * НОВОЕ v13.0: Количество попыток подбора данных для получения 200 ответа
   * @default 10
   */
  maxDataGenerationAttempts?: number;

  /**
   * НОВОЕ v13.0: URL стенда для тестового вызова при генерации данных
   * @default process.env.StandURL
   */
  standUrl?: string;

  /**
   * НОВОЕ v13.0: Токен авторизации для тестового вызова
   * @default process.env.AUTH_TOKEN
   */
  authToken?: string;

  /**
   * НОВОЕ v14.0: Группировать тесты по категориям в подпапки
   * @default true
   */
  groupByCategory?: boolean;
}

/**
 * НОВОЕ v14.0: Конфиг для негативных тестов
 */
export interface NegativeTestConfig extends BaseTestConfig {
  /**
   * Генерировать тесты 401 Unauthorized
   * @default true
   */
  generate401Tests?: boolean;

  /**
   * Генерировать тесты 403 Forbidden
   * @default true
   */
  generate403Tests?: boolean;

  /**
   * Генерировать тесты 400 Bad Request
   * @default true
   */
  generate400Tests?: boolean;

  /**
   * Генерировать тесты 404 Not Found
   * @default true
   */
  generate404Tests?: boolean;

  /**
   * Генерировать тесты 405 Method Not Allowed
   * @default true
   */
  generate405Tests?: boolean;

  /**
   * НОВОЕ v14.1: Глобально исключить методы из 405 проверок
   * Эти HTTP методы НЕ будут использоваться для проверки 405 ошибки
   *
   * ЗАЧЕМ: Некоторые методы (например DELETE) опасны - могут удалить тестовые данные
   * даже если для конкретного endpoint этот метод разрешён
   *
   * @example ['DELETE'] - никогда не вызывать DELETE для 405 проверок
   * @example ['DELETE', 'PUT'] - никогда не вызывать DELETE и PUT
   * @default []
   */
  exclude405Methods?: string[];
}

/**
 * НОВОЕ v14.0: Конфиг для позитивных тестов
 */
export interface PositiveTestConfig extends BaseTestConfig {
  /**
   * Генерировать тест с только обязательными полями
   * @default true
   */
  generateRequiredFieldsTest?: boolean;

  /**
   * Генерировать тест со всеми полями
   * @default true
   */
  generateAllFieldsTest?: boolean;
}

/**
 * НОВОЕ v14.0: Конфиг для pairwise тестов
 */
export interface PairwiseTestConfig extends BaseTestConfig {
  /**
   * Генерировать комбинации необязательных полей
   * @default true
   */
  generateOptionalCombinations?: boolean;

  /**
   * Генерировать тесты для enum значений
   * @default true
   */
  generateEnumTests?: boolean;

  /**
   * Максимальное количество pairwise комбинаций на endpoint
   * @default 10
   */
  maxPairwiseCombinations?: number;
}

/**
 * @deprecated Используйте отдельные методы: generateNegativeTests, generatePositiveTests, generatePairwiseTests
 */
export interface ApiTestConfig extends BaseTestConfig {
  /**
   * Генерировать тесты для негативных сценариев (401, 403, 400, 405)
   * @default true
   */
  generateNegativeTests?: boolean;

  /**
   * Генерировать тесты для позитивных сценариев (200, 201)
   * @default true
   */
  generatePositiveTests?: boolean;

  /**
   * Генерировать pairwise тесты (комбинаторное покрытие)
   * @default false
   */
  generatePairwiseTests?: boolean;
}

interface ExtractedMethod {
  name: string;
  httpMethod: string;
  path: string;
  parameters: string[];
  returnType: string;
  tags: string[];
  hasAuth: boolean;
  bodySchema?: DTOSchema; // Схема body параметра
  dtoSourcePath?: string; // Путь к файлу с DTO (для base.types.ts)
  sourceFile?: string; // НОВОЕ v14.0: Исходный файл с методом
  category?: string; // НОВОЕ v14.0: Категория для группировки (orders, users и т.д.)
}

/**
 * НОВОЕ v14.0: Результат генерации тестов
 */
interface GenerationResult {
  generatedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: GenerationFailure[];
}

/**
 * НОВОЕ v14.0: Информация о неудачной генерации
 */
interface GenerationFailure {
  methodName: string;
  reason: 'no_dto' | 'no_endpoint' | 'parse_error' | 'write_error' | 'other';
  details: string;
}

interface DTOSchema {
  name: string;
  fields: DTOField[];
}

interface DTOField {
  name: string;
  type: string;
  required: boolean;
  isArray: boolean;
  enumValues?: string[]; // Если поле - enum
}

/**
 * НОВОЕ v14.0: Проверяет является ли путь папкой
 */
function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * НОВОЕ v14.0: Получает все .ts файлы из папки (рекурсивно)
 */
function getAllApiFiles(dirPath: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️  Путь не существует: ${dirPath}`);
    return files;
  }

  if (!isDirectory(dirPath)) {
    // Это файл - возвращаем его
    return [dirPath];
  }

  // Это папка - ищем все .ts файлы
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.test.ts') && !item.endsWith('.spec.ts')) {
      files.push(fullPath);
    } else if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      // Рекурсивно обходим подпапки
      files.push(...getAllApiFiles(fullPath));
    }
  }

  return files;
}

/**
 * НОВОЕ v14.0: Мапинг русских категорий на английские
 */
const russianToEnglishCategories: Record<string, string> = {
  'Закупки': 'orders',
  'закупки': 'orders',
  'Заказы': 'orders',
  'заказы': 'orders',
  'Пользователи': 'users',
  'пользователи': 'users',
  'Товары': 'products',
  'товары': 'products',
  'Продукты': 'products',
  'продукты': 'products',
  'Финансы': 'finance',
  'финансы': 'finance',
  'Счета': 'invoices',
  'счета': 'invoices',
  'Платежи': 'payments',
  'платежи': 'payments',
  'Отчеты': 'reports',
  'отчеты': 'reports',
  'Статистика': 'statistics',
  'статистика': 'statistics',
  'Настройки': 'settings',
  'настройки': 'settings',
  'Документы': 'documents',
  'документы': 'documents',
  'Контрагенты': 'contractors',
  'контрагенты': 'contractors',
  'Склад': 'warehouse',
  'склад': 'warehouse',
  'Логистика': 'logistics',
  'логистика': 'logistics',
  'Доставка': 'delivery',
  'доставка': 'delivery'
};

/**
 * НОВОЕ v14.1: Нормализует путь endpoint для сравнения
 * Заменяет все параметры пути на {id} для унификации
 * /api/v1/orders/{orderId} -> /api/v1/orders/{id}
 * /api/v1/orders/123 -> /api/v1/orders/{id}
 */
function normalizeEndpointPath(endpointPath: string): string {
  return endpointPath
    // Заменяем {любое_имя} на {id}
    .replace(/\{[^}]+\}/g, '{id}')
    // Заменяем числа в пути на {id}
    .replace(/\/\d+/g, '/{id}')
    .toLowerCase();
}

/**
 * НОВОЕ v14.1: Строит карту endpoint -> разрешённые HTTP методы
 * Используется для проверки 405 тестов - чтобы не вызывать методы которые реально разрешены
 */
function buildEndpointMethodsMap(methods: ExtractedMethod[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const method of methods) {
    if (!method.path) continue;

    const normalizedPath = normalizeEndpointPath(method.path);
    const httpMethod = method.httpMethod.toUpperCase();

    if (!map.has(normalizedPath)) {
      map.set(normalizedPath, new Set());
    }
    map.get(normalizedPath)!.add(httpMethod);
  }

  return map;
}

/**
 * НОВОЕ v14.1: Получает разрешённые методы для endpoint
 */
function getAllowedMethodsForEndpoint(
  endpointPath: string,
  endpointMethodsMap: Map<string, Set<string>>
): string[] {
  const normalizedPath = normalizeEndpointPath(endpointPath);
  const methods = endpointMethodsMap.get(normalizedPath);
  return methods ? Array.from(methods) : [];
}

/**
 * НОВОЕ v14.0: Переводит или транслитерирует категорию
 */
function translateCategory(category: string): string {
  if (!category) return 'other';

  const trimmed = category.trim();

  // Проверяем в маппинге
  if (russianToEnglishCategories[trimmed]) {
    return russianToEnglishCategories[trimmed];
  }

  // Если есть русские буквы - транслитерируем
  if (/[а-яА-ЯёЁ]/.test(trimmed)) {
    return transliterate(trimmed)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Очищаем английские названия
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * НОВОЕ v14.0: Определяет категорию метода по @tags из комментариев
 * Приоритеты:
 * 1. @tags из комментария JSDoc (переводит/транслитерирует)
 * 2. Путь после /api/v1/ или /api/v2/
 * 3. Имя метода (getPetById -> pet)
 * 4. Имя файла
 */
function determineMethodCategory(method: ExtractedMethod): string {
  // Стратегия 1 (НОВОЕ): Берем из @tags комментария
  if (method.tags && method.tags.length > 0) {
    // Берем первый тег и переводим/транслитерируем
    const firstTag = method.tags[0];
    return translateCategory(firstTag);
  }

  // Стратегия 2: Извлекаем из пути после /api/v1/ или /api/v2/
  // /api/v1/test/fillOrders -> test
  // /api/v2/orders/search -> orders
  const versionedPathMatch = method.path.match(/^\/api\/v\d+\/([^/]+)/);
  if (versionedPathMatch) {
    return translateCategory(versionedPathMatch[1]);
  }

  // Стратегия 3: Извлекаем из пути без версии
  // /api/orders/search -> orders
  const pathMatch = method.path.match(/^\/api\/([^/]+)/);
  if (pathMatch && pathMatch[1] !== 'v1' && pathMatch[1] !== 'v2') {
    return translateCategory(pathMatch[1]);
  }

  // Стратегия 4: Извлекаем из имени метода
  // getPetById -> pet
  // createOrder -> order
  const nameMatch = method.name.match(/^(?:get|post|put|patch|delete|create|update|find|search)([A-Z][a-z]+)/);
  if (nameMatch) {
    return translateCategory(nameMatch[1]);
  }

  // Стратегия 5: Из имени файла
  if (method.sourceFile) {
    const fileName = path.basename(method.sourceFile, '.ts').replace('.api', '');
    if (fileName && fileName !== 'index') {
      return translateCategory(fileName);
    }
  }

  // По умолчанию - 'other'
  return 'other';
}

/**
 * НОВОЕ v14.0: Генерирует API тесты для негативных сценариев
 */
export async function generateNegativeTests(config: NegativeTestConfig): Promise<GenerationResult> {
  const fullConfig = {
    generate401Tests: true,
    generate403Tests: true,
    generate400Tests: true,
    generate404Tests: true,
    generate405Tests: true,
    exclude405Methods: [] as string[], // НОВОЕ v14.1: Глобально исключенные методы
    baseTestPath: '../../../fixtures/baseTest',
    axiosHelpersPath: '../../../helpers/axiosHelpers',
    apiTestHelperPath: '../../../helpers/apiTestHelper',
    useHappyPathData: true,
    dbSchema: 'qa',
    happyPathSamplesCount: 15,
    maxDataGenerationAttempts: 10,
    standUrl: process.env.StandURL,
    authToken: process.env.AUTH_TOKEN,
    groupByCategory: true,
    ...config
  };

  console.log('🧪 Начинаю генерацию НЕГАТИВНЫХ тестов...');

  // Получаем все файлы для обработки
  const apiFiles = getAllApiFiles(fullConfig.apiFilePath);
  console.log(`📁 Найдено файлов: ${apiFiles.length}`);

  if (apiFiles.length === 0) {
    console.warn('⚠️  Не найдено ни одного API файла для обработки');
    return {
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: []
    };
  }

  // НОВОЕ v14.1: Сначала собираем ВСЕ методы из всех файлов
  // чтобы построить карту endpoint -> разрешённые методы
  const allMethods: ExtractedMethod[] = [];
  for (const apiFile of apiFiles) {
    try {
      const content = fs.readFileSync(apiFile, 'utf-8');
      const fileMethods = extractMethodsFromFile(content, apiFile);
      fileMethods.forEach(m => {
        m.sourceFile = apiFile;
        m.category = determineMethodCategory(m);
      });
      allMethods.push(...fileMethods);
    } catch (error) {
      console.warn(`⚠️  Ошибка чтения файла ${apiFile}:`, error);
    }
  }

  // НОВОЕ v14.1: Строим карту: нормализованный путь -> Set<разрешённые HTTP методы>
  const endpointMethodsMap = buildEndpointMethodsMap(allMethods);
  console.log(`📊 Построена карта endpoint -> методы (${endpointMethodsMap.size} уникальных endpoints)`);

  const result: GenerationResult = {
    generatedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failures: []
  };

  // Обрабатываем каждый файл
  for (const apiFile of apiFiles) {
    console.log(`\n📄 Обработка файла: ${path.basename(apiFile)}`);

    try {
      const apiFileContent = fs.readFileSync(apiFile, 'utf-8');
      const methods = extractMethodsFromFile(apiFileContent, apiFile);

      // Добавляем информацию об исходном файле и категории
      methods.forEach(method => {
        method.sourceFile = apiFile;
        method.category = determineMethodCategory(method);
      });

      console.log(`  ✓ Найдено методов: ${methods.length}`);

      // Генерируем тесты для каждого метода
      for (const method of methods) {
        if (!method.path || method.path.trim() === '') {
          console.warn(`  ⚠️  Пропускаю ${method.name} - endpoint не найден`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'no_endpoint',
            details: `Endpoint не найден для метода ${method.name}`
          });
          continue;
        }

        // Определяем выходную папку (с группировкой по категориям или без)
        let outputDir = fullConfig.outputDir;
        if (fullConfig.groupByCategory && method.category) {
          outputDir = path.join(fullConfig.outputDir, method.category);
        }

        // Создаем выходную папку если не существует
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const testFileName = generateTestFileName(method);
        const testFilePath = path.join(outputDir, testFileName);

        try {
          // Проверяем существует ли файл
          if (fs.existsSync(testFilePath)) {
            const existingContent = fs.readFileSync(testFilePath, 'utf-8');

            // Проверяем тег исключения на весь файл
            if (hasReadOnlyTag(existingContent)) {
              console.log(`    ⏭️  ${testFileName} (пропущен - помечен как ReadOnly)`);
              result.skippedCount++;
              continue;
            }

            // Извлекаем protected области
            const protectedAreas = extractProtectedAreas(existingContent);

            // Генерируем новое содержимое (только негативные тесты)
            // НОВОЕ v14.1: Передаём карту разрешённых методов для корректной генерации 405 тестов
            const newContent = await generateNegativeTestForMethod(method, fullConfig, endpointMethodsMap);

            // Восстанавливаем protected области
            const finalContent = restoreProtectedAreas(newContent, protectedAreas);

            fs.writeFileSync(testFilePath, finalContent);
            console.log(`    ♻️  ${testFileName} (обновлен)`);
            result.updatedCount++;
          } else {
            // Новый файл
            // НОВОЕ v14.1: Передаём карту разрешённых методов для корректной генерации 405 тестов
            const testContent = await generateNegativeTestForMethod(method, fullConfig, endpointMethodsMap);
            fs.writeFileSync(testFilePath, testContent);
            console.log(`    ✅ ${testFileName} (создан)`);
            result.generatedCount++;
          }
        } catch (error: any) {
          console.error(`    ❌ Ошибка генерации ${testFileName}: ${error.message}`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'write_error',
            details: error.message
          });
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Ошибка обработки файла ${path.basename(apiFile)}: ${error.message}`);
      result.failedCount++;
      result.failures.push({
        methodName: `file:${path.basename(apiFile)}`,
        reason: 'parse_error',
        details: error.message
      });
    }
  }

  // Выводим отчет
  printGenerationReport(result, 'НЕГАТИВНЫЕ');

  console.log(`📁 Путь: ${fullConfig.outputDir}`);

  return result;
}

/**
 * НОВОЕ v14.0: Генерирует API тесты для позитивных сценариев
 */
export async function generatePositiveTests(config: PositiveTestConfig): Promise<GenerationResult> {
  const fullConfig = {
    generateRequiredFieldsTest: true,
    generateAllFieldsTest: true,
    baseTestPath: '../../../fixtures/baseTest',
    axiosHelpersPath: '../../../helpers/axiosHelpers',
    apiTestHelperPath: '../../../helpers/apiTestHelper',
    useHappyPathData: true,
    dbSchema: 'qa',
    happyPathSamplesCount: 15,
    maxDataGenerationAttempts: 10,
    standUrl: process.env.StandURL,
    authToken: process.env.AUTH_TOKEN,
    groupByCategory: true,
    ...config
  };

  console.log('🧪 Начинаю генерацию ПОЗИТИВНЫХ тестов...');

  // Получаем все файлы для обработки
  const apiFiles = getAllApiFiles(fullConfig.apiFilePath);
  console.log(`📁 Найдено файлов: ${apiFiles.length}`);

  if (apiFiles.length === 0) {
    console.warn('⚠️  Не найдено ни одного API файла для обработки');
    return {
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: []
    };
  }

  const result: GenerationResult = {
    generatedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failures: []
  };

  // Обрабатываем каждый файл
  for (const apiFile of apiFiles) {
    console.log(`\n📄 Обработка файла: ${path.basename(apiFile)}`);

    try {
      const apiFileContent = fs.readFileSync(apiFile, 'utf-8');
      const methods = extractMethodsFromFile(apiFileContent, apiFile);

      // Добавляем информацию об исходном файле и категории
      methods.forEach(method => {
        method.sourceFile = apiFile;
        method.category = determineMethodCategory(method);
      });

      console.log(`  ✓ Найдено методов: ${methods.length}`);

      // Генерируем тесты для каждого метода
      for (const method of methods) {
        if (!method.path || method.path.trim() === '') {
          console.warn(`  ⚠️  Пропускаю ${method.name} - endpoint не найден`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'no_endpoint',
            details: `Endpoint не найден для метода ${method.name}`
          });
          continue;
        }

        // Определяем выходную папку (с группировкой по категориям или без)
        let outputDir = fullConfig.outputDir;
        if (fullConfig.groupByCategory && method.category) {
          outputDir = path.join(fullConfig.outputDir, method.category);
        }

        // Создаем выходную папку если не существует
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const testFileName = generateTestFileName(method);
        const testFilePath = path.join(outputDir, testFileName);

        try {
          // Проверяем существует ли файл
          if (fs.existsSync(testFilePath)) {
            const existingContent = fs.readFileSync(testFilePath, 'utf-8');

            // Проверяем тег исключения на весь файл
            if (hasReadOnlyTag(existingContent)) {
              console.log(`    ⏭️  ${testFileName} (пропущен - помечен как ReadOnly)`);
              result.skippedCount++;
              continue;
            }

            // Извлекаем protected области
            const protectedAreas = extractProtectedAreas(existingContent);

            // Генерируем новое содержимое (только позитивные тесты)
            const newContent = await generatePositiveTestForMethod(method, fullConfig);

            // Восстанавливаем protected области
            const finalContent = restoreProtectedAreas(newContent, protectedAreas);

            fs.writeFileSync(testFilePath, finalContent);
            console.log(`    ♻️  ${testFileName} (обновлен)`);
            result.updatedCount++;
          } else {
            // Новый файл
            const testContent = await generatePositiveTestForMethod(method, fullConfig);
            fs.writeFileSync(testFilePath, testContent);
            console.log(`    ✅ ${testFileName} (создан)`);
            result.generatedCount++;
          }
        } catch (error: any) {
          console.error(`    ❌ Ошибка генерации ${testFileName}: ${error.message}`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'write_error',
            details: error.message
          });
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Ошибка обработки файла ${path.basename(apiFile)}: ${error.message}`);
      result.failedCount++;
      result.failures.push({
        methodName: `file:${path.basename(apiFile)}`,
        reason: 'parse_error',
        details: error.message
      });
    }
  }

  // Выводим отчет
  printGenerationReport(result, 'ПОЗИТИВНЫЕ');

  console.log(`📁 Путь: ${fullConfig.outputDir}`);

  return result;
}

/**
 * НОВОЕ v14.0: Генерирует pairwise тесты
 */
export async function generatePairwiseTests(config: PairwiseTestConfig): Promise<GenerationResult> {
  const fullConfig = {
    generateOptionalCombinations: true,
    generateEnumTests: true,
    maxPairwiseCombinations: 10,
    baseTestPath: '../../../fixtures/baseTest',
    axiosHelpersPath: '../../../helpers/axiosHelpers',
    apiTestHelperPath: '../../../helpers/apiTestHelper',
    useHappyPathData: true,
    dbSchema: 'qa',
    happyPathSamplesCount: 15,
    maxDataGenerationAttempts: 10,
    standUrl: process.env.StandURL,
    authToken: process.env.AUTH_TOKEN,
    groupByCategory: true,
    ...config
  };

  console.log('🧪 Начинаю генерацию PAIRWISE тестов...');

  // Получаем все файлы для обработки
  const apiFiles = getAllApiFiles(fullConfig.apiFilePath);
  console.log(`📁 Найдено файлов: ${apiFiles.length}`);

  if (apiFiles.length === 0) {
    console.warn('⚠️  Не найдено ни одного API файла для обработки');
    return {
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: []
    };
  }

  const result: GenerationResult = {
    generatedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failures: []
  };

  // Обрабатываем каждый файл
  for (const apiFile of apiFiles) {
    console.log(`\n📄 Обработка файла: ${path.basename(apiFile)}`);

    try {
      const apiFileContent = fs.readFileSync(apiFile, 'utf-8');
      const methods = extractMethodsFromFile(apiFileContent, apiFile);

      // Добавляем информацию об исходном файле и категории
      methods.forEach(method => {
        method.sourceFile = apiFile;
        method.category = determineMethodCategory(method);
      });

      console.log(`  ✓ Найдено методов: ${methods.length}`);

      // Генерируем тесты для каждого метода
      for (const method of methods) {
        if (!method.path || method.path.trim() === '') {
          console.warn(`  ⚠️  Пропускаю ${method.name} - endpoint не найден`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'no_endpoint',
            details: `Endpoint не найден для метода ${method.name}`
          });
          continue;
        }

        // Определяем выходную папку (с группировкой по категориям или без)
        let outputDir = fullConfig.outputDir;
        if (fullConfig.groupByCategory && method.category) {
          outputDir = path.join(fullConfig.outputDir, method.category);
        }

        // Создаем выходную папку если не существует
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const testFileName = generateTestFileName(method);
        const testFilePath = path.join(outputDir, testFileName);

        try {
          // Проверяем существует ли файл
          if (fs.existsSync(testFilePath)) {
            const existingContent = fs.readFileSync(testFilePath, 'utf-8');

            // Проверяем тег исключения на весь файл
            if (hasReadOnlyTag(existingContent)) {
              console.log(`    ⏭️  ${testFileName} (пропущен - помечен как ReadOnly)`);
              result.skippedCount++;
              continue;
            }

            // Извлекаем protected области
            const protectedAreas = extractProtectedAreas(existingContent);

            // Генерируем новое содержимое (только pairwise тесты)
            const newContent = await generatePairwiseTestForMethod(method, fullConfig);

            // Восстанавливаем protected области
            const finalContent = restoreProtectedAreas(newContent, protectedAreas);

            fs.writeFileSync(testFilePath, finalContent);
            console.log(`    ♻️  ${testFileName} (обновлен)`);
            result.updatedCount++;
          } else {
            // Новый файл
            const testContent = await generatePairwiseTestForMethod(method, fullConfig);
            fs.writeFileSync(testFilePath, testContent);
            console.log(`    ✅ ${testFileName} (создан)`);
            result.generatedCount++;
          }
        } catch (error: any) {
          console.error(`    ❌ Ошибка генерации ${testFileName}: ${error.message}`);
          result.failedCount++;
          result.failures.push({
            methodName: method.name,
            reason: 'write_error',
            details: error.message
          });
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Ошибка обработки файла ${path.basename(apiFile)}: ${error.message}`);
      result.failedCount++;
      result.failures.push({
        methodName: `file:${path.basename(apiFile)}`,
        reason: 'parse_error',
        details: error.message
      });
    }
  }

  // Выводим отчет
  printGenerationReport(result, 'PAIRWISE');

  console.log(`📁 Путь: ${fullConfig.outputDir}`);

  return result;
}

/**
 * НОВОЕ v14.0: Выводит отчет о генерации
 */
function printGenerationReport(result: GenerationResult, testType: string): void {
  console.log(`\n✨ Генерация ${testType} тестов завершена!`);
  console.log(`   Создано: ${result.generatedCount}`);
  console.log(`   Обновлено: ${result.updatedCount}`);
  console.log(`   Пропущено: ${result.skippedCount}`);

  if (result.failedCount > 0) {
    console.log(`   ⚠️  Не удалось сгенерировать: ${result.failedCount}`);
    console.log(`\n📋 Детали неудачных генераций:`);

    // Группируем по причинам
    const groupedFailures = new Map<string, GenerationFailure[]>();
    for (const failure of result.failures) {
      if (!groupedFailures.has(failure.reason)) {
        groupedFailures.set(failure.reason, []);
      }
      groupedFailures.get(failure.reason)!.push(failure);
    }

    // Выводим по группам
    for (const [reason, failures] of groupedFailures) {
      const reasonText = {
        'no_dto': 'DTO не найдено',
        'no_endpoint': 'Endpoint не найден',
        'parse_error': 'Ошибка парсинга',
        'write_error': 'Ошибка записи',
        'other': 'Прочие ошибки'
      }[reason] || reason;

      console.log(`\n   ${reasonText} (${failures.length}):`);
      failures.forEach(f => {
        console.log(`      - ${f.methodName}: ${f.details}`);
      });
    }
  }
}

/**
 * @deprecated Используйте отдельные методы: generateNegativeTests, generatePositiveTests, generatePairwiseTests
 * Генерирует API тесты из файла с методами
 */
export async function generateApiTests(config: ApiTestConfig): Promise<void> {
  const fullConfig = {
    generateNegativeTests: true,
    generatePositiveTests: true,
    generatePairwiseTests: false,
    baseTestPath: '../../../fixtures/baseTest',
    axiosHelpersPath: '../../../helpers/axiosHelpers',
    apiTestHelperPath: '../../../helpers/apiTestHelper',
    useHappyPathData: true,
    dbSchema: 'qa',
    happyPathSamplesCount: 15,
    maxDataGenerationAttempts: 10,
    standUrl: process.env.StandURL,
    authToken: process.env.AUTH_TOKEN,
    ...config
  };
  
  console.log('🧪 Начинаю генерацию API тестов...');
  
  // Читаем файл с API методами
  const apiFileContent = fs.readFileSync(fullConfig.apiFilePath, 'utf-8');
  
  // Извлекаем информацию о методах (передаем путь для поиска base.types.ts)
  const methods = extractMethodsFromFile(apiFileContent, fullConfig.apiFilePath);
  
  console.log(`✓ Найдено методов: ${methods.length}`);
  
  // Проверяем что у всех методов есть path
  const methodsWithoutPath = methods.filter(m => !m.path || m.path.trim() === '');
  if (methodsWithoutPath.length > 0) {
    console.warn('⚠️  Предупреждение: Найдены методы без endpoint:');
    methodsWithoutPath.forEach(m => console.warn(`   - ${m.name}`));
  }
  
  // Создаем выходную папку если не существует
  if (!fs.existsSync(fullConfig.outputDir)) {
    fs.mkdirSync(fullConfig.outputDir, { recursive: true });
  }
  
  // Генерируем тест для каждого метода
  let generatedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  
  for (const method of methods) {
    if (!method.path || method.path.trim() === '') {
      console.warn(`⚠️  Пропускаю ${method.name} - endpoint не найден`);
      continue;
    }
    
    const testFileName = generateTestFileName(method);
    const testFilePath = path.join(fullConfig.outputDir, testFileName);
    
    // Проверяем существует ли файл
    if (fs.existsSync(testFilePath)) {
      const existingContent = fs.readFileSync(testFilePath, 'utf-8');
      
      // Проверяем тег исключения на весь файл
      if (hasReadOnlyTag(existingContent)) {
        console.log(`  ⏭️  ${testFileName} (пропущен - помечен как ReadOnly)`);
        skippedCount++;
        continue;
      }
      
      // Извлекаем protected области
      const protectedAreas = extractProtectedAreas(existingContent);
      
      // Генерируем новое содержимое
      const newContent = await generateTestForMethod(method, fullConfig);

      // Восстанавливаем protected области
      const finalContent = restoreProtectedAreas(newContent, protectedAreas);
      
      fs.writeFileSync(testFilePath, finalContent);
      console.log(`  ♻️  ${testFileName} (обновлен)`);
      updatedCount++;
    } else {
      // Новый файл
      const testContent = await generateTestForMethod(method, fullConfig);
      fs.writeFileSync(testFilePath, testContent);
      console.log(`  ✅ ${testFileName} (создан)`);
      generatedCount++;
    }
  }
  
  console.log(`\n✨ Генерация завершена!`);
  console.log(`   Создано: ${generatedCount}`);
  console.log(`   Обновлено: ${updatedCount}`);
  console.log(`   Пропущено: ${skippedCount}`);
  console.log(`📁 Путь: ${fullConfig.outputDir}`);
}

/**
 * Извлекает информацию о методах из файла
 */
function extractMethodsFromFile(content: string, filePath?: string): ExtractedMethod[] {
  const methods: ExtractedMethod[] = [];
  
  // Сначала извлекаем все DTO из текущего файла
  const dtoSchemas = extractDTOSchemas(content);
  
  // Если есть путь к файлу, ищем base.types.ts и импорты
  const externalSchemas = new Map<string, DTOSchema>();
  if (filePath) {
    const dir = path.dirname(filePath);
    
    // Проверяем base.types.ts
    const baseTypesPath = path.join(dir, 'base.types.ts');
    if (fs.existsSync(baseTypesPath)) {
      console.log(`  📦 Найден base.types.ts, извлекаю DTO...`);
      const baseContent = fs.readFileSync(baseTypesPath, 'utf-8');
      const baseSchemas = extractDTOSchemas(baseContent);
      baseSchemas.forEach(schema => externalSchemas.set(schema.name, schema));
      console.log(`  ✓ Извлечено ${baseSchemas.length} DTO из base.types.ts`);
    }
    
    // Ищем импорты типов
    const importRegex = /import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"](.+?)['"]/g;
    let importMatch;
    
    while ((importMatch = importRegex.exec(content)) !== null) {
      const imports = importMatch[1].split(',').map(i => i.trim());
      const importPath = importMatch[2];
      
      // Разрешаем относительный путь
      let resolvedPath = importPath;
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        resolvedPath = path.resolve(dir, importPath);
        
        // Добавляем .ts если нет расширения
        if (!resolvedPath.endsWith('.ts')) {
          resolvedPath += '.ts';
        }
      }
      
      if (fs.existsSync(resolvedPath)) {
        console.log(`  📦 Читаю импорты из ${importPath}...`);
        const importedContent = fs.readFileSync(resolvedPath, 'utf-8');
        const importedSchemas = extractDTOSchemas(importedContent);
        
        // Добавляем только импортированные типы
        importedSchemas.forEach(schema => {
          if (imports.some(imp => imp.includes(schema.name))) {
            externalSchemas.set(schema.name, schema);
          }
        });
        
        console.log(`  ✓ Извлечено ${importedSchemas.length} DTO из ${importPath}`);
      }
    }
  }
  
  // Объединяем все схемы
  const allSchemas = [...dtoSchemas, ...Array.from(externalSchemas.values())];
  console.log(`  📊 Всего доступно DTO: ${allSchemas.length}`);
  
  // Регулярка для поиска JSDoc + функции
  const methodRegex = /\/\*\*[\s\S]*?\*\/\s*export\s+async\s+function\s+(\w+)\s*\((.*?)\)\s*:\s*Promise<(.+?)>\s*{/g;
  
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const methodName = match[1];
    const params = match[2];
    const returnType = match[3];
    
    // Извлекаем информацию из JSDoc
    const jsdocMatch = fullMatch.match(/\/\*\*([\s\S]*?)\*\//);
    const jsdoc = jsdocMatch ? jsdocMatch[1] : '';
    
    // Извлекаем @tags
    const tagsMatch = jsdoc.match(/@tags\s+(.+)/);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
    
    // Извлекаем @request (метод и путь)
    const requestMatch = jsdoc.match(/@request\s+(\w+):(.+)/);
    const httpMethod = requestMatch ? requestMatch[1].trim() : 'GET';
    const apiPath = requestMatch ? requestMatch[2].trim() : '';
    
    // Проверяем есть ли @secure
    const hasAuth = jsdoc.includes('@secure');
    
    // Парсим параметры
    const parameters = params
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        const colonIndex = p.indexOf(':');
        return colonIndex > 0 ? p.substring(0, colonIndex).trim() : p;
      });
    
    // Находим body параметр и его тип
    let bodySchema: DTOSchema | undefined;
    let dtoSourcePath: string | undefined;
    
    if (params.includes('body:') || params.includes('data:')) {
      const bodyMatch = params.match(/(?:body|data):\s*(\w+)/);
      if (bodyMatch) {
        const bodyTypeName = bodyMatch[1];
        
        // Ищем DTO во всех доступных схемах
        bodySchema = allSchemas.find(dto => dto.name === bodyTypeName);
        
        // Определяем откуда DTO
        if (bodySchema) {
          if (externalSchemas.has(bodyTypeName)) {
            // Ищем в импортах
            const importMatch = content.match(
              new RegExp(`import\\s+(?:type\\s+)?{[^}]*${bodyTypeName}[^}]*}\\s+from\\s+['"](.+?)['"]`)
            );
            dtoSourcePath = importMatch ? importMatch[1] : './base.types.ts';
          } else {
            // Текущий файл
            dtoSourcePath = filePath || 'current_file';
          }
          
          console.log(`  ✓ ${methodName}: найдено DTO '${bodyTypeName}' в ${dtoSourcePath}`);
        } else {
          console.warn(`  ⚠️  ${methodName}: DTO '${bodyTypeName}' не найдено`);
        }
      }
    }
    
    methods.push({
      name: methodName,
      httpMethod,
      path: apiPath,
      parameters,
      returnType,
      tags,
      hasAuth,
      bodySchema,
      dtoSourcePath
    });
  }
  
  return methods;
}

/**
 * Извлекает DTO схемы из файла
 */
function extractDTOSchemas(content: string): DTOSchema[] {
  const schemas: DTOSchema[] = [];
  
  // Регулярка для поиска интерфейсов
  const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]+)}/g;
  
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const interfaceName = match[1];
    const interfaceBody = match[2];
    
    const fields = extractFieldsFromInterface(interfaceBody);
    
    schemas.push({
      name: interfaceName,
      fields
    });
  }
  
  return schemas;
}

/**
 * Извлекает поля из интерфейса
 */
function extractFieldsFromInterface(interfaceBody: string): DTOField[] {
  const fields: DTOField[] = [];
  
  // Разбиваем на строки и парсим каждое поле
  const lines = interfaceBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Пропускаем комментарии
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }
    
    // Парсим поле: name?: type;
    const fieldMatch = line.match(/^['"]?(\w+)['"]?\??:\s*(.+?);?$/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].trim();
      const required = !line.includes('?:');
      const isArray = fieldType.includes('[]');
      
      // Проверяем на enum
      let enumValues: string[] | undefined;
      const enumMatch = fieldType.match(/['"]([^'"]+)['"](?:\s*\|\s*['"]([^'"]+)['"])+/);
      if (enumMatch) {
        enumValues = fieldType.match(/['"]([^'"]+)['"]/g)?.map(v => v.replace(/['"]/g, ''));
      }
      
      fields.push({
        name: fieldName,
        type: fieldType.replace('[]', ''),
        required,
        isArray,
        enumValues
      });
    }
  }
  
  return fields;
}

/**
 * Генерирует имя файла теста
 */
function generateTestFileName(method: ExtractedMethod): string {
  return `${method.name}.test.ts`;
}

/**
 * НОВОЕ v13.0: Создает файл с данными из Happy Path
 */
function createHappyPathDataFile(
  methodName: string,
  happyPathData: HappyPathData[],
  outputDir: string
): string {
  const testDataDir = path.join(outputDir, 'testData');

  // Создаем папку testData если её нет
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const dataFileName = `${methodName}.data.ts`;
  const dataFilePath = path.join(testDataDir, dataFileName);

  // Генерируем содержимое файла
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Тестовые данные для ${methodName}`);
  lines.push(' * Из Happy Path тестов (qa.api_requests)');
  lines.push(' * @generated');
  lines.push(' */');
  lines.push('');

  // Экспортируем данные
  lines.push('export const dbTestData = {');
  lines.push('  happyPath: [');

  happyPathData.forEach((data, index) => {
    const requestBody = data.request_body || {};
    const rowStr = JSON.stringify(requestBody, null, 4);
    const comma = index < happyPathData.length - 1 ? ',' : '';
    lines.push(`    ${rowStr}${comma}`);
  });

  lines.push('  ]');
  lines.push('} as const;');
  lines.push('');

  // Экспортируем вспомогательные функции
  lines.push('// Получить все данные');
  lines.push('export const getHappyPathData = () => dbTestData.happyPath;');
  lines.push('');
  lines.push('// Получить случайную запись');
  lines.push('export const getRandomHappyPath = () => {');
  lines.push('  const data = dbTestData.happyPath;');
  lines.push('  return data[Math.floor(Math.random() * data.length)];');
  lines.push('};');
  lines.push('');

  // Записываем файл
  fs.writeFileSync(dataFilePath, lines.join('\n'));

  console.log(`  ✓ Создан файл с Happy Path данными: ${path.relative(process.cwd(), dataFilePath)}`);

  // Возвращаем относительный путь для импорта
  return `./testData/${dataFileName.replace('.ts', '')}`;
}

/**
 * НОВОЕ v14.0: Генерирует содержимое НЕГАТИВНОГО теста для метода
 * ОБНОВЛЕНО v14.1: Добавлен параметр endpointMethodsMap для корректной генерации 405 тестов
 */
async function generateNegativeTestForMethod(
  method: ExtractedMethod,
  config: NegativeTestConfig & {
    generate401Tests: boolean;
    generate403Tests: boolean;
    generate400Tests: boolean;
    generate404Tests: boolean;
    generate405Tests: boolean;
    exclude405Methods: string[];
    baseTestPath: string;
    axiosHelpersPath: string;
    apiTestHelperPath: string;
    groupByCategory: boolean;
  },
  endpointMethodsMap: Map<string, Set<string>>
): Promise<string> {
  const lines: string[] = [];

  // Импорты
  lines.push(`import test, { expect } from '${config.baseTestPath}';`);
  lines.push("import axios from 'axios';");
  lines.push(`import { configApiHeaderAdmin, configApiHeaderNoRights } from '${config.axiosHelpersPath}';`);
  lines.push(`import { getMessageFromResponse, getMessageFromError } from '${config.apiTestHelperPath || '../../../helpers/apiTestHelper'}';`);
  lines.push('');

  // Извлекаем ID параметры из пути
  const pathParams = extractPathParams(method.path);
  const hasIdParams = pathParams.length > 0;

  // Если есть ID параметры, объявляем их заранее
  if (hasIdParams) {
    lines.push('// ID параметры для endpoint');
    for (const param of pathParams) {
      lines.push(`const ${param} = 1; // TODO: заменить на актуальный ID`);
    }
    lines.push('');
  }

  // Endpoint с подстановкой ID
  let endpointValue = method.path;
  if (hasIdParams) {
    for (const param of pathParams) {
      endpointValue = endpointValue.replace(`{${param}}`, `\${${param}}`);
    }
    lines.push(`const endpoint = \`${endpointValue}\`;`);
  } else {
    lines.push(`const endpoint = '${endpointValue}';`);
  }

  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');

  // Коды статусов
  lines.push('// Коды статусов');
  lines.push('const apiErrorCodes = {');
  lines.push('  unauthorized: 401,');
  lines.push('  badRequest: 400,');
  lines.push('  forbidden: 403,');
  lines.push('  notFound: 404,');
  lines.push('  methodNotAllowed: 405,');
  lines.push('};');
  lines.push('');

  // Case Info
  lines.push('// Информация о тест-кейсе');
  lines.push('const caseInfoObj = {');
  lines.push(`  testCase: 'T${Math.floor(Math.random() * 10000)}',`);
  lines.push("  aqaOwner: 'AutoGenerated',");
  lines.push(`  tms_testName: '${method.httpMethod} ${method.path}',`);
  lines.push("  testType: 'api'");
  lines.push('};');
  lines.push('');

  // Комментарий с проверками
  lines.push('/**');
  lines.push(' * НЕГАТИВНЫЕ ТЕСТЫ');
  lines.push(' * Проверки:');
  if (config.generate401Tests) {
    lines.push(' * - Без токена (401)');
  }
  if (config.generate400Tests && hasBodyParam(method)) {
    lines.push(' * - С токеном но без Body (400)');
  }
  if (config.generate405Tests) {
    lines.push(' * - Проверка methodNotAllowed для неподдерживаемых HTTP методов');
  }
  if (config.generate403Tests && method.hasAuth) {
    lines.push(' * - С токеном пользователя без прав (403)');
  }
  if (config.generate404Tests && hasIdParams) {
    lines.push(' * - С несуществующим ID (404)');
  }
  lines.push(' */');
  lines.push('');

  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API НЕГАТИВНЫЕ тесты для \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');

  // Тест 1: Без токена (401)
  if (config.generate401Tests) {
    lines.push(`  test(\`\${httpMethod} без TOKEN (\${apiErrorCodes.unauthorized}) @api @negative\`, async ({ page }, testInfo) => {`);
    const axiosCall = generateSimpleAxiosCall(method, false);
    lines.push(`    try {`);
    lines.push(`      await ${axiosCall};`);
    lines.push(`      throw new Error('Ожидалась ошибка 401, но запрос прошел успешно');`);
    lines.push(`    } catch (error: any) {`);
    lines.push(`      // Используем apiTestHelper для детализации ошибки`);
    lines.push('      const errorMessage = getMessageFromError(error);');
    lines.push('      ');
    lines.push('      await expect(error.response.status, errorMessage).toBe(apiErrorCodes.unauthorized);');
    lines.push('      await expect(error.response.statusText).toBe("Unauthorized");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
    lines.push('      await expect(error.config.url).toContain(endpoint);');
    lines.push('    }');
    lines.push('  });');
    lines.push('');
  }

  // Тест 2: С токеном но без body (400)
  if (config.generate400Tests && hasBodyParam(method)) {
    lines.push(`  test(\`\${httpMethod} с токеном без Body (\${apiErrorCodes.badRequest}) @api @negative\`, async ({ page }, testInfo) => {`);
    const axiosCallNoBody = generateSimpleAxiosCall(method, true, true);
    lines.push(`    try {`);
    lines.push(`      await ${axiosCallNoBody};`);
    lines.push(`      throw new Error('Ожидалась ошибка 400, но запрос прошел успешно');`);
    lines.push(`    } catch (error: any) {`);
    lines.push(`      const errorMessage = getMessageFromError(error);`);
    lines.push('      ');
    lines.push('      await expect(error.response.status, errorMessage).toBe(apiErrorCodes.badRequest);');
    lines.push('      await expect(error.response.statusText).toBe("Bad Request");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
    lines.push('    }');
    lines.push('  });');
    lines.push('');
  }

  // Тесты 3-5: Method Not Allowed (405)
  // ОБНОВЛЕНО v14.1: Исключаем методы которые реально разрешены для endpoint + глобально исключённые
  if (config.generate405Tests) {
    // Получаем разрешённые методы для этого endpoint
    const allowedMethods = getAllowedMethodsForEndpoint(method.path, endpointMethodsMap);

    // Глобально исключённые методы (например DELETE чтобы не удалять данные)
    const globallyExcluded = (config.exclude405Methods || []).map(m => m.toUpperCase());

    // Фильтруем методы: убираем текущий метод, разрешённые для endpoint и глобально исключённые
    const methodsToTest = ['GET', 'POST', 'PUT', 'DELETE'].filter(m => {
      if (m === method.httpMethod.toUpperCase()) return false; // Текущий метод
      if (allowedMethods.includes(m)) return false; // Разрешённый для endpoint
      if (globallyExcluded.includes(m)) return false; // Глобально исключённый
      return true;
    });

    // Логируем исключённые методы для отладки
    const excludedForEndpoint = allowedMethods.filter(m => m !== method.httpMethod.toUpperCase());
    if (excludedForEndpoint.length > 0) {
      lines.push(`  // ПРИМЕЧАНИЕ: Методы ${excludedForEndpoint.join(', ')} разрешены для этого endpoint - пропускаем`);
    }
    if (globallyExcluded.length > 0) {
      lines.push(`  // ПРИМЕЧАНИЕ: Методы ${globallyExcluded.join(', ')} глобально исключены из 405 проверок`);
    }

    for (const otherMethod of methodsToTest.slice(0, 3)) {
      lines.push(`  test(\`${otherMethod} с токеном (\${apiErrorCodes.methodNotAllowed}) @api @negative\`, async ({ page }, testInfo) => {`);
      const wrongMethodCall = generateWrongMethodCall(otherMethod);
      lines.push(`    try {`);
      lines.push(`      await ${wrongMethodCall};`);
      lines.push(`      throw new Error('Ожидалась ошибка 405, но запрос прошел успешно');`);
      lines.push(`    } catch (error: any) {`);
      lines.push(`      const errorMessage = getMessageFromError(error);`);
      lines.push('      ');
      lines.push('      await expect(error.response.status, errorMessage).toBe(apiErrorCodes.methodNotAllowed);');
      lines.push('      await expect(error.response.statusText).toBe("Method Not Allowed");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${otherMethod.toLowerCase()}');`);
      lines.push('    }');
      lines.push('  });');
      lines.push('');
    }

    // Если все методы исключены - добавляем комментарий
    if (methodsToTest.length === 0) {
      lines.push('  // Все HTTP методы разрешены или глобально исключены - нет 405 тестов');
      lines.push('');
    }
  }

  // Тест 6: С пользователем без прав (403)
  if (config.generate403Tests && method.hasAuth) {
    lines.push(`  test(\`\${httpMethod} с пользователем без прав (\${apiErrorCodes.forbidden}) @api @negative\`, async ({ page }, testInfo) => {`);
    const axiosCallNoRights = generateSimpleAxiosCall(method, true, false, 'configApiHeaderNoRights');
    lines.push(`    try {`);
    lines.push(`      await ${axiosCallNoRights};`);
    lines.push(`      throw new Error('Ожидалась ошибка 403, но запрос прошел успешно');`);
    lines.push(`    } catch (error: any) {`);
    lines.push(`      const errorMessage = getMessageFromError(error);`);
    lines.push('      ');
    lines.push('      await expect(error.response.status, errorMessage).toBe(apiErrorCodes.forbidden);');
    lines.push('      await expect(error.response.statusText).toBe("Forbidden");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push('    }');
    lines.push('  });');
    lines.push('');
  }

  // Тест 7: 404 для несуществующего ресурса
  if (config.generate404Tests && hasIdParams) {
    lines.push(`  test(\`\${httpMethod} с несуществующим ID (\${apiErrorCodes.notFound}) @api @negative\`, async ({ page }, testInfo) => {`);
    // Переопределяем ID на несуществующий
    for (const param of pathParams) {
      lines.push(`    const ${param}NotFound = 999999999;`);
    }
    const notFoundEndpoint = method.path;
    let endpointWith404 = notFoundEndpoint;
    for (const param of pathParams) {
      endpointWith404 = endpointWith404.replace(`{${param}}`, `\${${param}NotFound}`);
    }
    lines.push(`    const endpoint404 = \`${endpointWith404}\`;`);

    const axiosCall404 = generateSimpleAxiosCall(method, true, false, 'configApiHeaderAdmin', 'endpoint404');
    lines.push(`    try {`);
    lines.push(`      await ${axiosCall404};`);
    lines.push(`      throw new Error('Ожидалась ошибка 404, но запрос прошел успешно');`);
    lines.push(`    } catch (error: any) {`);
    lines.push(`      const errorMessage = getMessageFromError(error);`);
    lines.push('      ');
    lines.push('      await expect(error.response.status, errorMessage).toBe(apiErrorCodes.notFound);');
    lines.push('      await expect(error.response.statusText).toBe("Not Found");');
    lines.push('    }');
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * НОВОЕ v14.0: Генерирует содержимое ПОЗИТИВНОГО теста для метода
 */
async function generatePositiveTestForMethod(
  method: ExtractedMethod,
  config: PositiveTestConfig & {
    generateRequiredFieldsTest: boolean;
    generateAllFieldsTest: boolean;
    baseTestPath: string;
    axiosHelpersPath: string;
    apiTestHelperPath: string;
    groupByCategory: boolean;
  }
): Promise<string> {
  const lines: string[] = [];

  // НОВОЕ v13.0: Получаем данные из Happy Path тестов
  let happyPathData: HappyPathData[] = [];
  if (config.useHappyPathData && config.dbConnection) {
    console.log(`    📊 Получение Happy Path данных для ${method.name}...`);
    try {
      happyPathData = await fetchHappyPathData(
        method.path,
        method.httpMethod,
        {
          dbConnection: config.dbConnection,
          dbSchema: config.dbSchema,
          samplesCount: config.happyPathSamplesCount
        }
      );
    } catch (error: any) {
      console.warn(`    ⚠️  Ошибка получения Happy Path данных: ${error.message}`);
    }
  }

  // Проверяем наличие файла с данными
  const testDataDir = path.join(config.outputDir, method.category || '', 'testData');
  const testDataFileName = method.name + '.data.ts';
  const testDataFilePath = path.join(testDataDir, testDataFileName);
  const hasTestData = fs.existsSync(testDataFilePath) || happyPathData.length > 0;

  // НОВОЕ v13.0: Создаем файл с данными если есть Happy Path данные
  if (happyPathData.length > 0) {
    const categoryDir = method.category ? path.join(config.outputDir, method.category) : config.outputDir;
    createHappyPathDataFile(method.name, happyPathData, categoryDir);
  }

  // Импорты
  lines.push(`import test, { expect } from '${config.baseTestPath}';`);
  lines.push("import axios from 'axios';");
  lines.push(`import { configApiHeaderAdmin } from '${config.axiosHelpersPath}';`);
  lines.push(`import { getMessageFromResponse } from '${config.apiTestHelperPath || '../../../helpers/apiTestHelper'}';`);

  // Добавляем импорт данных если файл существует
  if (hasTestData) {
    lines.push(`import { dbTestData } from './testData/${method.name}.data';`);
  }

  lines.push('');

  // Извлекаем ID параметры из пути
  const pathParams = extractPathParams(method.path);
  const hasIdParams = pathParams.length > 0;

  // Если есть ID параметры, объявляем их заранее
  if (hasIdParams) {
    lines.push('// ID параметры для endpoint');
    for (const param of pathParams) {
      lines.push(`const ${param} = 1; // TODO: заменить на актуальный ID`);
    }
    lines.push('');
  }

  // Endpoint с подстановкой ID
  let endpointValue = method.path;
  if (hasIdParams) {
    for (const param of pathParams) {
      endpointValue = endpointValue.replace(`{${param}}`, `\${${param}}`);
    }
    lines.push(`const endpoint = \`${endpointValue}\`;`);
  } else {
    lines.push(`const endpoint = '${endpointValue}';`);
  }

  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');

  // Код успеха
  lines.push('// Код успешного ответа');
  lines.push(`const success = ${getSuccessCode(method) === 'apiErrorCodes.created' ? '201' : '200'};`);
  lines.push('');

  // Case Info
  lines.push('// Информация о тест-кейсе');
  lines.push('const caseInfoObj = {');
  lines.push(`  testCase: 'T${Math.floor(Math.random() * 10000)}',`);
  lines.push("  aqaOwner: 'AutoGenerated',");
  lines.push(`  tms_testName: '${method.httpMethod} ${method.path}',`);
  lines.push("  testType: 'api'");
  lines.push('};');
  lines.push('');

  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API ПОЗИТИВНЫЕ тесты для \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');

  if (method.bodySchema && method.bodySchema.fields.length > 0) {
    // Генерируем тестовые данные (используем dbTestData если доступно)
    const testDataSection = generateTestDataSectionWithDb(
      method.bodySchema,
      hasTestData ? `./testData/${method.name}.data` : null
    );
    lines.push(testDataSection);
    lines.push('');

    const requiredFields = method.bodySchema.fields.filter(f => f.required);
    const hasRequiredFields = requiredFields.length > 0;

    if (config.generateRequiredFieldsTest && hasRequiredFields) {
      // Тест 1: Только обязательные поля
      lines.push(`  test(\`\${httpMethod} с обязательными полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
      lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, requiredFieldsOnly, configApiHeaderAdmin);');
      lines.push('');
      lines.push('    const successMessage = getMessageFromResponse(response);');
      lines.push('    await expect(response.status, successMessage).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('    // TODO: Добавить проверки обязательных полей в response');
      lines.push('  });');
      lines.push('');
    }

    if (config.generateAllFieldsTest) {
      // Тест 2: Все поля
      lines.push(`  test(\`\${httpMethod} со всеми полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
      lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, allFieldsFilled, configApiHeaderAdmin);');
      lines.push('');
      lines.push('    const successMessage = getMessageFromResponse(response);');
      lines.push('    await expect(response.status, successMessage).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('    // TODO: Добавить проверки всех полей в response');
      lines.push('  });');
      lines.push('');
    }
  } else if (hasBodyParam(method)) {
    // Есть body параметр, но нет DTO - создаем базовый тест с пустым объектом
    lines.push('  // DTO для данного метода не найдено, создаем базовый позитивный тест');
    lines.push('');
    lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
    lines.push('    const testData = {}; // TODO: заполнить актуальными данными');
    lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, testData, configApiHeaderAdmin);');
    lines.push('');
    lines.push('    const successMessage = getMessageFromResponse(response);');
    lines.push('    await expect(response.status, successMessage).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('  });');
    lines.push('');
  } else {
    // Для GET/DELETE без body
    lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
    const axiosCallSuccess = generateSimpleAxiosCall(method, true);
    lines.push(`    const response = await ${axiosCallSuccess};`);
    lines.push('');
    lines.push('    const successMessage = getMessageFromResponse(response);');
    lines.push('    await expect(response.status, successMessage).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * НОВОЕ v14.0: Генерирует содержимое PAIRWISE теста для метода
 */
async function generatePairwiseTestForMethod(
  method: ExtractedMethod,
  config: PairwiseTestConfig & {
    generateOptionalCombinations: boolean;
    generateEnumTests: boolean;
    maxPairwiseCombinations: number;
    baseTestPath: string;
    axiosHelpersPath: string;
    apiTestHelperPath: string;
    groupByCategory: boolean;
  }
): Promise<string> {
  const lines: string[] = [];

  // НОВОЕ v13.0: Получаем данные из Happy Path тестов
  let happyPathData: HappyPathData[] = [];
  if (config.useHappyPathData && config.dbConnection) {
    console.log(`    📊 Получение Happy Path данных для ${method.name}...`);
    try {
      happyPathData = await fetchHappyPathData(
        method.path,
        method.httpMethod,
        {
          dbConnection: config.dbConnection,
          dbSchema: config.dbSchema,
          samplesCount: config.happyPathSamplesCount
        }
      );
    } catch (error: any) {
      console.warn(`    ⚠️  Ошибка получения Happy Path данных: ${error.message}`);
    }
  }

  // Проверяем наличие файла с данными
  const testDataDir = path.join(config.outputDir, method.category || '', 'testData');
  const testDataFileName = method.name + '.data.ts';
  const testDataFilePath = path.join(testDataDir, testDataFileName);
  const hasTestData = fs.existsSync(testDataFilePath) || happyPathData.length > 0;

  // НОВОЕ v13.0: Создаем файл с данными если есть Happy Path данные
  if (happyPathData.length > 0) {
    const categoryDir = method.category ? path.join(config.outputDir, method.category) : config.outputDir;
    createHappyPathDataFile(method.name, happyPathData, categoryDir);
  }

  // Импорты
  lines.push(`import test, { expect } from '${config.baseTestPath}';`);
  lines.push("import axios from 'axios';");
  lines.push(`import { configApiHeaderAdmin } from '${config.axiosHelpersPath}';`);
  lines.push(`import { getMessageFromResponse } from '${config.apiTestHelperPath || '../../../helpers/apiTestHelper'}';`);

  // Добавляем импорт данных если файл существует
  if (hasTestData) {
    lines.push(`import { dbTestData } from './testData/${method.name}.data';`);
  }

  lines.push('');

  // Извлекаем ID параметры из пути
  const pathParams = extractPathParams(method.path);
  const hasIdParams = pathParams.length > 0;

  // Если есть ID параметры, объявляем их заранее
  if (hasIdParams) {
    lines.push('// ID параметры для endpoint');
    for (const param of pathParams) {
      lines.push(`const ${param} = 1; // TODO: заменить на актуальный ID`);
    }
    lines.push('');
  }

  // Endpoint с подстановкой ID
  let endpointValue = method.path;
  if (hasIdParams) {
    for (const param of pathParams) {
      endpointValue = endpointValue.replace(`{${param}}`, `\${${param}}`);
    }
    lines.push(`const endpoint = \`${endpointValue}\`;`);
  } else {
    lines.push(`const endpoint = '${endpointValue}';`);
  }

  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');

  // Код успеха
  lines.push('// Код успешного ответа');
  lines.push(`const success = ${getSuccessCode(method) === 'apiErrorCodes.created' ? '201' : '200'};`);
  lines.push('');

  // Case Info
  lines.push('// Информация о тест-кейсе');
  lines.push('const caseInfoObj = {');
  lines.push(`  testCase: 'T${Math.floor(Math.random() * 10000)}',`);
  lines.push("  aqaOwner: 'AutoGenerated',");
  lines.push(`  tms_testName: '${method.httpMethod} ${method.path}',`);
  lines.push("  testType: 'api'");
  lines.push('};');
  lines.push('');

  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API PAIRWISE тесты для \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');

  if (method.bodySchema && method.bodySchema.fields.length > 0) {
    // Генерируем pairwise тестовые данные (используем dbTestData если доступно)
    const pairwiseDataSection = generatePairwiseTestDataSectionWithDb(
      method.bodySchema,
      hasTestData ? `./testData/${method.name}.data` : null
    );
    lines.push(pairwiseDataSection);
    lines.push('');

    const requiredFields = method.bodySchema.fields.filter(f => f.required);
    const optionalFields = method.bodySchema.fields.filter(f => !f.required);
    const enumFields = method.bodySchema.fields.filter(f => f.enumValues && f.enumValues.length > 0);

    // Тип 1: Комбинации необязательных полей
    if (config.generateOptionalCombinations && optionalFields.length > 0) {
      lines.push('  // Тип 1: Комбинации необязательных полей');
      lines.push('');

      const combinations = generateOptionalFieldsCombinations(optionalFields);
      const maxCombos = Math.min(combinations.length, config.maxPairwiseCombinations || 10);

      combinations.slice(0, maxCombos).forEach((combo, index) => {
        lines.push(`  test(\`\${httpMethod} pairwise комбинация ${index + 1} (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
        lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseCombo${index + 1}, configApiHeaderAdmin);`);
        lines.push('');
        lines.push('    const successMessage = getMessageFromResponse(response);');
        lines.push('    await expect(response.status, successMessage).toBe(success);');
        lines.push('    await expect(response.data).toBeDefined();');
        lines.push('  });');
        lines.push('');
      });
    }

    // Тип 2: Различные значения enum полей
    if (config.generateEnumTests && enumFields.length > 0) {
      lines.push('  // Тип 2: Различные значения enum полей');
      lines.push('');

      enumFields.forEach(field => {
        field.enumValues?.forEach((enumValue, index) => {
          lines.push(`  test(\`\${httpMethod} с ${field.name}='${enumValue}' (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
          lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseEnum_${field.name}_${index + 1}, configApiHeaderAdmin);`);
          lines.push('');
          lines.push('    const successMessage = getMessageFromResponse(response);');
          lines.push('    await expect(response.status, successMessage).toBe(success);');
          lines.push('    await expect(response.data).toBeDefined();');
          lines.push('  });');
          lines.push('');
        });
      });
    }

    if (optionalFields.length === 0 && enumFields.length === 0) {
      lines.push('  // У данного endpoint нет необязательных или enum полей для pairwise тестов');
      lines.push('');
    }
  } else {
    // Нет DTO - создаем базовые pairwise тесты
    lines.push('  // DTO для данного метода не найдено');
    lines.push('  // Создаем базовые pairwise тесты с различными наборами данных');
    lines.push('');

    // Генерируем несколько вариантов с разными данными
    for (let i = 1; i <= 3; i++) {
      lines.push(`  test(\`\${httpMethod} pairwise вариант ${i} (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
      lines.push(`    const testData = {}; // TODO: заполнить вариант ${i} данных`);
      lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, testData, configApiHeaderAdmin);');
      lines.push('');
      lines.push('    const successMessage = getMessageFromResponse(response);');
      lines.push('    await expect(response.status, successMessage).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('  });');
      lines.push('');
    }
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/**
 * Генерирует содержимое теста для метода
 */
async function generateTestForMethod(method: ExtractedMethod, config: ApiTestConfig): Promise<string> {
  const lines: string[] = [];

  // НОВОЕ v13.0: Получаем данные из Happy Path тестов
  let happyPathData: HappyPathData[] = [];
  if (config.useHappyPathData && config.dbConnection) {
    console.log(`\n  📊 Получение Happy Path данных для ${method.name}...`);
    try {
      happyPathData = await fetchHappyPathData(
        method.path,
        method.httpMethod,
        {
          dbConnection: config.dbConnection,
          dbSchema: config.dbSchema,
          samplesCount: config.happyPathSamplesCount
        }
      );
    } catch (error: any) {
      console.warn(`  ⚠️  Ошибка получения Happy Path данных: ${error.message}`);
    }
  }

  // НОВОЕ v13.0: Создаем файл с данными если есть Happy Path данные
  if (happyPathData.length > 0) {
    createHappyPathDataFile(method.name, happyPathData, config.outputDir);
  }

  // Проверяем наличие файла с данными
  const testFileName = method.name + '.test.ts';
  const testDataDir = path.join(config.outputDir, 'testData');
  const testDataFileName = method.name + '.data.ts';
  const testDataFilePath = path.join(testDataDir, testDataFileName);
  const hasTestData = fs.existsSync(testDataFilePath) || happyPathData.length > 0;

  // Импорты
  lines.push(`import test, { expect } from '${config.baseTestPath}';`);
  lines.push("import axios from 'axios';");
  lines.push(`import { configApiHeaderAdmin, configApiHeaderNoRights } from '${config.axiosHelpersPath}';`);
  lines.push(`import { getMessageFromResponse, getMessageFromError } from '${config.apiTestHelperPath || '../../../helpers/apiTestHelper'}';`);

  // Добавляем импорт данных если файл существует
  if (hasTestData) {
    lines.push(`import { dbTestData } from './testData/${method.name}.data';`);
  }
  
  lines.push('');
  
  // Извлекаем ID параметры из пути
  const pathParams = extractPathParams(method.path);
  const hasIdParams = pathParams.length > 0;
  
  // Если есть ID параметры, объявляем их заранее
  if (hasIdParams) {
    lines.push('// ID параметры для endpoint');
    for (const param of pathParams) {
      lines.push(`const ${param} = 1; // TODO: заменить на актуальный ID`);
    }
    lines.push('');
  }
  
  // Endpoint с подстановкой ID
  let endpointValue = method.path;
  if (hasIdParams) {
    for (const param of pathParams) {
      endpointValue = endpointValue.replace(`{${param}}`, `\${${param}}`);
    }
    lines.push(`const endpoint = \`${endpointValue}\`;`);
  } else {
    lines.push(`const endpoint = '${endpointValue}';`);
  }
  
  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');
  
  // Добавляем информацию о DTO
  if (method.bodySchema) {
    lines.push('// DTO информация');
    lines.push(`const dtoName = '${method.bodySchema.name}';`);
    
    // Используем dtoSourcePath если есть, иначе текущий файл
    const dtoPath = method.dtoSourcePath || config.apiFilePath;
    lines.push(`const dtoPath = '${dtoPath}';`);
    lines.push('');
  }
  
  // Добавляем placeholder для таблиц БД (будет заполнен анализатором)
  lines.push('// Таблицы БД (автоматически определяется DatabaseAnalyzer)');
  lines.push('// @db-tables:start');
  lines.push('const dbTables: string[] = []; // Будет заполнено после анализа БД');
  lines.push('// @db-tables:end');
  lines.push('');
  
  // Коды статусов
  lines.push('// Коды статусов');
  lines.push('const apiErrorCodes = {');
  lines.push('  success: 200,');
  lines.push('  created: 201,');
  lines.push('  badRequest: 400,');
  lines.push('  unauthorized: 401,');
  lines.push('  forbidden: 403,');
  lines.push('  notFound: 404,');
  lines.push('  methodNotAllowed: 405,');
  lines.push('};');
  lines.push('');
  
  lines.push('const unauthorized = apiErrorCodes.unauthorized;');
  lines.push('const badRequest = apiErrorCodes.badRequest;');
  lines.push('const forbidden = apiErrorCodes.forbidden;');
  lines.push('const notFound = apiErrorCodes.notFound;');
  lines.push('const methodNotAllowed = apiErrorCodes.methodNotAllowed;');
  lines.push(`const success = ${getSuccessCode(method)};`);
  lines.push('');
  
  // Case Info
  lines.push('// Информация о тест-кейсе');
  lines.push('const caseInfoObj = {');
  lines.push(`  testCase: 'T${Math.floor(Math.random() * 10000)}',`);
  lines.push("  aqaOwner: 'AutoGenerated',");
  lines.push(`  tms_testName: '${method.httpMethod} ${method.path}',`);
  lines.push("  testType: 'api'");
  lines.push('};');
  lines.push('');
  
  // Комментарий с проверками
  lines.push('/**');
  lines.push(' * Проверки:');
  lines.push(' * - Без токена (401)');
  if (hasBodyParam(method)) {
    lines.push(' * - С токеном но без Body (400)');
  }
  lines.push(' * - Проверка methodNotAllowed для неподдерживаемых HTTP методов');
  if (method.hasAuth) {
    lines.push(' * - С токеном пользователя без прав (403)');
  }
  if (hasIdParams) {
    lines.push(' * - С несуществующим ID (404)');
  }
  lines.push(' */');
  lines.push('');
  
  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API тесты для эндпоинта \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');
  
  // Тест 1: Без токена (401)
  if (config.generateNegativeTests) {
    lines.push(`  test(\`\${httpMethod} без TOKEN (\${unauthorized}) @api\`, async ({ page }, testInfo) => {`);
    const axiosCall = generateSimpleAxiosCall(method, false);
    lines.push(`    await ${axiosCall}.catch(async function(error) {`);
    lines.push('      await expect(error.response.status).toBe(unauthorized);');
    lines.push('      await expect(error.response.statusText).toBe("Unauthorized");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
    lines.push('      await expect(error.config.url).toContain(endpoint);');
    lines.push('    });');
    lines.push('  });');
    lines.push('');
    
    // Тест 2: С токеном но без body
    if (hasBodyParam(method)) {
      lines.push(`  test(\`\${httpMethod} с токеном без Body (\${badRequest}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoBody = generateSimpleAxiosCall(method, true, true);
      lines.push(`    await ${axiosCallNoBody}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(badRequest);');
      lines.push('      await expect(error.response.statusText).toBe("Bad Request");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
      lines.push('    });');
    lines.push('  });');
      lines.push('');
    }
    
    // Тесты 3-5: Method Not Allowed
    const otherMethods = ['GET', 'POST', 'PUT', 'DELETE'].filter(m => m !== method.httpMethod);
    for (const otherMethod of otherMethods.slice(0, 3)) {
      lines.push(`  test(\`${otherMethod} с токеном (\${methodNotAllowed}) @api\`, async ({ page }, testInfo) => {`);
      const wrongMethodCall = generateWrongMethodCall(otherMethod);
      lines.push(`    await ${wrongMethodCall}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(methodNotAllowed);');
      lines.push('      await expect(error.response.statusText).toBe("Method Not Allowed");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${otherMethod.toLowerCase()}');`);
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 6: С пользователем без прав (403)
    if (method.hasAuth) {
      lines.push(`  test(\`\${httpMethod} с пользователем без прав (\${forbidden}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoRights = generateSimpleAxiosCall(method, true, false, 'configApiHeaderNoRights');
      lines.push(`    await ${axiosCallNoRights}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(forbidden);');
      lines.push('      await expect(error.response.statusText).toBe("Forbidden");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }

    // Тест 7: 404 для несуществующего ресурса
    if (hasIdParams) {
      lines.push(`  test(\`\${httpMethod} с несуществующим ID (\${notFound}) @api\`, async ({ page }, testInfo) => {`);
      // Переопределяем ID на несуществующий
      for (const param of pathParams) {
        lines.push(`    const ${param}NotFound = 999999999;`);
      }
      const notFoundEndpoint = method.path;
      let endpointWith404 = notFoundEndpoint;
      for (const param of pathParams) {
        endpointWith404 = endpointWith404.replace(`{${param}}`, `\${${param}NotFound}`);
      }
      lines.push(`    const endpoint404 = \`${endpointWith404}\`;`);
      
      const axiosCall404 = generateSimpleAxiosCall(method, true, false, 'configApiHeaderAdmin', 'endpoint404');
      lines.push(`    await ${axiosCall404}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(notFound);');
      lines.push('      await expect(error.response.statusText).toBe("Not Found");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
  }
  
  // Позитивные тесты
  if (config.generatePositiveTests) {
    lines.push('');
    lines.push('  // ============================================');
    lines.push('  // ПОЗИТИВНЫЕ ТЕСТЫ');
    lines.push('  // ============================================');
    lines.push('');
    
    if (method.bodySchema && method.bodySchema.fields.length > 0) {
      // Генерируем тестовые данные (используем dbTestData если доступно)
      const testDataSection = generateTestDataSectionWithDb(
        method.bodySchema,
        hasTestData ? `./testData/${method.name}.data` : null
      );
      lines.push(testDataSection);
      lines.push('');
      
      const requiredFields = method.bodySchema.fields.filter(f => f.required);
      const hasRequiredFields = requiredFields.length > 0;
      
      if (hasRequiredFields) {
        // Тест 1: Только обязательные поля
        lines.push(`  test(\`\${httpMethod} с обязательными полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
        lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, requiredFieldsOnly, configApiHeaderAdmin);');
        lines.push('');
        lines.push('    await expect(response.status).toBe(success);');
        lines.push('    await expect(response.data).toBeDefined();');
        lines.push('    // TODO: Добавить проверки обязательных полей в response');
        lines.push('  });');
        lines.push('');
      } else {
        lines.push('  // У данного endpoint нет обязательных полей, поэтому тест с обязательными полями не будет создан');
        lines.push('');
      }
      
      // Тест 2: Все поля (всегда создаем если есть хоть какие-то поля)
      lines.push(`  test(\`\${httpMethod} со всеми полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
      lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, allFieldsFilled, configApiHeaderAdmin);');
      lines.push('');
      lines.push('    await expect(response.status).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('    // TODO: Добавить проверки всех полей в response');
      lines.push('  });');
      lines.push('');
    } else if (hasBodyParam(method)) {
      // Есть body параметр, но нет DTO - создаем базовый тест с пустым объектом
      lines.push('  // DTO для данного метода не найдено, создаем базовый позитивный тест');
      lines.push('');
      lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
      lines.push('    const testData = {}; // TODO: заполнить актуальными данными');
      lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, testData, configApiHeaderAdmin);');
      lines.push('');
      lines.push('    await expect(response.status).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('  });');
      lines.push('');
    } else {
      // Для GET/DELETE без body
      lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
      const axiosCallSuccess = generateSimpleAxiosCall(method, true);
      lines.push(`    const response = await ${axiosCallSuccess};`);
      lines.push('');
      lines.push('    await expect(response.status).toBe(success);');
      lines.push('    await expect(response.data).toBeDefined();');
      lines.push('  });');
      lines.push('');
    }
  }
  
  // Pairwise тесты
  if (config.generatePairwiseTests) {
    lines.push('');
    lines.push('  // ============================================');
    lines.push('  // PAIRWISE ТЕСТЫ');
    lines.push('  // ============================================');
    lines.push('');
    
    if (method.bodySchema && method.bodySchema.fields.length > 0) {
      // Генерируем pairwise тестовые данные (используем dbTestData если доступно)
      const pairwiseDataSection = generatePairwiseTestDataSectionWithDb(
        method.bodySchema,
        hasTestData ? `./testData/${method.name}.data` : null
      );
      lines.push(pairwiseDataSection);
      lines.push('');
      
      const requiredFields = method.bodySchema.fields.filter(f => f.required);
      const optionalFields = method.bodySchema.fields.filter(f => !f.required);
      const enumFields = method.bodySchema.fields.filter(f => f.enumValues && f.enumValues.length > 0);
      
      // Тип 1: Комбинации необязательных полей
      if (optionalFields.length > 0) {
        lines.push('  // Тип 1: Комбинации необязательных полей');
        lines.push('');
        
        const combinations = generateOptionalFieldsCombinations(optionalFields);
        combinations.forEach((combo, index) => {
          lines.push(`  test(\`\${httpMethod} pairwise комбинация ${index + 1} (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
          lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseCombo${index + 1}, configApiHeaderAdmin);`);
          lines.push('');
          lines.push('    await expect(response.status).toBe(success);');
          lines.push('    await expect(response.data).toBeDefined();');
          lines.push('  });');
          lines.push('');
        });
      } else if (requiredFields.length === 0) {
        lines.push('  // У данного endpoint нет необязательных полей для pairwise комбинаций');
        lines.push('');
      }
      
      // Тип 2: Различные значения enum полей
      if (enumFields.length > 0) {
        lines.push('  // Тип 2: Различные значения enum полей');
        lines.push('');
        
        enumFields.forEach(field => {
          field.enumValues?.forEach((enumValue, index) => {
            lines.push(`  test(\`\${httpMethod} с ${field.name}='${enumValue}' (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
            lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseEnum_${field.name}_${index + 1}, configApiHeaderAdmin);`);
            lines.push('');
            lines.push('    await expect(response.status).toBe(success);');
            lines.push('    await expect(response.data).toBeDefined();');
            lines.push('  });');
            lines.push('');
          });
        });
      } else if (optionalFields.length === 0) {
        lines.push('  // У данного endpoint нет enum полей для pairwise тестов');
        lines.push('');
      }
    } else {
      // Нет DTO - создаем базовые pairwise тесты
      lines.push('  // DTO для данного метода не найдено');
      lines.push('  // Создаем базовые pairwise тесты с различными наборами данных');
      lines.push('');
      
      // Генерируем несколько вариантов с разными данными
      for (let i = 1; i <= 3; i++) {
        lines.push(`  test(\`\${httpMethod} pairwise вариант ${i} (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
        lines.push(`    const testData = {}; // TODO: заполнить вариант ${i} данных`);
        lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, testData, configApiHeaderAdmin);');
        lines.push('');
        lines.push('    await expect(response.status).toBe(success);');
        lines.push('    await expect(response.data).toBeDefined();');
        lines.push('  });');
        lines.push('');
      }
    }
  }
  
  lines.push('});');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Генерирует простой axios вызов с использованием process.env.StandURL
 */
function generateSimpleAxiosCall(
  method: ExtractedMethod,
  withAuth: boolean,
  emptyBody: boolean = false,
  configVar: string = 'configApiHeaderAdmin',
  endpointVar: string = 'endpoint'
): string {
  const axiosMethod = method.httpMethod.toLowerCase();
  const url = `process.env.StandURL + ${endpointVar}`;
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    if (withAuth) {
      return `axios.${axiosMethod}(${url}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${url})`;
    }
  } else {
    // POST, PUT, PATCH
    const body = emptyBody ? '{}' : '{ /* TODO: заполнить тестовыми данными */ }';
    if (withAuth) {
      return `axios.${axiosMethod}(${url}, ${body}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${url}, ${body})`;
    }
  }
}

/**
 * Генерирует вызов с неправильным HTTP методом
 */
function generateWrongMethodCall(wrongMethod: string): string {
  const axiosMethod = wrongMethod.toLowerCase();
  const url = 'process.env.StandURL + endpoint';
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    return `axios.${axiosMethod}(${url}, configApiHeaderAdmin)`;
  } else {
    return `axios.${axiosMethod}(${url}, {}, configApiHeaderAdmin)`;
  }
}

/**
 * Извлекает path параметры из пути
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/[{}]/g, ''));
}

/**
 * Определяет код успеха для метода
 */
function getSuccessCode(method: ExtractedMethod): string {
  if (method.httpMethod === 'POST') {
    return 'apiErrorCodes.created';
  }
  return 'apiErrorCodes.success';
}

/**
 * Проверяет есть ли body параметр
 */
function hasBodyParam(method: ExtractedMethod): boolean {
  return method.parameters.some(p => p === 'body' || p === 'data') ||
         ['POST', 'PUT', 'PATCH'].includes(method.httpMethod);
}

/**
 * Генерирует блок проверок для негативного теста с кастомными сообщениями
 */
function generateNegativeTestChecks(method: ExtractedMethod, expectedStatus: string, checkUrl: boolean = true): string[] {
  const lines: string[] = [];
  
  lines.push(`      await expect(error.response.status, getMessageFromError(error)).toBe(${expectedStatus});`);
  lines.push('      await expect(error.response.statusText).toBe("' + getStatusText(expectedStatus) + '");');
  lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
  lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
  
  if (checkUrl) {
    lines.push('      await expect(error.config.url).toContain(endpoint);');
  }
  
  return lines;
}

/**
 * Генерирует блок проверок для позитивного теста с кастомными сообщениями
 */
function generatePositiveTestChecks(successCode: string): string[] {
  const lines: string[] = [];
  
  lines.push(`    await expect(response.status, getMessageFromResponse(response)).toBe(${successCode});`);
  lines.push('    await expect(response.data).toBeDefined();');
  
  return lines;
}

/**
 * Возвращает текст статуса по коду
 */
function getStatusText(statusCode: string): string {
  const statusTexts: Record<string, string> = {
    'unauthorized': 'Unauthorized',
    'badRequest': 'Bad Request',
    'forbidden': 'Forbidden',
    'notFound': 'Not Found',
    'methodNotAllowed': 'Method Not Allowed',
  };
  
  return statusTexts[statusCode] || 'Error';
}

/**
 * Генерирует секцию с тестовыми данными из dbTestData
 */
function generateTestDataSectionWithDb(
  schema: DTOSchema,
  testDataFilePath: string | null
): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для позитивных тестов');
  lines.push('');
  
  const requiredFields = schema.fields.filter(f => f.required);
  const hasRequiredFields = requiredFields.length > 0;
  
  if (testDataFilePath) {
    // Есть данные из БД - используем их!
    lines.push('  // Используем данные из БД');
    
    // Получаем случайные записи для вариативности
    lines.push('  const dbRecords = Object.values(dbTestData).flat();');
    lines.push('  const getRandomRecord = () => dbRecords[Math.floor(Math.random() * dbRecords.length)];');
    lines.push('  const record1 = getRandomRecord();');
    lines.push('  const record2 = getRandomRecord();');
    lines.push('  const record3 = getRandomRecord();');
    lines.push('');
    
    // Функция для маппинга полей
    lines.push('  // Функция для маппинга данных из БД в DTO');
    lines.push('  const mapToDto = (record: any, fields: string[]) => {');
    lines.push('    const result: any = {};');
    lines.push('    for (const field of fields) {');
    lines.push('      // Пробуем разные варианты названий');
    lines.push('      const snakeCase = field.replace(/([A-Z])/g, "_$1").toLowerCase();');
    lines.push('      result[field] = record[field] ?? record[snakeCase] ?? record[field.toLowerCase()];');
    lines.push('    }');
    lines.push('    return result;');
    lines.push('  };');
    lines.push('');
    
    // Только обязательные поля
    if (hasRequiredFields) {
      lines.push('  // Объект с только обязательными полями (из БД)');
      lines.push('  const requiredFieldsOnly = mapToDto(record1, [');
      requiredFields.forEach((field, index) => {
        const comma = index < requiredFields.length - 1 ? ',' : '';
        lines.push(`    '${field.name}'${comma}`);
      });
      lines.push('  ]);');
      lines.push('');
    }
    
    // Все поля
    if (schema.fields.length > 0) {
      lines.push('  // Объект со всеми полями (из БД)');
      lines.push('  const allFieldsFilled = mapToDto(record2, [');
      schema.fields.forEach((field, index) => {
        const comma = index < schema.fields.length - 1 ? ',' : '';
        lines.push(`    '${field.name}'${comma}`);
      });
      lines.push('  ]);');
    }
  } else {
    // Нет данных из БД - генерируем моки (старый способ)
    lines.push('  // Данные из БД отсутствуют, используются моки');
    lines.push('  // Запустите analyzeAndGenerateTestData для генерации реальных данных');
    lines.push('');
    
    // Только обязательные поля (если есть)
    if (hasRequiredFields) {
      lines.push('  // Объект с только обязательными полями');
      lines.push('  const requiredFieldsOnly = {');
      requiredFields.forEach((field, index) => {
        const value = generateMockValue(field);
        const comma = index < requiredFields.length - 1 ? ',' : '';
        lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
      });
      lines.push('  };');
      lines.push('');
    }
    
    // Все поля
    if (schema.fields.length > 0) {
      lines.push('  // Объект со всеми полями');
      lines.push('  const allFieldsFilled = {');
      schema.fields.forEach((field, index) => {
        const value = generateMockValue(field);
        const comma = index < schema.fields.length - 1 ? ',' : '';
        lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
      });
      lines.push('  };');
    }
  }
  
  return lines.join('\n');
}

/**
 * Генерирует секцию с тестовыми данными
 */
function generateTestDataSection(schema: DTOSchema): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для позитивных тестов');
  lines.push('');
  
  const requiredFields = schema.fields.filter(f => f.required);
  const hasRequiredFields = requiredFields.length > 0;
  
  // Только обязательные поля (если есть)
  if (hasRequiredFields) {
    lines.push('  // Объект с только обязательными полями');
    lines.push('  const requiredFieldsOnly = {');
    requiredFields.forEach((field, index) => {
      const value = generateMockValue(field);
      const comma = index < requiredFields.length - 1 ? ',' : '';
      lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
    });
    lines.push('  };');
    lines.push('');
  }
  
  // Все поля
  if (schema.fields.length > 0) {
    lines.push('  // Объект со всеми полями');
    lines.push('  const allFieldsFilled = {');
    schema.fields.forEach((field, index) => {
      const value = generateMockValue(field);
      const comma = index < schema.fields.length - 1 ? ',' : '';
      lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
    });
    lines.push('  };');
  }
  
  return lines.join('\n');
}

/**
 * Генерирует секцию с pairwise тестовыми данными из dbTestData
 */
function generatePairwiseTestDataSectionWithDb(
  schema: DTOSchema,
  testDataFilePath: string | null
): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для pairwise тестов');
  lines.push('');
  
  const requiredFields = schema.fields.filter(f => f.required);
  const optionalFields = schema.fields.filter(f => !f.required);
  
  if (testDataFilePath) {
    // Есть данные из БД - используем их для pairwise!
    lines.push('  // Используем разные записи из БД для pairwise комбинаций');
    lines.push('  const dbRecords = Object.values(dbTestData).flat();');
    lines.push('');
    
    // Функция для маппинга
    lines.push('  const mapToDto = (record: any, fields: string[]) => {');
    lines.push('    const result: any = {};');
    lines.push('    for (const field of fields) {');
    lines.push('      const snakeCase = field.replace(/([A-Z])/g, "_$1").toLowerCase();');
    lines.push('      result[field] = record[field] ?? record[snakeCase] ?? record[field.toLowerCase()];');
    lines.push('    }');
    lines.push('    return result;');
    lines.push('  };');
    lines.push('');
    
    // Комбинации необязательных полей
    if (optionalFields.length > 0) {
      const combinations = generateOptionalFieldsCombinations(optionalFields);
      
      combinations.forEach((combo, index) => {
        const recordIndex = index % 15; // Используем разные записи (макс 15)
        
        lines.push(`  // Комбинация ${index + 1}: запись ${recordIndex} из БД`);
        lines.push(`  const record${index + 1} = dbRecords[${recordIndex}] || dbRecords[0];`);
        lines.push(`  const pairwiseCombo${index + 1} = {`);
        
        // Обязательные поля из записи
        lines.push('    ...' + `mapToDto(record${index + 1}, [${requiredFields.map(f => `'${f.name}'`).join(', ')}]),`);
        
        // Выбранные необязательные поля из той же записи
        lines.push('    ...' + `mapToDto(record${index + 1}, [${combo.map(f => `'${f.name}'`).join(', ')}])`);
        
        lines.push('  };');
        lines.push('');
      });
    }
  } else {
    // Нет данных из БД - генерируем моки (старый способ)
    lines.push('  // Данные из БД отсутствуют, используются моки');
    lines.push('  // Запустите analyzeAndGenerateTestData для генерации реальных данных');
    lines.push('');
    
    // Комбинации необязательных полей
    if (optionalFields.length > 0) {
      const combinations = generateOptionalFieldsCombinations(optionalFields);
      
      combinations.forEach((combo, index) => {
        lines.push(`  // Комбинация ${index + 1}: обязательные поля + ${combo.map(f => f.name).join(', ')}`);
        lines.push(`  const pairwiseCombo${index + 1} = {`);
        
        // Обязательные поля
        requiredFields.forEach(field => {
          const value = generateMockValue(field);
          lines.push(`    ${field.name}: ${value},`);
        });
        
        // Выбранные необязательные поля
        combo.forEach((field, fieldIndex) => {
          const value = generateMockValue(field);
          const comma = fieldIndex < combo.length - 1 ? ',' : '';
          lines.push(`    ${field.name}: ${value}${comma}`);
        });
        
        lines.push('  };');
        lines.push('');
      });
    }
  }
  
  return lines.join('\n');
}

/**
 * Генерирует секцию с pairwise тестовыми данными
 */
function generatePairwiseTestDataSection(schema: DTOSchema): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для pairwise тестов');
  lines.push('');
  
  const requiredFields = schema.fields.filter(f => f.required);
  const optionalFields = schema.fields.filter(f => !f.required);
  const enumFields = schema.fields.filter(f => f.enumValues && f.enumValues.length > 0);
  
  // Комбинации необязательных полей
  if (optionalFields.length > 0) {
    const combinations = generateOptionalFieldsCombinations(optionalFields);
    
    combinations.forEach((combo, index) => {
      lines.push(`  // Комбинация ${index + 1}: обязательные поля + ${combo.map(f => f.name).join(', ')}`);
      lines.push(`  const pairwiseCombo${index + 1} = {`);
      
      // Обязательные поля
      requiredFields.forEach(field => {
        const value = generateMockValue(field);
        lines.push(`    ${field.name}: ${value},`);
      });
      
      // Выбранные необязательные поля
      combo.forEach((field, fieldIndex) => {
        const value = generateMockValue(field);
        const comma = fieldIndex < combo.length - 1 ? ',' : '';
        lines.push(`    ${field.name}: ${value}${comma}`);
      });
      
      lines.push('  };');
      lines.push('');
    });
  }
  
  // Различные значения enum полей
  if (enumFields.length > 0) {
    enumFields.forEach(field => {
      field.enumValues?.forEach((enumValue, index) => {
        lines.push(`  // Тест с ${field.name} = '${enumValue}'`);
        lines.push(`  const pairwiseEnum_${field.name}_${index + 1} = {`);
        
        // Обязательные поля
        requiredFields.forEach(reqField => {
          const value = generateMockValue(reqField);
          lines.push(`    ${reqField.name}: ${value},`);
        });
        
        // Enum поле с конкретным значением
        lines.push(`    ${field.name}: '${enumValue}'`);
        
        lines.push('  };');
        lines.push('');
      });
    });
  }
  
  return lines.join('\n');
}

/**
 * Генерирует моковое значение для поля
 */
function generateMockValue(field: DTOField): string {
  // Если есть enum значения
  if (field.enumValues && field.enumValues.length > 0) {
    return `'${field.enumValues[0]}'`;
  }
  
  // Определяем тип
  const type = field.type.toLowerCase();
  
  if (type.includes('string')) {
    if (field.name.toLowerCase().includes('email')) {
      return field.isArray ? "['test@example.com']" : "'test@example.com'";
    }
    if (field.name.toLowerCase().includes('name')) {
      return field.isArray ? "['Test Name']" : "'Test Name'";
    }
    if (field.name.toLowerCase().includes('url')) {
      return field.isArray ? "['https://example.com']" : "'https://example.com'";
    }
    return field.isArray ? "['test']" : "'test'";
  }
  
  if (type.includes('number') || type.includes('integer')) {
    if (field.name.toLowerCase().includes('id')) {
      return field.isArray ? '[1]' : '1';
    }
    return field.isArray ? '[100]' : '100';
  }
  
  if (type.includes('boolean') || type.includes('bool')) {
    return field.isArray ? '[true]' : 'true';
  }
  
  if (type.includes('date')) {
    return field.isArray ? "['2024-01-01']" : "'2024-01-01'";
  }
  
  // По умолчанию
  return field.isArray ? '[]' : 'null';
}

/**
 * Генерирует комбинации необязательных полей для pairwise тестов
 */
function generateOptionalFieldsCombinations(optionalFields: DTOField[]): DTOField[][] {
  const combinations: DTOField[][] = [];
  const maxCombinations = Math.min(10, optionalFields.length + 1);
  
  // Комбинация 1: без необязательных полей (уже есть в requiredFieldsOnly)
  // Комбинация 2: с одним необязательным полем
  if (optionalFields.length > 0) {
    combinations.push([optionalFields[0]]);
  }
  
  // Комбинация 3: с двумя необязательными полями
  if (optionalFields.length > 1) {
    combinations.push([optionalFields[0], optionalFields[1]]);
  }
  
  // Комбинация 4: с тремя необязательными полями
  if (optionalFields.length > 2) {
    combinations.push([optionalFields[0], optionalFields[1], optionalFields[2]]);
  }
  
  // Комбинация 5: с половиной необязательных полей
  if (optionalFields.length > 3) {
    const halfCount = Math.floor(optionalFields.length / 2);
    combinations.push(optionalFields.slice(0, halfCount));
  }
  
  // Комбинация 6: со всеми необязательными полями (кроме одного)
  if (optionalFields.length > 4) {
    combinations.push(optionalFields.slice(0, -1));
  }
  
  // Дополнительные комбинации если полей много
  if (optionalFields.length > 5) {
    // Каждое второе поле
    const everySecond = optionalFields.filter((_, index) => index % 2 === 0);
    combinations.push(everySecond);
  }
  
  if (optionalFields.length > 7) {
    // Каждое третье поле
    const everyThird = optionalFields.filter((_, index) => index % 3 === 0);
    combinations.push(everyThird);
  }
  
  return combinations.slice(0, maxCombinations);
}

/**
 * Проверяет есть ли тег ReadOnly на весь файл
 */
function hasReadOnlyTag(content: string): boolean {
  // Ищем комментарий // @readonly или /* @readonly */ в начале файла (первые 500 символов)
  const header = content.substring(0, 500);
  return header.includes('@readonly') || header.includes('@read-only') || header.includes('@READONLY');
}

/**
 * Извлекает protected области из файла
 */
function extractProtectedAreas(content: string): Map<string, string> {
  const protectedAreas = new Map<string, string>();
  
  // Ищем блоки /* @protected:start:ID */ ... /* @protected:end:ID */
  const protectedRegex = /\/\*\s*@protected:start:(\w+)\s*\*\/([\s\S]*?)\/\*\s*@protected:end:\1\s*\*\//g;
  
  let match;
  while ((match = protectedRegex.exec(content)) !== null) {
    const id = match[1];
    const protectedContent = match[2];
    protectedAreas.set(id, protectedContent);
  }
  
  // Также ищем блоки // @protected:start:ID ... // @protected:end:ID
  const protectedLineRegex = /\/\/\s*@protected:start:(\w+)\s*\n([\s\S]*?)\/\/\s*@protected:end:\1\s*\n/g;
  
  while ((match = protectedLineRegex.exec(content)) !== null) {
    const id = match[1];
    const protectedContent = match[2];
    protectedAreas.set(id, protectedContent);
  }
  
  return protectedAreas;
}

/**
 * Восстанавливает protected области в новом контенте
 */
function restoreProtectedAreas(newContent: string, protectedAreas: Map<string, string>): string {
  let result = newContent;
  
  // Заменяем блоки /* @protected:start:ID */ ... /* @protected:end:ID */
  for (const [id, protectedContent] of protectedAreas.entries()) {
    // Ищем placeholder в новом контенте
    const placeholderMultiline = new RegExp(
      `\\/\\*\\s*@protected:start:${id}\\s*\\*\\/[\\s\\S]*?\\/\\*\\s*@protected:end:${id}\\s*\\*\\/`,
      'g'
    );
    
    const replacement = `/* @protected:start:${id} */${protectedContent}/* @protected:end:${id} */`;
    result = result.replace(placeholderMultiline, replacement);
    
    // Также обрабатываем однострочные комментарии
    const placeholderLine = new RegExp(
      `\\/\\/\\s*@protected:start:${id}\\s*\\n[\\s\\S]*?\\/\\/\\s*@protected:end:${id}\\s*\\n`,
      'g'
    );
    
    const replacementLine = `// @protected:start:${id}\n${protectedContent}// @protected:end:${id}\n`;
    result = result.replace(placeholderLine, replacementLine);
  }
  
  return result;
}
