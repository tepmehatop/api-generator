# API Generator - Полная документация

Комплексное решение для генерации TypeScript API клиентов из OpenAPI спецификаций + автоматическая генерация тестов Playwright + Happy Path тесты на основе реальных данных.

> **Краткая версия:** См. [README.md](./README.md)

---

## 📋 Содержание

- [История версий](#история-версий)
- [Установка](#установка)
- [Методы API](#методы-api)
  - [generateApi()](#generateapi)
  - [generateApiTests()](#generateapitests)
  - [generateHappyPathTests()](#generatehappypathtests)
  - [analyzeAndGenerateTestData()](#analyzeandgeneratetestdata)
  - [collectApiData()](#collectapidata)
- [Настройка БД](#настройка-бд)
- [Конфигурации](#конфигурации)
- [Примеры использования](#примеры-использования)
- [Troubleshooting](#troubleshooting)

---

## История версий

### v14.0 (Текущая) - Раздельные методы генерации тестов

**Основные изменения:**

1. **Раздельные методы генерации**: `generateApiTests()` разделен на три отдельных метода:
   - `generateNegativeTests()` - только негативные тесты (401, 403, 400, 404, 405)
   - `generatePositiveTests()` - только позитивные тесты (200, 201)
   - `generatePairwiseTests()` - только pairwise комбинации
2. **Поддержка папок**: `apiFilePath` теперь может быть как файлом, так и папкой с файлами
3. **Автогруппировка**: Тесты автоматически группируются по категориям (orders, users и т.д.)
4. **Интеграция apiTestHelper**: `apiTestHelper` теперь правильно используется в негативных тестах при падении
5. **Детальный отчет**: Отчет теперь включает "Не удалось сгенерировать" с причинами

**Новые интерфейсы:**
- `BaseTestConfig` - базовый конфиг для всех типов тестов
- `NegativeTestConfig` - конфиг для негативных тестов
- `PositiveTestConfig` - конфиг для позитивных тестов
- `PairwiseTestConfig` - конфиг для pairwise тестов

**Измененные файлы:**
- `src/test-generator.ts` → v14.0

### v13.0 - Happy Path интеграция в generateApiTests

**Основные изменения:**

1. **Happy Path интеграция в generateApiTests**: `generateApiTests()` теперь может использовать реальные данные из `qa.api_requests` таблицы
2. **Интеллектуальная стратегия повторов**: 10-15 попыток получить 200 ответ с умным fallback
3. **Отдельные файлы данных**: `testData/*.data.ts` файлы для каждого endpoint
4. **Убран Content-Type тест**: Удален unsupportedMediaType (415) из негативных сценариев
5. **database-analyzer.ts v13.0**: Новый метод `tryGetSuccessfulResponse()` с интеллектуальными повторами

**Измененные файлы:**
- `src/test-generator.ts` → v13.0
- `src/database-analyzer.ts` → v13.0
- `src/utils/happy-path-data-fetcher.ts` → NEW
- `src/utils/data-validation.ts` → v12.0 (валидация)
- `src/utils/test-deduplication.ts` → v12.0 (дедупликация)

### v12.0 - Дедупликация и валидация данных

**Основные изменения:**

1. **Дедупликация тестов**: Signature-based группировка для избежания дублей
2. **Валидация данных**: Проверка актуальности данных перед генерацией
3. **Edge cases**: Обнаружение null, пустых массивов, редких значений
4. **Конфигурируемые правила**: Настраиваемые поля для валидации и дедупликации

**Новые утилиты:**
- `src/utils/test-deduplication.ts`
- `src/utils/data-validation.ts`

### v11.1 - Динамический импорт utils

**Основные изменения:**

1. **Динамический импорт**: Автоматическое определение имени пакета из `package.json`
2. **Экспорт utils**: Папка `utils` теперь корректно экспортируется в NPM пакет
3. **Исправление импорта**: `compareDbWithResponse` импортируется из NPM пакета

**Измененные файлы:**
- `src/happy-path-generator.ts` → v11.1
- `scripts/update-exports.cjs`

### v11.0 - Базовая версия

- Генерация API клиента из OpenAPI
- Генерация позитивных/негативных/pairwise тестов
- Happy Path тесты из БД
- Анализ БД для данных
- Сбор данных из UI тестов

---

## Установка

```bash
npm install @your-company/api-codegen
```

**Зависимости:**

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "postgres": "^3.4.7"
  },
  "peerDependencies": {
    "@playwright/test": "^1.57.0"
  }
}
```

---

## Методы API

### 1. generateApi()

Генерация TypeScript API клиента из OpenAPI

### 2. generateNegativeTests() ⭐ NEW v14.0

Генерация ТОЛЬКО негативных тестов (401, 403, 400, 404, 405)

### 3. generatePositiveTests() ⭐ NEW v14.0

Генерация ТОЛЬКО позитивных тестов (200, 201)

### 4. generatePairwiseTests() ⭐ NEW v14.0

Генерация ТОЛЬКО pairwise комбинаций

### 5. generateApiTests() 🚫 DEPRECATED

Используйте раздельные методы выше

### 6. generateHappyPathTests()

Генерация Happy Path тестов из БД

### 7. analyzeAndGenerateTestData()

Анализ БД и генерация тестовых данных

### 8. collectApiData()

Сбор данных из UI тестов в БД

---

## Детали методов

### generateApi()

Генерирует TypeScript API клиент из OpenAPI спецификации.

#### Интерфейс

```typescript
interface GeneratorConfig {
  specUrl: string;                       // URL или путь к OpenAPI (обязательно)
  outputDir: string;                     // Папка для выгрузки (обязательно)
  httpClient?: 'axios' | 'fetch';        // HTTP клиент (default: 'axios')
  baseUrl?: string;                      // Базовый URL API
  authTokenVar?: string;                 // Переменная для токена
  generateErrorHandlers?: boolean;       // Генерировать обработчики ошибок (default: true)
  generateTypes?: boolean;               // Генерировать типы (default: true)
  transliterateRussian?: boolean;        // Транслитерация русских тегов (default: true)
  useClasses?: boolean;                  // Использовать классы (default: false)
  prevPackage?: string;                  // URL предыдущей версии для сравнения
}

function generateApi(config: GeneratorConfig): Promise<void>
```

#### Пример использования

```typescript
import { generateApi } from '@your-company/api-codegen';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api',
  httpClient: 'axios',
  baseUrl: 'process.env.API_BASE_URL',
  authTokenVar: 'process.env.AUTH_TOKEN',
  generateErrorHandlers: true,
  generateTypes: true,
  transliterateRussian: true,
  useClasses: false
});
```

#### Результат

```
api/
├── orders.api.ts        # API методы для orders
├── orders.types.ts      # TypeScript типы
├── products.api.ts      # API методы для products
├── products.types.ts    # TypeScript типы
└── base.types.ts        # Общие типы
```

#### Сравнение версий

Если указан `prevPackage`, будет создан `COMPARE_README.md` с отчетом об изменениях:

```typescript
await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api',
  prevPackage: 'https://registry.com/repo/npm/api-codegen/api-codegen-1.55.tgz'
});
```

---

### generateNegativeTests() ⭐ NEW v14.0

Генерирует **ТОЛЬКО негативные** Playwright тесты для API методов.

**Преимущества раздельного метода:**
- Гибкая настройка каждого типа тестов (401, 403, 400, 404, 405)
- Поддержка папок с файлами
- Автоматическая группировка по категориям
- Правильная интеграция `apiTestHelper` при падении тестов
- Детальный отчет с причинами неудач

#### Интерфейс

```typescript
interface NegativeTestConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  apiFilePath: string;                   // Путь к файлу ИЛИ папке с API методами ⭐ NEW
  outputDir: string;                     // Папка для тестов

  // === НАСТРОЙКА НЕГАТИВНЫХ ТЕСТОВ ===
  generate401Tests?: boolean;            // 401 Unauthorized (default: true)
  generate403Tests?: boolean;            // 403 Forbidden (default: true)
  generate400Tests?: boolean;            // 400 Bad Request (default: true)
  generate404Tests?: boolean;            // 404 Not Found (default: true)
  generate405Tests?: boolean;            // 405 Method Not Allowed (default: true)

  // === ГРУППИРОВКА ⭐ NEW ===
  groupByCategory?: boolean;             // Группировать по категориям (default: true)
                                         // orders → outputDir/orders/
                                         // users  → outputDir/users/

  // === HAPPY PATH ИНТЕГРАЦИЯ ===
  useHappyPathData?: boolean;            // Использовать Happy Path данные (default: true)
  dbConnection?: any;                    // postgres connection
  dbSchema?: string;                     // Схема БД (default: 'qa')
  happyPathSamplesCount?: number;        // Количество записей (default: 15)

  // === ПУТИ ИМПОРТОВ ===
  baseTestPath?: string;                 // Путь к базовому тесту (default: '../../../fixtures/baseTest')
  axiosHelpersPath?: string;             // Путь к axios helpers (default: '../../../helpers/axiosHelpers')
  apiTestHelperPath?: string;            // Путь к API test helpers (default: '../../../helpers/apiTestHelper')
}

async function generateNegativeTests(config: NegativeTestConfig): Promise<GenerationResult>
```

#### Возвращаемый результат

```typescript
interface GenerationResult {
  generatedCount: number;                // Создано тестов
  updatedCount: number;                  // Обновлено тестов
  skippedCount: number;                  // Пропущено (@readonly)
  failedCount: number;                   // Не удалось сгенерировать ⭐ NEW
  failures: GenerationFailure[];         // Детали неудач ⭐ NEW
}

interface GenerationFailure {
  methodName: string;                    // Имя метода
  reason: 'no_dto' | 'no_endpoint' | 'parse_error' | 'write_error' | 'other';
  details: string;                       // Подробности
}
```

#### Пример использования

```typescript
import { generateNegativeTests } from '@your-company/api-codegen';
import sql from './db';

// Вариант 1: Один файл
const result = await generateNegativeTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/negative',
  generate401Tests: true,
  generate403Tests: true,
  generate400Tests: true,
  generate404Tests: true,
  generate405Tests: true,
  dbConnection: sql
});

// Вариант 2: Вся папка с автогруппировкой ⭐ NEW
const result = await generateNegativeTests({
  apiFilePath: './api/',  // ← Вся папка!
  outputDir: './tests/api/negative',
  groupByCategory: true,  // ← Создаст подпапки orders/, users/ и т.д.
  dbConnection: sql
});

console.log(`✅ Создано: ${result.generatedCount}`);
console.log(`♻️  Обновлено: ${result.updatedCount}`);
console.log(`⏭️  Пропущено: ${result.skippedCount}`);
console.log(`❌ Не удалось: ${result.failedCount}`);

if (result.failedCount > 0) {
  console.log('\nДетали неудач:');
  result.failures.forEach(f => {
    console.log(`- ${f.methodName}: ${f.reason} - ${f.details}`);
  });
}
```

#### Результат (с группировкой)

```
tests/api/negative/
├── orders/                    # Группа "orders"
│   ├── createOrder.test.ts
│   ├── getOrderById.test.ts
│   └── updateOrder.test.ts
├── users/                     # Группа "users"
│   ├── createUser.test.ts
│   ├── getUserById.test.ts
│   └── updateUser.test.ts
└── other/                     # Прочие
    └── healthCheck.test.ts
```

#### Интеграция apiTestHelper ⭐ NEW

Теперь `apiTestHelper` **правильно используется** в негативных тестах:

```typescript
// Сгенерированный тест
test(`POST без TOKEN (401) @api @negative`, async ({ page }, testInfo) => {
  try {
    await axios.post(process.env.StandURL + endpoint, {}, configApiHeaderAdmin);
    throw new Error('Ожидалась ошибка 401');
  } catch (error: any) {
    // ⭐ apiTestHelper используется здесь!
    const errorMessage = getMessageFromError(error);

    await expect(error.response.status, errorMessage).toBe(401);
    await expect(error.response.statusText).toBe("Unauthorized");
  }
});
```

---

### generatePositiveTests() ⭐ NEW v14.0

Генерирует **ТОЛЬКО позитивные** Playwright тесты для API методов.

#### Интерфейс

```typescript
interface PositiveTestConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  apiFilePath: string;                   // Путь к файлу ИЛИ папке с API методами
  outputDir: string;                     // Папка для тестов

  // === НАСТРОЙКА ПОЗИТИВНЫХ ТЕСТОВ ===
  generateRequiredFieldsTest?: boolean;  // Тест с обязательными полями (default: true)
  generateAllFieldsTest?: boolean;       // Тест со всеми полями (default: true)

  // === ГРУППИРОВКА ===
  groupByCategory?: boolean;             // Группировать по категориям (default: true)

  // === HAPPY PATH ИНТЕГРАЦИЯ ===
  useHappyPathData?: boolean;            // Использовать Happy Path данные (default: true)
  dbConnection?: any;                    // postgres connection
  dbSchema?: string;                     // Схема БД (default: 'qa')
  happyPathSamplesCount?: number;        // Количество записей (default: 15)

  // === ПУТИ ИМПОРТОВ ===
  baseTestPath?: string;
  axiosHelpersPath?: string;
  apiTestHelperPath?: string;
}

async function generatePositiveTests(config: PositiveTestConfig): Promise<GenerationResult>
```

#### Пример использования

```typescript
import { generatePositiveTests } from '@your-company/api-codegen';
import sql from './db';

const result = await generatePositiveTests({
  apiFilePath: './api/',
  outputDir: './tests/api/positive',
  generateRequiredFieldsTest: true,
  generateAllFieldsTest: true,
  groupByCategory: true,
  dbConnection: sql
});
```

---

### generatePairwiseTests() ⭐ NEW v14.0

Генерирует **ТОЛЬКО pairwise** комбинации для API методов.

#### Интерфейс

```typescript
interface PairwiseTestConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  apiFilePath: string;                   // Путь к файлу ИЛИ папке с API методами
  outputDir: string;                     // Папка для тестов

  // === НАСТРОЙКА PAIRWISE ===
  generateOptionalCombinations?: boolean; // Комбинации необязательных полей (default: true)
  generateEnumTests?: boolean;           // Тесты для enum значений (default: true)
  maxPairwiseCombinations?: number;      // Максимум комбинаций (default: 10)

  // === ГРУППИРОВКА ===
  groupByCategory?: boolean;             // Группировать по категориям (default: true)

  // === HAPPY PATH ИНТЕГРАЦИЯ ===
  useHappyPathData?: boolean;            // Использовать Happy Path данные (default: true)
  dbConnection?: any;                    // postgres connection
  dbSchema?: string;                     // Схема БД (default: 'qa')
  happyPathSamplesCount?: number;        // Количество записей (default: 15)

  // === ПУТИ ИМПОРТОВ ===
  baseTestPath?: string;
  axiosHelpersPath?: string;
  apiTestHelperPath?: string;
}

async function generatePairwiseTests(config: PairwiseTestConfig): Promise<GenerationResult>
```

#### Пример использования

```typescript
import { generatePairwiseTests } from '@your-company/api-codegen';
import sql from './db';

const result = await generatePairwiseTests({
  apiFilePath: './api/',
  outputDir: './tests/api/pairwise',
  generateOptionalCombinations: true,
  generateEnumTests: true,
  maxPairwiseCombinations: 10,
  groupByCategory: true,
  dbConnection: sql
});
```

---

### 🔒 Защита тестов от обновления ⭐ NEW

Иногда требуется защитить отдельные тесты от перезаписи при повторной генерации (например, тест с ожидаемой 400 ошибкой).

#### Способ 1: Защита ВСЕГО файла

Добавьте в начало файла (первые 500 символов):

```typescript
// @readonly

import test, { expect } from '../../../fixtures/baseTest';
// ... остальной код
```

Файл будет **полностью пропущен** при генерации.

#### Способ 2: Защита КОНКРЕТНОГО теста

Оберните тест в защищенные теги:

```typescript
/* @protected:start:custom400Test */
test(`POST с некорректными данными (400) @api @negative`, async ({ page }, testInfo) => {
  try {
    await axios.post(process.env.StandURL + endpoint, { invalid: 'data' }, configApiHeaderAdmin);
    throw new Error('Ожидалась ошибка 400');
  } catch (error: any) {
    // Это ожидаемая 400 ошибка от разработчиков - НЕ ИСПРАВЛЯТЬ
    await expect(error.response.status).toBe(400);
    await expect(error.response.data.message).toBe('Expected validation error');
  }
});
/* @protected:end:custom400Test */
```

Или с однострочными комментариями:

```typescript
// @protected:start:custom400Test
test(`POST с некорректными данными (400) @api @negative`, async ({ page }, testInfo) => {
  // ваш кастомный код
});
// @protected:end:custom400Test
```

**Важно:**
- `custom400Test` - уникальный ID блока (буквы, цифры, подчеркивания)
- При повторной генерации защищенные блоки **полностью сохраняются**
- Можно защитить несколько тестов в одном файле с разными ID

---

### generateApiTests() 🚫 DEPRECATED

> ⚠️ **Устаревший метод!** Используйте раздельные методы:
> - `generateNegativeTests()` - для негативных тестов
> - `generatePositiveTests()` - для позитивных тестов
> - `generatePairwiseTests()` - для pairwise тестов

Генерирует Playwright тесты для API методов. **v13.0**: Интеграция с Happy Path данными.

#### Интерфейс

```typescript
interface ApiTestConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  apiFilePath: string;                   // Путь к файлу с API методами
  outputDir: string;                     // Папка для тестов

  // === ТИПЫ ТЕСТОВ ===
  generateNegativeTests?: boolean;       // Негативные (default: true)
  generatePositiveTests?: boolean;       // Позитивные (default: true)
  generatePairwiseTests?: boolean;       // Pairwise (default: false)

  // === v13.0: HAPPY PATH ИНТЕГРАЦИЯ ===
  useHappyPathData?: boolean;            // Использовать Happy Path данные (default: true)
  dbConnection?: any;                    // postgres connection
  dbSchema?: string;                     // Схема БД (default: 'qa')
  happyPathSamplesCount?: number;        // Количество записей (default: 15)
  maxDataGenerationAttempts?: number;    // Максимум попыток (default: 10)
  standUrl?: string;                     // URL стенда (default: process.env.StandURL)
  authToken?: string;                    // Токен (default: process.env.AUTH_TOKEN)

  // === v12.0: ВАЛИДАЦИЯ ДАННЫХ ===
  validation?: {
    enabled?: boolean;                   // Включить валидацию (default: false)
    validateBeforeGeneration?: boolean;  // Проверять перед генерацией
    onStaleData?: 'update' | 'skip' | 'delete'; // Действие для устаревших данных
    staleIfChanged?: string[];           // Значимые поля (status, type, state)
    allowChanges?: string[];             // Допустимые изменения (*_at, *_timestamp)
    validateInDatabase?: boolean;        // Проверять в БД
    standUrl?: string;                   // URL для проверки
    axiosConfig?: any;                   // Конфиг axios
    logChanges?: boolean;                // Логировать изменения
    logPath?: string;                    // Путь для логов
  };

  // === v12.0: ДЕДУПЛИКАЦИЯ ТЕСТОВ ===
  deduplication?: {
    enabled?: boolean;                   // Включить (default: false)
    ignoreFields?: string[];             // Игнорируемые поля (id, *_id, *_timestamp)
    significantFields?: string[];        // Значимые поля (status, type, role)
    detectEdgeCases?: boolean;           // Обнаруживать edge cases
    maxTestsPerEndpoint?: number;        // Максимум тестов на endpoint (default: 10)
    preserveTaggedTests?: string[];      // Защищенные теги ([KEEP], [IMPORTANT])
  };

  // === ФИЛЬТРЫ ===
  includeEndpoints?: string[];           // Только эти endpoints
  excludeEndpoints?: string[];           // Исключить endpoints
  includeMethods?: string[];             // Только эти HTTP методы
  excludeMethods?: string[];             // Исключить методы

  // === ПУТИ ИМПОРТОВ ===
  baseTestPath?: string;                 // Путь к базовому тесту
  axiosHelpersPath?: string;             // Путь к axios helpers
  apiTestHelperPath?: string;            // Путь к API test helpers
}

