# 🚀 QUICK START - API Generator v10.0

## ✅ ВСЕ 12 ПУНКТОВ ГОТОВЫ!

**Версия:** 10.0 (на базе v9.4)  
**Дата:** 25 декабря 2025

---

## 📦 Установка

```bash
# 1. Распакуйте архив
tar -xzf api-generator-v10.0-ALL-12-POINTS.tar.gz
cd api-generator-main

# 2. Установите зависимости
npm install

# 3. Соберите проект
npm run build
```

---

## 🎯 Быстрое использование

### Минимальная конфигурация

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  database: 'qa',
  username: 'postgres',
  password: 'password'
});

await generateHappyPathTests(
  {
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'qa',
  },
  sql
);
```

### С использованием новых возможностей (пункты 7-12)

```typescript
await generateHappyPathTests(
  {
    // Базовые
    outputDir: './tests/api/happy-path',
    dbConnectionMethod: 'testDbConnect',
    dbSchema: 'qa',
    
    // Пункт 7: Своя переменная стенда
    standUrlEnvVar: 'MY_API_URL',
    
    // Пункт 8: Свой axios config
    axiosConfigName: 'myConfig',
    axiosConfigPath: './my/helpers/axios',
    
    // Пункт 10: Проверка DTO
    apiGeneratedPath: './node_modules/@company/dist/generated/',
    
    // Пункт 11: Отдельные файлы с данными
    createSeparateDataFiles: true,
    
    // Пункт 12: Объединение дублей
    mergeDuplicateTests: true,
  },
  sql
);
```

---

## 📝 Что нового в каждом пункте

### 1️⃣ Полный архив
- Весь проект в одном файле
- Готов к распаковке и использованию

### 2️⃣ .test.ts расширение
```
post-orders.happy-path.test.ts  ✅
```

### 3️⃣ Структура как в примерах
- Смотрите `generated/tests/pet/findPetsByStatus.test.ts`
- Точно такая же структура!

### 4️⃣ Только axios
```typescript
const response = await axios.post(
  process.env.StandURL + endpoint,
  requestData,
  configApiHeaderAdmin
);
```

### 5️⃣ Нормализация данных
```typescript
import { normalizeDbData } from '@your-company/api-codegen';

const normalized = normalizeDbData(dbData);
// "{\"id\":\"123\"}" → {id: 123}
```

### 6️⃣ Глубокое сравнение
```typescript
import { deepCompareObjects } from '@your-company/api-codegen';

// Игнорирует порядок в массивах
{status: ["A","B"]} == {status: ["B","A"]}  // ✅
```

### 7️⃣ Своя переменная стенда
```typescript
standUrlEnvVar: 'MY_URL'

// В тесте: process.env.MY_URL + endpoint
```

### 8️⃣ Свой axios config
```typescript
axiosConfigName: 'myConfig',
axiosConfigPath: './my/path'

// В тесте:
// import { myConfig } from './my/path';
// axios.post(..., myConfig)
```

### 9️⃣ Валидация типов
```typescript
// Автоматически в тесте:
await expect(typeof response.data.id).toBe('number');
await expect(typeof response.data.status).toBe('string');
```

### 🔟 Проверка DTO
```typescript
apiGeneratedPath: './node_modules/@company/dist/generated/'

// Автоматически находит DTO и проверяет поля:
await expect(response.data.id).toBeDefined();
await expect(response.data.status).toBeDefined();
```

### 1️⃣1️⃣ Отдельные файлы
```typescript
createSeparateDataFiles: true

// Создает:
// test-data/post-orders-data-1.ts
// test-data/post-orders-data-2.ts
```

### 1️⃣2️⃣ Объединение дублей
```typescript
mergeDuplicateTests: true

// /api/orders/123
// /api/orders/456  } → Один файл с 3 тестами
// /api/orders/789
```

---

## 📁 Структура проекта

```
api-generator-main/
├── src/
│   ├── happy-path-generator.ts       ✨ v10.0
│   ├── utils/
│   │   ├── data-comparison.ts        ✨ НОВЫЙ
│   │   ├── type-validator.ts         ✨ НОВЫЙ
│   │   └── dto-finder.ts             ✨ НОВЫЙ
│   └── ...
├── generated/tests/pet/
│   └── findPetsByStatus.test.ts      ✨ ЭТАЛОН
├── dist/                             ✨ Скомпилировано
└── README_ALL_12_POINTS.md           ✨ Полная документация
```

---

## 🎯 Пример сгенерированного теста

```typescript
import test, { expect } from '../../../fixtures/baseTest';
import axios from 'axios';
import { configApiHeaderAdmin } from '../../../helpers/axiosHelpers';

const endpoint = '/api/v1/orders';
const httpMethod = 'POST';

const apiErrorCodes = {
  success: 200,
  created: 201,
  // ...
};

const success = apiErrorCodes.created;

const caseInfoObj = {
  testCase: 'AutoGenerated',
  aqaOwner: 'HappyPathGenerator',
  tms_testName: 'POST /api/v1/orders',
  testType: 'api'
};

test.describe.configure({ mode: "parallel" });
test.describe(`API тесты для эндпоинта ${httpMethod} >> ${endpoint}`, async () => {

  test(`${httpMethod} Happy Path #1 (${success}) @api @apiHappyPath`, async ({ page }, testInfo) => {
    // DB ID: db-id-123
    
    const requestData = { /* ... */ };
    
    const response = await axios.post(
      process.env.StandURL + endpoint,
      requestData,
      configApiHeaderAdmin
    );

    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
    
    // Валидация типов
    await expect(typeof response.data.id).toBe('number');
    
    // Проверка DTO
    await expect(response.data.id).toBeDefined();
    await expect(response.data.status).toBeDefined();
    
    // Сравнение
    await expect(response.data).toMatchObject(normalizedExpected);
  });

});
```

---

## 🧪 Запуск

```bash
# Генерация тестов
npx ts-node scripts/generate-happy-tests.ts

# Запуск всех Happy Path тестов
npx playwright test --grep @apiHappyPath

# Запуск конкретного файла
npx playwright test post-orders.happy-path.test.ts
```

---

## 📚 Документация

- **README_ALL_12_POINTS.md** - Полная документация всех изменений
- **generated/tests/pet/findPetsByStatus.test.ts** - Эталонный пример структуры

---

## ✅ Все 12 пунктов реализованы!

1. ✅ Полный архив проекта
2. ✅ .test.ts расширение
3. ✅ Структура как в примерах
4. ✅ Только axios
5. ✅ Нормализация данных
6. ✅ Глубокое сравнение
7. ✅ Конфигурируемая переменная стенда
8. ✅ Конфигурируемый axios config
9. ✅ Валидация типов
10. ✅ Проверка DTO
11. ✅ Отдельные файлы с данными
12. ✅ Объединение дублей

**Готово к использованию!** 🎉
