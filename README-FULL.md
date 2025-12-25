# API Code Generator with Happy Path Tests

Генератор API клиентов и тестов из OpenAPI спецификации с поддержкой Happy Path тестов на основе реальных данных.

## 🎯 Основные возможности

- ✅ Генерация TypeScript API клиента из OpenAPI 2.0/3.0/3.1
- ✅ Генерация позитивных, негативных и pairwise тестов
- ✅ **Генерация Happy Path тестов на основе данных с фронта** (собранных в БД)
- ✅ Анализ базы данных для тестовых данных
- ✅ Глубокое сравнение объектов с учетом порядка в массивах
- ✅ Нормализация данных из БД
- ✅ Конфигурируемая глобальная переменная стенда
- ✅ Конфигурируемый axios config
- ✅ Валидация структуры и типов данных
- ✅ Проверка обязательных полей из DTO
- ✅ Вынос данных в отдельные файлы
- ✅ Объединение дублирующих тестов

## 📦 Установка

```bash
npm install
npm run build
```

## 🔧 Все исправления (12 пунктов)

### 1️⃣ Полный архив проекта ✅
**Что сделано:** Весь проект выдается в одном архиве
- Не нужно искать какой файл куда класть
- Просто распаковываете и работаете

### 2️⃣ Префикс .test.ts вместо .spec.ts ✅
**Что сделано:** Файлы генерируются с правильным расширением

**Было:**
```
orders.happy-path.spec.ts
```

**Стало:**
```
orders.happy-path.test.ts
```

**Код:**
```typescript
// happy-path-generator.ts, строка ~244
const filePath = path.join(this.config.outputDir, `${fileName}.happy-path.test.ts`);
```

### 3️⃣ Структура теста как в примерах ✅
**Что сделано:** Тесты генерируются с полной структурой (caseInfoObj, description)

**Пример:**
```typescript
test('POST Happy Path #1 @api @apiHappyPath', async ({ page }, testInfo) => {
  const description = 'Тест на основе реальных данных с UI';
  
  const caseInfoObj = {
    id: testInfo.testId,
    title: testInfo.title,
    description: description,
    endpoint: endpoint,
    method: httpMethod,
    expectedStatus: success,
  };
  
  await testInfo.attach('Test Case Info', {
    body: JSON.stringify(caseInfoObj, null, 2),
    contentType: 'application/json',
  });
  
  // ... остальной код теста
});
```

**Файл примера:** `generated/tests/pet/findPetsByStatus.test.ts`

### 4️⃣ Использование только axios ✅
**Что сделано:** Все запросы делаются через axios (без request от Playwright)

**Было:**
```typescript
const response = await request.post(endpoint, { data: testData });
```

**Стало:**
```typescript
const response = await axios.post(
  process.env.STANDURL + endpoint,
  requestData,
  STANDCONFIG
);
```

### 5️⃣ Нормализация данных из БД ✅
**Что сделано:** Автоматическое преобразование данных из БД

**Проблема:**
```javascript
dbData = "{\"id\":\"423\",\"status\":\"INPROGRESS\"}"  // Строка с экранированием
responseData = {"id":423,"status":"INPROGRESS"}      // Объект с правильными типами
```

**Решение:**
```typescript
// helpers/dataComparison.ts - normalizeDbData()
const comparison = compareDbWithResponse(expectedResponse, response.data);
// Внутри происходит автоматическая нормализация
```

### 6️⃣ Глубокое сравнение объектов ✅
**Что сделано:** Игнорирование порядка элементов в массивах

**Проблема:**
```typescript
{status: ["A", "B"]} !== {status: ["B", "A"]}  // ❌ Ошибка
```

**Решение:**
```typescript
{status: ["A", "B"]} == {status: ["B", "A"]}   // ✅ Равны
// Массивы сортируются перед сравнением
```

**Файл:** `src/helpers/dataComparison.ts` - функция `deepCompareObjects()`

### 7️⃣ Конфигурируемая глобальная переменная стенда ✅
**Что сделано:** Можно указать свою переменную окружения для URL стенда

**Конфигурация:**
```typescript
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    standUrlEnvVar: 'STANDURL', // ← Ваша переменная
    // ... другие параметры
  },
  testDbConnect
);
```

**В тесте:**
```typescript
const response = await axios.post(
  process.env.STANDURL + endpoint,  // ← Используется ваша переменная
  requestData,
  STANDCONFIG
);
```

**Значение по умолчанию:** `'STANDURL'`

### 8️⃣ Конфигурируемый axios config ✅
**Что сделано:** Можно указать свой config и путь к нему

