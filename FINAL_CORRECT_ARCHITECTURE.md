# ✅ Готово! Правильная архитектура - ВСЁ В ОДНОМ ПАКЕТЕ

## Что было исправлено

### ✅ Правильная структура пакета

**Пакет содержит ВСЁ:**
1. `/dist` - скомпилированный генератор (generateApi, generateApiTests, analyzeAndGenerateTestData)
2. `/api` - сгенерированные API методы и типы (orders.api.ts, orders.types.ts)
3. `/bin` - CLI для запуска из командной строки

### ✅ CLI для Jenkins

Теперь можно вызывать через командную строку:

```bash
npx api-codegen generate
npx api-codegen generate --config=my-config.json
```

## 🎯 Правильный Workflow

### ЭТАП 1: DevOps (Jenkins) - Генерация и публикация

**Репозиторий:** `api-codegen` (этот проект)

**Jenkinsfile:**
```groovy
pipeline {
    agent any
    
    environment {
        NPM_REGISTRY = 'https://your-internal-npm-registry.com/'
        NPM_TOKEN = credentials('npm-token')
        OPENAPI_URL = 'https://api.example.com/openapi.json'
    }
    
    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/your-company/api-codegen.git'
            }
        }
        
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Generate API') {
            steps {
                // Создаём конфиг
                sh '''
cat > codegen.config.json << EOF
{
  "specUrl": "${OPENAPI_URL}",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL"
}
EOF
                '''
                
                // Генерируем API - создаётся /api/*.ts
                sh 'npx api-codegen generate'
                
                // Проверяем что файлы созданы
                sh 'ls -la ./api/'
            }
        }
        
        stage('Build') {
            steps {
                // Компилируем TypeScript → создаётся /dist
                sh 'npm run build'
            }
        }
        
        stage('Publish') {
            steps {
                sh '''
                    echo "//your-npm-registry.com/:_authToken=${NPM_TOKEN}" > .npmrc
                    npm publish --registry=${NPM_REGISTRY}
                '''
            }
        }
    }
    
    post {
        success {
            echo "✅ Package @your-company/api-codegen published!"
            echo "Contains:"
            echo "  - /dist (generators)"
            echo "  - /api (generated API methods)"
            echo "  - /bin (CLI)"
        }
        always {
            sh 'rm -f .npmrc'
        }
    }
}
```

**Что публикуется:**
```
@your-company/api-codegen/
├── dist/                  ← Генераторы
│   ├── index.js
│   ├── index.d.ts
│   ├── generator.js
│   ├── test-generator.js
│   └── database-analyzer.js
│
├── api/                   ← Сгенерированные API методы!
│   ├── orders.api.ts
│   ├── orders.types.ts
│   ├── products.api.ts
│   └── base.types.ts
│
├── bin/
│   └── cli.js            ← CLI команда
│
└── package.json
```

### ЭТАП 2: QA (Автотесты) - Использование

**package.json в тестах:**
```json
{
  "name": "my-tests",
  "dependencies": {
    "@your-company/api-codegen": "^1.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "postgres": "^3.4.0"
  }
}
```

**Использование API методов в тестах:**
```typescript
// tests/orders.test.ts
import test, { expect } from '@playwright/test';

// ✅ Импортируем из пакета - путь /api внутри пакета!
import { createOrder, getOrders } from '@your-company/api-codegen/api/orders.api';
import type { CreateOrderRequest } from '@your-company/api-codegen/api/orders.types';

test.describe('Orders API', () => {
  test('create order', async () => {
    const request: CreateOrderRequest = {
      productId: 100,
      quantity: 5,
      orderType: 'express'
    };
    
    const response = await createOrder(request);
    expect(response.status).toBe(201);
    expect(response.data.id).toBeDefined();
  });
  
  test('get orders', async () => {
    const response = await getOrders();
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });
});
```

**Генерация тестов:**
```typescript
// scripts/generate-tests.ts
import { generateApiTests } from '@your-company/api-codegen';

// Генерируем тесты на основе API из пакета
await generateApiTests({
  apiFilePath: './node_modules/@your-company/api-codegen/api/orders.api.ts',
  outputDir: './tests/api/orders',
  generatePositiveTests: true,
  generatePairwiseTests: true
});
```

**Анализ базы данных:**
```typescript
// scripts/analyze-db.ts
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const testDbConnect = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  samplesCount: 15
}, testDbConnect);
```

## 📋 CLI Использование

### В Jenkins

```bash
# Создать конфиг
cat > codegen.config.json << EOF
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api"
}
EOF

# Генерировать
npx api-codegen generate

# Проверить результат
ls -la ./api/
```

### Локально для разработки

```bash
# С дефолтным конфигом
npx api-codegen generate

# С кастомным конфигом
npx api-codegen generate --config=./configs/dev.json

# Справка
npx api-codegen --help
```

### Структура конфига

**codegen.config.json:**
```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL",
  "authTokenVar": "process.env.AUTH_TOKEN",
  "generateErrorHandlers": true,
  "generateTypes": true,
  "transliterateRussian": true,
  "useClasses": false
}
```

