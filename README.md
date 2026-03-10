# API Generator - Генератор API клиентов и тестов

Комплексное решение для генерации TypeScript API клиентов из OpenAPI спецификаций + автоматическая генерация тестов Playwright + Happy Path тесты на основе реальных данных.

---

## 🎉 Что нового в v14.10.0 (Текущая)

### v14.10.0 — Новые режимы проверки по эндпоинтам + замена значений при генерации

#### Пункт 1 — `checkStructureOnlyEndpoints` и `statusOnlyEndpoints`

Два новых config-параметра для автоматического выбора режима проверки на основе паттерна URL:

| Параметр | Тип | Описание |
|---|---|---|
| `checkStructureOnlyEndpoints` | `string[]` | Паттерны эндпоинтов где тест автоматически ставит `checkStructureOnlySingle = true` |
| `statusOnlyEndpoints` | `string[]` | Паттерны эндпоинтов где тест проверяет **только HTTP 200 + непустой ответ** (сравнение данных пропускается) |

```typescript
const generator = new HappyPathTestGenerator(sql, {
  checkStructureOnlyEndpoints: ['search', 'filter', 'list'],   // авто-structureOnly
  statusOnlyEndpoints: ['report', 'export', 'download'],       // только статус
});
```

**`checkStructureOnlyEndpoints`:** если URL эндпоинта содержит любой из паттернов (case-insensitive), генератор ставит `checkStructureOnlySingle = true` — проверяются только наличие полей и типы, но не значения.

**`statusOnlyEndpoints`:** если URL содержит паттерн — тест генерируется без блока сравнения данных:
```typescript
// statusOnly режим: проверяем только статус и непустой ответ
await expect(response.status, 'Ожидался успешный статус (2xx)').toBeLessThan(300);
await expect(response.data !== null && response.data !== undefined, 'Ответ не должен быть пустым').toBe(true);
```

---

#### Пункт 4 — `replaceValues`: замена значений при генерации

Список значений которые **обязательно заменяются** во всех request body и response при генерации тестов. Старые значения (например тестовые префиксы из БД) заменяются на случайно сгенерированные, сохраняя формат и регистр.

| Параметр | Тип | Описание |
|---|---|---|
| `replaceValues` | `string[]` | Значения которые заменяются во всех данных при генерации |

```typescript
const generator = new HappyPathTestGenerator(sql, {
  replaceValues: ['TEST_ORDER', 'AQA_ORDER', 'AQA_USER'],
});
```

Генератор вызывает `generateSmartUniqueValue` для каждого значения — замена происходит при записи в файл теста (и в файл данных при `createSeparateDataFiles: true`).

---

#### Пункт 5 — `enableGeneratedSuffix` / `generatedSuffix`: суффикс к сгенерированным значениям

Суффикс добавляется к каждому значению сгенерированному через `replaceValues`. Удобно для идентификации тестовых данных в БД и последующей очистки.

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `enableGeneratedSuffix` | `boolean` | `false` | Включить суффикс |
| `generatedSuffix` | `string` | `''` | Суффикс (например `'_GENDT'`) |

```typescript
const generator = new HappyPathTestGenerator(sql, {
  replaceValues: ['TEST_ORDER'],
  enableGeneratedSuffix: true,
  generatedSuffix: '_GENDT',
  // Результат: TEST_ORDER → DJSKLFXC_GENDT
});
```

---

### v14.9.1 — Исправления: длина массива и checkStructureOnly

#### Пункт 2 — Исправление `checkStructureOnly` (не работало ни в одном тесте)

**Причина:** старый `test-helpers.ts` в проекте пользователя не содержал параметр `structureOnly` — функция `compareWithoutUniqueFields` не принимала его и игнорировала.

**Решение:** генератор теперь проверяет содержимое существующего `test-helpers.ts`. Если в нём нет `structureOnly` или `warnings` — файл автоматически перегенерируется с актуальной версией.

#### Пункт 3 — Длина массива: предупреждение вместо падения

**Проблема:** если в ответе массив короче чем в ожидаемых данных — тест падал с ошибкой.

**Решение:** `deepCompareObjects` теперь возвращает `{ isEqual, differences, warnings }`. Если массив стал короче — это попадает в `warnings[]` (не в `differences[]`), тест не падает, но предупреждение выводится. `isEqual` зависит только от `differences.length`.

---

## Что нового в v14.9.0

### v14.9.0 — Исправление reActualizeHappyPathTests

**Проблема:** метод выполнялся без ошибок, сообщал "обновил 1 тест", но содержимое файлов не менялось.

**Причины:**
1. `extractTestInfo` использовал наивную конвертацию JSON в JS: `.replace(/(\w+):/g, '"$1":')` ломала уже-quoted ключи (`"id":` → `""id":`), `JSON.parse` падал в catch → `expectedResponse = {}`. Сравнение всегда показывало "изменения", но `updateTestDataInFile` заменял данные на те же самые — визуально файл не менялся.
2. Режим `createSeparateDataFiles` не поддерживался: в тестовом файле `const normalizedExpected = normalizedExpectedResponse1;` (переменная, не объект), реальные данные лежат в `./test-data/xxx-data-1.ts`. Старый код игнорировал этот файл.

**Что исправлено:**
- Новый хелпер `extractJsonBlock` — счётчик скобок корректно извлекает любой вложенный JSON-блок
- `extractTestInfo` теперь определяет режим по импорту `from './test-data/...-data-N'` и читает данные из файла данных напрямую
- `updateJsonInContent` заменяет `updateTestDataInFile` — в режиме `createSeparateDataFiles` обновляет `normalizedExpectedResponse` в файле данных, иначе обновляет `normalizedExpected` inline
- `uniqueFields` / `uniqueFieldsUpperCase` добавлены в `ReActualizeConfig` — при POST/PUT/PATCH уникальные поля рандомизируются через `generateSmartUniqueValue` (как при генерации тестов)

**Новые параметры `ReActualizeConfig`:**

| Параметр | Тип | Описание |
|---|---|---|
| `uniqueFields` | `string[]` | Поля которые рандомизируются при POST/PUT/PATCH запросах |
| `uniqueFieldsUpperCase` | `string[]` | Поля из uniqueFields которые генерируются в ВЕРХНЕМ регистре |

```typescript
await reActualizeHappyPathTests({
  testsDir: './e2e/api/happy-path',
  standUrl: process.env.STAND_URL,
  axiosConfig: { headers: { Authorization: `Bearer ${token}` } },
  endpointFilter: ['/api/v1/orders'],
  uniqueFields: ['code', 'name'],        // ← рандомизируются при POST/PUT/PATCH
  uniqueFieldsUpperCase: ['code'],       // ← code будет в ВЕРХНЕМ регистре
});
```

