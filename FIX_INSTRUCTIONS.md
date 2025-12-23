# Исправление ошибки NOT_TAGGED_CALL

## Проблема

Ошибка `Error: NOT_TAGGED_CALL: Query not calles as a tagged template literal` возникает, когда библиотека `postgres` (версия 3.4.5) получает SQL запрос в виде обычной строки вместо **tagged template literal**.

## Что было исправлено

### ❌ Неправильно (старый код):

```typescript
// Обычная строка - вызывает ошибку!
const columns = await this.sql(`
  SELECT * FROM information_schema.columns
  WHERE table_schema = '${schema}'
`);
```

### ✅ Правильно (исправленный код):

```typescript
// Tagged template literal - работает!
const columns = await this.sql`
  SELECT * FROM information_schema.columns
  WHERE table_schema = ${schema}
`;
```

## Ключевые изменения

1. **Используются обратные кавычки** (`` ` ``) вместо обычных кавычек
2. **Переменные вставляются напрямую** через `${variable}`
3. **Для идентификаторов используется** `${this.sql(tableName)}`

### Примеры исправлений:

```typescript
// Выборка данных
const rows = await this.sql`
  SELECT * FROM ${this.sql(tableFullName)}
  ORDER BY created_at DESC
  LIMIT ${this.config.samplesCount}
`;

// Условие с параметром
const schemaCondition = this.config.dbSchema 
  ? `table_schema = '${this.config.dbSchema}'`
  : `table_schema NOT IN ('information_schema', 'pg_catalog')`;

const columns = await this.sql`
  SELECT table_schema, table_name, column_name
  FROM information_schema.columns
  WHERE ${this.sql(schemaCondition)}
`;

// Foreign Keys
const fks = await this.sql`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = ${table.schema}
    AND tc.table_name = ${table.name}
`;
```

## Как применить исправление

### Вариант 1: Замена файла (рекомендуется)

1. Скачайте исправленный файл `database-analyzer-fixed.ts`
2. Замените файл в вашем проекте:
   ```bash
   cp database-analyzer-fixed.ts ./node_modules/@your-company/api-codegen/dist/database-analyzer.ts
   ```

### Вариант 2: Ручное исправление

Найдите в файле `database-analyzer.ts` все места где используется:
- `await this.sql("...")` → заменить на `` await this.sql`...` ``
- `await this.sql('...')` → заменить на `` await this.sql`...` ``
- `await this.dbConnect("...")` → заменить на `` await this.dbConnect`...` ``

**Важно:** Не забудьте изменить способ вставки переменных:
- Было: `"WHERE id = " + id`
- Стало: `` `WHERE id = ${id}` ``

## Проверка исправления

После применения исправлений, проверьте работу:

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import { testDbConnect } from './helpers/dbConnection';

await analyzeAndGenerateTestData(
  {
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'public',
    samplesCount: 5
  },
  testDbConnect
);
```

Должно работать без ошибок! ✅

## Дополнительная информация

### Почему нужны tagged template literals?

Библиотека `postgres` использует tagged template literals для:
1. **Безопасности** - автоматическая защита от SQL injection
2. **Подготовленных запросов** - кэширование и оптимизация
3. **Правильной типизации** - параметры автоматически экранируются

### Документация postgres

Официальная документация: https://github.com/porsager/postgres

Примеры:
```typescript
// Правильно
await sql`SELECT * FROM users WHERE id = ${userId}`;

// Неправильно
await sql("SELECT * FROM users WHERE id = " + userId);
```

## Поддержка

Если после применения исправлений проблема остается, проверьте:
1. Версию библиотеки `postgres` в `package.json` (должна быть 3.4.5)
2. Правильность подключения к БД в `testDbConnect`
3. Права доступа к таблицам

Удачи! 🚀