async function generateApiTests(config: ApiTestConfig): Promise<void>
```

#### Минимальный пример

```typescript
import { generateApiTests } from '@your-company/api-codegen';

await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

#### Полный пример с Happy Path (v13.0)

```typescript
import { generateApiTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

await generateApiTests({
  // Обязательные
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',

  // Типы тестов
  generatePositiveTests: true,
  generateNegativeTests: true,
  generatePairwiseTests: true,

  // v13.0: Happy Path интеграция
  useHappyPathData: true,
  dbConnection: sql,
  dbSchema: 'qa',
  happyPathSamplesCount: 15,
  maxDataGenerationAttempts: 10,
  standUrl: process.env.StandURL,
  authToken: process.env.AUTH_TOKEN,

  // v12.0: Валидация
  validation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update',
    staleIfChanged: ['status', 'type', 'state'],
    allowChanges: ['*_at', '*_timestamp', 'updated_at'],
    logChanges: true,
    logPath: './logs/validation.log'
  },

  // v12.0: Дедупликация
  deduplication: {
    enabled: true,
    ignoreFields: ['id', '*_id', '*_timestamp'],
    significantFields: ['status', 'type', 'role'],
    detectEdgeCases: true,
    maxTestsPerEndpoint: 5,
    preserveTaggedTests: ['[KEEP]']
  },

  // Фильтры
  includeEndpoints: ['/orders', '/products'],
  excludeMethods: ['DELETE']
});

await sql.end();
```