---

### v14.8.1 — Сохранение настроек skipCheckFields/checkStructureOnly при force регенерации

**Проблема:** при запуске генерации с `force: true` все вручную выставленные настройки в тестах (`skipCheckFieldsGlobal`, `checkStructureOnlySingle` и т.д.) затирались.

**Решение:** генератор теперь перед перезаписью читает старый файл, сохраняет все нестандартные значения, и после генерации восстанавливает их. Привязка идёт по `// DB ID: db-id-{N}` — уникальному маркеру каждого теста.

**Что сохраняется и восстанавливается:**
- `skipCheckFieldsGlobal` (если не пустой массив)
- `skipCheckFieldsSingle` (если не пустой массив, для каждого теста по DB ID)
- `checkStructureOnlyGlobal` (если `true`)
- `checkStructureOnlySingle` (если `true`, для каждого теста по DB ID)

---

### v14.8.0 — checkStructureOnly: проверка только структуры ответа

**Проблема:** пагинационные и поисковые эндпоинты возвращают разные данные при каждом запуске — Happy Path тесты постоянно падают по значениям.

**Решение:** новый флаг `checkStructureOnly` — проверяет только наличие полей и их типы, но не значения.

```typescript
// В начале файла — применяется ко ВСЕМ тестам:
const checkStructureOnlyGlobal = false;

// Внутри теста — только для этого теста:
const checkStructureOnlySingle = false;
const checkStructureOnly = checkStructureOnlyGlobal || checkStructureOnlySingle;
```

**Поведение при `checkStructureOnly = true`:**
- Примитивы (string, number, boolean) — тип проверяется, значение нет
- Объекты — проверяется только наличие полей (рекурсивно)
- Массивы — проверяется что не пустой + структура первого элемента
- Настройка сохраняется при force регенерации (v14.8.1)

---

### v14.7.1 — Детализация ошибок для 422/400 тестов

**Проблема:** при падении 422/400 теста с сообщением _"Ожидалась ошибка 422, но запрос успешен"_ не было никакой информации о том, что именно вызывалось.

**Теперь при таком падении выводится:**
```
❌ Ожидалась ошибка 422, но запрос успешен
📍 Endpoint: /api/v1/orders | Method: POST
📍 Full URL: https://stand.example.com/api/v1/orders
📋 Response status: 200
📋 Response data: { "id": 123, "status": "created" }
📋 CURL: curl -X POST 'https://stand.example.com/api/v1/orders' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{"name":"TEST","code":"ABC"}'
```

Для 400 тестов — аналогично, плюс при несовпадении текста сообщения об ошибке тоже выводится CURL с diff.

---

### v14.7.0 — Умное сопоставление массивов без привязки к индексу

**Проблема:** тесты падали из-за изменения порядка или индексов в массивах:
- UI тесты создали новую запись → все элементы сдвинулись
- `results[10].title = "TEST"` ожидалось, но элемент стал `results[9]` → ложное падение

**Новый алгоритм:**
1. Для каждого ожидаемого элемента ищем **точное совпадение в любом индексе** actual
2. Нашли → ✅ PASS
3. Не нашли точно → ищем наиболее похожий и показываем конкретные различия
4. Не нашли совсем → ❌ FAIL `"no matching element found in actual array"`

**Другие изменения:**
- `act.length >= exp.length` → ок (добавились новые записи — не падаем)
- `act.length < exp.length` → FAIL (ожидаемые элементы пропали)
- Примитивные массивы (`[1, 2, 3]`) → проверяем наличие каждого значения без учёта порядка

---

### v14.6.1 — Подмена uniqueFields перед валидацией

**Проблема:** при генерации Happy Path тестов, валидатор использовал оригинальные данные из БД. Если запись с таким `code`/`name` ещё существовала в системе — API возвращал 400 "уже существует", и запрос ошибочно определялся как дубликат вместо happy path.

**Решение:** теперь перед каждой попыткой валидации POST/PUT/PATCH запросов поля из `uniqueFields` заменяются на полностью новые уникальные значения. Каждый retry получает новые значения.

**Новые параметры в `dataValidation`:**

| Параметр | Тип | Описание |
|---|---|---|
| `uniqueFields` | `string[]` | Поля которые заменяются на уникальные перед валидацией |
| `uniqueFieldsUpperCase` | `string[]` | Поля из uniqueFields которые генерируются в ВЕРХНЕМ регистре |

> **Примечание:** эти параметры автоматически берутся из основного конфига генератора (`config.uniqueFields` и `config.uniqueFieldsUpperCase`) — отдельно прописывать не нужно.

**Пример:**
```typescript
await generateHappyPathTests({
  // ...
  uniqueFields: ['name', 'code', 'title'],       // ← заменяются и при генерации теста, и при валидации
  uniqueFieldsUpperCase: ['code'],                // ← code генерируется в ВЕРХНЕМ регистре
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
    validationRetries: 3,                         // ← каждая из 3 попыток получает НОВЫЙ уникальный код
    // uniqueFields передаётся автоматически ↑
  }
}, sql);
```

---

### v14.6.0 — skipCheckFields: пропуск проверки значения динамических полей

**Проблема:** поля типа `pagination.total`, `totalAmount`, счётчики — их значения меняются между запусками (UI тесты создают/удаляют записи), из-за чего Happy Path тесты ложно падают.

**Решение:** в каждом сгенерированном тесте появились два массива которые можно редактировать вручную:

```typescript
// В начале файла — применяется ко ВСЕМ тестам в файле:
const skipCheckFieldsGlobal: string[] = [];

// Внутри каждого теста — только для этого теста:
const skipCheckFieldsSingle: string[] = [];
```

Для полей из этих массивов проверяется **только наличие поля** в response, значение не сравнивается.

**Поддерживаемые форматы:**
```typescript
// Простое имя поля — пропускается везде где встретится:
skipCheckFieldsGlobal = ['total', 'count'];

// Вложенный путь — пропускается только по точному пути:
skipCheckFieldsGlobal = ['pagination.total', 'meta.count'];

// С префиксом root. — эквивалентно без него:
skipCheckFieldsGlobal = ['root.pagination.total'];
```

