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
  - [generateNegativeTests()](#generatenegativetests)
  - [generateHappyPathTests()](#generatehappypathtests)
  - [reActualizeHappyPathTests()](#reactualizehappypathtests) ⭐ NEW v14.1
  - [analyzeAndGenerateTestData()](#analyzeandgeneratetestdata)
  - [collectApiData()](#collectapidata)
- [Настройка БД](#настройка-бд)
- [Конфигурации](#конфигурации)
- [Примеры использования](#примеры-использования)
- [Troubleshooting](#troubleshooting)

---

## История версий

### v14.1 (Текущая) - Email уведомления + Реактуализация тестов

**Основные изменения:**

1. **Реактуализация Happy Path тестов**: Новый метод `reActualizeHappyPathTests()` для автоматического обновления тестовых данных
2. **Email уведомления при 5xx**: HTML письма при серверных ошибках (500, 501, 502, 503)
3. **CURL вывод при падении**: При несовпадении данных в Happy Path тестах выводится copyable CURL
4. **Безопасные 405 тесты**: Автоматическое исключение разрешённых методов для endpoint
5. **Параметр exclude405Methods**: Глобальное исключение методов из 405 тестов
6. **Исправление test-data папки**: Корректная работа при `groupByCategory: true` + `createSeparateDataFiles: true`
7. **Логирование ошибок валидации**: 4xx и 5xx ошибки сохраняются в отдельные JSON файлы с CURL командами

**Новые методы и интерфейсы:**
- `reActualizeHappyPathTests()` - реактуализация тестовых данных
- `ReActualizeConfig` - конфигурация реактуализации
- `ReActualizeResult` - результат реактуализации
- `ValidationErrorEntry` - структура записи об ошибке валидации

**Новые параметры конфигурации:**
- `HappyPathTestConfig.send5xxEmailNotification` - включить email уведомления
- `HappyPathTestConfig.emailHelperPath` - путь к хелперу отправки email
- `HappyPathTestConfig.emailHelperMethodName` - имя метода отправки email
- `NegativeTestConfig.exclude405Methods` - исключить методы из 405 тестов
- `dataValidation.clientErrorsLogPath` - путь к JSON файлу для 4xx ошибок
- `dataValidation.serverErrorsLogPath` - путь к JSON файлу для 5xx ошибок
- `dataValidation.sendServerErrorEmail` - отправлять email при 5xx ошибках валидации

**Измененные файлы:**
- `src/happy-path-generator.ts` → v14.1
- `src/test-generator.ts` → v14.1
- `src/utils/data-validation.ts` → v14.1 (логирование ошибок)
- `src/index.ts` → добавлены новые экспорты

### v14.0 - Раздельные методы генерации тестов

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

  // === БЕЗОПАСНЫЕ 405 ТЕСТЫ (v14.1) ⭐ NEW ===
  exclude405Methods?: string[];          // Глобально исключить методы из 405 тестов
                                         // Автоматически исключаются методы,
                                         // которые реально поддерживаются endpoint'ом
                                         // @example ['DELETE', 'PUT'] - никогда не тестировать эти методы

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

// Вариант 3: Безопасные 405 тесты (v14.1) ⭐ NEW
const result = await generateNegativeTests({
  apiFilePath: './api/',
  outputDir: './tests/api/negative',
  generate405Tests: true,
  exclude405Methods: ['DELETE', 'PUT'],  // ← Никогда не тестировать DELETE/PUT
  // Автоматически исключаются методы, которые endpoint реально поддерживает!
  // Например, если /orders поддерживает GET и POST, 405 тест НЕ будет вызывать GET и POST
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

### generateHappyPathTests() - v14.0 ⭐ MAJOR UPDATE

Генерирует Happy Path тесты на основе реальных данных из UI тестов.

---

## 🎯 ЗАЧЕМ ЭТО НУЖНО

**Проблема:** Ручное написание тестов для API - долго и утомительно. Нужно:
- Подбирать корректные данные для каждого endpoint
- Проверять что данные актуальны
- Избегать дубликатов тестов

**Решение:** Happy Path генератор автоматически:
1. Берет **реальные данные** из UI тестов (сохранённые в БД)
2. **Валидирует** что данные всё ещё актуальны
3. **Дедуплицирует** похожие тесты
4. **Генерирует** готовые Playwright тесты

---

## 📋 ПОЛНЫЙ ИНТЕРФЕЙС КОНФИГУРАЦИИ

```typescript
interface HappyPathTestConfig {
  // ═══════════════════════════════════════════════════════════════════
  // ОСНОВНЫЕ ПАРАМЕТРЫ
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Папка для выгрузки сгенерированных тестов
   * @required
   * @example './e2e/api/happy-path'
   */
  outputDir: string;

  /**
   * НОВОЕ v14.0: Группировать тесты по категориям в подпапки
   *
   * ЧТО ДЕЛАЕТ:
   * Категория определяется из пути endpoint:
   * - /api/v1/orders/place -> orders/
   * - /api/v2/users/{id}/profile -> users/
   *
   * ЗАЧЕМ:
   * - Структурированное хранение тестов
   * - Легче находить тесты для конкретного модуля
   * - Можно запускать тесты по папкам: npx playwright test orders/
   *
   * @default true
   *
   * @example
   * // groupByCategory: true
   * outputDir/
   * ├── orders/
   * │   ├── create-order.happy-path.test.ts
   * │   └── test-data/
   * ├── users/
   * │   ├── get-user.happy-path.test.ts
   * │   └── test-data/
   */
  groupByCategory?: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // ПОДКЛЮЧЕНИЯ К БАЗАМ ДАННЫХ (v14.0 - РАЗДЕЛЬНЫЕ ПОДКЛЮЧЕНИЯ)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * @deprecated Используйте dbDataConnection вместо этого
   */
  dbConnectionMethod?: string;

  /**
   * НОВОЕ v14.0: Подключение к БД где хранятся собранные API запросы
   *
   * ЧТО ЭТО:
   * База данных с таблицей api_requests куда UI тесты сохраняют запросы/ответы.
   * Из этой таблицы генератор берёт данные для тестов.
   *
   * ЗАЧЕМ ОТДЕЛЬНОЕ ПОДКЛЮЧЕНИЕ:
   * БД с собранными данными может быть ДРУГОЙ базой данных,
   * отличной от БД тестового стенда.
   *
   * @example
   * import postgres from 'postgres';
   * const sqlDataGenConn = postgres({ host: 'data-gen-db.example.com', ... });
   *
   * await generateHappyPathTests({
   *   dbDataConnection: sqlDataGenConn,
   *   dbDataSchema: 'qa'  // таблица qa.api_requests
   * });
   */
  dbDataConnection?: any;

  /**
   * НОВОЕ v14.0: Схема БД для api_requests
   *
   * ЧТО ЭТО:
   * Схема PostgreSQL где находится таблица api_requests с собранными данными.
   *
   * @default 'qa'
   * @example 'qa' -> SELECT * FROM qa.api_requests
   */
  dbDataSchema?: string;

  /**
   * НОВОЕ v14.0: Подключение к БД тестового стенда
   *
   * ЧТО ЭТО:
   * БД на которой работает тестируемое приложение.
   * Используется для валидации данных - проверки что записи всё ещё существуют.
   *
   * ЗАЧЕМ:
   * Данные в qa.api_requests могут устареть - заказ удалён, пользователь заблокирован.
   * Эта БД используется для проверки что данные актуальны.
   *
   * @example
   * const sqlStandConn = postgres({ host: 'test-stand-db.example.com', ... });
   *
   * await generateHappyPathTests({
   *   dbDataConnection: sqlDataGenConn,   // БД с api_requests
   *   dbStandConnection: sqlStandConn,    // БД стенда для валидации
   *   dbStandSchema: 'orders'
   * });
   */
  dbStandConnection?: any;

  /**
   * НОВОЕ v14.0: Схема БД тестового стенда
   * @default 'public'
   */
  dbStandSchema?: string;

  /**
   * @deprecated Используйте dbDataSchema
   */
  dbSchema?: string;

  // ═══════════════════════════════════════════════════════════════════
  // ФИЛЬТРЫ ЭНДПОИНТОВ И МЕТОДОВ
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Генерировать тесты ТОЛЬКО для указанных эндпоинтов (белый список)
   *
   * ЧТО ДЕЛАЕТ:
   * Если указан - генерируются тесты ТОЛЬКО для этих эндпоинтов.
   * Если пустой массив - генерируются тесты для ВСЕХ эндпоинтов.
   *
   * КОГДА ИСПОЛЬЗОВАТЬ:
   * - Хотите сгенерировать тесты только для конкретного модуля
   * - Тестируете новый функционал
   *
   * @example ['/api/v1/orders', '/api/v1/orders/{id}']
   */
  endpointFilter?: string[];

  /**
   * НОВОЕ v14.0: НЕ генерировать тесты для указанных эндпоинтов (черный список)
   *
   * ЧТО ДЕЛАЕТ:
   * Исключает эндпоинты из генерации даже если они попадают в endpointFilter.
   * Поддерживает wildcard: '/api/v1/internal/*' исключит все эндпоинты начинающиеся с этого пути.
   *
   * КОГДА ИСПОЛЬЗОВАТЬ:
   * - Есть внутренние/админские эндпоинты которые не нужно тестировать
   * - Есть эндпоинты с особой логикой которые тестируете вручную
   *
   * @example ['/api/v1/internal/*', '/api/v1/admin', '/api/v1/debug']
   */
  excludeEndpoints?: string[];

  /**
   * Генерировать тесты ТОЛЬКО для указанных HTTP методов
   * @example ['GET', 'POST'] - только GET и POST запросы
   */
  methodFilter?: string[];

  /**
   * НОВОЕ v14.0: НЕ генерировать тесты для указанных HTTP методов
   *
   * ЧТО ДЕЛАЕТ:
   * Исключает HTTP методы из генерации.
   *
   * КОГДА ИСПОЛЬЗОВАТЬ:
   * - DELETE методы слишком опасны для автоматических тестов
   * - PATCH методы имеют сложную логику
   *
   * @example ['DELETE', 'PATCH']
   */
  excludeMethods?: string[];

  /**
   * Максимальное количество тестов на один эндпоинт
   *
   * ЗАЧЕМ:
   * Для одного эндпоинта может быть 100+ запросов в БД.
   * Генерировать 100 тестов бессмысленно - достаточно нескольких уникальных.
   *
   * @default 5
   */
  maxTestsPerEndpoint?: number;

  /**
   * Генерировать тесты только для успешных запросов (2xx)
   * @default true
   */
  onlySuccessful?: boolean;

  // ═══════════════════════════════════════════════════════════════════
  // НАСТРОЙКИ ТЕСТОВ
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Тег для сгенерированных тестов
   * @default '@apiHappyPath'
   * @example '@apiHappyPath @smoke' - можно добавить несколько тегов
   */
  testTag?: string;

  /**
   * Принудительная перегенерация всех тестов
   *
   * ЧТО ДЕЛАЕТ:
   * - false: Инкрементальная генерация - пропускает уже существующие тесты
   * - true: Перезаписывает ВСЕ тесты (кроме @protected)
   *
   * @default false
   */
  force?: boolean;

  /**
   * Переменная окружения с URL тестового стенда
   * @default 'StandURL'
   * @example 'TEST_STAND_URL' -> process.env.TEST_STAND_URL
   */
  standUrlEnvVar?: string;

  /**
   * Имя конфига axios для авторизации
   *
   * ЧТО ЭТО:
   * Имя экспортируемого объекта из axiosConfigPath который содержит
   * headers с авторизацией.
   *
   * @default 'configApiHeaderAdmin'
   * @example
   * // В helpers/axiosHelpers.ts:
   * export const configApiHeaderAdmin = {
   *   headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` }
   * };
   */
  axiosConfigName?: string;

  /**
   * Путь к файлу с axios конфигами (относительно тестового файла)
   * @default '../../../helpers/axiosHelpers'
   */
  axiosConfigPath?: string;

  /**
   * НОВОЕ v14.0: Путь к apiTestHelper для детализации ошибок
   *
   * ЧТО ДЕЛАЕТ:
   * При падении теста выводит детальный response с готовым curl запросом
   * который можно скопировать и выполнить в Postman/терминале.
   *
   * ЗАЧЕМ:
   * Упрощает отладку - сразу видно какой запрос упал и можно повторить вручную.
   *
   * @default '../../../helpers/apiTestHelper'
   */
  apiTestHelperPath?: string;

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL УВЕДОМЛЕНИЯ ПРИ 5xx ОШИБКАХ (v14.1)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * НОВОЕ v14.1: Путь к методу отправки email уведомлений
   *
   * ЧТО ЭТО:
   * Путь к хелперу который экспортирует метод для отправки email.
   * Метод должен принимать HTML-строку с телом письма.
   *
   * КОГДА ИСПОЛЬЗОВАТЬ:
   * Когда хотите получать уведомления о 5xx ошибках на почту.
   *
   * @example '../../../helpers/mailHelper'
   */
  emailHelperPath?: string;

  /**
   * НОВОЕ v14.1: Имя метода для отправки email
   *
   * ЧТО ЭТО:
   * Имя функции которая экспортируется из emailHelperPath.
   *
   * @default 'sendErrorMailbyApi'
   */
  emailHelperMethodName?: string;

  /**
   * НОВОЕ v14.1: Отправлять email уведомления при 5xx ошибках
   *
   * ЧТО ДЕЛАЕТ:
   * При получении ошибок 500, 501, 502, 503 отправляет HTML письмо с:
   * - Названием теста и путём к файлу
   * - Endpoint и HTTP метод
   * - Временем падения (MSK)
   * - Кодом ошибки
   * - CURL командой для повторения запроса
   * - Response data
   *
   * ТРЕБОВАНИЯ:
   * - Настроенный emailHelperPath
   * - Метод должен принимать HTML строку
   *
   * @default false
   */
  send5xxEmailNotification?: boolean;

  /**
   * Путь к сгенерированным API методам (для поиска DTO)
   * @example './src/generated-api'
   */
  apiGeneratedPath?: string;

  /**
   * Создавать отдельные файлы с тестовыми данными
   *
   * ЧТО ДЕЛАЕТ:
   * - false: Данные встроены в тест
   * - true: Данные выносятся в папку test-data/
   *
   * ЗАЧЕМ:
   * - Меньше размер тестового файла
   * - Данные можно переиспользовать
   * - Легче обновлять данные отдельно от логики теста
   *
   * @default false
   */
  createSeparateDataFiles?: boolean;

  /**
   * Объединять дубликаты тестов
   * @default true
   */
  mergeDuplicateTests?: boolean;

  /**
   * Путь для импорта test и expect
   * @default '@playwright/test'
   * @example '../../../fixtures/baseTest' - для кастомных fixtures
   */
  testImportPath?: string;

  /**
   * Название NPM пакета для импорта утилит
   * @default Читается из package.json или '@your-company/api-codegen'
   */
  packageName?: string;

  // ═══════════════════════════════════════════════════════════════════
  // ДЕДУПЛИКАЦИЯ ТЕСТОВ (v12.0)
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Настройки дедупликации тестов
   */
  deduplication?: DeduplicationConfig;

  // ═══════════════════════════════════════════════════════════════════
  // ВАЛИДАЦИЯ ДАННЫХ (v12.0)
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Настройки валидации актуальности данных
   */
  dataValidation?: DataValidationConfig;

  /**
   * Включить детальное логирование для отладки
   * @default false
   */
  debug?: boolean;
}
```

---

## 🔄 ДЕДУПЛИКАЦИЯ ТЕСТОВ (deduplication)

### Зачем это нужно?

**Проблема:**
При сборе API запросов часто получаем много **ПОХОЖИХ** запросов к одному эндпоинту.

Например, для `GET /api/v1/orders/{id}`:
- 50 запросов с разными `id`
- Все возвращают одинаковую структуру `{ id, status, items: [...] }`

**Генерировать 50 одинаковых тестов бессмысленно!**

**Решение:**
Дедупликация оставляет только **УНИКАЛЬНЫЕ** случаи:
- Разные значения `status` (active, deleted, pending)
- Edge cases (пустой массив `items: []`, `null` значения)
- Разные `type` или `role`

### Как работает?

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Группировка по endpoint + method                              │
│    GET /orders/{id} → 50 запросов                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Создание "signature" для каждого запроса                     │
│    - Берём структуру response (поля, типы, вложенность)         │
│    - Игнорируем ignoreFields (id, *_id, timestamps)             │
│    - Учитываем significantFields (status, type, role)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Группировка по signature                                     │
│    Signature A: 30 запросов (status: active)                    │
│    Signature B: 15 запросов (status: deleted)                   │
│    Signature C: 5 запросов (items: [])                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Выбор представителей                                         │
│    maxTestsPerEndpoint: 2 → берём по 1 из каждой группы        │
│    Итого: 3 теста вместо 50!                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Полная конфигурация

```typescript
interface DeduplicationConfig {
  /**
   * Включить дедупликацию
   * @default true
   */
  enabled?: boolean;

  /**
   * Поля которые ИГНОРИРУЮТСЯ при сравнении уникальности
   *
   * ЧТО ЭТО:
   * Эти поля НЕ учитываются при определении уникальности запроса.
   * Поддерживает wildcard: '*_id' матчит 'user_id', 'order_id' и т.д.
   *
   * ЗАЧЕМ:
   * Два запроса с разными id но одинаковой структурой - это ОДИН тест-кейс.
   *
   * @default ['id', '*_id', 'created_at', 'updated_at', 'modified_at',
   *           'deleted_at', 'timestamp', '*_timestamp', 'uuid', 'guid']
   *
   * @example
   * // Эти два response считаются ОДИНАКОВЫМИ:
   * { id: 1, status: 'active', user_id: 100 }
   * { id: 2, status: 'active', user_id: 200 }
   */
  ignoreFields?: string[];

  /**
   * Поля которые ВАЖНЫ для определения уникальности
   *
   * ЧТО ЭТО:
   * Если эти поля ОТЛИЧАЮТСЯ - запросы считаются РАЗНЫМИ тест-кейсами.
   *
   * ЗАЧЕМ:
   * Заказ в статусе 'active' и заказ в статусе 'deleted' - это РАЗНЫЕ тест-кейсы.
   *
   * @default ['status', 'state', 'type', 'role', 'category', 'kind']
   *
   * @example
   * // Эти два response считаются РАЗНЫМИ:
   * { id: 1, status: 'active' }   → Тест 1
   * { id: 2, status: 'deleted' }  → Тест 2
   */
  significantFields?: string[];

  /**
   * Обнаруживать edge cases (граничные случаи)
   *
   * ЧТО ЭТО:
   * Автоматически выделяет тесты с: пустыми массивами, null, 0, пустыми строками.
   *
   * ЗАЧЕМ:
   * Edge cases часто ломают приложение. Важно их тестировать!
   *
   * @default true
   *
   * @example
   * // Оба будут сохранены как разные тест-кейсы:
   * { items: [] }           → Edge case: пустой массив
   * { items: [{...}, ...] } → Обычный случай
   */
  detectEdgeCases?: boolean;

  /**
   * Максимум тестов на один эндпоинт (после дедупликации)
   * @default 2
   */
  maxTestsPerEndpoint?: number;

  /**
   * Теги в названии теста которые защищают от удаления
   *
   * ЧТО ЭТО:
   * Тесты с этими тегами в названии ВСЕГДА сохраняются при дедупликации.
   *
   * ЗАЧЕМ:
   * Можно пометить важные тесты чтобы они не были удалены.
   *
   * @default ['[KEEP]', '[IMPORTANT]']
   *
   * @example
   * // Этот тест НЕ будет удалён даже при дедупликации:
   * test('GET /orders [KEEP] - специальный случай', ...)
   */
  preserveTaggedTests?: string[];
}
```

### Пример использования

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',

  deduplication: {
    enabled: true,

    // Игнорируем все ID и timestamps
    ignoreFields: [
      'id', '*_id', '*_uuid',
      'created_at', 'updated_at', '*_timestamp'
    ],

    // Важны status, type, role
    significantFields: ['status', 'state', 'type', 'role'],

    // Обнаруживать пустые массивы, null
    detectEdgeCases: true,

    // Максимум 3 теста на эндпоинт
    maxTestsPerEndpoint: 3,

    // Защитить тесты с [KEEP]
    preserveTaggedTests: ['[KEEP]', '[IMPORTANT]', '[REGRESSION]']
  }
}, sql);
```

---

## ✅ ВАЛИДАЦИЯ ДАННЫХ (dataValidation)

### Зачем это нужно?

**Проблема:**
Собранные API запросы **УСТАРЕВАЮТ**:
- Заказ был в статусе `pending`, а теперь `completed`
- Пользователь удалён
- Товар закончился на складе

Тест с ожиданием `status: 'pending'` будет **ПАДАТЬ**!

**Решение:**
Валидация проверяет актуальность данных ПЕРЕД генерацией теста.

### Как работает?

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Берём запрос из qa.api_requests                              │
│    GET /orders/123 → response: { status: 'pending' }            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Отправляем РЕАЛЬНЫЙ запрос на стенд                         │
│    GET https://api.example.com/orders/123                       │
│    → Получаем: { status: 'completed' }                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Сравниваем significant поля                                  │
│    Сохранённый: status = 'pending'                              │
│    Актуальный:  status = 'completed'                            │
│    → Данные УСТАРЕЛИ!                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Применяем стратегию onStaleData                              │
│    'update' → обновить response в qa.api_requests               │
│    'skip'   → пропустить генерацию теста                        │
│    'delete' → удалить запрос из qa.api_requests                 │
└─────────────────────────────────────────────────────────────────┘
```

### Полная конфигурация

```typescript
interface DataValidationConfig {
  /**
   * Включить валидацию данных
   * @default true
   */
  enabled?: boolean;

  /**
   * Проверять актуальность данных ПЕРЕД генерацией теста
   *
   * ЧТО ДЕЛАЕТ:
   * Отправляет реальный запрос на стенд и сравнивает с сохранённым response.
   *
   * ЗАЧЕМ:
   * Гарантирует что тест будет проходить - данные актуальны.
   *
   * @default true
   */
  validateBeforeGeneration?: boolean;

  /**
   * Что делать с устаревшими данными
   *
   * 'update':
   *   - Обновляет response в qa.api_requests актуальными данными
   *   - Генерирует тест с новыми данными
   *   - ПЛЮС: Данные всегда актуальны
   *   - МИНУС: Может потерять историю изменений
   *
   * 'skip':
   *   - Пропускает генерацию теста
   *   - Не трогает данные в БД
   *   - ПЛЮС: Безопасно, ничего не меняет
   *   - МИНУС: Тест не будет сгенерирован
   *
   * 'delete':
   *   - Удаляет запрос из qa.api_requests
   *   - ПЛЮС: Очищает устаревшие данные
   *   - МИНУС: Данные потеряны навсегда
   *
   * @default 'delete'
   */
  onStaleData?: 'update' | 'skip' | 'delete';

  /**
   * Поля которые определяют что данные устарели
   *
   * ЧТО ЭТО:
   * Если эти поля ИЗМЕНИЛИСЬ - данные считаются устаревшими.
   *
   * @default ['status', 'state', 'type', 'role', 'category']
   *
   * @example
   * // Сохранённый response:
   * { status: 'pending', updated_at: '2024-01-01' }
   *
   * // Актуальный response:
   * { status: 'completed', updated_at: '2024-02-01' }
   *
   * // staleIfChanged: ['status'] → УСТАРЕЛИ (status изменился)
   * // staleIfChanged: ['type']   → НЕ устарели (type не изменился)
   */
  staleIfChanged?: string[];

  /**
   * Изменения каких полей ДОПУСТИМЫ (не считаются устареванием)
   *
   * ЧТО ЭТО:
   * Даже если эти поля изменились - данные НЕ считаются устаревшими.
   * Поддерживает wildcard: '*_at' матчит 'created_at', 'updated_at'.
   *
   * ЗАЧЕМ:
   * Timestamps меняются всегда, но это не значит что данные устарели.
   *
   * @default ['updated_at', 'modified_at', '*_timestamp', '*_at']
   */
  allowChanges?: string[];

  /**
   * Дополнительно проверять данные в БД тестового стенда
   *
   * ЧТО ДЕЛАЕТ:
   * Кроме API запроса, проверяет что запись существует в БД.
   *
   * ЗАЧЕМ:
   * API может кэшировать ответы. Проверка в БД - более надёжна.
   *
   * ТРЕБУЕТ:
   * Настроенный dbStandConnection
   *
   * @default false
   */
  validateInDatabase?: boolean;

  /**
   * Логировать все обнаруженные изменения данных
   * @default true
   */
  logChanges?: boolean;

  /**
   * Путь для сохранения логов валидации
   * @default './happy-path-validation-logs'
   */
  logPath?: string;
}
```

### Пример использования

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',

  // Два подключения к БД (v14.0)
  dbDataConnection: sqlDataGenConn,  // БД с api_requests
  dbStandConnection: sqlStandConn,   // БД стенда для валидации

  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,

    // Устаревшие данные - обновить
    onStaleData: 'update',

    // Данные устарели если изменились эти поля
    staleIfChanged: ['status', 'state', 'is_active', 'is_deleted'],

    // Изменения этих полей допустимы
    allowChanges: ['updated_at', 'modified_at', '*_timestamp', '*_at', 'last_login'],

    // Проверять также в БД
    validateInDatabase: true,

    // Логировать
    logChanges: true,
    logPath: './logs/happy-path-validation'
  }
}, sqlDataGenConn);
```

---

## 📝 ПОЛНЫЙ ПРИМЕР (v14.0)

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

// Подключение к БД с собранными данными (qa.api_requests)
const sqlDataGenConn = postgres({
  host: 'data-gen-db.example.com',
  port: 5432,
  database: 'api_data',
  user: 'reader',
  password: process.env.DATA_DB_PASSWORD
});

// Подключение к БД тестового стенда (для валидации)
const sqlStandConn = postgres({
  host: 'test-stand-db.example.com',
  port: 5432,
  database: 'orders_service',
  user: 'validator',
  password: process.env.STAND_DB_PASSWORD
});

await generateHappyPathTests({
  // === ОСНОВНЫЕ ===
  outputDir: './e2e/api/happy-path',
  groupByCategory: true,  // orders/, users/, products/

  // === ПОДКЛЮЧЕНИЯ К БД (v14.0) ===
  dbDataConnection: sqlDataGenConn,
  dbDataSchema: 'qa',           // qa.api_requests
  dbStandConnection: sqlStandConn,
  dbStandSchema: 'public',

  // === ФИЛЬТРЫ ===
  endpointFilter: [],           // Все эндпоинты
  excludeEndpoints: [           // Исключить
    '/api/v1/internal/*',
    '/api/v1/admin/*',
    '/api/v1/debug'
  ],
  methodFilter: [],             // Все методы
  excludeMethods: ['DELETE'],   // Исключить DELETE

  // === НАСТРОЙКИ ТЕСТОВ ===
  maxTestsPerEndpoint: 5,
  onlySuccessful: true,
  testTag: '@apiHappyPath @regression',
  force: false,

  // === ПУТИ ===
  testImportPath: '../../../fixtures/baseTest',
  axiosConfigPath: '../../../helpers/axiosHelpers',
  axiosConfigName: 'configApiHeaderAdmin',
  apiTestHelperPath: '../../../helpers/apiTestHelper',  // v14.0

  // === ДЕДУПЛИКАЦИЯ ===
  deduplication: {
    enabled: true,
    ignoreFields: ['id', '*_id', '*_uuid', '*_at', '*_timestamp'],
    significantFields: ['status', 'state', 'type', 'role', 'is_active'],
    detectEdgeCases: true,
    maxTestsPerEndpoint: 3,
    preserveTaggedTests: ['[KEEP]', '[REGRESSION]']
  },

  // === ВАЛИДАЦИЯ ===
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update',
    staleIfChanged: ['status', 'state', 'is_deleted'],
    allowChanges: ['*_at', '*_timestamp'],
    validateInDatabase: true,
    logChanges: true,
    logPath: './logs/validation'
  },

  // === ОТЛАДКА ===
  debug: false
}, sqlDataGenConn);

await sqlDataGenConn.end();
await sqlStandConn.end();
```

---

## 📂 РЕЗУЛЬТАТ ГЕНЕРАЦИИ (v14.0)

```
e2e/api/happy-path/
├── orders/                           # Группа "orders"
│   ├── create-order.happy-path.test.ts
│   ├── get-order-by-id.happy-path.test.ts
│   ├── update-order.happy-path.test.ts
│   └── test-data/
│       ├── create-order-data-1.ts
│       └── get-order-by-id-data-1.ts
├── users/                            # Группа "users"
│   ├── get-user.happy-path.test.ts
│   └── test-data/
│       └── get-user-data-1.ts
├── products/                         # Группа "products"
│   ├── search-products.happy-path.test.ts
│   └── test-data/
└── other/                            # Прочие
    └── health-check.happy-path.test.ts
```

---

## ⚙️ ЧТО ДЕЛАЕТ v14.0

1. **Группировка по категориям** - тесты лежат в подпапках orders/, users/
2. **Раздельные подключения к БД** - одна БД для данных, другая для валидации
3. **Фильтры исключения** - excludeEndpoints, excludeMethods
4. **apiTestHelper в catch** - детальный вывод ошибок с curl
5. **Улучшенные описания** - каждый параметр документирован

---

### reActualizeHappyPathTests() - v14.1 ⭐ NEW

Обновление тестовых данных в существующих Happy Path тестах на основе актуальных ответов API.

#### 🎯 ЗАЧЕМ ЭТО НУЖНО

**Проблема:** Со временем данные в API меняются - добавляются новые поля, меняются значения, удаляются старые поля. Тесты начинают падать из-за устаревших expected данных.

**Решение:** `reActualizeHappyPathTests()` автоматически:
1. Сканирует существующие Happy Path тесты
2. Вызывает реальные API endpoints
3. Сравнивает ответы с ожидаемыми данными в тестах
4. Обновляет тестовые файлы при обнаружении изменений

#### Интерфейс

```typescript
interface ReActualizeConfig {
  /**
   * Путь к папке со сгенерированными Happy Path тестами
   * @required
   * @example './e2e/api/happy-path'
   */
  testsDir: string;

  /**
   * URL тестового стенда
   * @required
   * @example 'https://api.example.com'
   */
  standUrl: string;

  /**
   * Axios конфиг для авторизации
   * @required
   * @example { headers: { Authorization: 'Bearer xxx' } }
   */
  axiosConfig: any;

  /**
   * Фильтр endpoints для актуализации
   * Если пустой массив - актуализируются все endpoints
   * @example ['/api/v1/orders', '/api/v1/users/{id}']
   */
  endpointFilter?: string[];

  /**
   * Обновлять тестовые данные в файлах
   * Если false - только показывает что изменилось (dry-run)
   * @default true
   */
  updateFiles?: boolean;

  /**
   * Включить детальное логирование
   * @default false
   */
  debug?: boolean;
}

interface ReActualizeResult {
  totalTests: number;       // Всего обработано тестов
  updatedTests: number;     // Обновлено тестов
  skippedTests: number;     // Пропущено тестов
  failedTests: number;      // Тестов с ошибками
  details: Array<{
    testFile: string;
    endpoint: string;
    method: string;
    status: 'updated' | 'skipped' | 'failed' | 'unchanged';
    reason?: string;
    changedFields?: string[];
  }>;
}
```

#### Пример использования

```typescript
import { reActualizeHappyPathTests } from '@your-company/api-codegen';

// Полная реактуализация всех тестов
const result = await reActualizeHappyPathTests({
  testsDir: './tests/api/happy-path',
  standUrl: process.env.StandURL,
  axiosConfig: { headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` } },
  updateFiles: true,
  debug: true
});

console.log(`✅ Обновлено: ${result.updatedTests}`);
console.log(`⏭️  Пропущено: ${result.skippedTests}`);
console.log(`❌ Ошибок: ${result.failedTests}`);

// Показать детали по каждому тесту
for (const detail of result.details) {
  if (detail.status === 'updated') {
    console.log(`📝 ${detail.endpoint}: изменены поля ${detail.changedFields?.join(', ')}`);
  }
}
```

#### Dry-run режим (только просмотр)

```typescript
// Посмотреть что изменится БЕЗ обновления файлов
const result = await reActualizeHappyPathTests({
  testsDir: './tests/api/happy-path',
  standUrl: process.env.StandURL,
  axiosConfig: configApiHeaderAdmin,
  updateFiles: false,  // ← Не обновлять файлы
  debug: true
});
```

#### Фильтрация по endpoints

```typescript
// Обновить только тесты для orders
const result = await reActualizeHappyPathTests({
  testsDir: './tests/api/happy-path',
  standUrl: process.env.StandURL,
  axiosConfig: configApiHeaderAdmin,
  endpointFilter: ['/api/v1/orders', '/api/v1/orders/{id}'],
  updateFiles: true
});
```

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

**Версия документации:** v14.1
**Последнее обновление:** 2026-02-10