## 🔍 Проверка после установки

### 1. Установите пакет в тестовом проекте

```bash
mkdir test-project
cd test-project
npm init -y
npm install @your-company/api-codegen
```

### 2. Проверьте структуру

```bash
ls node_modules/@your-company/api-codegen/

# Должно быть:
# dist/         ← Генераторы
# api/          ← API методы (если генерировались)
# bin/          ← CLI
# package.json
# README.md
```

### 3. Проверьте импорты генераторов

```javascript
// test-generators.js
const { generateApi, generateApiTests, analyzeAndGenerateTestData } = require('@your-company/api-codegen');

console.log('generateApi:', typeof generateApi);  // function
console.log('generateApiTests:', typeof generateApiTests);  // function
console.log('analyzeAndGenerateTestData:', typeof analyzeAndGenerateTestData);  // function
```

### 4. Проверьте импорты API (если api/ существует)

```typescript
// test-api.ts
import { createOrder } from '@your-company/api-codegen/api/orders.api';
import type { CreateOrderRequest } from '@your-company/api-codegen/api/orders.types';

console.log('createOrder:', typeof createOrder);  // function
```

### 5. Проверьте CLI

```bash
npx api-codegen --help
# Должна показаться справка
```

## 📊 Полный Lifecycle

```
┌─────────────────────────────────────────────────────┐
│ 1. РАЗРАБОТКА ГЕНЕРАТОРА                            │
├─────────────────────────────────────────────────────┤
│ - Разрабатываете функции в /src                     │
│ - Коммитите в git                                   │
│ - npm version patch/minor/major                     │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 2. JENKINS - ГЕНЕРАЦИЯ API                          │
├─────────────────────────────────────────────────────┤
│ git clone api-codegen                               │
│ npm install                                         │
│ npx api-codegen generate  → создаёт /api/*.ts      │
│ npm run build             → создаёт /dist/*.js     │
│ npm publish               → публикует ВСЁ          │
│                                                      │
│ Пакет содержит:                                     │
│ ├── /dist  (генераторы)                            │
│ ├── /api   (API методы) ← ВАЖНО!                   │
│ └── /bin   (CLI)                                    │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 3. QA - ИСПОЛЬЗОВАНИЕ В ТЕСТАХ                      │
├─────────────────────────────────────────────────────┤
│ npm install @your-company/api-codegen               │
│                                                      │
│ Импорты:                                            │
│ - import { createOrder } from                       │
│     '@your-company/api-codegen/api/orders.api'      │
│                                                      │
│ - import { generateApiTests } from                  │
│     '@your-company/api-codegen'                     │
│                                                      │
│ - import { analyzeAndGenerateTestData } from        │
│     '@your-company/api-codegen'                     │
└─────────────────────────────────────────────────────┘
```

## ⚠️ Важные моменты

### 1. ✅ Папка /api попадает в пакет

`.npmignore` настроен так:
```
src/      ← Исключаем исходники генератора
!api/     ← НО включаем сгенерированные API файлы!
```

### 2. ✅ TypeScript файлы в /api остаются

Файлы `.ts` в `/api` **НЕ компилируются** и попадают в пакет как есть:
- `api/orders.api.ts` ✅
- `api/orders.types.ts` ✅

Это позволяет импортировать типы и методы напрямую.

### 3. ✅ CLI работает через npx

После установки пакета можно вызвать:
```bash
npx api-codegen generate
```

### 4. ✅ Всё в одном пакете

Не нужно публиковать 2 пакета:
- ❌ `@your-company/api-codegen` (генератор)
- ❌ `@your-company/api-client` (методы)

Один пакет содержит ВСЁ:
- ✅ `@your-company/api-codegen` (генератор + методы + CLI)

## 📦 Перед публикацией

### 1. Обновите имя

`package.json`:
```json
{
  "name": "@your-company/api-codegen",
  "publishConfig": {
    "registry": "https://your-internal-npm-registry.com/"
  }
}
```

### 2. Проверьте сборку

```bash
npm install
npm run build
npm pack --dry-run
```

Убедитесь что видите:
- ✅ `dist/` файлы
- ✅ `api/` файлы (или .gitkeep если не генерировали)
- ✅ `bin/cli.js`

### 3. Тестовая публикация

```bash
# Создайте тестовый tarball
npm pack

# Установите локально в другой проект
cd ../test-project
npm install ../api-codegen/your-company-api-codegen-1.0.0.tgz

# Проверьте импорты
node -e "console.log(require('@your-company/api-codegen'))"
```

## 🚀 Публикация

```bash
# Установите версию
npm version patch  # или minor/major

# Опубликуйте
npm publish --registry=https://your-internal-npm-registry.com/
```

## ✅ Готово!

Теперь архитектура правильная:
- ✅ Всё в одном пакете
- ✅ CLI для Jenkins
- ✅ Конфиг через JSON файл
- ✅ /api попадает в пакет
- ✅ Можно импортировать методы и типы
- ✅ Можно использовать генераторы

🎉 **Готово к публикации!**
