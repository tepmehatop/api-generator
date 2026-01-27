/**
 * Генератор Happy Path API тестов
 * ВЕРСИЯ 12.0 - ДЕДУПЛИКАЦИЯ И ВАЛИДАЦИЯ ДАННЫХ
 *
 * ИСПРАВЛЕНИЯ:
 * 1. Конфигурируемый импорт test/expect (testImportPath)
 * 2. В apiErrorCodes только 200-ые коды
 * 3. Описание теста с рандомным номером
 * 4. Запросы через catch с детальным выводом
 * 5. Применены deepCompareObjects, generateTypeValidationCode, findDtoForEndpoint
 * 6. generateTypeValidationCode на основе DTO
 * 7. normalizeDbDataByDto на основе типов из DTO
 * 8. Исправлен mergeDuplicateTests (нормализация endpoint)
 * 9. createSeparateDataFiles - нормализация во внешнем файле
 * 10. Импорт DTO в тест
 * 11. Динамический импорт compareDbWithResponse из NPM пакета (packageName)
 * 12. Реальный endpoint с подставленными ID вместо {id}
 * 13. Улучшенный вывод различий с цветами (блочный формат)
 * 14. НОВОЕ: Дедупликация тестов (Идея 1 + 2)
 * 15. НОВОЕ: Валидация данных (Стратегия 1 - проверка актуальности)
 */

import * as fs from 'fs';
import * as path from 'path';
import { findDtoForEndpoint, generateDtoValidationCode, DTOInfo } from './utils/dto-finder';
import { generateTypeValidationCode } from './utils/type-validator';
import {
  compareDbWithResponse,
  normalizeDbData,
  normalizeDbDataByDto
} from './utils/data-comparison';
import { deduplicateTests } from './utils/test-deduplication';
import { validateRequests } from './utils/data-validation';
import axios from 'axios';

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

  standUrlEnvVar?: string;
  axiosConfigName?: string;
  axiosConfigPath?: string;
  apiGeneratedPath?: string;
  createSeparateDataFiles?: boolean;
  mergeDuplicateTests?: boolean;

  // НОВОЕ: Откуда импортировать test и expect
  testImportPath?: string; // По умолчанию '@playwright/test'

  // НОВОЕ: Название NPM пакета для импорта утилит
  packageName?: string; // По умолчанию '@your-company/api-codegen'

  // НОВОЕ v12.0: Дедупликация тестов
  deduplication?: {
    enabled?: boolean; // По умолчанию true
    ignoreFields?: string[]; // Поля которые игнорируем при сравнении (id, *_id, created_at и т.д.)
    significantFields?: string[]; // Поля которые важны (status, type, role и т.д.)
    detectEdgeCases?: boolean; // Обнаруживать edge cases (пустые массивы, null и т.д.)
    maxTestsPerEndpoint?: number; // Максимум тестов на эндпоинт (перегружает основной maxTestsPerEndpoint)
    preserveTaggedTests?: string[]; // Теги которые защищают тест от удаления ([KEEP], [IMPORTANT])
  };

  // НОВОЕ v12.0: Валидация данных (проверка актуальности)
  dataValidation?: {
    enabled?: boolean; // По умолчанию true
    validateBeforeGeneration?: boolean; // Проверять актуальность данных перед генерацией
    onStaleData?: 'update' | 'skip' | 'delete'; // Что делать с устаревшими данными
    staleIfChanged?: string[]; // Какие поля определяют что данные устарели (status, state и т.д.)
    allowChanges?: string[]; // Какие изменения допустимы (timestamps, даты)
    validateInDatabase?: boolean; // Проверять данные в БД стенда
    standUrl?: string; // URL стенда для валидации (по умолчанию process.env[standUrlEnvVar])
    axiosConfig?: any; // Конфиг axios для валидации
    logChanges?: boolean; // Логировать изменения данных
    logPath?: string; // Путь для логов
  };

  // НОВОЕ v13.0: Debug режим
  debug?: boolean; // Детальное логирование для отладки (default: false)
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

/**
 * НОВОЕ v13.0: Рекурсивный поиск файла в директории
 */