#### Результат генерации

```
tests/api/orders/
├── createOrder.test.ts               # Основной тест
├── createOrder-positive.test.ts      # Позитивные тесты
├── createOrder-negative.test.ts      # Негативные тесты
├── createOrder-pairwise.test.ts      # Pairwise тесты
└── testData/
    ├── createOrder.data.ts           # Happy Path данные
    ├── createOrder-positive.data.ts  # Данные для позитивных
    └── createOrder-pairwise.data.ts  # Данные для pairwise
```

#### Что делает v13.0

1. Получает данные из `qa.api_requests` таблицы
2. Валидирует данные (не stale)
3. Дедуплицирует похожие тесты
4. Создает отдельные `testData/*.data.ts` файлы
5. Генерирует тесты с реальными данными
6. Fallback на сгенерированные данные если Happy Path недоступен
7. Делает до 10 попыток получить 200 ответ

---

### generateHappyPathTests()

Генерирует Happy Path тесты на основе реальных данных из UI тестов. **v12.0**: Дедупликация и валидация.

#### Интерфейс

```typescript
interface HappyPathTestConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  outputDir: string;                     // Папка для тестов
  dbConnectionMethod: string;            // Имя метода подключения к БД

  // === ОСНОВНЫЕ ===
  dbSchema?: string;                     // Схема БД (default: 'qa')
  endpointFilter?: string[];             // Фильтр endpoints
  methodFilter?: string[];               // Фильтр HTTP методов
  maxTestsPerEndpoint?: number;          // Максимум тестов на endpoint (default: 5)
  onlySuccessful?: boolean;              // Только успешные (default: true)
  testTag?: string;                      // Тег теста (default: '@apiHappyPath')
  force?: boolean;                       // Force режим (default: false)

  // === ПУТИ И ИМПОРТЫ ===
  standUrlEnvVar?: string;               // Переменная URL (default: 'StandURL')
  axiosConfigName?: string;              // Имя конфига axios (default: 'configApiHeaderAdmin')
  axiosConfigPath?: string;              // Путь к axios helpers
  apiGeneratedPath?: string;             // Путь к сгенерированным API
  testImportPath?: string;               // Откуда импортировать test/expect (default: '@playwright/test')
  packageName?: string;                  // Имя NPM пакета (default: auto из package.json)

  // === ОПЦИИ ГЕНЕРАЦИИ ===
  createSeparateDataFiles?: boolean;     // Создавать отдельные файлы данных (default: false)
  mergeDuplicateTests?: boolean;         // Мерджить дубликаты (default: true)

  // === v12.0: ДЕДУПЛИКАЦИЯ ===
  deduplication?: {
    enabled?: boolean;                   // Включить (default: true)
    ignoreFields?: string[];             // Игнорируемые поля
    significantFields?: string[];        // Значимые поля
    detectEdgeCases?: boolean;           // Обнаруживать edge cases (default: true)
    maxTestsPerEndpoint?: number;        // Максимум тестов (default: 2)
    preserveTaggedTests?: string[];      // Защищенные теги ([KEEP], [IMPORTANT])
  };

  // === v12.0: ВАЛИДАЦИЯ ДАННЫХ ===
  dataValidation?: {
    enabled?: boolean;                   // Включить (default: true)
    validateBeforeGeneration?: boolean;  // Проверять перед генерацией (default: true)
    onStaleData?: 'update' | 'skip' | 'delete'; // Действие (default: 'delete')
    staleIfChanged?: string[];           // Значимые поля
    allowChanges?: string[];             // Допустимые изменения
    validateInDatabase?: boolean;        // Проверять в БД
    standUrl?: string;                   // URL для проверки
    axiosConfig?: any;                   // Конфиг axios
    logChanges?: boolean;                // Логировать (default: true)
    logPath?: string;                    // Путь для логов
  };
}

async function generateHappyPathTests(
  config: HappyPathTestConfig,
  sqlConnection: any
): Promise<void>
```

