# ✅ Обновления: Один README + Динамические конфиги

## Что изменено

### 1. Один README файл вместо множества

**БЫЛО:** 50+ файлов `ordersReadmeApi.md`, `productsReadmeApi.md`, etc.

**СТАЛО:** Один файл `API_README.md` в `dist/` с разделами для каждого тега!

### 2. Динамическое обновление конфигов в Jenkins

Добавлен параметр `PREV_COMPARE_VERSION` который автоматически добавляет `prevPackage` в конфиги перед генерацией.

---

## 1. Один README файл

### Структура после генерации:

```
dist/orders/
├── API_README.md          ← Один файл со всеми разделами! ✨
├── orders.api.ts
├── products.api.ts
├── index.ts
└── ...
```

### Формат API_README.md:

```markdown
# API Documentation

---

## Оглавление

- [Orders](#orders)
- [Products](#products)
- [Finance](#finance)

---

## Orders

### Endpoints

| Endpoint | HTTP Method | Function Name | Request DTO | Response DTO | File Name |
|----------|-------------|---------------|-------------|--------------|-----------|
| `/api/v1/orders` | GET | `getOrders` | `-` | `OrderListResponse` | orders.api.ts |
| `/api/v1/orders` | POST | `createOrder` | `CreateOrderRequest` | `OrderResponse` | orders.api.ts |

### Использование

```typescript
import { getOrders, createOrder } from '@your-company/api-codegen/orders';

const response = await getOrders();
```

### Типы данных

```typescript
import type {
  CreateOrderRequest,
  OrderResponse
} from '@your-company/api-codegen/orders/orders.api';
```

---

## Products

### Endpoints

...

---

## Finance

### Endpoints

...

---

*Сгенерировано автоматически*
```

### Преимущества:

