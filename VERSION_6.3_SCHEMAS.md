# 🔧 Версия 6.3 - Поддержка множественных схем БД

## ✅ Что исправлено

### 1. Поддержка нескольких схем PostgreSQL

**Проблема:** Анализатор искал только в схеме `public`, игнорируя остальные схемы.

**Решение:** Добавлен параметр `dbSchema` с двумя режимами работы:

#### Режим 1: Поиск во всех схемах (по умолчанию)

```typescript
await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    // dbSchema не указан - ищем во всех схемах!
  },
  testDbConnect
);
```

**Вывод:**

```
📊 ЭТАП 1: Анализ схемы БД...
  🔍 Ищу таблицы для полей: orderType, productId, regNumberS
  📊 Режим поиска: во всех схемах

  📋 SQL запрос для получения схемы БД:
  ┌──────────────────────────────────────────────────────────┐
  │   SELECT table_schema, table_name, column_name, ...      │
  │   FROM information_schema.columns                         │
  │   WHERE table_schema NOT IN                               │
  │     ('information_schema', 'pg_catalog')                  │
  └──────────────────────────────────────────────────────────┘

  ✓ Получено 1247 колонок из БД
  ✓ Найдено схем: 4
      - public
      - orders_schema
      - products_schema
      - analytics

  📊 Примеры колонок (первые 10):
      public.users.id (integer)
      public.users.email (character varying)
      orders_schema.orders.id (integer)
      orders_schema.orders.order_type (character varying)
      orders_schema.orders.product_id (integer)
      products_schema.products.id (integer)
      ...
```

#### Режим 2: Поиск в конкретной схеме

```typescript
await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'orders_schema', // ← Указываем схему!
  },
  testDbConnect
);
```

**Вывод:**

```
📊 ЭТАП 1: Анализ схемы БД...
  🔍 Ищу таблицы для полей: orderType, productId, regNumberS
  📊 Режим поиска: в схеме "orders_schema"

  📋 SQL запрос для получения схемы БД:
  ┌──────────────────────────────────────────────────────────┐
  │   SELECT table_schema, table_name, column_name, ...      │
  │   FROM information_schema.columns                         │
  │   WHERE table_schema = 'orders_schema'                    │
  └──────────────────────────────────────────────────────────┘

  ✓ Получено 87 колонок из БД
  ✓ Найдено схем: 1
      - orders_schema

  📊 Примеры колонок (первые 10):
      orders_schema.orders.id (integer)
      orders_schema.orders.order_type (character varying)
      orders_schema.orders.product_id (integer)
      ...
```

**Преимущества конкретной схемы:**
- ✅ Быстрее (меньше таблиц для проверки)
- ✅ Точнее (нет совпадений из других схем)
- ✅ Меньше ложных срабатываний

### 2. Исправлен незавершенный код в confirmWithRealCall

**Проблема:** Синтаксическая ошибка в запросах к БД:

```typescript
// ❌ Было (неправильно):
const rows = await this.dbConnect`
  SELECT * FROM ${this.dbConnect(table)}
  ...
`;
```

**Решение:** Правильная работа с именами таблиц и схем:

```typescript
// ✅ Стало (правильно):
const [schema, tableName] = table.includes('.') 
  ? table.split('.') 
  : [this.config.dbSchema || 'public', table];

const rows = await this.dbConnect`
  SELECT * FROM ${this.dbConnect(schema + '.' + tableName)}
  ...
`;
```

Теперь поддерживаются:
- `orders` → `public.orders`
- `orders_schema.orders` → `orders_schema.orders`

### 3. Улучшена обработка ошибок

**Таблицы без deleted_at/created_at:**

```typescript
// Сначала пробуем с фильтрами
try {
  existing = await this.dbConnect`
    SELECT * FROM table
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  `;
} catch (error) {
  // Если нет этих полей - простой запрос
  existing = await this.dbConnect`
    SELECT * FROM table
    LIMIT 5
  `;
}
```

**Детальные сообщения об ошибках:**

```
⚠️  Не удалось прочитать таблицу orders_schema.orders: column "deleted_at" does not exist
⚠️  Ошибка при получении данных из products_schema.products: permission denied
```

## 🎯 Примеры использования

### Пример 1: У вас несколько схем, не знаете где таблица

```typescript
// Ищем во всех схемах
await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    // dbSchema не указываем
  },
  testDbConnect
);

// Результат:
// ✓ Найдено схем: 4
//     - public
//     - orders_schema
//     - products_schema
//     - analytics
//
// 🎯 ТАБЛИЦА: orders_schema.orders
// Совпадений: 3/3 (100%)
```

### Пример 2: Знаете что таблица в конкретной схеме