**Конфигурация:**
```typescript
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    axiosConfigName: 'STANDCONFIG',                    // ← Название конфига
    axiosConfigPath: './projects/utils/axiosHelpers', // ← Путь к файлу
    // ... другие параметры
  },
  testDbConnect
);
```

**В тесте автоматически добавляется:**
```typescript
import { STANDCONFIG } from './projects/utils/axiosHelpers';

const response = await axios.post(
  process.env.STANDURL + endpoint,
  requestData,
  STANDCONFIG  // ← Ваш конфиг
);
```

**Значения по умолчанию:**
- `axiosConfigName: 'STANDCONFIG'`
- `axiosConfigPath: '../../../helpers/axiosHelpers'`

### 9️⃣ Валидация структуры и типов данных ✅
**Что сделано:** Автоматическая проверка типов всех полей в response

**В тесте генерируется:**
```typescript
// Валидация структуры и типов данных
await expect(response.data.id).toBeDefined();
await expect(typeof response.data.id).toBe('number');
await expect(response.data.status).toBeDefined();
await expect(typeof response.data.status).toBe('string');
await expect(Array.isArray(response.data.items)).toBe(true);
```

**Файл:** `src/helpers/schemaValidation.ts`

**Функции:**
- `validateDataStructure()` - проверка структуры
- `inferSchemaFromData()` - автоопределение схемы из примера
- `generateValidationCode()` - генерация кода проверок

### 🔟 Проверка обязательных полей из DTO ✅
**Что сделано:** Поиск DTO в сгенерированных файлах и проверка обязательных полей

**Конфигурация:**
```typescript
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    apiGeneratedPath: './node_modules/@your-company/dist/generated/orders/', // ← Путь к файлам с DTO
    // ... другие параметры
  },
  testDbConnect
);
```

**Что происходит:**
1. Генератор ищет endpoint `/api/v1/orders` с методом `POST`
2. Находит связанный DTO (например `CreateOrderResponse`)
3. Извлекает обязательные поля из DTO
4. Добавляет проверки в тест:

```typescript
import type { CreateOrderResponse } from '../../../generated/orders/orders.api';

// Проверка обязательных полей из DTO: CreateOrderResponse
await expect(response.data.id).toBeDefined();
await expect(typeof response.data.id).toBe('number');
await expect(response.data.status).toBeDefined();
await expect(typeof response.data.status).toBe('string');
await expect(response.data.createdAt).toBeDefined();
```

**Файл:** `src/helpers/dtoFinder.ts`

**Функции:**
- `findEndpointDto()` - поиск endpoint в файлах
- `getDtoInfo()` - извлечение информации о DTO
- `generateDtoValidationCode()` - генерация проверок

### 1️⃣1️⃣ Вынос данных в отдельные файлы ✅
**Что сделано:** Request и Response хранятся в отдельных файлах

**Конфигурация:**
```typescript
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    createSeparateDataFiles: true, // ← Включить вынос данных
    // ... другие параметры
  },
  testDbConnect
);
```

**Структура файлов:**
```
tests/api/happy-path/
├── post-orders.happy-path.test.ts     ← Тесты
└── test-data/                         ← Папка с данными
    ├── post-orders-data-1.ts          ← Данные для теста #1
    ├── post-orders-data-2.ts          ← Данные для теста #2
    └── post-orders-data-3.ts          ← Данные для теста #3
```

**Файл с данными:**
```typescript
// test-data/post-orders-data-1.ts
export const requestData = {
  productId: 100,
  quantity: 5,
  customerId: 42
};

export const expectedResponse = {
  id: 423,
  status: "INPROGRESS",
  productId: 100
};
```

**В тесте:**
```typescript
import { requestData as requestData1, expectedResponse as expectedResponse1 } from './test-data/post-orders-data-1';

test('POST Happy Path #1', async ({ page }, testInfo) => {
  // Данные из отдельного файла
  const requestData = requestData1;
  
  const response = await axios.post(...);
  
  const expectedResponse = expectedResponse1;
  const comparison = compareDbWithResponse(expectedResponse, response.data);
});
```

**Значение по умолчанию:** `createSeparateDataFiles: true`

### 1️⃣2️⃣ Объединение дублирующих тестов ✅
**Что сделано:** Тесты с одинаковой структурой объединяются в один файл

**Конфигурация:**
```typescript
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    mergeDuplicateTests: true, // ← Включить объединение
    // ... другие параметры
  },
  testDbConnect
);
```

**Проблема:**
```
/api/v1/getOrderById/123
/api/v1/getOrderById/456  
/api/v1/getOrderById/789
```
→ 3 отдельных теста с дублированием кода

