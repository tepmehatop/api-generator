# 🚀 Быстрый старт - Исправления 7-12 пунктов

## 📦 Установка

1. Распакуйте архив:
```bash
tar -xzf api-generator-all-12-points.tar.gz
cd api-generator
```

2. Установите зависимости:
```bash
npm install
```

3. Соберите (уже собран):
```bash
npm run build
```

## ✅ Что добавлено (7-12 пункты)

### 7️⃣ Конфигурируемая глобальная переменная стенда
✅ Теперь можно указать свою переменную окружения для URL

**Конфигурация:**
```typescript
await generateHappyPathTests({
  standUrlEnvVar: 'MYSTANDURL',  // Ваша переменная
}, testDbConnect);
```

**В тесте:**
```typescript
const response = await axios.post(
  process.env.MYSTANDURL + endpoint,  // ← Ваша переменная
  requestData,
  config
);
```

### 8️⃣ Конфигурируемый axios config
✅ Можно указать свой конфиг и путь к нему

**Конфигурация:**
```typescript
await generateHappyPathTests({
  axiosConfigName: 'myCustomConfig',
  axiosConfigPath: './my/path/to/config',
}, testDbConnect);
```

**В тесте автоматически:**
```typescript
import { myCustomConfig } from './my/path/to/config';

const response = await axios.post(
  process.env.STANDURL + endpoint,
  requestData,
  myCustomConfig  // ← Ваш конфиг
);
```

### 9️⃣ Валидация структуры и типов данных
✅ Автоматическая проверка типов всех полей

**В тесте генерируется:**
```typescript
// Валидация структуры и типов
await expect(response.data.id).toBeDefined();
await expect(typeof response.data.id).toBe('number');
await expect(response.data.status).toBeDefined();
await expect(typeof response.data.status).toBe('string');
await expect(Array.isArray(response.data.items)).toBe(true);
```

### 🔟 Проверка обязательных полей из DTO
✅ Поиск DTO и проверка обязательных полей

**Конфигурация:**
```typescript
await generateHappyPathTests({
  apiGeneratedPath: './node_modules/@company/dist/generated/',
}, testDbConnect);
```

**Что делает:**
1. Находит endpoint в сгенерированных файлах
2. Извлекает DTO
3. Добавляет проверки обязательных полей:

```typescript
import type { CreateOrderResponse } from '../../../generated/orders';

// Проверка обязательных полей из DTO
await expect(response.data.id).toBeDefined();
await expect(response.data.status).toBeDefined();
await expect(response.data.createdAt).toBeDefined();
```

### 1️⃣1️⃣ Вынос данных в отдельные файлы
✅ Request/Response в отдельных файлах

**Конфигурация:**
```typescript
await generateHappyPathTests({
  createSeparateDataFiles: true,  // По умолчанию true
}, testDbConnect);
```

**Результат:**
```
tests/api/happy-path/
├── post-orders.happy-path.test.ts
└── test-data/
    ├── post-orders-data-1.ts  ← export const requestData = {...}
    ├── post-orders-data-2.ts  ← export const expectedResponse = {...}
    └── post-orders-data-3.ts
```

**В тесте:**
```typescript
import { requestData1, expectedResponse1 } from './test-data/post-orders-data-1';

test('POST Happy Path #1', async () => {
  const requestData = requestData1;  // Данные из файла
  // ...
  const expectedResponse = expectedResponse1;
});
```

### 1️⃣2️⃣ Объединение дублирующих тестов
✅ Тесты с одинаковой структурой в одном файле

**Конфигурация:**
```typescript
await generateHappyPathTests({
  mergeDuplicateTests: true,  // По умолчанию true
}, testDbConnect);
```

**Было:**
```
get-orderbyid-123.test.ts
get-orderbyid-456.test.ts  
get-orderbyid-789.test.ts
```

**Стало:**
```typescript
// Один файл: get-orderbyid.happy-path.test.ts
test('GET Happy Path #1 (ID: 123)', async () => { ... });
test('GET Happy Path #2 (ID: 456)', async () => { ... });
test('GET Happy Path #3 (ID: 789)', async () => { ... });
```

## 🔧 Полная конфигурация