#### Минимальный пример

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect'
}, sql);
```

#### Полный пример с дедупликацией и валидацией (v12.0)

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

await generateHappyPathTests({
  // Обязательные
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect',

  // Основные
  dbSchema: 'qa',
  maxTestsPerEndpoint: 10,
  onlySuccessful: true,
  testTag: '@apiHappyPath',
  force: false,

  // Фильтры
  endpointFilter: ['/api/v1/orders', '/api/v1/products'],
  methodFilter: ['POST', 'PUT'],

  // Импорты
  testImportPath: '@playwright/test',
  packageName: '@your-company/api-codegen', // Автоматически из package.json
  standUrlEnvVar: 'StandURL',
  axiosConfigName: 'configApiHeaderAdmin',
  axiosConfigPath: '../../../helpers/axiosHelpers',
  apiGeneratedPath: './node_modules/@your-company/api-codegen',

  // Опции
  createSeparateDataFiles: true,
  mergeDuplicateTests: true,

  // v12.0: Дедупликация
  deduplication: {
    enabled: true,
    ignoreFields: ['id', '*_id', 'created_at', 'updated_at', '*_timestamp'],
    significantFields: ['status', 'state', 'type', 'role'],
    detectEdgeCases: true,
    maxTestsPerEndpoint: 2,
    preserveTaggedTests: ['[KEEP]', '[IMPORTANT]']
  },

  // v12.0: Валидация
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'delete',
    staleIfChanged: ['status', 'state', 'type', 'role'],
    allowChanges: ['updated_at', 'modified_at', '*_timestamp', '*_at'],
    validateInDatabase: false,
    logChanges: true,
    logPath: './logs/happy-path-validation.log'
  }
}, sql);

await sql.end();
```