function findFileRecursively(
  dir: string,
  fileName: string,
  maxDepth: number = 5,
  currentDepth: number = 0
): string | null {
  if (currentDepth > maxDepth) return null;

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      // Пропускаем node_modules, .git и другие служебные папки
      if (item === 'node_modules' || item === '.git' || item.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, item);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
          // Проверяем имя файла (без расширения и с расширениями .ts/.js)
          const baseName = path.basename(item, path.extname(item));
          if (baseName === fileName || item === fileName || item === `${fileName}.ts` || item === `${fileName}.js`) {
            return fullPath;
          }
        } else if (stat.isDirectory()) {
          // Рекурсивно ищем в поддиректориях
          const found = findFileRecursively(fullPath, fileName, maxDepth, currentDepth + 1);
          if (found) return found;
        }
      } catch (err) {
        // Пропускаем файлы/папки к которым нет доступа
        continue;
      }
    }
  } catch (err) {
    return null;
  }

  return null;
}

/**
 * НОВОЕ v13.0: Умный поиск axios конфига с несколькими стратегиями
 */
async function findAndLoadAxiosConfig(
  configPath: string | undefined,
  configName: string,
  debug: boolean = false
): Promise<any | null> {
  const searchPaths: string[] = [];
  const cwd = process.cwd();

  if (debug) {
    console.log(`🐛 Текущая рабочая директория: ${cwd}`);
    console.log(`🐛 Ищем axios конфиг: ${configName}`);
  }

  // Стратегия 1: Попробовать указанный путь как есть
  if (configPath) {
    searchPaths.push(configPath);

    // Стратегия 2: Попробовать путь относительно cwd
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.join(cwd, configPath);
    searchPaths.push(absolutePath);

    // Добавляем варианты с расширениями
    searchPaths.push(absolutePath + '.ts');
    searchPaths.push(absolutePath + '.js');
  }

  // Стратегия 3: Поиск по имени файла
  const fileNameFromPath = configPath
    ? path.basename(configPath, path.extname(configPath))
    : 'axiosHelpers';

  if (debug) {
    console.log(`🐛 Имя файла для поиска: ${fileNameFromPath}`);
    console.log(`🐛 Стратегии поиска:`);
    console.log(`   1. Указанный путь: ${configPath || 'не указан'}`);
    console.log(`   2. Относительно cwd: ${cwd}`);
    console.log(`   3. Рекурсивный поиск по имени: ${fileNameFromPath}`);
  }

  // Пробуем каждый путь
  for (const searchPath of searchPaths) {
    if (debug) {
      console.log(`🐛 Пробую путь: ${searchPath}`);
    }

    try {
      const module = await import(searchPath);
      if (module[configName]) {
        if (debug) {
          console.log(`✓ Найден конфиг по пути: ${searchPath}`);
        }
        return module[configName];
      } else {
        if (debug) {
          console.log(`   ⚠️  Файл найден, но не содержит '${configName}'`);
          console.log(`   Доступные экспорты:`, Object.keys(module));
        }
      }
    } catch (error: any) {
      if (debug && !error.message.includes('Cannot find module')) {
        console.log(`   ⚠️  Ошибка загрузки: ${error.message}`);
      }
    }
  }

  // Стратегия 4: Рекурсивный поиск файла
  if (debug) {
    console.log(`🐛 Начинаю рекурсивный поиск файла '${fileNameFromPath}' в ${cwd}...`);
  }

  const foundPath = findFileRecursively(cwd, fileNameFromPath);

  if (foundPath) {
    if (debug) {
      console.log(`🐛 Файл найден: ${foundPath}`);
    }

    // Пробуем разные способы загрузки
    const pathsToTry: string[] = [foundPath];

    // Если это .ts файл, ищем скомпилированную .js версию
    if (foundPath.endsWith('.ts')) {
      const jsPath = foundPath.replace(/\.ts$/, '.js');
      pathsToTry.push(jsPath);

      // Также пробуем в dist/build папках
      const dirName = path.dirname(foundPath);
      const baseName = path.basename(foundPath, '.ts');
      pathsToTry.push(path.join(dirName, '..', 'dist', baseName + '.js'));
      pathsToTry.push(path.join(dirName, '..', 'build', baseName + '.js'));
      pathsToTry.push(path.join(dirName, 'dist', baseName + '.js'));
    }

    for (const tryPath of pathsToTry) {
      if (!fs.existsSync(tryPath)) continue;

      if (debug) {
        console.log(`🐛 Пробую загрузить: ${tryPath}`);
      }

      try {
        // Способ 1: Динамический import с file:// протоколом
        let module: any;

        try {
          // Правильный формат file:// URL для разных платформ
          const fileUrl = new URL('file://' + (tryPath.startsWith('/') ? '' : '/') + tryPath.replace(/\\/g, '/')).href;
          if (debug) {
            console.log(`🐛   Пробую import с URL: ${fileUrl}`);
          }
          module = await import(fileUrl);
        } catch (importError: any) {
          if (debug) {
            console.log(`🐛   Import не сработал: ${importError.message}`);
          }

          // Способ 2: Используем require (для CommonJS)
          try {
            if (debug) {
              console.log(`🐛   Пробую require: ${tryPath}`);
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            module = require(tryPath);
          } catch (requireError: any) {
            if (debug) {
              console.log(`🐛   Require не сработал: ${requireError.message}`);
            }
            continue;
          }
        }

        // Проверяем наличие конфига
        if (module && module[configName]) {
          if (debug) {
            console.log(`✓ Конфиг '${configName}' найден в файле: ${tryPath}`);
          }
          return module[configName];
        } else if (module && module.default && module.default[configName]) {
          // Проверяем default export
          if (debug) {
            console.log(`✓ Конфиг '${configName}' найден в default export файла: ${tryPath}`);
          }
          return module.default[configName];
        } else {
          if (debug) {
            const availableKeys = module ? Object.keys(module) : [];
            console.log(`⚠️  Файл загружен, но не содержит '${configName}'`);
            console.log(`   Доступные экспорты:`, availableKeys);
            if (module?.default) {
              console.log(`   Экспорты в default:`, Object.keys(module.default));
            }
          }
        }
      } catch (error: any) {
        if (debug) {
          console.log(`❌ Ошибка при загрузке ${tryPath}: ${error.message}`);
        }
      }
    }
  } else {
    if (debug) {
      console.log(`⚠️  Файл '${fileNameFromPath}' не найден в проекте`);
    }
  }

  return null;
}

export class HappyPathTestGenerator {
  private sql: any;
  private config: Required<HappyPathTestConfig>;

  constructor(config: HappyPathTestConfig, sqlConnection: any) {
    // Читаем package.json для получения названия пакета
    let defaultPackageName = '@your-company/api-codegen';
    try {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        defaultPackageName = packageJson.name || defaultPackageName;
      }
    } catch (error) {
      console.warn('⚠️  Не удалось прочитать package.json, используется название по умолчанию');
    }

    this.config = {
      endpointFilter: [],
      methodFilter: [],
      maxTestsPerEndpoint: 5,
      onlySuccessful: true,
      testTag: '@apiHappyPath',
      force: false,
      dbSchema: 'qa',
      standUrlEnvVar: 'StandURL',
      axiosConfigName: 'configApiHeaderAdmin',
      axiosConfigPath: '../../../helpers/axiosHelpers',
      apiGeneratedPath: '',
      createSeparateDataFiles: false,
      mergeDuplicateTests: true,
      testImportPath: '@playwright/test', // ИСПРАВЛЕНИЕ 1
      packageName: defaultPackageName, // ИСПРАВЛЕНИЕ 11: Автоматически из package.json
      debug: false, // НОВОЕ v13.0: Debug режим по умолчанию выключен
      ...config,

      // НОВОЕ v12.0: Дефолтные настройки дедупликации
      deduplication: {
        enabled: true,
        ignoreFields: ['id', '*_id', 'created_at', 'updated_at', 'modified_at', 'deleted_at', 'timestamp', '*_timestamp', 'uuid', 'guid'],
        significantFields: ['status', 'state', 'type', 'role', 'category', 'kind'],
        detectEdgeCases: true,
        maxTestsPerEndpoint: 2, // Максимум 2 теста на эндпоинт (как указал пользователь)
        preserveTaggedTests: ['[KEEP]', '[IMPORTANT]'],
        ...(config.deduplication || {})
      },

      // НОВОЕ v12.0: Дефолтные настройки валидации
      dataValidation: {
        enabled: true,
        validateBeforeGeneration: true,
        onStaleData: 'delete', // Удаляем устаревшие (как указал пользователь)
        staleIfChanged: ['status', 'state', 'type', 'role', 'category'],
        allowChanges: ['updated_at', 'modified_at', '*_timestamp', '*_at'],
        validateInDatabase: false, // По умолчанию выключено (нужна настройка)
        standUrl: undefined,
        axiosConfig: undefined,
        logChanges: true,
        logPath: './happy-path-validation-logs',
        ...(config.dataValidation || {})
      }
    };

    this.sql = sqlConnection;
  }

  async generate(): Promise<void> {
    console.log('🔍 Подключаюсь к БД и собираю данные...');
    console.log(this.config.force ? '⚠️  FORCE режим' : 'ℹ️  Инкрементальный режим');

    if (this.config.debug) {
      console.log('🐛 DEBUG MODE: Включен детальный вывод');
      console.log('🐛 Конфигурация:', JSON.stringify({
        standUrlEnvVar: this.config.standUrlEnvVar,
        standUrl: process.env[this.config.standUrlEnvVar],
        axiosConfigName: this.config.axiosConfigName,
        axiosConfigPath: this.config.axiosConfigPath,
        dbSchema: this.config.dbSchema
      }, null, 2));
    }

    let uniqueRequests = await this.fetchUniqueRequests();
    console.log(`📊 Найдено ${uniqueRequests.length} уникальных запросов`);

    // НОВОЕ v12.0: Валидация данных (проверка актуальности)
    if (this.config.dataValidation.enabled && this.config.dataValidation.validateBeforeGeneration) {
      try {
        // НОВОЕ v13.0: Умная загрузка axios конфига с автопоиском
        let axiosConfigObject: any = undefined;

        if (this.config.axiosConfigName) {
          console.log(`\n🔍 Поиск axios конфига '${this.config.axiosConfigName}'...`);

          const loadedAxiosConfig = await findAndLoadAxiosConfig(
            this.config.axiosConfigPath,
            this.config.axiosConfigName,
            this.config.debug
          );

          if (loadedAxiosConfig) {
            console.log(`✓ Axios конфиг '${this.config.axiosConfigName}' загружен успешно`);

            // Проверяем: это axios instance или просто объект конфигурации?
            const isAxiosInstance = typeof loadedAxiosConfig?.get === 'function';

            if (isAxiosInstance) {
              // Это axios instance - извлекаем конфиг
              axiosConfigObject = loadedAxiosConfig.defaults;

              if (this.config.debug) {
                console.log(`🐛 Загружен axios instance`);
                console.log(`🐛 Конфиг содержит:`, {
                  hasHeaders: !!axiosConfigObject?.headers,
                  hasAuth: !!axiosConfigObject?.headers?.Authorization,
                  baseURL: axiosConfigObject?.baseURL
                });
              }
            } else {
              // Это просто объект конфигурации
              axiosConfigObject = loadedAxiosConfig;

              if (this.config.debug) {
                console.log(`🐛 Загружен объект конфигурации`);
                console.log(`🐛 Конфиг содержит:`, {
                  hasHeaders: !!axiosConfigObject?.headers,
                  hasAuth: !!axiosConfigObject?.headers?.authorization || !!axiosConfigObject?.headers?.Authorization,
                  hasHttpsAgent: !!axiosConfigObject?.httpsAgent
                });
              }
            }

            // Показываем все заголовки в debug режиме
            if (this.config.debug && axiosConfigObject?.headers) {
              console.log(`🐛 Все заголовки:`, JSON.stringify(axiosConfigObject.headers, null, 2));
            }
          } else {
            console.warn(`⚠️  Не удалось найти axios конфиг '${this.config.axiosConfigName}'`);
            console.warn(`⚠️  Продолжаю без авторизации (могут быть 401 ошибки)`);
          }
        }

        // Получаем URL стенда из переменной окружения
        const standUrl = process.env[this.config.standUrlEnvVar];

        if (!standUrl) {
          console.warn(`⚠️  Переменная окружения ${this.config.standUrlEnvVar} не установлена`);
          if (this.config.debug) {
            console.log(`🐛 Доступные env переменные:`, Object.keys(process.env).filter(k => k.includes('URL')));
          }
        } else if (this.config.debug) {
          console.log(`🐛 Stand URL: ${standUrl}`);
        }

        // Обновляем конфиг валидации с правильными настройками
        const validationConfig = {
          ...this.config.dataValidation,
          standUrl: standUrl || this.config.dataValidation.standUrl,
          axiosConfig: axiosConfigObject
        };

        if (this.config.debug) {
          console.log(`🐛 Конфиг валидации:`, {
            enabled: validationConfig.enabled,
            validateBeforeGeneration: validationConfig.validateBeforeGeneration,
            standUrl: validationConfig.standUrl,
            hasAxiosConfig: !!validationConfig.axiosConfig,
            hasAuthHeader: !!validationConfig.axiosConfig?.headers?.authorization || !!validationConfig.axiosConfig?.headers?.Authorization
          });
        }

        // ВАЖНО: Передаем настоящий axios, а конфиг - отдельно в validationConfig
        const validationResult = await validateRequests(
          uniqueRequests,
          validationConfig,
          axios  // ← Настоящий axios, не конфиг!
        );

        uniqueRequests = validationResult.validRequests;

        console.log(`\n✅ Валидация завершена:`);
        console.log(`   Осталось запросов: ${uniqueRequests.length}`);
        if (validationResult.updatedCount > 0) {
          console.log(`   Обновлено: ${validationResult.updatedCount}`);
        }
        if (validationResult.deletedCount > 0) {
          console.log(`   Удалено устаревших: ${validationResult.deletedCount}`);
        }
        if (validationResult.skippedCount > 0) {
          console.log(`   Пропущено: ${validationResult.skippedCount}`);
        }
      } catch (error: any) {
        console.error('❌ Ошибка при валидации данных:', error.message);
        if (this.config.debug) {
          console.error('🐛 Полная ошибка:', error);
        }
        console.log('⚠️  Продолжаю без валидации');
      }
    }

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
   * ИСПРАВЛЕНИЕ 8: Правильная группировка - заменяем числа на {id}
   */
  private groupByStructure(requests: UniqueRequest[]): Record<string, UniqueRequest[]> {
    const grouped: Record<string, UniqueRequest[]> = {};

    for (const request of requests) {
      // Заменяем все числа в пути на {id}
      const normalizedEndpoint = request.endpoint.replace(/\/\d+/g, '/{id}');
      const key = `${request.method}:${normalizedEndpoint}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      if (grouped[key].length < this.config.maxTestsPerEndpoint) {
        grouped[key].push(request);
      }
    }

    return grouped;
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

    // НОВОЕ v12.0: Дедупликация тестов (Идея 1 + 2)
    if (this.config.deduplication.enabled && requests.length > 1) {
      const beforeCount = requests.length;
      requests = deduplicateTests(requests, this.config.deduplication);
      const afterCount = requests.length;

      if (beforeCount !== afterCount) {
        console.log(`  🔄 Дедупликация ${endpoint}: ${beforeCount} → ${afterCount} тестов`);
      }
    }

    const fileName = this.endpointToFileName(endpoint, method);

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
      console.log(`  ✓ ${fileName}.happy-path.test.ts (+${requests.length})`);
    } else {
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
      console.log(`  ${mode} ${fileName}.happy-path.test.ts (${requests.length})`);
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

    // Находим DTO
    let dtoInfo: DTOInfo | null = null;
    if (this.config.apiGeneratedPath) {
      dtoInfo = findDtoForEndpoint(this.config.apiGeneratedPath, endpoint, method);
    }

    const newTests = await Promise.all(
        requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1, dtoInfo))
    );

    content = content.slice(0, lastBraceIndex) + '\n' + newTests.join('\n\n') + '\n' + content.slice(lastBraceIndex);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Генерирует полный файл теста
   */
  private async generateTestFile(endpoint: string, method: string, requests: UniqueRequest[]): Promise<string> {
    // Ищем DTO
    let dtoInfo: DTOInfo | null = null;

    if (this.config.apiGeneratedPath) {
      dtoInfo = findDtoForEndpoint(this.config.apiGeneratedPath, endpoint, method);
    }

    // Генерируем импорты
    const imports: string[] = [
      // ИСПРАВЛЕНИЕ 1: Конфигурируемый импорт
      `import test, { expect } from '${this.config.testImportPath}';`,
      `import axios from 'axios';`,
    ];

    // ИСПРАВЛЕНИЕ 11: Импорт функций сравнения из NPM пакета
    imports.push(`import { compareDbWithResponse, formatDifferencesAsBlocks } from '${this.config.packageName}/dist/utils/data-comparison';`);

    // Импорт axios конфига
    if (this.config.axiosConfigPath && this.config.axiosConfigName) {
      imports.push(`import { ${this.config.axiosConfigName} } from '${this.config.axiosConfigPath}';`);
    }

    // ИСПРАВЛЕНИЕ 10: Импорт DTO
    if (dtoInfo) {
      const dtoImportPath = this.getRelativePath(this.config.outputDir, dtoInfo.filePath);
      imports.push(`import type { ${dtoInfo.name} } from '${dtoImportPath}';`);
    }

    // ИСПРАВЛЕНИЕ 9: Импорты нормализованных данных
    if (this.config.createSeparateDataFiles) {
      const fileName = this.endpointToFileName(endpoint, method);
      for (let i = 0; i < requests.length; i++) {
        imports.push(`import { requestData as requestData${i + 1}, normalizedExpectedResponse as normalizedExpectedResponse${i + 1} } from './test-data/${fileName}-data-${i + 1}';`);
      }
    }

    // Генерируем тесты
    const tests = await Promise.all(
        requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1, dtoInfo))
    );

    // ИСПРАВЛЕНИЕ 9: Создаем файлы с нормализованными данными
    if (this.config.createSeparateDataFiles) {
      await this.createDataFiles(endpoint, method, requests, dtoInfo);
    }

    // ИСПРАВЛЕНИЕ 3: Рандомный номер
    const randomId = Math.floor(Math.random() * 10000);

    return `${imports.join('\n')}

const endpoint = '${endpoint}';
const httpMethod = '${method}';

// ИСПРАВЛЕНИЕ 2: Только 200-ые коды
const apiErrorCodes = {
  success: 200,
  created: 201,
  noContent: 204,
};

const success = apiErrorCodes.${this.getSuccessCodeName(requests[0]?.response_status || 200)};

// ИСПРАВЛЕНИЕ 3: Автоматическое описание
const caseInfoObj = {
  testCase: 'HP-${randomId}',
  aqaOwner: 'HappyPathGenerator',
  tms_testName: 'Happy path тесты с проверкой ${method} ${endpoint}',
  testType: 'api'
};

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
   * ИСПРАВЛЕНИЕ 9: Создает файлы с НОРМАЛИЗОВАННЫМИ данными на основе DTO
   */
  private async createDataFiles(
      endpoint: string,
      method: string,
      requests: UniqueRequest[],
      dtoInfo: DTOInfo | null
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

      // ИСПРАВЛЕНИЕ 7: Нормализуем на основе DTO
      let normalizedResponse;

      if (dtoInfo) {
        normalizedResponse = normalizeDbDataByDto(request.response_body, dtoInfo);
      } else {
        normalizedResponse = normalizeDbData(request.response_body);
      }

      const dataContent = `/**
 * Тестовые данные для ${method} ${endpoint}
 * DB ID: ${request.id}
 */

export const requestData = ${JSON.stringify(request.request_body, null, 2)};

// Нормализованный response (готовый для сравнения)
export const normalizedExpectedResponse = ${JSON.stringify(normalizedResponse, null, 2)};
`;

      fs.writeFileSync(dataFilePath, dataContent, 'utf-8');
    }
  }

  /**
   * ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ метод генерации теста
   * ИСПРАВЛЕНИЯ 4, 5, 6, 7
   */
  private async generateSingleTest(
      endpoint: string,
      method: string,
      request: UniqueRequest,
      testNumber: number,
      dtoInfo: DTOInfo | null
  ): Promise<string> {
    // ИСПРАВЛЕНИЕ 3: Уникальный рандомный номер
    const randomId = Math.floor(Math.random() * 1000);
    const testName = `Happy path #${testNumber} (ID: ${randomId})`;
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

    const standUrlVar = `process.env.${this.config.standUrlEnvVar}`;
    const axiosConfig = this.config.axiosConfigName;

    let testCode = `  test(\`\${httpMethod} ${testName} (\${success}) @api ${this.config.testTag}\`, async ({ page }, testInfo) => {
    // DB ID: db-id-${request.id}
    // ИСПРАВЛЕНИЕ 12: Реальный endpoint с подставленными параметрами пути
    const actualEndpoint = '${request.endpoint}';
`;

    // Данные
    if (this.config.createSeparateDataFiles) {
      if (hasBody) {
        testCode += `    const requestData = requestData${testNumber};
`;
      }
      // ИСПРАВЛЕНИЕ 9: Только переменная, не объект целиком
      testCode += `    const normalizedExpected = normalizedExpectedResponse${testNumber};
    
`;
    } else {
      if (hasBody) {
        testCode += `    const requestData = ${JSON.stringify(request.request_body, null, 4).replace(/^/gm, '    ')};
    
`;
      }

      // ИСПРАВЛЕНИЕ 7: Нормализуем на основе DTO
      let normalizedResponse;
      if (dtoInfo) {
        normalizedResponse = normalizeDbDataByDto(request.response_body, dtoInfo);
      } else {
        normalizedResponse = normalizeDbData(request.response_body);
      }

      testCode += `    const normalizedExpected = ${JSON.stringify(normalizedResponse, null, 4).replace(/^/gm, '    ')};
    
`;
    }

    // ИСПРАВЛЕНИЕ 4: Запрос через catch с детальным выводом
    testCode += `    let response;

    try {
`;

    if (hasBody) {
      testCode += `      response = await axios.${method.toLowerCase()}(${standUrlVar} + actualEndpoint, requestData, ${axiosConfig});
`;
    } else {
      testCode += `      response = await axios.${method.toLowerCase()}(${standUrlVar} + actualEndpoint, ${axiosConfig});
`;
    }

    testCode += `    } catch (error: any) {
      console.error('❌ Ошибка при вызове endpoint:');
      console.error('Endpoint template:', endpoint);
      console.error('Actual endpoint:', actualEndpoint);
      console.error('Method:', httpMethod);
`;

    if (hasBody) {
      testCode += `      console.error('Request:', JSON.stringify(requestData, null, 2));
`;
    }

    testCode += `      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error message:', error.message);
      throw error;
    }
    
    // Основные проверки
    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
`;

    // ИСПРАВЛЕНИЕ 6: Валидация типов на основе DTO
    if (dtoInfo && dtoInfo.fields.length > 0) {
      testCode += `\n    // Валидация типов данных из DTO: ${dtoInfo.name}\n`;

      for (const field of dtoInfo.fields.slice(0, 5)) {
        const jsType = this.getJsType(field.type);

        if (jsType === 'array') {
          testCode += `    await expect(Array.isArray(response.data.${field.name})).toBe(true);\n`;
        } else if (jsType) {
          testCode += `    await expect(typeof response.data.${field.name}).toBe('${jsType}');\n`;
        }
      }
    }

    // ИСПРАВЛЕНИЕ 5: Проверка обязательных полей из DTO
    if (dtoInfo && dtoInfo.fields.length > 0) {
      testCode += `\n    // Проверка обязательных полей из DTO: ${dtoInfo.name}\n`;

      const requiredFields = dtoInfo.fields.filter(f => f.required);
      for (const field of requiredFields.slice(0, 5)) {
        testCode += `    await expect(response.data.${field.name}).toBeDefined();\n`;
      }
    }

    // ИСПРАВЛЕНИЕ 5: Используем deepCompareObjects вместо toMatchObject
    // ИСПРАВЛЕНИЕ 13: Улучшенный вывод различий с цветами (блочный формат)
    testCode += `
    // Глубокое сравнение (учитывает порядок в массивах)
    const comparison = compareDbWithResponse(normalizedExpected, response.data);

    if (!comparison.isEqual) {
      console.log(formatDifferencesAsBlocks(comparison.differences));
    }

    await expect(comparison.isEqual).toBe(true);
  });`;

    return testCode;
  }

  private getJsType(tsType: string): string | null {
    tsType = tsType.toLowerCase().trim();

    if (tsType.includes('string')) return 'string';
    if (tsType.includes('number')) return 'number';
    if (tsType.includes('boolean')) return 'boolean';
    if (tsType.includes('[]') || tsType.includes('array')) return 'array';
    if (tsType === 'object') return 'object';

    return null;
  }

  private getRelativePath(from: string, to: string): string {
    const relative = path.relative(path.dirname(from), to);
    return relative.startsWith('.') ? relative.replace(/\.ts$/, '') : `./${relative.replace(/\.ts$/, '')}`;
  }

  private endpointToFileName(endpoint: string, method: string): string {
    let fileName = endpoint
        .replace(/^\/api\/v[0-9]+\//, '')
        .replace(/\{[^}]+\}/g, 'id')
        .replace(/\/\d+/g, '-id') // ИСПРАВЛЕНИЕ 8: Числа → -id
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