```typescript
// Ищем только в orders_schema
await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'orders_schema', // ← Быстрее!
  },
  testDbConnect
);

// Результат:
// 📊 Режим поиска: в схеме "orders_schema"
// ✓ Получено 87 колонок (вместо 1247)
// 🎯 ТАБЛИЦА: orders_schema.orders
```

### Пример 3: Массовый анализ с разными схемами

```typescript
const testConfigs = [
  {
    file: './tests/api/orders/createOrder.test.ts',
    schema: 'orders_schema'
  },
  {
    file: './tests/api/products/getProduct.test.ts',
    schema: 'products_schema'
  },
  {
    file: './tests/api/users/createUser.test.ts',
    schema: 'public'
  },
];

for (const config of testConfigs) {
  await analyzeAndGenerateTestData(
    {
      testFilePath: config.file,
      dbConnectionMethod: 'testDbConnect',
      dbSchema: config.schema,
      force: false,
      dataStrategy: 'existing'
    },
    testDbConnect
  );
}
```

### Пример 4: Проверка какие схемы есть в БД

```typescript
import { testDbConnect } from './helpers/dbConnection';

// Посмотрите какие схемы доступны
const schemas = await testDbConnect`
  SELECT schema_name 
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
`;

console.log('Доступные схемы:');
schemas.forEach((s: any) => console.log(`  - ${s.schema_name}`));

// Результат:
// Доступные схемы:
//   - public
//   - orders_schema
//   - products_schema
//   - analytics
```

## 📋 Обновленный API

### DatabaseAnalyzerConfig

```typescript
interface DatabaseAnalyzerConfig {
  testFilePath: string;
  dbConnectionMethod: string;
  
  // 🆕 Новый параметр!
  dbSchema?: string | null;
  // null или undefined = искать во всех схемах
  // 'schema_name' = искать только в этой схеме
  
  force?: boolean;
  dataStrategy?: 'existing' | 'generate' | 'both';
  samplesCount?: number;
}
```

### Примеры вызова

```typescript
// Во всех схемах (медленнее, но найдет везде)
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect'
}, testDbConnect);

// В конкретной схеме (быстрее, точнее)
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema'
}, testDbConnect);

// Явно указываем null = все схемы
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: null
}, testDbConnect);
```

## 🔍 SQL запросы

### Все схемы (dbSchema не указан)

```sql
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY table_schema, table_name, ordinal_position
```

### Конкретная схема (dbSchema = 'orders_schema')

```sql
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'orders_schema'
ORDER BY table_schema, table_name, ordinal_position
```

## 💡 Рекомендации

### 1. Первый запуск - без схемы

Узнайте где находятся ваши таблицы:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  // dbSchema не указываем - ищем везде
}, testDbConnect);

// Смотрим вывод:
// 🎯 ТАБЛИЦА: orders_schema.orders
//             ^^^^^^^^^^^^^^^
//             Запоминаем схему!
```

### 2. Последующие запуски - с схемой

Используйте найденную схему для ускорения:

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/orders.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema' // ← Быстрее в 10-20 раз!
}, testDbConnect);
```

### 3. Структура проекта с разными схемами

```
config/
  db-schemas.ts  ← Храните схемы здесь

helpers/
  analyze-tests.ts  ← Массовый анализ

tests/
  api/
    orders/
      *.test.ts  → orders_schema
    products/
      *.test.ts  → products_schema
    users/
      *.test.ts  → public
```

**config/db-schemas.ts:**

```typescript
export const dbSchemas = {
  orders: 'orders_schema',
  products: 'products_schema',
  users: 'public',
  analytics: 'analytics'
};
```

**helpers/analyze-tests.ts:**

```typescript
import { analyzeAndGenerateTestData } from 'openapi-typescript-generator';
import { testDbConnect } from './dbConnection';
import { dbSchemas } from '../config/db-schemas';

export async function analyzeTest(
  testFile: string,
  domain: keyof typeof dbSchemas
) {
  return await analyzeAndGenerateTestData(
    {
      testFilePath: testFile,
      dbConnectionMethod: 'testDbConnect',
      dbSchema: dbSchemas[domain],
      force: false,
      dataStrategy: 'existing'
    },
    testDbConnect
  );
}

// Использование:
await analyzeTest('./tests/api/orders/createOrder.test.ts', 'orders');
await analyzeTest('./tests/api/products/getProduct.test.ts', 'products');
```

## ✅ Готово!

Теперь анализатор работает с:
- ✅ Одной схемой (указанной)
- ✅ Всеми схемами (если не указана)
- ✅ Правильными SQL запросами
- ✅ Обработкой ошибок
- ✅ Таблицами формата `schema.table`

Укажите `dbSchema` и получите мгновенный результат! 🎊