```typescript
// scripts/generate-happy-tests.ts
import { generateHappyPathTests } from '@your-company/api-codegen';
import { testDbConnect } from '../helpers/dbConnection';

(async () => {
  await generateHappyPathTests(
    {
      // Основные (из пунктов 1-6)
      outputDir: './tests/api/happy-path',
      dbConnectionMethod: 'testDbConnect',
      dbSchema: 'qa',
      maxTestsPerEndpoint: 10,
      
      // 🆕 Пункт 7: Глобальная переменная стенда
      standUrlEnvVar: 'STANDURL',
      
      // 🆕 Пункт 8: Axios config
      axiosConfigName: 'STANDCONFIG',
      axiosConfigPath: './projects/utils/axiosHelpers',
      
      // 🆕 Пункт 10: Путь к DTO
      apiGeneratedPath: './node_modules/@your-company/dist/generated/',
      
      // 🆕 Пункт 11: Отдельные файлы
      createSeparateDataFiles: true,
      
      // 🆕 Пункт 12: Объединение дублей
      mergeDuplicateTests: true,
    },
    testDbConnect
  );
})();
```

## 📝 Пример сгенерированного теста (все пункты)

```typescript
import { test, expect } from '@playwright/test';
import axios from 'axios';
import { STANDCONFIG } from './projects/utils/axiosHelpers'; // ← Пункт 8
import { apiErrorCodes } from '../../../helpers/apiErrorCodes';
import { compareDbWithResponse } from '../../../helpers/dataComparison';
import type { CreateOrderResponse } from '../../../generated/orders'; // ← Пункт 10
import { requestData1, expectedResponse1 } from './test-data/post-orders-data-1'; // ← Пункт 11

test.describe('POST /api/v1/orders - Happy Path', () => {
  test.describe.configure({ tag: '@apiHappyPath' });
  
  const endpoint = '/api/v1/orders';
  const httpMethod = 'POST';
  const success = apiErrorCodes.created;
  
  test('POST Happy Path #1', async ({ page }, testInfo) => {
    const description = 'Тест на основе реальных данных';
    
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
    
    // Пункт 11: Данные из отдельного файла
    const requestData = requestData1;
    
    // Пункт 7 и 8: Конфигурируемые параметры
    const response = await axios.post(
      process.env.STANDURL + endpoint,  // ← Пункт 7
      requestData,
      STANDCONFIG  // ← Пункт 8
    );
    
    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
    
    // Пункт 9: Валидация типов
    await expect(response.data.id).toBeDefined();
    await expect(typeof response.data.id).toBe('number');
    
    // Пункт 10: Проверка DTO
    await expect(response.data.id).toBeDefined();
    await expect(response.data.status).toBeDefined();
    await expect(response.data.createdAt).toBeDefined();
    
    // Пункты 5 и 6: Нормализация и сравнение
    const expectedResponse = expectedResponse1;
    const comparison = compareDbWithResponse(expectedResponse, response.data);
    
    await expect(comparison.isEqual).toBe(true);
  });
});
```

## 📁 Новые файлы

```
api-generator/
├── src/
│   ├── happy-path-generator.ts       ✨ Обновлен (все 12 пунктов)
│   ├── helpers/
│   │   ├── schemaValidation.ts       ✨ НОВЫЙ (пункт 9)
│   │   ├── dtoFinder.ts              ✨ НОВЫЙ (пункт 10)
│   │   ├── dataComparison.ts         (пункты 5, 6)
│   │   ├── axiosHelpers.ts           (пункт 8)
│   │   └── apiErrorCodes.ts
│   └── index.ts                      ✨ Обновлен (экспорты)
│
└── README-FULL.md                    ✨ Полная документация
```

## 🧪 Запуск

```bash
# Генерация с новыми параметрами
npx ts-node scripts/generate-happy-tests.ts

# Запуск тестов
npx playwright test --grep @apiHappyPath
```

## 🎯 Итого

**Пункты 1-6:** ✅ Реализованы ранее
- Архив проекта
- .test.ts расширение
- Структура с caseInfoObj
- Только axios
- Нормализация данных
- Глубокое сравнение

**Пункты 7-12:** ✅ Реализованы сейчас
- Конфигурируемый URL стенда
- Конфигурируемый axios config
- Валидация типов
- Проверка DTO
- Отдельные файлы данных
- Объединение дублей

---

**Все 12 пунктов готовы!** 🎉

Полная документация в `README-FULL.md`
