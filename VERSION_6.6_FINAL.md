# 🎉 Версия 6.6 FINAL - Автоматическая интеграция данных в тесты!

## ✅ Что реализовано

### 1. Увеличено количество записей - 15 по умолчанию

Теперь по умолчанию берется 15 разнообразных записей вместо 5.

```typescript
// В конфигурации по умолчанию
samplesCount: 15  // Увеличено для pairwise вариаций
```

### 2. Автоматическая интеграция dbTestData в тесты!

**ГЛАВНАЯ ФИЧА:** Теперь `generateApiTests` автоматически использует данные из БД!

#### Workflow:

```
1. generateApi
   ↓
2. generateApiTests (создает базовые тесты с моками)
   ↓
3. analyzeAndGenerateTestData (создает testData/*.data.ts)
   ↓
4. generateApiTests (АВТОМАТИЧЕСКИ использует dbTestData!)
```

#### Как это работает:

**Шаг 1: Генерируем API**
```typescript
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api'
});
```

**Шаг 2: Генерируем базовые тесты**
```typescript
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

Результат: `createOrder.test.ts` с моками
```typescript
const requiredFieldsOnly = {
  orderType: '', // TODO: заменить на актуальные данные
  productId: 0   // TODO: заменить на актуальные данные
};
```

**Шаг 3: Анализируем БД и создаем данные**
```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  samplesCount: 15,  // 15 записей!
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,
    empiricalTest: false
  }
}, testDbConnect);
```

Результат: 
- ✅ `testData/createOrder.data.ts` создан (15 записей)
- ✅ `createOrder.test.ts` обновлен (добавлен импорт)

**Шаг 4: Регенерируем тесты с данными**
```typescript
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

Результат: `createOrder.test.ts` теперь использует dbTestData!
```typescript
import { dbTestData } from './testData/createOrder.data';

// Используем данные из БД
const dbRecords = Object.values(dbTestData).flat();
const getRandomRecord = () => dbRecords[Math.floor(Math.random() * dbRecords.length)];
const record1 = getRandomRecord();
const record2 = getRandomRecord();

// Функция для маппинга данных из БД в DTO
const mapToDto = (record: any, fields: string[]) => {
  const result: any = {};
  for (const field of fields) {
    const snakeCase = field.replace(/([A-Z])/g, "_$1").toLowerCase();
    result[field] = record[field] ?? record[snakeCase] ?? record[field.toLowerCase()];
  }
  return result;
};

// Объект с только обязательными полями (из БД)
const requiredFieldsOnly = mapToDto(record1, ['orderType', 'productId']);

// Объект со всеми полями (из БД)
const allFieldsFilled = mapToDto(record2, ['orderType', 'productId', 'quantity', 'status']);
```

### 3. Умный маппинг полей

Автоматически мапит camelCase → snake_case:

```typescript
// DTO поле
orderType → ищет: orderType, order_type, ordertype

// DTO поле
productId → ищет: productId, product_id, productid
```

### 4. Pairwise тесты с реальными данными

**Было:**
```typescript
const pairwiseCombo1 = {
  orderType: '',  // Мок
  productId: 0,   // Мок
  quantity: 0     // Мок
};
```

**Стало:**
```typescript
// Используем разные записи из БД для pairwise комбинаций
const dbRecords = Object.values(dbTestData).flat();

const record1 = dbRecords[0] || dbRecords[0];
const pairwiseCombo1 = {
  ...mapToDto(record1, ['orderType', 'productId']),
  ...mapToDto(record1, ['quantity'])
};

const record2 = dbRecords[1] || dbRecords[0];
const pairwiseCombo2 = {
  ...mapToDto(record2, ['orderType', 'productId']),
  ...mapToDto(record2, ['status'])
};
```

Каждая pairwise комбинация использует разную запись из 15 доступных!

### 5. Автоматическая проверка наличия данных

`generateApiTests` автоматически проверяет:

1. Есть ли папка `testData/`?
2. Есть ли файл `methodName.data.ts`?
3. Если ДА → импортирует и использует `dbTestData`
4. Если НЕТ → генерирует моки + комментарий

**С данными:**
```typescript
import { dbTestData } from './testData/createOrder.data';

// Используем данные из БД
const dbRecords = Object.values(dbTestData).flat();
```

**Без данных:**
```typescript
// Данные из БД отсутствуют, используются моки
// Запустите analyzeAndGenerateTestData для генерации реальных данных

const requiredFieldsOnly = {
  orderType: '', // TODO: заменить на актуальные данные
  productId: 0
};
```

## 🎯 Полный workflow

### Для нового проекта:

```typescript
// 1. Генерируем API
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api'
});

// 2. Генерируем базовые тесты
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders',
  generatePositiveTests: true,
  generatePairwiseTests: true
});

// 3. Анализируем БД и создаем данные для всех тестов
const testFiles = [
  './tests/api/orders/createOrder.test.ts',
  './tests/api/orders/updateOrder.test.ts',
  './tests/api/products/createProduct.test.ts'
];

for (const testFile of testFiles) {
  await analyzeAndGenerateTestData({
    testFilePath: testFile,
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'app_schema',
    samplesCount: 15,
    
    stages: {
      schemaAnalysis: true,
      foreignKeys: false,
      empiricalTest: false
    },
    
    verboseStages: {
      stage1: false
    }
  }, testDbConnect);
}

// 4. Регенерируем тесты - теперь они используют dbTestData!
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders',
  generatePositiveTests: true,
  generatePairwiseTests: true
});
```

### Для обновления существующих тестов:

```typescript
// Если данные уже есть, просто регенерируем
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders'
});

// Тесты автоматически используют существующий testData/*.data.ts
```

### Для обновления данных:

```typescript
// Перегенерируем данные из БД
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  force: true,  // ← Заново ищем таблицы
  samplesCount: 15
}, testDbConnect);

// Регенерируем тесты
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

## 📊 Пример результата

**testData/createOrder.data.ts:**
```typescript
export const dbTestData = {
  'orders_schema.orders': [
    { order_type: 'standard', product_id: 100, quantity: 2, status: 'pending' },
    { order_type: 'express', product_id: 200, quantity: 1, status: 'completed' },
    { order_type: 'standard', product_id: 300, quantity: 5, status: 'pending' },
    { order_type: 'priority', product_id: 150, quantity: 3, status: 'processing' },
    // ... еще 11 записей (всего 15)
  ]
} as const;
```

**createOrder.test.ts:**
```typescript
import test, { expect } from '@playwright/test';
import axios from 'axios';
import { dbTestData } from './testData/createOrder.data';  // ← Импорт!

const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

test.describe('POST /api/v1/orders', () => {
  // Используем данные из БД
  const dbRecords = Object.values(dbTestData).flat();
  const getRandomRecord = () => dbRecords[Math.floor(Math.random() * dbRecords.length)];
  const record1 = getRandomRecord();
  const record2 = getRandomRecord();

  const mapToDto = (record: any, fields: string[]) => {
    const result: any = {};
    for (const field of fields) {
      const snakeCase = field.replace(/([A-Z])/g, "_$1").toLowerCase();
      result[field] = record[field] ?? record[snakeCase] ?? record[field.toLowerCase()];
    }
    return result;
  };

  // Объект с только обязательными полями (из БД)
  const requiredFieldsOnly = mapToDto(record1, ['orderType', 'productId']);

  // Объект со всеми полями (из БД)
  const allFieldsFilled = mapToDto(record2, ['orderType', 'productId', 'quantity', 'status']);

  // ============================================
  // ПОЗИТИВНЫЕ ТЕСТЫ
  // ============================================

  test(`${httpMethod} с обязательными полями (201) @api @positive`, async ({ page }, testInfo) => {
    const response = await axios.post(
      process.env.StandURL + endpoint, 
      requiredFieldsOnly,  // ← Реальные данные!
      configApiHeaderAdmin
    );

    await expect(response.status).toBe(201);
    await expect(response.data).toBeDefined();
  });

  test(`${httpMethod} со всеми полями (201) @api @positive`, async ({ page }, testInfo) => {
    const response = await axios.post(
      process.env.StandURL + endpoint, 
      allFieldsFilled,  // ← Реальные данные!
      configApiHeaderAdmin
    );

    await expect(response.status).toBe(201);
    await expect(response.data).toBeDefined();
  });

  // ============================================
  // PAIRWISE ТЕСТЫ
  // ============================================

  // Комбинация 1: запись 0 из БД
  const record1 = dbRecords[0] || dbRecords[0];
  const pairwiseCombo1 = {
    ...mapToDto(record1, ['orderType', 'productId']),
    ...mapToDto(record1, ['quantity'])
  };

  test(`${httpMethod} pairwise combo 1 @api @pairwise`, async ({ page }, testInfo) => {
    const response = await axios.post(
      process.env.StandURL + endpoint,
      pairwiseCombo1,  // ← Реальные данные!
      configApiHeaderAdmin
    );

    await expect(response.status).toBe(201);
  });

  // ... и так для всех комбинаций
});
```

## 📈 Статистика

| Метрика | Было | Стало |
|---------|------|-------|
| Записей для тестов | 5 | 15 ✅ |
| Интеграция в позитивные тесты | Нет | Автоматически ✅ |
| Интеграция в pairwise | Нет | Автоматически ✅ |
| Маппинг camelCase → snake_case | Нет | Да ✅ |
| Вариативность данных | Нет | 15 разных записей ✅ |

## ✅ Готово!

Теперь полный цикл работает:
1. ✅ generateApi - генерируем API методы
2. ✅ generateApiTests - базовые тесты
3. ✅ analyzeAndGenerateTestData - данные из БД (15 записей)
4. ✅ generateApiTests - тесты автоматически используют dbTestData!

**Результат:** Реальные рабочие тесты с данными из БД! 🎊