**Пример использования:**
```typescript
// orders.test.ts

// Пагинация меняется — скипаем для всего файла:
const skipCheckFieldsGlobal: string[] = ['pagination.total', 'pagination.count'];

test.describe('API тесты для GET /api/v1/orders - Happy Path', async () => {

  test('GET Happy path #1 ...', async () => {
    // Этот заказ мог изменить сумму — скипаем только здесь:
    const skipCheckFieldsSingle: string[] = ['totalAmount'];
    // ...
  });

});
```

---

## 📋 Что было в v14.5.9

- **🆔 Умная генерация уникальных полей**: `AUTOCODE` → `XKZPQWNM` (полностью новое значение, не суффикс)
- **🐛 Исправлено**: `ignoreFieldValues` теперь работает с вложенными путями (`meta.count`)
- **🔍 Улучшено**: Сравнение массивов объектов с одинаковыми полями в разных вложенных объектах

## 📋 Что было в v14.5.8

- **🐛 Исправлено**: Удаление заголовка `Content-Length` из axios запросов (вызывал 502 ошибки)

## 📋 Что было в v14.5.7

- **🐛 Исправлено**: Массивы в request body (`[324234]`) больше не конвертируются в объекты (`{"0": 324234}`)

## 📋 Что было в v14.5.6

- **🔍 Pattern matching для excludeEndpoints**: Поддержка wildcard (`*`) и path параметров (`{id}`)

## 📋 Что было в v14.5.1

## 📋 Что было в v14.5

- **🔄 Дедупликация по body**: Запросы с одинаковыми полями, но разным порядком теперь считаются идентичными (`{"a": 1, "b": 2}` === `{"b": 2, "a": 1}`)
- **📋 Исправление CURL**: Убрано двойное экранирование body, однострочный вывод для удобного копирования
- **🧹 Вынос helpers**: Функции `prepareUniqueFields`, `buildCurlCommand`, `compareWithoutUniqueFields`, `verifyUniqueFields` вынесены в `test-data/test-helpers.ts`
- **📦 Компактные тесты**: Тесты стали значительно короче за счёт использования helper функций

## 📋 Что было в v14.4

- **🔁 Парные тесты на дубликаты (400)**: Автоматическая генерация негативного (400) + позитивного (2xx) тестов
- **✅ Точное сообщение**: Негативный тест проверяет ТОЧНОЕ сообщение из реального response
- **🆔 Уникальные данные**: Позитивный тест использует uniqueFields для обхода 400 ошибки

## 📋 Что было в v14.3

- **📋 Тесты на валидацию (422)**: Автоматическая генерация тестов для 422 ошибок с детальными сообщениями
- **🔍 Сбор 422 ошибок**: При валидации собираются все 422 ответы с непустым detail сообщением
- **⏭️ Пропуск "Bad Request"**: Ответы без детализации ("Bad Request") пропускаются и логируются в отдельный JSON
- **📁 Отдельная папка**: Тесты валидации генерируются в отдельную папку с test-data

## 📋 Что было в v14.2

- **🆔 Уникальные поля для POST**: Автоматическая генерация уникальных значений для полей `name`, `code`, `title` и т.д., чтобы избежать ошибок 400 "Уже существует"
- **✅ Умная проверка уникальных полей**: Проверяется что бэкенд вернул именно те значения которые отправили (не исключаются из проверки!)
- **🔠 Поддержка CAPS**: Параметр `uniqueFieldsUpperCase` для полей которые должны быть в ВЕРХНЕМ РЕГИСТРЕ (например `code`)

## 📋 Что было в v14.1

- **🔄 Реактуализация тестов**: Новый метод `reActualizeHappyPathTests()` для обновления тестовых данных
- **📧 Email уведомления**: Отправка HTML писем при 5xx ошибках (500-503) в Happy Path тестах
- **📋 CURL вывод**: При падении Happy Path теста выводится copyable CURL для отладки
- **🛡️ Безопасные 405 тесты**: Исключение разрешённых методов + параметр `exclude405Methods`
- **🐛 Исправление test-data**: Корректная работа с `groupByCategory` + `createSeparateDataFiles`
- **📁 Логирование ошибок валидации**: 4xx и 5xx ошибки сохраняются в отдельные JSON файлы с CURL
- **🔧 Централизация handleApiError**: Вся логика обработки ошибок вынесена в `apiTestHelper`
- **🔀 Исправление сравнения массивов**: Порядок элементов в массивах теперь игнорируется при сравнении

## 📋 Что было в v14.0

- **🎯 Раздельные методы генерации**: `generateNegativeTests()`, `generatePositiveTests()`, `generatePairwiseTests()`
- **📁 Поддержка папок**: Теперь можно указывать папку с файлами, а не только один файл
- **🗂️ Автогруппировка**: Тесты автоматически группируются по категориям (orders/, users/ и т.д.)
- **🔧 Правильная интеграция apiTestHelper**: Хелпер теперь используется в негативных тестах при падении
- **📊 Детальный отчет**: "Не удалось сгенерировать" с причинами (no_dto, no_endpoint и т.д.)
- **🔒 Защита тестов**: Возможность помечать тесты как `@protected` для защиты от обновления

## 📦 Что внутри

1. **API Generator** - Генерация TypeScript API клиентов из OpenAPI спецификаций
2. **Test Generator** - Автоматическая генерация Playwright тестов с Happy Path данными (v13.0)
3. **Happy Path Generator** - Генерация Happy Path тестов из реальных данных UI тестов (v12.0)
4. **Database Analyzer** - Извлечение реальных данных из БД с интеллектуальными повторами (v13.0)
5. **API Collector** - Сбор данных из UI тестов для Happy Path

## 🚀 Быстрый старт

### Установка

```bash
npm install @your-company/api-codegen
```

### 1. Генерация API клиента из OpenAPI

```typescript
import { generateApi } from '@your-company/api-codegen';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api',
  httpClient: 'axios',
  baseUrl: 'process.env.API_BASE_URL'
});
```

**Результат:**
```
api/
├── orders.api.ts      # API методы
├── orders.types.ts    # TypeScript типы
├── products.api.ts
└── products.types.ts
```

### 2. Генерация негативных тестов - v14.0 ⭐ NEW

