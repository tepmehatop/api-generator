# ✅ Генерация Happy Path тестов из БД

## Использование (как analyzeAndGenerateTestData)

### Вариант 1: Прямой вызов в коде (рекомендуется)

```typescript
// scripts/generate-happy-tests.ts
import { generateHappyPathTests } from '@your-company/api-codegen';
import { testDbConnect } from '../helpers/dbHelpers';

(async () => {
  await generateHappyPathTests({
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',  // ✅ Ваш существующий метод
    dbSchema: 'qa',                       // ✅ Схема где api_requests
    force: false,
    maxTestsPerEndpoint: 10,
    testTag: '@apiHappyPath'
  }, testDbConnect);  // ✅ Передаём метод подключения
  
  console.log('✅ Готово!');
})();
```

**Запуск:**

```bash
npx ts-node scripts/generate-happy-tests.ts
```

---

### Вариант 2: Через npm скрипт (опционально)

```json
{
  "scripts": {
    "generate:happy-tests": "ts-node scripts/generate-happy-tests.ts",
    "generate:happy-tests:force": "ts-node scripts/generate-happy-tests.ts --force"
  }
}
```

---

## Конфигурация

### Минимальная (обязательно):

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect'
}, testDbConnect);
```

### Полная:

```typescript
await generateHappyPathTests({
  // Обязательные
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect',
  
  // Опциональные
  dbSchema: 'qa',                           // Default: 'qa'
  force: false,                             // Default: false
  maxTestsPerEndpoint: 10,                  // Default: 10
  onlySuccessful: true,                     // Default: true
  testTag: '@apiHappyPath',                 // Default: '@apiHappyPath'
  axiosHelpersPath: '../../../helpers/axiosHelpers',
  
  // Фильтры
  endpointFilter: ['/api/v1/orders', '/api/v1/cart'],
  methodFilter: ['POST', 'PUT']
}, testDbConnect);
```

---

## Параметры

| Параметр | Тип | Описание | Default |
|----------|-----|----------|---------|
| `outputDir` | string | Папка для тестов | **обязательно** |
| `dbConnectionMethod` | string | Имя метода подключения | **обязательно** |
| `dbSchema` | string | Схема БД | `'qa'` |
| `force` | boolean | Перегенерировать все | `false` |
| `maxTestsPerEndpoint` | number | Макс тестов на endpoint | `10` |
| `onlySuccessful` | boolean | Только 2xx ответы | `true` |
| `testTag` | string | Тег для тестов | `'@apiHappyPath'` |
| `endpointFilter` | string[] | Фильтр по endpoint | `[]` |
| `methodFilter` | string[] | Фильтр по HTTP методу | `[]` |

---

## Пример: Интеграция с существующим кодом

### Ваш существующий файл с БД:

```typescript
// helpers/dbHelpers.ts
import postgres from 'postgres';