#### Результат генерации

```
tests/api/happy-path/
├── POST_api_v1_orders.test.ts        # Happy Path тест
├── PUT_api_v1_orders_id.test.ts
└── testData/
    ├── POST_api_v1_orders.data.ts    # Отдельные файлы данных (если createSeparateDataFiles: true)
    └── PUT_api_v1_orders_id.data.ts
```

#### Что делает v12.0

1. Получает данные из `qa.api_requests`
2. **Валидация**: Проверяет актуальность данных (вызывает live API)
3. **Дедупликация**: Группирует по signature, удаляет дубликаты
4. **Edge cases**: Обнаруживает null, пустые массивы, редкие значения
5. Генерирует тесты с глубоким сравнением
6. Валидация типов из DTO
7. Красивый вывод различий (блочный формат)

---

### analyzeAndGenerateTestData()

Анализирует БД и генерирует/обновляет тестовые данные. **v13.0**: Интеллектуальные повторы и Happy Path интеграция.

#### Интерфейс

```typescript
interface DatabaseAnalyzerConfig {
  // === ОБЯЗАТЕЛЬНЫЕ ===
  testFilePath: string;                  // Путь к тест файлу
  dbConnectionMethod: string;            // Имя метода подключения
  dbSchema: string;                      // Схема БД

  // === ОСНОВНЫЕ ===
  force?: boolean;                       // Force режим (default: false)
  dataStrategy?: 'existing' | 'random';  // Стратегия данных (default: 'existing')
  samplesCount?: number;                 // Количество записей (default: 15)
  authToken?: string;                    // Токен авторизации

  // === v13.0: HAPPY PATH ИНТЕГРАЦИЯ ===
  useHappyPathData?: boolean;            // Использовать Happy Path (default: true)
  happyPathSchema?: string;              // Схема Happy Path (default: 'qa')
  maxAttempts?: number;                  // Максимум попыток (default: 10)

  // === ЭТАПЫ АНАЛИЗА ===
  stages?: {
    schemaAnalysis?: boolean;            // Анализ схемы (default: true)
    foreignKeys?: boolean;               // Внешние ключи (default: true)
    empiricalTest?: boolean;             // Эмпирическая проверка (default: true)
  };

  // === ЛОГИРОВАНИЕ ===
  verboseStages?: {
    stage1?: boolean;                    // Детальные логи этапа 1
    stage2?: boolean;                    // Детальные логи этапа 2
    stage3?: boolean;                    // Детальные логи этапа 3
  };
}

async function analyzeAndGenerateTestData(
  config: DatabaseAnalyzerConfig,
  dbConnectFunction: any
): Promise<AnalysisResult>
```