```typescript
import { generateNegativeTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

// Вариант 1: Один файл
await generateNegativeTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/negative',
  dbConnection: sql
});

// Вариант 2: Вся папка с автогруппировкой
await generateNegativeTests({
  apiFilePath: './api/',  // ← Вся папка!
  outputDir: './tests/api/negative',
  groupByCategory: true,  // ← Создаст подпапки orders/, users/
  generate401Tests: true,
  generate403Tests: true,
  generate400Tests: true,
  generate404Tests: true,
  generate405Tests: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Негативные тесты (401, 403, 400, 404, 405)
- ✅ Автоматическая группировка по категориям
- ✅ Правильное использование `apiTestHelper` при падении
- ✅ Детальный отчет с причинами неудач
- ✅ **v14.1**: Безопасные 405 тесты (не вызывают DELETE/PUT если они разрешены)

### 2.0.1 Безопасная генерация 405 тестов - v14.1 ⭐ NEW

При генерации 405 тестов автоматически исключаются методы, которые реально поддерживаются endpoint'ом:

```typescript
await generateNegativeTests({
  apiFilePath: './api/',
  outputDir: './tests/api/negative',
  generate405Tests: true,

  // v14.1: Глобальное исключение методов из 405 тестов
  exclude405Methods: ['DELETE', 'PUT'],  // Никогда не тестировать эти методы

  dbConnection: sql
});
```

**Как работает:**
- Если endpoint поддерживает `GET` и `POST`, 405 тест НЕ будет пробовать эти методы
- Параметр `exclude405Methods` позволяет глобально исключить опасные методы
- Это предотвращает случайное удаление тестовых данных

### 2.1 Генерация позитивных тестов - v14.0 ⭐ NEW

```typescript
import { generatePositiveTests } from '@your-company/api-codegen';

await generatePositiveTests({
  apiFilePath: './api/',
  outputDir: './tests/api/positive',
  generateRequiredFieldsTest: true,
  generateAllFieldsTest: true,
  groupByCategory: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Позитивные тесты (с обязательными полями, со всеми полями)
- ✅ Использует реальные данные из `qa.api_requests` таблицы

### 2.2 Генерация pairwise тестов - v14.0 ⭐ NEW

```typescript
import { generatePairwiseTests } from '@your-company/api-codegen';

await generatePairwiseTests({
  apiFilePath: './api/',
  outputDir: './tests/api/pairwise',
  generateOptionalCombinations: true,
  generateEnumTests: true,
  maxPairwiseCombinations: 10,
  groupByCategory: true,
  dbConnection: sql
});
```

**Что генерируется:**
- ✅ Pairwise тесты (комбинаторное покрытие)
- ✅ Комбинации необязательных полей
- ✅ Тесты для enum значений

### 3. Генерация Happy Path тестов - v12.0

```typescript
import { generateHappyPathTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'qa',
  maxTestsPerEndpoint: 10,

  // v14.1: Email уведомления при 5xx ошибках
  send5xxEmailNotification: true,
  emailHelperPath: '../../../helpers/mailHelper',
  emailHelperMethodName: 'sendErrorMailbyApi',

  // v14.1: Логирование ошибок валидации в JSON файлы
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
    clientErrorsLogPath: './validation-errors/4xx-client-errors.json',  // 400, 404, 422 и т.д.
    serverErrorsLogPath: './validation-errors/5xx-server-errors.json',  // 500, 501, 502, 503
    sendServerErrorEmail: true  // Отправка email при 5xx ошибках валидации
  }
}, sql);
```

### 3.0.1 Логирование ошибок валидации - v14.1 ⭐ NEW

При генерации Happy Path тестов происходит валидация данных - вызов реальных API endpoints.
Если endpoints возвращают ошибки, они сохраняются в JSON файлы:

**Структура JSON файла ошибок:**
```json
{
  "generatedAt": "2026-02-10T12:00:00.000Z",
  "lastUpdated": "2026-02-10T12:30:00.000Z",
  "errorType": "4xx Client Errors",
  "totalErrors": 3,
  "errors": [
    {
      "timestamp": "2026-02-10T12:00:00.000Z",
      "timestampMsk": "10.02.2026, 15:00:00 (МСК)",
      "errorCode": 404,
      "errorMessage": "Not Found",
      "endpoint": "/api/v1/orders/12345",
      "method": "GET",
      "fullUrl": "https://api.example.com/api/v1/orders/12345",
      "curlCommand": "curl -X GET 'https://api.example.com/api/v1/orders/12345' \\\n  -H 'Authorization: Bearer xxx'",
      "requestId": 123,
      "testName": "get-order-test"
    }
  ]
}
```

**Что логируется:**
- **4xx ошибки** (400, 404, 422 и т.д.) → `./validation-errors/4xx-client-errors.json`
- **5xx ошибки** (500, 501, 502, 503) → `./validation-errors/5xx-server-errors.json` + **email**

**Особенности:**
- ✅ Тесты на основе реальных данных из UI тестов
- ✅ Глубокое сравнение ответов с БД (v14.1 - с игнорированием порядка в массивах)
- ✅ Валидация типов из DTO
- ✅ Дедупликация похожих тестов (v12.0)
- ✅ Проверка актуальности данных (v12.0)
- ✅ **v14.1**: CURL вывод при несовпадении данных
- ✅ **v14.1**: Email уведомления при 5xx ошибках

### 3.0.2 Сравнение данных с игнорированием порядка - v14.1 ⭐ NEW

API часто возвращает массивы в произвольном порядке. Функция `compareDbWithResponse` автоматически сортирует массивы перед сравнением.

**Как работает сортировка:**

1. **Массивы чисел** - числовая сортировка: `[3, 5, 1, 44]` → `[1, 3, 5, 44]`

2. **Массивы строк** - алфавитная сортировка: `["ORDERED", "CREATED"]` → `["CREATED", "ORDERED"]`

3. **Массивы объектов** - сортировка по первому найденному ключевому полю:
   - `id`, `uuid`, `guid`, `code`, `key`, `type`, `kind`, `category`, `name`, `title`, `label`

4. **Объекты без ключевых полей** - создаётся хеш из всех значений

5. **Рекурсивная обработка** - вложенные массивы также сортируются

**Пример:**

```javascript
// Ожидаемые данные (из БД):
const expected = [
  { id: 2, name: "Вася" },
  { id: 9, name: "Антони" },
  { id: 21, name: "Ноу" }
];

// Фактические данные (с API, другой порядок):
const actual = [
  { id: 21, name: "Ноу" },
  { id: 2, name: "Вася" },
  { id: 9, name: "Антони" }
];

// Сравнение вернёт isEqual: true
const result = compareDbWithResponse(expected, actual);
console.log(result.isEqual); // true - порядок игнорируется!
```

**Работает с вложенными массивами:**

```javascript
// Объект с вложенным массивом products
const expected = {
  id: 44,
  products: [
    { id: 32, title: "Картофель" },
    { id: 33, title: "Редис" }
  ]
};

const actual = {
  id: 44,
  products: [
    { id: 33, title: "Редис" },  // Порядок изменён
    { id: 32, title: "Картофель" }
  ]
};

const result = compareDbWithResponse(expected, actual);
console.log(result.isEqual); // true - вложенные массивы тоже сортируются!
```

**Массивы строк (avalibleStates, permissions и т.д.):**

```javascript
const expected = {
  id: 43,
  avalibleStates: ["ORDERED", "CREATED", "TESTED", "DELIVERED"]
};

const actual = {
  id: 43,
  avalibleStates: ["TESTED", "CREATED", "DELIVERED", "ORDERED"]  // Другой порядок
};

const result = compareDbWithResponse(expected, actual);
console.log(result.isEqual); // true - строки сортируются по алфавиту!
```

**Массивы чисел (tags, ids и т.д.):**

```javascript
const expected = {
  id: 43,
  tags: [3, 5, 1, 44]
};

const actual = {
  id: 43,
  tags: [1, 5, 44, 3]  // Другой порядок
};

const result = compareDbWithResponse(expected, actual);
console.log(result.isEqual); // true - числа сортируются по значению!
```

**Функция `sortArraysRecursively`:**

Доступна для использования отдельно:

```typescript
import { sortArraysRecursively } from '@your-company/api-codegen/dist/utils/data-comparison';

const data = {
  items: [{ id: 3 }, { id: 1 }, { id: 2 }],
  nested: {
    users: [{ id: "b" }, { id: "a" }]
  }
};

const sorted = sortArraysRecursively(data);
// sorted.items = [{ id: 1 }, { id: 2 }, { id: 3 }]
// sorted.nested.users = [{ id: "a" }, { id: "b" }]
```

### 3.1 Реактуализация Happy Path тестов - v14.1 ⭐ NEW

Обновление тестовых данных в существующих Happy Path тестах на основе актуальных ответов API:

```typescript
import { reActualizeHappyPathTests } from '@your-company/api-codegen';

const result = await reActualizeHappyPathTests({
  testsDir: './tests/api/happy-path',
  standUrl: process.env.StandURL,
  axiosConfig: { headers: { Authorization: 'Bearer xxx' } },

  // Опционально: фильтр по endpoints
  endpointFilter: ['/api/v1/orders', '/api/v1/users'],

  // Обновлять файлы или только показать различия
  updateFiles: true,  // false для dry-run

  // Подробный вывод
  debug: true
});

console.log(`Обновлено: ${result.updatedTests} из ${result.totalTests}`);
console.log(`Пропущено: ${result.skippedTests}, Ошибок: ${result.failedTests}`);
```

**Что делает:**
1. 📂 Сканирует папку с `.happy-path.test.ts` файлами
2. 🔍 Извлекает endpoint, метод и ожидаемые данные
3. 🌐 Вызывает реальный API endpoint
4. 📊 Сравнивает ответ с ожидаемыми данными
5. ✏️ Обновляет тестовый файл при различиях

**Возвращает:**
```typescript
{
  totalTests: 50,
  updatedTests: 5,
  skippedTests: 3,
  failedTests: 2,
  details: [
    { testFile: '...', endpoint: '/api/orders', method: 'GET', status: 'updated', changedFields: ['name', 'price'] },
    { testFile: '...', endpoint: '/api/users/1', method: 'GET', status: 'unchanged' },
    { testFile: '...', endpoint: '/api/products', method: 'POST', status: 'failed', reason: 'API error: 401' }
  ]
}
```

### 3.2 Уникальные поля для POST запросов - v14.2 ⭐ NEW

При создании записей часто возникают ошибки 400 "Уже существует" из-за дублирования уникальных полей (`code`, `name`, `title` и т.д.).

**Пример проблемы:**
```
POST /api/v1/orders/create
body: {"id": null, "name": "test", "code":"TEST", "title": "ВВВ"}
Response: {"errors": {"code": ["Уже существует"]}}
```

**Решение v14.2:** Автоматическое добавление уникального суффикса + умная проверка.

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',

  // v14.2: Уникальные поля
  uniqueFields: ['name', 'code', 'title', 'email'],  // Поля для уникализации
  uniqueFieldsUpperCase: ['code'],                   // Поля которые должны быть в CAPS
  enableUniqueFieldGeneration: true,                 // Включить генерацию (по умолчанию true)

}, sql);
```

**Как работает (3 этапа):**

**Этап 1: Генерация уникальных значений перед отправкой**

```javascript
// Исходный request (из api_requests таблицы):
const requestData = { "name": "test", "code": "TEST", "title": "ВВВ" };