export const testDbConnect = postgres({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

### Скрипт генерации:

```typescript
// scripts/generate-happy-tests.ts
import { generateHappyPathTests } from '@your-company/api-codegen';
import { testDbConnect } from '../helpers/dbHelpers';

(async () => {
  try {
    console.log('🚀 Запускаю генерацию Happy Path тестов...');
    
    await generateHappyPathTests({
      outputDir: './tests/api/happy-path',
      dbConnectionMethod: 'testDbConnect',
      dbSchema: 'qa',
      force: process.argv.includes('--force'),
      verbose: true
    }, testDbConnect);
    
    console.log('✅ Генерация завершена!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
})();
```

---

## Логи

### Первый запуск:

```
🚀 Запускаю генерацию Happy Path тестов...
🔍 Подключаюсь к БД и собираю данные...
ℹ️  Инкрементальный режим - только новые данные
📊 Найдено 50 уникальных запросов
📁 Сгруппировано по 10 endpoints

  ✨ orders-post.happy-path.spec.ts (5 тестов)
  ✨ cart-get.happy-path.spec.ts (3 теста)
  ✨ products-get.happy-path.spec.ts (7 тестов)
  ...

✨ Генерация завершена!
   Всего тестов: 50
   Новых тестов: 50
✅ Генерация завершена!
```

### Повторный запуск (с новыми данными):

```
🔍 Подключаюсь к БД и собираю данные...
ℹ️  Инкрементальный режим - только новые данные
📊 Найдено 5 уникальных запросов
📁 Сгруппировано по 2 endpoints

  ✓ orders-post.happy-path.spec.ts (+2 теста)
  ✓ cart-post.happy-path.spec.ts (+3 теста)

✨ Генерация завершена!
   Всего тестов: 55
   Новых тестов: 5
```

### Force режим:

```bash
npx ts-node scripts/generate-happy-tests.ts --force
```

```
⚠️  FORCE режим - перегенерация всех тестов
📊 Найдено 55 уникальных запросов
📁 Сгруппировано по 12 endpoints

  🔄 orders-post.happy-path.spec.ts (5 тестов)
  🔄 cart-get.happy-path.spec.ts (3 теста)
  ...
```

---

## Запуск тестов

```bash
# Все Happy Path тесты
npx playwright test --grep @apiHappyPath

# Конкретный endpoint
npx playwright test orders-post.happy-path.spec.ts

# С фильтром
npx playwright test --grep "@apiHappyPath.*POST"
```

---

## Сравнение с analyzeAndGenerateTestData

| Функция | analyzeAndGenerateTestData | generateHappyPathTests |
|---------|---------------------------|------------------------|
| **Источник данных** | Анализ OpenAPI + БД | БД (собранные с фронта) |
| **Подключение к БД** | `dbConnectionMethod` + передача | `dbConnectionMethod` + передача ✅ |
| **Схема БД** | `dbSchema` | `dbSchema` ✅ |
| **Конфиг в коде** | Да | Да ✅ |
| **Инкремент** | Нет | Да ✅ |

---

## Полный пример

```typescript
// scripts/generate-all-tests.ts
import { 
  generateApiTests, 
  analyzeAndGenerateTestData,
  generateHappyPathTests 
} from '@your-company/api-codegen';
import { testDbConnect } from '../helpers/dbHelpers';

(async () => {
  console.log('1️⃣  Генерация API тестов из OpenAPI...');
  await generateApiTests({
    apiFilePath: './src/api/orders.api.ts',
    outputDir: './tests/api/orders',
    generatePositiveTests: true,
    generateNegativeTests: true
  });
  
  console.log('2️⃣  Анализ БД и генерация тестовых данных...');
  await analyzeAndGenerateTestData({
    testFilePath: './tests/api/orders/createOrder.test.ts',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'public'
  }, testDbConnect);
  
  console.log('3️⃣  Генерация Happy Path тестов...');
  await generateHappyPathTests({
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'qa'
  }, testDbConnect);
  
  console.log('✅ Все тесты сгенерированы!');
})();
```

---

## Troubleshooting

### Нет данных в БД

**Проверка:**

```sql
SELECT COUNT(*) FROM qa.api_requests;
```

Если 0, запустите UI тесты с коллектором:

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  kafkaTopic: 'api-collector-topic',
  kafkaSendFunction: yourKafkaFunction
});
```

### Ошибка подключения к БД

```
Error: Cannot find module '../helpers/dbHelpers'
```

**Решение:** Проверьте что `testDbConnect` экспортируется:

```typescript
// helpers/dbHelpers.ts
export const testDbConnect = postgres({ ... });
```

### Тесты не генерируются

**Проверка 1:** test_generated = FALSE?

```sql
SELECT COUNT(*) 
FROM qa.api_requests 
WHERE test_generated = FALSE;
```

Если 0, используйте `force: true` или запустите UI тесты снова.

---

## ✅ Итого

- ✅ **Как analyzeAndGenerateTestData** - тот же паттерн
- ✅ **dbConnectionMethod** - используем существующее подключение
- ✅ **dbSchema** - указываем схему БД
- ✅ **Конфиг в коде** - не нужен внешний JSON
- ✅ **Инкрементальная генерация** - дополняет существующие тесты

**Готово к использованию!** 🎉✨