- ✅ **Один файл** вместо 50+
- ✅ **В dist/** - попадает в NPM пакет
- ✅ **Разделы** для каждого тега
- ✅ **Оглавление** с якорями
- ✅ **Легко найти** нужный раздел

---

## 2. Динамические конфиги в Jenkins

### Параметр PREV_COMPARE_VERSION

В Jenkins добавлен параметр который контролирует сравнение версий:

```groovy
parameters {
    string(
        name: 'PREV_COMPARE_VERSION', 
        defaultValue: 'FALSE', 
        description: 'Версия для сравнения (1.55.0) или FALSE'
    )
}
```

### Как работает:

#### Вариант 1: БЕЗ сравнения

```
Параметр: PREV_COMPARE_VERSION = FALSE
```

**Конфиг (configs/orders_config.json):**
```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders"
}
```

**Результат:** Генерация без сравнения

#### Вариант 2: СО сравнением

```
Параметр: PREV_COMPARE_VERSION = 1.55.0
```

**Скрипт автоматически обновляет конфиг:**
```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.0.tgz"
}
```

**Результат:** Генерация + сравнение + `ordersCompareReadme.md` в корне

### Использование в Jenkins:

#### 1. С Node.js скриптом (рекомендуется):

Скачайте файл: **[update-config.js](update-config.js)**

Положите в `scripts/update-config.js`

**Jenkinsfile:**
```groovy
stage('Обновление конфигов') {
    when {
        expression { 
            params.PREV_COMPARE_VERSION != 'FALSE' && 
            params.PREV_COMPARE_VERSION != '' 
        }
    }
    steps {
        sh """
            node scripts/update-config.js configs/orders_config.json ${params.PREV_COMPARE_VERSION}
            node scripts/update-config.js configs/products_config.json ${params.PREV_COMPARE_VERSION}
            node scripts/update-config.js configs/finance_config.json ${params.PREV_COMPARE_VERSION}
        """
    }
}
```

#### 2. С jq (если доступен):

```groovy
stage('Обновление конфигов') {
    steps {
        sh """
            PREV_URL="https://registry/api-codegen-${params.PREV_COMPARE_VERSION}.tgz"
            jq --arg url "\$PREV_URL" '. + {prevPackage: \$url}' configs/orders_config.json > tmp.json
            mv tmp.json configs/orders_config.json
        """
    }
}
```

#### 3. С Groovy функцией:

```groovy
def updateConfigWithPrevPackage(String configPath, String prevVersion) {
    def configText = readFile(configPath)
    def config = readJSON text: configText
    
    def prevPackageUrl = "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-${prevVersion}.tgz"
    config.prevPackage = prevPackageUrl
    
    writeJSON file: configPath, json: config, pretty: 4
}

stage('Обновление') {
    steps {
        script {
            updateConfigWithPrevPackage('configs/orders_config.json', params.PREV_COMPARE_VERSION)
        }
    }
}
```

### Примеры Jenkinsfile:

Доступны 3 варианта:

1. **[Jenkinsfile](Jenkinsfile)** - с Groovy функциями (полный вариант)
2. **[Jenkinsfile-with-jq](Jenkinsfile-with-jq)** - с jq и bash
3. **[Jenkinsfile-simple](Jenkinsfile-simple)** - с Node.js скриптом (рекомендуется)

---

## Workflow

### Релиз 1.55 (первый раз):

```
Jenkins параметры:
  PREV_COMPARE_VERSION = FALSE

Результат:
  - dist/orders/API_README.md ✅
  - dist/products/API_README.md ✅
  - Нет файлов сравнения
  - npm publish → api-codegen-1.55.0.tgz
```

### Релиз 1.56 (со сравнением):

```
Jenkins параметры:
  PREV_COMPARE_VERSION = 1.55.0

Что происходит:
  1. Скрипт обновляет все конфиги:
     "prevPackage": "https://...api-codegen-1.55.0.tgz"
  
  2. Генерация запускается:
     - dist/orders/API_README.md ✅
     - ordersCompareReadme.md ✅ (в корне)
  
  3. CompareReadme архивируются как артефакты
  
  4. npm publish → api-codegen-1.56.0.tgz
```

---

## Структура финального пакета

```
@your-company/api-codegen/
├── dist/
│   ├── orders/
│   │   ├── API_README.md       ← Один файл со всеми разделами!
│   │   ├── orders.api.ts
│   │   ├── orders.api.d.ts
│   │   ├── products.api.ts
│   │   └── index.ts
│   │
│   ├── products/
│   │   ├── API_README.md
│   │   └── ...
│   │
│   └── finance/
│       ├── API_README.md
│       └── ...
│
├── ordersCompareReadme.md     ← В корне (не в пакете)
├── productsCompareReadme.md
├── financeCompareReadme.md
│
└── package.json
```

**В NPM пакете:**
- ✅ `dist/orders/API_README.md` - документация API
- ❌ `ordersCompareReadme.md` - НЕ попадает (в корне)

**Для анализа изменений:**
- Отчёты сравнения остаются в корне
- Архивируются как артефакты Jenkins
- Не попадают в NPM пакет

---

## Использование API_README.md

### После установки пакета:

```bash
npm install @your-company/api-codegen
```

### Читаем документацию:

```bash
cat node_modules/@your-company/api-codegen/dist/orders/API_README.md
```

Или откройте в IDE - один файл со всеми разделами!

### В VSCode:

1. Установите пакет
2. Откройте `node_modules/@your-company/api-codegen/dist/orders/API_README.md`
3. Нажмите Preview (Ctrl+Shift+V)
4. Используйте оглавление для навигации по разделам

---

## Переменные окружения для скрипта

В `update-config.js` можно настроить через env:

```groovy
environment {
    NPM_REGISTRY_URL = 'https://customRegistry.niu.ru/repo/npm/api-codegen'
    PACKAGE_NAME = 'api-codegen'
}
```

Или напрямую в скрипте:

```bash
NPM_REGISTRY_URL="https://my-registry.com" \
PACKAGE_NAME="my-package" \
node scripts/update-config.js configs/orders_config.json 1.55.0
```

---

## ✅ Готово!

Теперь:
- ✅ **Один README** вместо множества
- ✅ **В dist/** - попадает в NPM пакет
- ✅ **Динамические конфиги** в Jenkins
- ✅ **Параметр версии** - включает/выключает сравнение
- ✅ **3 варианта** Jenkinsfile на выбор

**Чисто, просто и автоматизировано!** 🎉✨