// Генерируем уникальный суффикс
const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const modifiedUniqueFields = {}; // Сохраняем для проверки

// Модифицируем поля (code в CAPS, остальные как есть)
requestData.name = "test" + uniqueSuffix;           // "test_1707654321_abc12"
modifiedUniqueFields.name = requestData.name;

requestData.code = ("TEST" + uniqueSuffix).toUpperCase();  // "TEST_1707654321_ABC12" (CAPS!)
modifiedUniqueFields.code = requestData.code;

requestData.title = "ВВВ" + uniqueSuffix;           // "ВВВ_1707654321_abc12"
modifiedUniqueFields.title = requestData.title;

// Отправляем запрос
const response = await axios.post(url, requestData, config);
```

**Этап 2: Проверка уникальных полей в response**

```javascript
// Проверяем что бэкенд вернул ИМЕННО ТЕ значения которые мы отправили
// Если бэк вернул пустое значение или другое - тест УПАДЁТ!

for (const [fieldName, sentValue] of Object.entries(modifiedUniqueFields)) {
  const receivedValue = response.data[fieldName];
  expect(receivedValue).toBe(sentValue);  // name === "test_1707654321_abc12"
                                          // code === "TEST_1707654321_ABC12"
                                          // title === "ВВВ_1707654321_abc12"
}
```

**Этап 3: Сравнение остальных полей (без уникальных)**

```javascript
// Исключаем уникальные поля из ОБОИХ объектов
const { name, code, title, ...expectedWithoutUnique } = normalizedExpected;
const { name: _n, code: _c, title: _t, ...responseWithoutUnique } = response.data;