**Решение:**
```typescript
// Один файл: get-orderbyid.happy-path.test.ts
test('GET Happy Path #1 (ID: 123)', async () => { ... });
test('GET Happy Path #2 (ID: 456)', async () => { ... });
test('GET Happy Path #3 (ID: 789)', async () => { ... });
```

**Как работает:**
1. Анализируется структура request (игнорируя ID и параметры)
2. Создается хэш структуры
3. Тесты с одинаковым хэшом группируются в один файл
4. Каждый вариант становится отдельным тестом в файле

**Значение по умолчанию:** `mergeDuplicateTests: true`

**Файл:** `happy-path-generator.ts` - метод `groupByStructure()`

## 🚀 Использование

### Полная конфигурация

```typescript
// scripts/generate-happy-tests.ts
import { generateHappyPathTests } from '@your-company/api-codegen';
import { testDbConnect } from '../helpers/dbConnection';

(async () => {
  await generateHappyPathTests(
    {
      // Основные параметры
      outputDir: './tests/api/happy-path',
      dbConnectionMethod: 'testDbConnect',
      dbSchema: 'qa',
      
      // Фильтры
      endpointFilter: ['/api/v1/orders', '/api/v1/products'],
      methodFilter: ['POST', 'PUT'],
      maxTestsPerEndpoint: 10,
      onlySuccessful: true,
      
      // Теги
      testTag: '@apiHappyPath',
      
      // Режим
      force: false,
      
      // Пункт 7: Глобальная переменная стенда
      standUrlEnvVar: 'STANDURL',
      
      // Пункт 8: Axios config
      axiosConfigName: 'STANDCONFIG',
      axiosConfigPath: './projects/utils/axiosHelpers',
      
      // Пункт 10: Путь к сгенерированным API файлам
      apiGeneratedPath: './node_modules/@your-company/dist/generated/',
      
      // Пункт 11: Отдельные файлы с данными
      createSeparateDataFiles: true,
      
      // Пункт 12: Объединение дублей
      mergeDuplicateTests: true,
    },
    testDbConnect
  );
})();
```

**Запуск:**
```bash
npx ts-node scripts/generate-happy-tests.ts
```

### Базовая конфигурация

```typescript
// Минимальная конфигурация с дефолтными значениями
await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'qa',
  },
  testDbConnect
);
```

## 📝 Пример сгенерированного теста

```typescript
import { test, expect } from '@playwright/test';
import axios from 'axios';
import { STANDCONFIG } from './projects/utils/axiosHelpers';
import { apiErrorCodes } from '../../../helpers/apiErrorCodes';
import { compareDbWithResponse } from '../../../helpers/dataComparison';
import type { CreateOrderResponse } from '../../../generated/orders/orders.api';
import { requestData as requestData1, expectedResponse as expectedResponse1 } from './test-data/post-orders-data-1';

test.describe('POST /api/v1/orders - Happy Path', () => {
  test.describe.configure({ tag: '@apiHappyPath' });
  
  const endpoint = '/api/v1/orders';
  const httpMethod = 'POST';
  const success = apiErrorCodes.created;
  
  test('POST Happy Path #1 @api @apiHappyPath', async ({ page }, testInfo) => {
    const description = 'Тест на основе реальных данных с UI (DB ID: 123)';
    
    // Пункт 3: caseInfoObj
    const caseInfoObj = {
      id: testInfo.testId,
      title: testInfo.title,
      description: description,
      endpoint: endpoint,
      method: httpMethod,
      expectedStatus: success,
      dbRecordId: 123,
    };
    
    await testInfo.attach('Test Case Info', {
      body: JSON.stringify(caseInfoObj, null, 2),
      contentType: 'application/json',
    });
    
    // DB ID: db-id-123
    // Пункт 11: Данные из отдельного файла
    const requestData = requestData1;
    
    // Пункт 4, 7, 8: Только axios с конфигурируемыми параметрами
    const response = await axios.post(
      process.env.STANDURL + endpoint,
      requestData,
      STANDCONFIG
    );
    
    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
    
    // Пункт 9: Валидация структуры и типов
    await expect(response.data.id).toBeDefined();
    await expect(typeof response.data.id).toBe('number');
    await expect(response.data.status).toBeDefined();
    
    // Пункт 10: Проверка обязательных полей из DTO
    await expect(response.data.id).toBeDefined();
    await expect(typeof response.data.id).toBe('number');
    await expect(response.data.status).toBeDefined();
    await expect(typeof response.data.status).toBe('string');
    
    // Пункт 5 и 6: Нормализация и глубокое сравнение
    const expectedResponse = expectedResponse1;
    
    const comparison = compareDbWithResponse(expectedResponse, response.data);
    
    if (!comparison.isEqual) {
      console.log('Различия найдены:');
      comparison.differences.forEach(diff => console.log('  -', diff));
    }
    
    await expect(comparison.isEqual).toBe(true);
  });
});
```