#### Минимальный пример

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({ /* ... */ });

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema'
}, sql);
```

#### Полный пример с Happy Path (v13.0)

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

await analyzeAndGenerateTestData({
  // Обязательные
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',

  // Основные
  force: false,
  dataStrategy: 'existing',
  samplesCount: 15,
  authToken: process.env.AUTH_TOKEN,

  // v13.0: Happy Path интеграция
  useHappyPathData: true,
  happyPathSchema: 'qa',
  maxAttempts: 10,

  // Этапы анализа
  stages: {
    schemaAnalysis: true,
    foreignKeys: true,
    empiricalTest: true
  },

  // Детальное логирование
  verboseStages: {
    stage1: true,
    stage2: true,
    stage3: true
  }
}, sql);

await sql.end();
```

#### Что делает v13.0

**Этап 1: Анализ схемы БД**
1. Анализирует таблицы и колонки
2. Определяет типы данных
3. Находит внешние ключи

**Этап 2: Анализ DTO и связей**
1. Находит DTO для endpoint
2. Определяет обязательные и опциональные поля
3. Анализирует связи между таблицами

**Этап 3: Генерация данных (v13.0)**
1. Получает Happy Path данные из `qa.api_requests`
2. Генерирует fallback данные
3. Делает 10-15 попыток получить 200 ответ:
   - Пробует Happy Path данные
   - Fallback на сгенерированные данные
   - Останавливается на 401/403 (auth ошибки)
   - Продолжает на 400 (validation ошибки) с новыми данными
4. Обновляет тест файл с рабочими данными

---

### collectApiData()

Собирает данные API запросов/ответов из UI тестов и сохраняет в БД.

#### Интерфейс

```typescript
interface CollectorConfig {
  serviceUrl: string;                    // URL микросервиса для сбора
  endpoint?: string;                     // Endpoint (default: '/api/collect-data')
  urlFilters?: string[];                 // Фильтры URL (default: ['/api/'])
  excludeUrls?: string[];                // Исключить URL (default: [])
  enabled?: boolean;                     // Включить сбор (default: true)
}

async function collectApiData(
  page: Page,
  testInfo: TestInfo,
  config: CollectorConfig
): Promise<void>
```

#### Использование в beforeEach

