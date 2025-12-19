# ✅ Автоматическое сравнение версий API

## Что это

Система автоматического сравнения изменений между версиями API. Показывает:
- Новые endpoints и методы
- Удалённые endpoints и методы  
- Новые DTO
- Удалённые DTO
- Изменённые поля в DTO

## 🚀 Использование

### Параметр `prevPackage`

Добавьте в конфиг URL к предыдущей версии пакета:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.tgz"
}
```

### Jenkins Workflow:

```groovy
stage('Generate API v1.56') {
    steps {
        sh 'npm install'
        sh 'npm run build'
        
        // Генерируем с сравнением
        sh '''
cat > orders.config.json << EOF
{
  "specUrl": "${ORDERS_API_URL}/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.tgz"
}
EOF
        '''
        
        sh 'npm run generate -- --config=orders.config.json'
        // Создаются:
        // - dist/orders/*.ts (новый API код)
        // - ordersReadmeApi.md (документация)
        // - ordersCompareReadme.md (сравнение версий!) ✨
        
        sh 'npm publish'
    }
}
```

## 📊 Формат отчёта

### Пример: ordersCompareReadme.md

```markdown
# API Comparison Report: orders

Сравнение изменений API между версиями

---

## ✅ Новые Endpoints

| HTTP Method | Endpoint | Operation ID |
|-------------|----------|--------------|
| POST | `/api/v1/orders/{id}/cancel` | `cancelOrder` |
| GET | `/api/v1/orders/{id}/history` | `getOrderHistory` |

## ❌ Удалённые Endpoints

| HTTP Method | Endpoint | Operation ID |
|-------------|----------|--------------|
| GET | `/api/v1/orders/legacy` | `getLegacyOrders` |

## ✅ Новые Методы

| Method Name | Endpoint | HTTP Method |
|-------------|----------|-------------|
| `cancelOrder` | `/api/v1/orders/{id}/cancel` | POST |
| `getOrderHistory` | `/api/v1/orders/{id}/history` | GET |

## ❌ Удалённые Методы

| Method Name | Endpoint | HTTP Method |
|-------------|----------|-------------|
| `getLegacyOrders` | `/api/v1/orders/legacy` | GET |

## ✅ Новые DTO

### `CancelOrderRequest`

| Field | Type | Required |
|-------|------|----------|
| `orderId` | `number` | ✓ |
| `reason` | `string` | ✓ |
| `refundAmount` | `number` | ✗ |

### `OrderHistoryResponse`

| Field | Type | Required |
|-------|------|----------|
| `events` | `OrderEvent[]` | ✓ |
| `totalEvents` | `number` | ✓ |

## ❌ Удалённые DTO

### `LegacyOrderResponse`

| Field | Type | Required |
|-------|------|----------|
| `oldId` | `string` | ✓ |
| `legacyStatus` | `string` | ✓ |

## 🔄 Изменённые DTO

### `OrderResponse`

#### ✅ Добавленные поля:

| Field | Type | Required |
|-------|------|----------|
| `cancellationReason` | `string` | ✗ |
| `lastModified` | `Date` | ✓ |

#### ❌ Удалённые поля:

| Field | Type | Required |
|-------|------|----------|
| `oldField` | `string` | ✗ |

#### 🔄 Изменённые поля:

| Field | Old Type | New Type | Was Required | Now Required |
|-------|----------|----------|--------------|--------------|
| `status` | `string` | `OrderStatus` | ✓ | ✓ |
| `amount` | `number` | `string` | ✓ | ✗ |

---

*Сгенерировано автоматически*
```

## 🔍 Workflow

### 1. Генерация без сравнения (первый раз):

```bash
$ npm run generate -- --config=orders.config.json