## 📁 Структура проекта

```
api-generator/
├── src/
│   ├── happy-path-generator.ts       ✨ Главный генератор (все 12 пунктов)
│   ├── helpers/
│   │   ├── dataComparison.ts         ✨ Пункты 5, 6
│   │   ├── schemaValidation.ts       ✨ Пункт 9
│   │   ├── dtoFinder.ts              ✨ Пункт 10
│   │   ├── axiosHelpers.ts           ✨ Пункт 8
│   │   └── apiErrorCodes.ts
│   └── ...
│
├── generated/tests/pet/
│   └── findPetsByStatus.test.ts      ✨ Пример правильной структуры
│
├── dist/                             ✨ Скомпилированный код
└── README.md                         ✨ Эта документация
```

## 🧪 Запуск тестов

```bash
# Все Happy Path тесты
npx playwright test --grep @apiHappyPath

# Конкретный endpoint
npx playwright test post-orders.happy-path.test.ts

# С фильтром по методу
npx playwright test --grep "@apiHappyPath.*POST"
```

## ⚙️ Конфигурация

### HappyPathTestConfig

| Параметр | Тип | Описание | По умолчанию | Пункт |
|----------|-----|----------|--------------|-------|
| `outputDir` | `string` | Папка для тестов | **обязательно** | - |
| `dbConnectionMethod` | `string` | Имя метода БД | **обязательно** | - |
| `dbSchema` | `string` | Схема БД | `'qa'` | - |
| `maxTestsPerEndpoint` | `number` | Макс тестов | `10` | - |
| `onlySuccessful` | `boolean` | Только 2xx | `true` | - |
| `testTag` | `string` | Тег | `'@apiHappyPath'` | - |
| `force` | `boolean` | Перегенерация | `false` | - |
| `standUrlEnvVar` | `string` | Переменная URL | `'STANDURL'` | 7️⃣ |
| `axiosConfigName` | `string` | Название конфига | `'STANDCONFIG'` | 8️⃣ |
| `axiosConfigPath` | `string` | Путь к конфигу | `'../../../helpers/axiosHelpers'` | 8️⃣ |
| `apiGeneratedPath` | `string` | Путь к DTO | `''` | 🔟 |
| `createSeparateDataFiles` | `boolean` | Отдельные файлы | `true` | 1️⃣1️⃣ |
| `mergeDuplicateTests` | `boolean` | Объединять дубли | `true` | 1️⃣2️⃣ |

## 📚 API Reference

### Основные функции

#### generateHappyPathTests()
```typescript
async function generateHappyPathTests(
  config: HappyPathTestConfig,
  sqlConnection: any
): Promise<void>
```

### Утилиты сравнения данных (пункты 5, 6)

#### compareDbWithResponse()
```typescript
function compareDbWithResponse(
  dbData: any,
  responseData: any
): {
  isEqual: boolean;
  differences: string[];
  normalizedDb: any;
  normalizedResponse: any;
}
```

#### normalizeDbData()
```typescript
function normalizeDbData(data: any): any
```

#### deepCompareObjects()
```typescript
function deepCompareObjects(
  actual: any,
  expected: any,
  path?: string
): {
  isEqual: boolean;
  differences: string[];
}
```

### Утилиты валидации (пункт 9)

#### validateDataStructure()
```typescript
function validateDataStructure(
  data: any,
  schema: FieldSchema[],
  path?: string
): ValidationResult
```

#### inferSchemaFromData()
```typescript
function inferSchemaFromData(
  data: any,
  fieldName?: string
): FieldSchema
```

### Утилиты поиска DTO (пункт 10)

#### findEndpointDto()
```typescript
function findEndpointDto(
  apiGeneratedPath: string,
  endpoint: string,
  method: string
): EndpointInfo | null
```

#### getDtoInfo()
```typescript
function getDtoInfo(
  apiGeneratedPath: string,
  dtoName: string
): DTOInfo | null
```

## ⚠️ Требования

- Node.js >= 16
- TypeScript >= 5.0
- PostgreSQL (для Happy Path тестов)
- Playwright (для запуска тестов)
- Библиотека `postgres` версии 3.4.5

## 📝 Лицензия

MIT

---

**Все 12 пунктов реализованы! Готово к использованию!** 🎉