```typescript
import { test } from '@playwright/test';
import { collectApiData } from '@your-company/api-codegen';

test.beforeEach(async ({ page }, testInfo) => {
  await collectApiData(page, testInfo, {
    serviceUrl: 'http://vm-host:3000',
    endpoint: '/api/collect-data',
    urlFilters: ['/api/v1/', '/api/v2/'],
    excludeUrls: ['/health', '/metrics', '/debug']
  });
});

test('User creates order', async ({ page }) => {
  // Ваш тест...
  // Все API запросы автоматически собираются
});
```

#### Микросервис для сбора данных

```javascript
// api-collector-service.js
const express = require('express');
const postgres = require('postgres');

const app = express();
const sql = postgres({
  host: 'localhost',
  database: 'testdb',
  username: 'user',
  password: 'pass'
});

app.use(express.json());

app.post('/api/collect-data', async (req, res) => {
  const {
    endpoint,
    method,
    requestBody,
    responseBody,
    responseStatus,
    testName,
    testFile
  } = req.body;

  try {
    await sql`
      INSERT INTO qa.api_requests
        (endpoint, method, request_body, response_body, response_status, test_name, test_file)
      VALUES
        (${endpoint}, ${method}, ${requestBody}, ${responseBody}, ${responseStatus}, ${testName}, ${testFile})
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('API Collector service running on port 3000');
});
```

**Запуск микросервиса:**

```bash
node api-collector-service.js
```

---

## Настройка БД

### Таблица qa.api_requests (v13.0)

```sql
CREATE TABLE qa.api_requests (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER NOT NULL,
  test_name VARCHAR(500),
  test_file VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Для инкрементальной генерации
  test_generated BOOLEAN DEFAULT FALSE,
  test_file_path VARCHAR(1000),
  generated_at TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_api_requests_endpoint ON qa.api_requests(endpoint);
CREATE INDEX idx_api_requests_endpoint_method
  ON qa.api_requests(endpoint, method, response_status);
CREATE INDEX idx_api_requests_test_generated
  ON qa.api_requests(test_generated) WHERE test_generated = FALSE;
```

### Миграция для существующей таблицы

```sql
-- Добавление колонок для инкрементальной генерации
ALTER TABLE qa.api_requests
ADD COLUMN IF NOT EXISTS test_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS test_file_path VARCHAR(1000),
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE;

-- Индекс для инкрементальной генерации
CREATE INDEX IF NOT EXISTS idx_api_requests_test_generated
ON qa.api_requests(test_generated)
WHERE test_generated = FALSE;
```

---

## Конфигурации

### Переменные окружения

```bash
# === API ===
StandURL=https://api.example.com
AUTH_TOKEN=your_auth_token_here

# === База данных ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_database
DB_USER=postgres
DB_PASSWORD=password

# === Опционально ===
API_BASE_URL=https://api.example.com
NPM_REGISTRY=https://your-internal-npm-registry.com/
```

### Конфигурация .env файла

```bash
# .env
StandURL=https://api.example.com
AUTH_TOKEN=Bearer eyJhbGciOiJIUzI1NiIs...
DB_HOST=localhost
DB_NAME=test_database
DB_USER=postgres
DB_PASSWORD=secret_password
```

**Использование в коде:**

```typescript
import * as dotenv from 'dotenv';
dotenv.config();

// Теперь доступны process.env.StandURL и т.д.
```

### Конфигурация package.json

```json
{
  "name": "@your-company/api-codegen",
  "version": "13.0.0",
  "description": "API client generator with Happy Path tests",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./utils/*": {
      "types": "./dist/utils/*.d.ts",
      "default": "./dist/utils/*.js"
    },
    "./dist/utils/*": {
      "types": "./dist/utils/*.d.ts",
      "default": "./dist/utils/*.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "build:api": "tsc --project tsconfig.api.json",
    "update-exports": "node scripts/update-exports.cjs",
    "prepublishOnly": "npm run build && npm run update-exports && npm run build:api"
  }
}
```

---

## Примеры использования

### Пример 1: Полный workflow v13.0

```typescript
import {
  generateApi,
  generateApiTests,
  generateHappyPathTests,
  analyzeAndGenerateTestData
} from '@your-company/api-codegen';
import postgres from 'postgres';

// 1. Генерация API клиента
await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api'
});

// 2. Подключение к БД
const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

// 3. Генерация позитивных/негативных/pairwise тестов (v13.0)
await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',
  useHappyPathData: true,
  dbConnection: sql,
  maxDataGenerationAttempts: 10,
  validation: { enabled: true },
  deduplication: { enabled: true }
});

// 4. Генерация Happy Path тестов (v12.0)
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect',
  deduplication: { enabled: true },
  dataValidation: { enabled: true }
}, sql);

// 5. Анализ БД и генерация данных (v13.0)
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  useHappyPathData: true,
  maxAttempts: 10
}, sql);

await sql.end();
```

### Пример 2: CI/CD интеграция

```yaml
# .github/workflows/generate-tests.yml
name: Generate Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Каждую ночь в 2:00
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Setup database
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -f schema.sql

      - name: Generate tests
        env:
          StandURL: ${{ secrets.STAND_URL }}
          AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
          DB_HOST: localhost
          DB_NAME: postgres
          DB_USER: postgres
          DB_PASSWORD: postgres
        run: node generate-tests.js

      - name: Commit and push
        run: |
          git config --local user.email "bot@example.com"
          git config --local user.name "Test Generator Bot"
          git add tests/
          git commit -m "chore: regenerate tests" || exit 0
          git push
```

### Пример 3: Использование в Jenkins

```groovy
pipeline {
  agent any

  environment {
    StandURL = credentials('stand-url')
    AUTH_TOKEN = credentials('auth-token')
    DB_HOST = 'localhost'
    DB_NAME = 'testdb'
  }

  stages {
    stage('Install') {
      steps {
        sh 'npm install'
      }
    }

    stage('Generate API') {
      steps {
        sh 'npm run generate'
      }
    }

    stage('Generate Tests') {
      steps {
        sh 'node generate-tests.js'
      }
    }

    stage('Run Tests') {
      steps {
        sh 'npx playwright test'
      }
    }
  }
}
```

---

## Troubleshooting

### Ошибка: "Table qa.api_requests does not exist"

**Решение:**

```sql
CREATE TABLE qa.api_requests (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER NOT NULL,
  test_name VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Или отключите Happy Path интеграцию:

```typescript
await generateApiTests({
  useHappyPathData: false
});
```

### Ошибка: "Max attempts reached, could not get 200 response"

Генератор пытался 10-15 раз, но не получил успешный ответ.

**Проверьте:**
1. API endpoint доступен (StandURL корректен)
2. Токен авторизации валиден (AUTH_TOKEN)
3. Обязательные поля в DTO корректны
4. В БД есть валидные Happy Path данные

**Решение:**

```typescript
await generateApiTests({
  maxDataGenerationAttempts: 20  // Увеличить попытки
});
```

### Ошибка: "Package subpath './dist/utils/data-comparison' is not defined"

**Решение (v11.1):**

```bash
# Пересобрать пакет
npm run build

# Обновить exports
npm run update-exports

# Проверить что utils экспортируется
cat package.json | grep -A 4 "utils"
```

### Предупреждение: "No Happy Path data found"

Это нормально если таблица `qa.api_requests` пустая.

**Генератор:**
1. Попытается получить Happy Path данные
2. Fallback на сгенерированные данные
3. Сделает несколько попыток получить 200 ответ

**Для наполнения таблицы:**

Запустите UI тесты с `collectApiData()`:

```typescript
test.beforeEach(async ({ page }, testInfo) => {
  await collectApiData(page, testInfo, {
    serviceUrl: 'http://vm-host:3000',
    endpoint: '/api/collect-data'
  });
});
```

### Проблема: Тесты дублируются

**Решение: Включить дедупликацию (v12.0)**

```typescript
await generateApiTests({
  deduplication: {
    enabled: true,
    maxTestsPerEndpoint: 5
  }
});
```

или для Happy Path:

```typescript
await generateHappyPathTests({
  deduplication: {
    enabled: true,
    maxTestsPerEndpoint: 2
  }
}, sql);
```

### Проблема: Тесты используют устаревшие данные

**Решение: Включить валидацию (v12.0)**

```typescript
await generateApiTests({
  validation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update'  // Автообновление устаревших данных
  }
});
```

или для Happy Path:

```typescript
await generateHappyPathTests({
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'delete'  // Удалить устаревшие
  }
}, sql);
```

### Ошибка: "NOT_TAGGED_CALL"

**Причина:** Неправильный синтаксис для библиотеки `postgres`.

```typescript
// ❌ НЕПРАВИЛЬНО
await sql("SELECT * FROM table")
await sql(`SELECT * FROM table WHERE id = ${id}`)

// ✅ ПРАВИЛЬНО (tagged template literal)
await sql`SELECT * FROM table`
await sql`SELECT * FROM table WHERE id = ${id}`
await sql`SELECT * FROM ${sql('tableName')} WHERE id = ${id}`
```

---

## Структура проекта

```
api-generator/
├── src/
│   ├── index.ts                      # Главный экспорт
│   ├── generator.ts                  # Генератор API из OpenAPI
│   ├── parser.ts                     # Парсер OpenAPI
│   ├── test-generator.ts             # v13.0: Генератор тестов с Happy Path
│   ├── happy-path-generator.ts       # v12.0: Happy Path тесты
│   ├── database-analyzer.ts          # v13.0: Анализ БД с повторами
│   ├── test-collector.ts             # Сбор данных из UI
│   ├── comparator.ts                 # Сравнение версий
│   └── utils/
│       ├── happy-path-data-fetcher.ts  # v13.0: NEW
│       ├── data-validation.ts          # v12.0: Валидация
│       ├── test-deduplication.ts       # v12.0: Дедупликация
│       ├── data-comparison.ts          # Сравнение данных
│       ├── dto-finder.ts               # Поиск DTO
│       ├── type-validator.ts           # Валидация типов
│       ├── string-helpers.ts           # Утилиты строк
│       └── transliterate.ts            # Транслитерация
├── scripts/
│   ├── update-exports.cjs            # Автообновление exports
│   └── generate.js                   # CLI генерация
├── bin/
│   └── cli.js                        # CLI команды
├── package.json                      # NPM пакет
├── README.md                         # Краткая документация
├── README_FULL.md                    # Полная документация (этот файл)
└── CHAT_CONTEXT_EXPORT.md            # История разработки
```

---

## Полезные ссылки

- **GitHub:** https://github.com/tepmehatop/api-generator
- **NPM:** `@your-company/api-codegen`
- **Краткая документация:** [README.md](./README.md)
- **История разработки:** [CHAT_CONTEXT_EXPORT.md](./CHAT_CONTEXT_EXPORT.md)

---

## Лицензия

MIT

---

**Версия документации:** v13.0
**Последнее обновление:** 2026-01-27
