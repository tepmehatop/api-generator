# 🎯 Версия 6.5 - Отдельные файлы с данными и умные тестовые данные

## ✅ Исправлено

### 1. Синтаксис dbTestData - правильное экранирование

**Было:**
```typescript
const dbTestData = {
  baseScheme.orders: [  // ❌ Синтаксическая ошибка!
    {"id": "111"}
  ]
};
```

**Стало:**
```typescript
const dbTestData = {
  'baseScheme.orders': [  // ✅ Правильно!
    {"id": "111"}
  ]
};
```

### 2. Отдельные файлы с тестовыми данными

Теперь данные хранятся в отдельных файлах!

**Структура:**
```
tests/
  api/
    orders/
      createOrder.test.ts       ← Импортирует данные
      getOrder.test.ts
      testData/                 ← Новая папка!
        createOrder.data.ts     ← Данные здесь
        getOrder.data.ts
    products/
      createProduct.test.ts
      testData/
        createProduct.data.ts
```

**createOrder.data.ts:**
```typescript
/**
 * Тестовые данные для createOrder
 * Автоматически сгенерировано из БД
 * @generated
 */

export const dbTestData = {
  'orders_schema.orders': [
    {
      "order_type": "standard",
      "product_id": 12345,
      "quantity": 2,
      "status": "pending"
    },
    {
      "order_type": "express",
      "product_id": 67890,
      "quantity": 1,
      "status": "completed"
    }
    // ... еще 13 записей (всего 15)
  ]
} as const;

// Вспомогательные функции
export const getOrdersData = () => dbTestData['orders_schema.orders'];

// Получить случайную запись
export const getRandomOrders = () => {
  const data = dbTestData['orders_schema.orders'];
  return data[Math.floor(Math.random() * data.length)];
};
```

**createOrder.test.ts:**
```typescript
import { apiClient } from './helpers/apiClient';
import { dbTestData } from './testData/createOrder.data';  // ← Импорт!

const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

// Данные импортированы из ./testData/createOrder.data

describe('POST /api/v1/orders', () => {
  // Используем данные из dbTestData
  const testRecord = dbTestData['orders_schema.orders'][0];
  
  // ... тесты
});
```

### 3. Больше записей - 15 вместо 5

**Было:** 5 последних записей
**Стало:** 15 случайных записей с разнообразием

```sql
-- Берем разнообразные данные
SELECT * FROM orders_schema.orders
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '1 year'
ORDER BY RANDOM()
LIMIT 15;
```

**Преимущества:**
- ✅ Разные типы заказов
- ✅ Разные даты (в пределах года)
- ✅ Разные статусы
- ✅ Больше вариаций для pairwise тестов

### 4. Умные данные для эмпирического теста

**Было:** Рандомные значения → 400 ошибки
```typescript
{
  orderType: "TEST_1733843200000_ORDERTYPE",  // ❌ Невалидное
  productId: 999900000123456                   // ❌ Не существует
}
```

**Стало:** Данные из существующих записей → работает!
```typescript
{
  orderType: "standard",   // ✅ Из реальной записи
  productId: 12345         // ✅ Существующий продукт
}
```

**Алгоритм:**
1. Берем случайную запись из первой таблицы
2. Извлекаем значения полей (кроме id, created_at, etc.)
3. Подставляем в DTO
4. Для отсутствующих полей - fallback значения

**Пример:**
```
🎯 ЭТАП 3: Эмпирический тест...
  🔍 Ищу существующие данные в таблицах: orders_schema.orders
  ⏭️  Исключаю поля: id, created_at, updated_at, deleted_at
  ✓ Найдена запись в orders_schema.orders
  ✓ orderType = "standard" (из order_type)
  ✓ productId = 12345 (из product_id)
  ✓ quantity = 2 (из quantity)
  ✓ status = "pending" (из status)
```

### 5. Исключение полей для эмпирического теста

Можно указать какие поля не использовать:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  
  // 🆕 Исключаем поля
  excludeFieldsForEmpirical: [
    'id',
    'userId',           // Не берем чужой userId
    'createdBy',        // Не берем чужой createdBy
    'internalReference' // Внутреннее поле
  ]
}, testDbConnect);
```

## 🎯 Рекомендуемый workflow

### Вариант 1: Последовательный (рекомендуется)

```typescript
// 1. Генерируем API методы
await generateApi({
  specUrl: 'openapi.json',
  outputDir: './src/api'
});