// Сравниваем остальные поля как обычно
const comparison = compareDbWithResponse(expectedWithoutUnique, responseWithoutUnique);
expect(comparison.isEqual).toBe(true);
```

**Что проверяется:**

| Проверка | Как работает |
|----------|--------------|
| ✅ Уникальные поля | `response.data.name === requestData.name` (тот же суффикс) |
| ✅ Остальные поля | Полное сравнение с `normalizedExpected` (без уникальных) |
| ✅ Пустые значения | Если бэк вернёт `name: null` - тест упадёт! |
| ✅ Другие значения | Если бэк вернёт `name: "другое"` - тест упадёт! |

**Параметры конфигурации:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `uniqueFields` | `string[]` | `['name', 'code', 'title']` | Поля для уникализации |
| `uniqueFieldsUpperCase` | `string[]` | `['code']` | Поля в ВЕРХНЕМ РЕГИСТРЕ |
| `enableUniqueFieldGeneration` | `boolean` | `true` | Включить/выключить |

**Пример сгенерированного теста:**

```typescript
test(`POST Happy path #1 (201) @api @apiHappyPath`, async ({ page }, testInfo) => {
  const requestData = { "name": "test", "code": "TEST", "title": "ВВВ", "price": 100 };
  const normalizedExpected = { "id": 123, "name": "test", "code": "TEST", "title": "ВВВ", "price": 100 };

  // Генерация уникальных значений
  const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const modifiedUniqueFields: Record<string, string> = {};

  if (requestData.name && typeof requestData.name === 'string') {
    requestData.name = requestData.name + uniqueSuffix;
    modifiedUniqueFields['name'] = requestData.name;
  }
  if (requestData.code && typeof requestData.code === 'string') {
    requestData.code = (requestData.code + uniqueSuffix).toUpperCase();  // CAPS!
    modifiedUniqueFields['code'] = requestData.code;
  }
  if (requestData.title && typeof requestData.title === 'string') {
    requestData.title = requestData.title + uniqueSuffix;
    modifiedUniqueFields['title'] = requestData.title;
  }

  // Отправка запроса
  const response = await axios.post(url, requestData, config);
  expect(response.status).toBe(201);

  // 1. Проверка уникальных полей - бэк должен вернуть то что отправили
  for (const [fieldName, sentValue] of Object.entries(modifiedUniqueFields)) {
    expect(response.data[fieldName]).toBe(sentValue);
  }

  // 2. Проверка остальных полей (price, id и т.д.)
  const { name, code, title, ...expectedWithoutUnique } = normalizedExpected;
  const { name: _n, code: _c, title: _t, ...responseWithoutUnique } = response.data;
  const comparison = compareDbWithResponse(expectedWithoutUnique, responseWithoutUnique);
  expect(comparison.isEqual).toBe(true);
});
```

**Отключение:**

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  enableUniqueFieldGeneration: false,  // Не модифицировать поля
}, sql);
```

### 3.1 Тесты на валидацию (422 ошибки) - v14.3 NEW

При генерации Happy Path тестов можно автоматически создавать тесты для 422 ошибок валидации.

**Как это работает:**

1. При валидации запросов собираются все ответы с кодом 422
2. Ответы с детальным сообщением (`detail`) используются для генерации тестов
3. Ответы с "Bad Request" (без детализации) пропускаются и логируются в отдельный JSON
4. Тесты генерируются в отдельную папку с проверкой: статус 422 + ожидаемое сообщение

**Включение:**

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',

  // Настройки тестов валидации
  validationTests: {
    enabled: true,                                    // Включить генерацию
    outputDir: '../validation-tests',                 // Папка относительно outputDir
    badRequestSkipLogPath: './validation-errors/422-bad-request-skipped.json',
    createSeparateDataFiles: true,                    // test-data папка
    groupByCategory: true,                            // Группировка по категориям
    testTag: '@apiValidation',                        // Тег для тестов
    maxTestsPerEndpoint: 3,                           // Максимум тестов на эндпоинт
    skipMessagePatterns: ['Bad Request', ''],         // Паттерны для пропуска
  },

  // ВАЖНО: Валидация должна быть включена для сбора 422 ошибок!
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
  }
}, sql);
```

> **⚠️ Важно:** Если тесты не генерируются:
> 1. Убедитесь что `dataValidation.enabled: true` и `dataValidation.validateBeforeGeneration: true`
> 2. Убедитесь что `validationTests.enabled: true`
> 3. Проверьте что API возвращает 422 ошибки с непустым `detail` сообщением
> 4. В консоли будет выведено: "📋 422 ошибок: N" - если N=0, значит ошибок не найдено

**Параметры конфигурации validationTests:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `enabled` | `boolean` | `false` | Включить генерацию тестов на 422 |
| `outputDir` | `string` | `'../validation-tests'` | Папка для тестов (относительно outputDir) |
| `badRequestSkipLogPath` | `string` | `'./validation-errors/422-bad-request-skipped.json'` | Путь для логирования пропущенных |
| `createSeparateDataFiles` | `boolean` | `true` | Создавать test-data папку |
| `groupByCategory` | `boolean` | `true` | Группировка по категориям |
| `testTag` | `string` | `'@apiValidation'` | Тег для тестов |
| `maxTestsPerEndpoint` | `number` | `3` | Максимум тестов на эндпоинт |
| `skipMessagePatterns` | `string[]` | `['Bad Request', ...]` | Паттерны для пропуска |

**Результат:**

```
tests/
├── happy-path/
│   └── orders/
│       └── post-orders.spec.ts
└── validation-tests/           # ← Новая папка!
    └── orders/
        ├── post-orders-validation.spec.ts
        └── test-data/
            └── post-orders-validation-data.ts