✨ Генерация завершена!
📁 Создано:
  - dist/orders/*.ts
  - ordersReadmeApi.md
```

### 2. Генерация со сравнением (следующие разы):

```bash
$ npm run generate -- --config=orders-with-compare.config.json

✨ Генерация завершена!

🔍 Начинаю сравнение с предыдущей версией...
📦 Скачиваю предыдущую версию: https://...api-codegen-1.55.tgz
✓ Пакет скачан
✓ Пакет распакован
📊 Извлекаю информацию из старой версии...
📊 Извлекаю информацию из новой версии...
🔄 Сравниваю версии...
✅ Отчёт о сравнении сохранён: ordersCompareReadme.md
✓ Временные файлы очищены

📁 Создано:
  - dist/orders/*.ts
  - ordersReadmeApi.md
  - ordersCompareReadme.md  ← Отчёт о сравнении!
```

## 📁 Структура после генерации

```
api-codegen/
├── ordersReadmeApi.md          ← Документация API
├── ordersCompareReadme.md      ← Сравнение версий! ✨
├── productsReadmeApi.md
├── productsCompareReadme.md    ← Сравнение для products
└── dist/
    ├── orders/
    └── products/
```

## 💡 Использование отчёта

### Сценарий 1: Breaking Changes

**Вопрос:** Есть ли breaking changes в новой версии?

**Ответ:** Открываю `ordersCompareReadme.md` → смотрю секции:
- "Удалённые Endpoints" - есть?
- "Удалённые Методы" - есть?
- "Удалённые поля" в DTO - есть?
- "Изменённые поля" - изменились типы или required?

### Сценарий 2: Что нового

**Вопрос:** Какие новые методы появились?

**Ответ:** Открываю `ordersCompareReadme.md` → секция "Новые Методы"

### Сценарий 3: Миграция автотестов

**Вопрос:** Нужно ли обновлять автотесты?

**Ответ:** Открываю `ordersCompareReadme.md`:
- Удалённые методы → нужно удалить тесты
- Новые методы → нужно добавить тесты
- Изменённые DTO → нужно обновить моки

## 🎯 Jenkins - полный workflow

### Версия 1.55 (первый релиз):

```groovy
stage('Generate API v1.55') {
    steps {
        sh 'npm run build'
        
        sh '''
cat > orders.config.json << EOF
{
  "specUrl": "${ORDERS_API_URL}/openapi.json",
  "outputDir": "./dist/orders"
}
EOF
        '''
        
        sh 'npm run generate -- --config=orders.config.json'
        
        // Обновляем версию
        sh 'npm version 1.55.0'
        sh 'npm publish'
        
        // Создаётся: api-codegen-1.55.0.tgz
    }
}
```

### Версия 1.56 (с сравнением):

```groovy
stage('Generate API v1.56') {
    steps {
        sh 'npm run build'
        
        sh '''
cat > orders.config.json << EOF
{
  "specUrl": "${ORDERS_API_URL}/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.0.tgz"
}
EOF
        '''
        
        sh 'npm run generate -- --config=orders.config.json'
        // Создаются:
        // - ordersCompareReadme.md (сравнение 1.55 → 1.56)
        
        // Публикуем отчёт как артефакт
        archiveArtifacts artifacts: '*CompareReadme.md'
        
        // Обновляем версию
        sh 'npm version 1.56.0'
        sh 'npm publish'
    }
}
```

### Автоматическое определение предыдущей версии:

```groovy
stage('Generate with Compare') {
    steps {
        script {
            // Получаем текущую версию из package.json
            def currentVersion = sh(
                script: 'node -p "require(\'./package.json\').version"',
                returnStdout: true
            ).trim()
            
            // Парсим версию (1.56.0 → 1.55.0)
            def parts = currentVersion.split('\\.')
            def prevMinor = (parts[1] as Integer) - 1
            def prevVersion = "${parts[0]}.${prevMinor}.0"
            
            def prevPackageUrl = "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-${prevVersion}.tgz"
            
            sh """
cat > orders.config.json << EOF
{
  "specUrl": "${ORDERS_API_URL}/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "${prevPackageUrl}"
}
EOF
            """
        }
        
        sh 'npm run generate -- --config=orders.config.json'
    }
}
```

## ⚠️ Важно

### 1. Если предыдущей версии нет:

```json
{
  "specUrl": "...",
  "outputDir": "./dist/orders"
  // НЕ указываем prevPackage
}
```

Сравнение не будет запущено - это нормально!

### 2. Если URL недоступен:

```
❌ Ошибка при сравнении версий: ...
✨ Генерация завершена! (без сравнения)
```

Генерация продолжится без сравнения.

### 3. Формат URL:

Поддерживаются:
- ✅ `.tgz` файлы: `https://registry.com/package.tgz`
- ✅ NPM registry: `https://registry.npmjs.org/package/-/package-1.0.0.tgz`
- ✅ Приватные registry: `https://custom.registry.com/repo/npm/package.tgz`

## 📊 Что сравнивается

### 1. Endpoints
- Путь (path)
- HTTP метод (GET, POST, etc.)
- Operation ID

### 2. Методы
- Имя функции
- Endpoint который вызывает
- HTTP метод

### 3. DTO
- Имя DTO
- Все поля
- Типы полей
- Required/Optional

### 4. Изменения в полях
- Добавленные поля
- Удалённые поля
- Изменение типа (string → number)
- Изменение required (✓ → ✗)

## 🎨 Кастомизация отчёта

Если нужно изменить формат отчёта, отредактируйте метод `generateComparisonReport` в `src/comparator.ts`:

```typescript
generateComparisonReport(result: ComparisonResult): string {
  const lines: string[] = [];
  
  // Добавьте свои секции
  lines.push('# Ваш кастомный заголовок');
  
  // Например, статистика
  lines.push(`Всего изменений: ${
    result.newEndpoints.length + 
    result.removedEndpoints.length
  }`);
  
  return lines.join('\n');
}
```

## ✅ Готово!

Теперь:
- ✅ **Автоматическое сравнение** версий API
- ✅ **Детальный отчёт** обо всех изменениях
- ✅ **Breaking changes** видны сразу
- ✅ **История изменений** для каждого релиза
- ✅ **Jenkins интеграция** - автоматически

**Больше не нужно вручную искать различия между версиями!** 🔍✨