// 2. Генерируем базовые тесты
await generateApiTests({
  apiFilePath: './src/api/orders.api.ts',
  outputDir: './tests/api/orders'
});

// 3. Анализируем БД и генерируем данные
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,
    empiricalTest: false
  },
  
  verboseStages: {
    stage1: false  // Компактно
  }
}, testDbConnect);

// Результат:
// ✓ createOrder.test.ts обновлен
// ✓ testData/createOrder.data.ts создан
// ✓ 15 записей с разнообразными данными

// 4. (Опционально) Регенерируем тесты с данными
// TODO: Добавить интеграцию данных в позитивные/pairwise тесты
```

### Вариант 2: Массовый анализ

```typescript
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
    
    stages: {
      schemaAnalysis: true,
      foreignKeys: false,
      empiricalTest: false
    },
    
    verboseStages: {
      stage1: false,
      stage2: false,
      stage3: false
    }
  }, testDbConnect);
}
```

## 📋 Что дальше? (TODO для следующей версии)

### 1. Интеграция данных в тесты (в разработке)

Нужно обновить генератор тестов чтобы использовать `dbTestData`:

**Сейчас:**
```typescript
// Позитивный тест - только обязательные поля
const requiredFieldsOnly = {
  orderType: '',  // ❌ Пустые значения
  productId: 0
};
```

**Должно быть:**
```typescript
// Позитивный тест - только обязательные поля
const testRecord = getRandomOrders();  // ← Из dbTestData!

const requiredFieldsOnly = {
  orderType: testRecord.order_type,
  productId: testRecord.product_id
};
```

### 2. Pairwise комбинации с реальными данными

**Сейчас:**
```typescript
const pairwiseCombo1 = {
  orderType: '',  // ❌ Пустые
  productId: 0,
  quantity: 0
};
```

**Должно быть:**
```typescript
const data = dbTestData['orders_schema.orders'];

const pairwiseCombo1 = {
  orderType: data[0].order_type,
  productId: data[1].product_id,
  quantity: data[2].quantity
};

const pairwiseCombo2 = {
  orderType: data[3].order_type,
  productId: data[4].product_id,
  quantity: data[5].quantity
};
```

### 3. Архитектурное решение

**Проблема:** Данные генерируются ПОСЛЕ создания тестов

**Решение А (текущее):**
```
generateApi → generateApiTests → analyzeAndGenerateTestData
                                  (создает testData/*.data.ts)
```

**Решение Б (предлагаемое):**
```
generateApi → analyzeAndGenerateTestData → generateApiTests
              (создает testData/*.data.ts)  (использует dbTestData)
```

**Решение В (гибридное):**
```
generateApi → generateApiTests → analyzeAndGenerateTestData → generateApiTests (force update)
              (базовые тесты)    (создает данные)              (обновляет тесты)
```

**Мои рекомендации:**

**Для нового проекта (Решение Б):**
1. `generateApi` - генерируем API
2. `analyzeAndGenerateTestData` - находим таблицы и создаем данные
3. `generateApiTests` - генерируем тесты УЖЕ используя данные

**Для существующего проекта (Решение В):**
1. `generateApi` - обновляем API
2. `generateApiTests` - обновляем базовую структуру тестов
3. `analyzeAndGenerateTestData` - обновляем данные
4. `generateApiTests({ updateDataOnly: true })` - обновляем только секции с данными

**Для быстрого прототипа (Решение А):**
1. `generateApi` → `generateApiTests` - быстро создаем тесты
2. `analyzeAndGenerateTestData` - добавляем данные позже
3. Вручную правим тесты для использования данных

## 📊 Статистика улучшений

| Метрика | Было | Стало |
|---------|------|-------|
| Синтаксические ошибки | Да | Нет ✅ |
| Записей для тестов | 5 | 15 ✅ |
| Разнообразие данных | Последние | Случайные ✅ |
| Данные для Этапа 3 | Рандом (400 ошибки) | Реальные (работает) ✅ |
| Хранение данных | В тесте | Отдельные файлы ✅ |
| Повторное использование | Нет | Да (импорты) ✅ |

## ✅ Готово!

Теперь:
- ✅ Нет синтаксических ошибок
- ✅ Данные в отдельных файлах (testData/)
- ✅ 15 разнообразных записей
- ✅ Умные данные для эмпирического теста
- ✅ Возможность исключать поля
- ✅ Вспомогательные функции для доступа

Следующий шаг: интеграция данных в позитивные и pairwise тесты! 🎊