```

**Пример сгенерированного теста:**

```typescript
test(`Validation #1: Поле 'email' должно быть валидным (422) @api @apiValidation`, async ({ page }, testInfo) => {
  const requestData = { ...requestData1 };
  const expectedErrorData = expectedError1;

  let response;
  let errorCaught = false;

  try {
    response = await axios.post(url, requestData, config);
  } catch (error: any) {
    errorCaught = true;
    response = error.response;

    // Если это НЕ 422 - пробрасываем ошибку
    if (!response || response.status !== 422) {
      await handleApiError({ error, testInfo, ... });
    }
  }

  // Проверяем что вернулся 422
  expect(errorCaught).toBe(true);
  expect(response.status).toBe(422);

  // Проверяем сообщение (мягкая проверка - предупреждение, не падение)
  const responseDetail = response.data?.detail || response.data?.message;
  if (responseDetail !== expectedErrorData.detailMessage) {
    console.warn('⚠️ Сообщение об ошибке изменилось');
  }
});
```

### 3.2 Парные тесты на дубликаты (400 ошибки) - v14.4 NEW

При создании записей с дублирующимися уникальными полями бэкенд возвращает 400 "Уже существует". Генератор автоматически создаёт ПАРНЫЕ тесты:

1. **Негативный тест** - оригинальные данные → 400 + проверка ТОЧНОГО сообщения
2. **Позитивный тест** - данные с uniqueFields → 2xx + полная проверка response

**Включение:**

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',

  // Настройки тестов на дубликаты
  duplicateTests: {
    enabled: true,                                     // Включить генерацию
    outputDir: './tests/api/negative-400',             // АБСОЛЮТНЫЙ путь к папке
    badRequestSkipLogPath: './validation-errors/400-bad-request-skipped.json',
    createSeparateDataFiles: true,                     // test-data папка
    groupByCategory: true,                             // Группировка по категориям
    testTag: '@negative400Validation',                 // Тег для тестов
    maxTestsPerEndpoint: 2,                            // Максимум тестов на эндпоинт
    skipMessagePatterns: ['Bad Request', ''],          // Паттерны для пропуска
  },

  // ВАЖНО: Валидация должна быть включена для сбора 400 ошибок!
  dataValidation: {
    enabled: true,
    validateBeforeGeneration: true,
  }
}, sql);
```

> **⚠️ Важно:** Если тесты не генерируются:
> 1. Убедитесь что `dataValidation.enabled: true` и `dataValidation.validateBeforeGeneration: true`
> 2. Убедитесь что `duplicateTests.enabled: true`
> 3. Проверьте что API возвращает 400 ошибки с сообщением "Уже существует" (или подобным)
> 4. В консоли будет выведено: "📋 400 ошибок: N" - если N=0, значит ошибок не найдено

**Результат (3 отдельные папки):**

```
tests/
├── happy-path/              # ← Happy Path тесты
│   └── orders/
│       └── post-orders.spec.ts
├── validation-tests/        # ← Тесты на 422 (v14.3)
│   └── orders/
│       └── post-orders-validation.spec.ts
└── negative-400/            # ← Тесты на 400 (v14.4)
    └── orders/
        ├── post-orders-duplicate-400.spec.ts
        └── test-data/
            └── post-orders-duplicate-400-data.ts
```

### 4. Анализ БД и генерация данных - v13.0

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({ /* ... */ });

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',

  // v13.0: Happy Path интеграция
  useHappyPathData: true,
  happyPathSchema: 'qa',
  maxAttempts: 10
}, sql);
```

**Что делает:**
1. Анализирует схему БД
2. Получает Happy Path данные из `qa.api_requests`
3. Генерирует fallback данные
4. Делает 10-15 попыток получить 200 ответ
5. Обновляет тест файл рабочими данными

### 5. Сбор данных из UI тестов

```typescript
import { collectApiData } from '@your-company/api-codegen';

test.beforeEach(async ({ page }, testInfo) => {
  await collectApiData(page, testInfo, {
    serviceUrl: 'http://vm-host:3000',
    endpoint: '/api/collect-data',
    urlFilters: ['/api/']
  });
});
```

## 🔒 Защита тестов от обновления (v14.0) ⭐ NEW

Иногда требуется защитить отдельные тесты от перезаписи при повторной генерации.

### Способ 1: Защита всего файла

```typescript
// @readonly

import test, { expect } from '../../../fixtures/baseTest';
// ... остальной код
```

### Способ 2: Защита конкретного теста

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

**Важно:** При повторной генерации защищенные блоки полностью сохраняются!

---

## 🗄️ Настройка БД (v13.0)

### Таблица для Happy Path данных

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

CREATE INDEX idx_api_requests_endpoint_method
  ON qa.api_requests(endpoint, method, response_status);
```

### Переменные окружения

```bash
# Для Happy Path интеграции
StandURL=https://api.example.com
AUTH_TOKEN=your_auth_token

# Подключение к БД
DB_HOST=localhost
DB_NAME=test_database
DB_USER=postgres
DB_PASSWORD=password
```

## 📊 Основные методы

| Метод | Описание | Версия |
|-------|----------|--------|
| `generateApi()` | Генерация API клиента из OpenAPI | - |
| ⭐ `generateNegativeTests()` | Генерация ТОЛЬКО негативных тестов (401, 403, 400, 404, 405) | v14.0 |
| ⭐ `generatePositiveTests()` | Генерация ТОЛЬКО позитивных тестов (200, 201) | v14.0 |
| ⭐ `generatePairwiseTests()` | Генерация ТОЛЬКО pairwise комбинаций | v14.0 |
| 🚫 `generateApiTests()` | Генерация всех тестов (**DEPRECATED** - используйте раздельные методы) | v13.0 |
| `generateHappyPathTests()` | Генерация Happy Path тестов из БД + email уведомления | v12.0 / v14.1 |
| ⭐ `reActualizeHappyPathTests()` | **NEW** Реактуализация тестовых данных Happy Path | v14.1 |
| `analyzeAndGenerateTestData()` | Анализ БД и генерация данных | v13.0 |
| `collectApiData()` | Сбор данных из UI тестов | - |

## 📚 Документация

- **[README_FULL.md](./README_FULL.md)** - Полная документация со всеми конфигурациями и примерами
- **[CHAT_CONTEXT_EXPORT.md](./CHAT_CONTEXT_EXPORT.md)** - История разработки и контекст проекта

## 🔧 Минимальная конфигурация

### generateApiTests (v13.0)

```typescript
await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

### generateHappyPathTests (v12.0)

```typescript
await generateHappyPathTests({
  outputDir: './tests/api/happy-path',
  dbConnectionMethod: 'testDbConnect'
}, sql);
```

### analyzeAndGenerateTestData (v13.0)

```typescript
await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema'
}, sql);
```

## 🎯 Workflow

```
┌─────────────────────────────────────────┐
│ 1. UI Тесты                             │
│    └─> Собирают API запросы/ответы      │
│         └─> Сохраняют в qa.api_requests │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Генерация тестов (v13.0)            │
│    ├─> generateApiTests()               │
│    │   └─> Использует Happy Path данные │
│    └─> generateHappyPathTests()         │
│        └─> Создает тесты из БД          │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Запуск тестов                        │
│    └─> Тесты используют реальные данные │
│        └─> Меньше flaky тестов          │
└─────────────────────────────────────────┘
```

## 📝 История версий

### v14.9.0 (Текущая) ⭐
- ✅ **Исправлен reActualizeHappyPathTests**: корректный парсинг JSON через счётчик скобок
- ✅ **Поддержка createSeparateDataFiles**: данные читаются/обновляются из `test-data/xxx-data-N.ts`
- ✅ **Рандомизация uniqueFields**: POST/PUT/PATCH запросы используют новые уникальные значения
- ✅ **Новые параметры ReActualizeConfig**: `uniqueFields`, `uniqueFieldsUpperCase`

### v14.8.1
- ✅ **Сохранение настроек при force**: `skipCheckFields*` и `checkStructureOnly*` не затираются при регенерации
- ✅ **Привязка по DB ID**: каждый тест идентифицируется по `// DB ID: db-id-{N}` маркеру

### v14.8.0
- ✅ **checkStructureOnly**: проверка только структуры (поля + типы), без значений
- ✅ **checkStructureOnlyGlobal** / **checkStructureOnlySingle**: глобальный и per-тест флаги
- ✅ **Подходит для пагинационных/поисковых эндпоинтов** — данные меняются, структура нет

### v14.7.1
- ✅ **Детализация 422/400 падений**: endpoint, URL, status, response data, CURL при "ожидалась ошибка, но успешен"

### v14.7.0
- ✅ **Умное сопоставление массивов**: поиск элемента в любом индексе, не по порядку
- ✅ **act.length >= exp.length**: добавились новые записи — тест не падает
- ✅ **Примитивные массивы**: проверка наличия каждого значения без учёта порядка

### v14.6.1
- ✅ **uniqueFields подменяются перед валидацией**: каждый retry получает новые уникальные значения
- ✅ **Исправлены ложные 400**: записи с тем же code/name в БД больше не мешают генерации

### v14.6.0
- ✅ **skipCheckFields**: `skipCheckFieldsGlobal` / `skipCheckFieldsSingle` — пропуск проверки значений
- ✅ **Для динамических полей**: pagination.total, totalAmount, счётчики и т.п.

### v14.5.1
- ✅ **Исправлен TypeError**: `Cannot assign to read only property` - `requestData` теперь через spread
- ✅ **Исправлен comparison**: Переменная объявляется для всех случаев (с и без уникальных полей)
- ✅ **Исправлен formatDifferencesAsBlocks**: Корректный реэкспорт из test-helpers.ts
- ✅ **Улучшено логирование**: Показывает количество 422/400 ошибок при генерации

### v14.5
- ✅ **Дедупликация по body**: Запросы с одинаковыми полями, но разным порядком теперь дедуплицируются
- ✅ **Исправление CURL**: Убрано двойное экранирование, однострочный вывод
- ✅ **Вынос helpers в test-data**: `prepareUniqueFields`, `buildCurlCommand`, `compareWithoutUniqueFields`, `verifyUniqueFields`
- ✅ **Компактные тесты**: Код тестов значительно сокращён за счёт использования helpers

### v14.4
- ✅ **Парные тесты на дубликаты (400)**: Негативный (400) + позитивный (2xx) тесты из собранных ошибок
- ✅ **Точная проверка сообщения**: Негативный тест проверяет ТОЧНОЕ сообщение из реального response
- ✅ **Отдельная папка negative-400**: Тесты генерируются в `./tests/api/negative-400/`

### v14.3
- ✅ **Тесты на валидацию (422)**: Автоматическая генерация тестов для 422 ошибок валидации
- ✅ **Сбор 422 ошибок**: При валидации собираются все 422 ответы с непустым detail
- ✅ **Пропуск "Bad Request"**: Ответы без детализации логируются в отдельный JSON

### v14.2
- ✅ **Уникальные поля для POST**: Параметры `uniqueFields`, `uniqueFieldsUpperCase`, `enableUniqueFieldGeneration`
- ✅ **Умная проверка**: Отдельная проверка уникальных полей (response должен содержать то что отправили)
- ✅ **CAPS поддержка**: Поля вроде `code` автоматически конвертируются в ВЕРХНИЙ РЕГИСТР
- ✅ **Полное покрытие**: Остальные поля проверяются без уникальных (исключаются из обоих объектов)

### v14.1
- ✅ **Реактуализация тестов**: Новый метод `reActualizeHappyPathTests()` для обновления данных
- ✅ **Email уведомления 5xx**: HTML письма при серверных ошибках (500-503)
- ✅ **CURL вывод**: При падении Happy Path теста выводится copyable CURL
- ✅ **Безопасные 405 тесты**: Автоматическое исключение разрешённых методов
- ✅ **Параметр exclude405Methods**: Глобальное исключение методов из 405 тестов
- ✅ **Исправление test-data папки**: Корректная работа с groupByCategory
- ✅ **Логирование ошибок валидации**: 4xx → JSON файл, 5xx → JSON файл + email
- ✅ **Централизация handleApiError**: Вся логика обработки ошибок в `apiTestHelper`
- ✅ **Исправление сравнения массивов**: Игнорирование порядка элементов в массивах

### v14.0
- ✅ **Раздельные методы генерации**: `generateNegativeTests()`, `generatePositiveTests()`, `generatePairwiseTests()`
- ✅ **Поддержка папок**: Можно указать папку с файлами вместо одного файла
- ✅ **Автогруппировка**: Тесты группируются по категориям (orders/, users/)
- ✅ **Правильная интеграция apiTestHelper**: Используется в негативных тестах при падении
- ✅ **Детальный отчет**: "Не удалось сгенерировать" с причинами
- ✅ **Защита тестов**: Теги `@protected` для защиты от обновления
- 🚫 `generateApiTests()` помечен как **DEPRECATED**

### v13.0
- ✅ Happy Path интеграция в `generateApiTests()`
- ✅ Интеллектуальная стратегия повторов (10-15 попыток)
- ✅ Отдельные `testData/*.data.ts` файлы
- ✅ Убран Content-Type (415) тест
- ✅ Умная генерация данных с остановкой на 401/403

### v12.0
- ✅ Валидация данных с обнаружением stale data
- ✅ Дедупликация тестов (signature-based)
- ✅ Обнаружение edge cases (null, пустые массивы)
- ✅ Конфигурируемые правила валидации и дедупликации

### v11.1
- ✅ Динамический импорт utils из NPM пакета
- ✅ Автоматическое определение имени пакета

### v11.0
- API клиент из OpenAPI
- Базовая генерация тестов
- Анализ БД для данных
- Happy Path тесты

## 🆘 Поддержка

**Полная документация:** [README_FULL.md](./README_FULL.md)

**GitHub:** https://github.com/tepmehatop/api-generator

**NPM:** `@your-company/api-codegen`

## 📄 Лицензия

MIT
