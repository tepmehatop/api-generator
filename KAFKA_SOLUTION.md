# ✅ Kafka решение для API Collector

## Архитектура

```
UI Автотесты (Playwright)
    ↓ page.on('response')
setupApiCollector()
    ↓ kafkaSendFunction
Kafka Topic (api-collector-topic)
    ↓ Consumer
Node.js Express Сервис
    ↓ INSERT
PostgreSQL (qa.api_requests)
```

## Преимущества Kafka

- ✅ **Асинхронная отправка** - не блокирует тесты
- ✅ **Нет лимитов размера** - любые body
- ✅ **Высокая пропускная способность** - 1000+ сообщений/сек
- ✅ **Надёжность** - сообщения не теряются
- ✅ **Масштабируемость** - легко добавить consumers

---

## Шаг 1: Создайте Kafka топик

```bash
# Создайте топик в Kafka
kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic api-collector-topic \
  --partitions 3 \
  --replication-factor 1

# Проверьте
kafka-topics --list --bootstrap-server localhost:9092
```

---

## Шаг 2: Настройте автотесты

### Вариант A: Если у вас уже есть kafkaSendFunction

```typescript
// test-helpers/kafka.ts
import { kafkaSendFunction } from '../existing-kafka-helper';

export { kafkaSendFunction };

// tests/cart.spec.ts
import { test } from '@playwright/test';
import { setupApiCollector } from '@your-company/api-codegen';
import { kafkaSendFunction } from '../test-helpers/kafka';

test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  
  setupApiCollector(page, testInfo, {
    useKafka: true,                              // ✅ Включаем Kafka
    kafkaTopic: 'api-collector-topic',
    kafkaSendFunction: kafkaSendFunction,        // ✅ Ваша функция
    urlFilters: ['/api/v1/'],
    batchSize: 20,                               // Можно больше с Kafka
    sendInterval: 5000,
    verbose: true
  });
});

// afterEach НЕ НУЖЕН!
```

### Вариант B: Если нужно создать kafkaSendFunction

```typescript
// test-helpers/kafka.ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'playwright-tests',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();

let isConnected = false;

export async function kafkaSendFunction(topic: string, message: any): Promise<void> {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
  
  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify(message)
      }
    ]
  });
}

// Cleanup при завершении тестов
process.on('beforeExit', async () => {
  if (isConnected) {
    await producer.disconnect();
  }
});
```

---

## Шаг 3: Добавьте Consumer в Node.js сервис

### Если у вас уже есть Kafka подключение:

```javascript
// Ваш существующий микросервис
const postgres = require('postgres');
const { Kafka } = require('kafkajs');

const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// Ваше существующее Kafka подключение
const kafka = new Kafka({
  clientId: 'your-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'api-collector-group' });

// Добавляем обработку топика api-collector
await consumer.connect();

await consumer.subscribe({ 
  topic: 'api-collector-topic', 
  fromBeginning: false 
});

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    try {
      const data = JSON.parse(message.value.toString());
      
      // Сохраняем в БД
      await sql`
        INSERT INTO qa.api_requests (
          endpoint, method, request_body, response_body,
          response_status, test_name, test_file, timestamp, created_at
        ) VALUES (
          ${data.data.endpoint},
          ${data.data.method},
          ${JSON.stringify(data.data.requestBody)},
          ${JSON.stringify(data.data.responseBody)},
          ${data.data.responseStatus},
          ${data.testName},
          ${data.testFile},
          ${data.data.timestamp},
          NOW()
        )
      `;
      
      console.log(`✓ Saved: ${data.data.method} ${data.data.endpoint}`);
      
    } catch (error) {
      console.error('Kafka consumer error:', error);
    }
  }
});

console.log('✓ Kafka Consumer запущен');
```

### Если Kafka подключения нет:

```bash
# Установите зависимости
npm install kafkajs
```

Используйте файл `kafka-consumer.js` из приложения.

---

## Шаг 4: Запустите

### 1. Запустите Kafka (если локально):

```bash
# Zookeeper
zookeeper-server-start.sh config/zookeeper.properties

# Kafka
kafka-server-start.sh config/server.properties
```

### 2. Запустите Node.js сервис:

```bash
node your-service.js

# Логи:
✓ Подключение к БД настроено
✓ Kafka Consumer запущен
[Kafka Consumer] Подписываюсь на топик: api-collector-topic
[Kafka Consumer] ✓ Consumer запущен и слушает топик api-collector-topic
```

### 3. Запустите автотесты:

```bash
npm test
```

### Логи в автотестах:

```
[API Collector] 🔍 Начинаю сбор для: проверка корзины
[API Collector] ⚙️  Режим: Kafka
[API Collector] ⚙️  Batch: 20 запросов, интервал: 5000ms
[API Collector] ⚙️  Kafka топик: api-collector-topic

[API Collector] ✓ GET /api/v1/cart -> 200 (buffer: 1, ~2.5KB)
[API Collector] ✓ POST /api/v1/cart/add -> 201 (buffer: 2, ~5.1KB)
[API Collector] ✓ GET /api/v1/cart -> 200 (buffer: 3, ~7.8KB)

[API Collector] 📤 Kafka: отправляю 3 записей, ~7.8KB в топик api-collector-topic
[API Collector] ✅ Kafka: отправлено 3 из 3 записей
```

### Логи в сервисе:

```
[Kafka Consumer] Получено сообщение из топика api-collector-topic
[Kafka Consumer] ✓ Сохранено: GET /api/v1/cart
[Kafka Consumer] Получено сообщение из топика api-collector-topic
[Kafka Consumer] ✓ Сохранено: POST /api/v1/cart/add
```

---

## Конфигурация

### Базовая (для Kafka):

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  kafkaTopic: 'api-collector-topic',
  kafkaSendFunction: yourKafkaFunction,
  verbose: true
});
```

### Полная:

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  kafkaTopic: 'api-collector-topic',
  kafkaSendFunction: yourKafkaFunction,
  urlFilters: ['/api/v1/', '/api/v2/'],
  excludeUrls: ['/health', '/metrics'],
  batchSize: 50,        // С Kafka можно больше!
  sendInterval: 10000,  // Реже (Kafka быстрый)
  verbose: true
});
```

### Переменные окружения:

```bash
# .env
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC=api-collector-topic
```

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  kafkaTopic: process.env.KAFKA_TOPIC,
  kafkaSendFunction: yourKafkaFunction
});
```

---

## Мониторинг Kafka

### Проверка топика:

```bash
# Список сообщений
kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic api-collector-topic \
  --from-beginning

# Статистика
kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group api-collector-group \
  --describe
```

### Метрики:

```bash
# Количество сообщений
kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic api-collector-topic

# Lag consumer'а
kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group api-collector-group \
  --describe
```

---

## Troubleshooting

### Сообщения не отправляются

**Проверка 1:** Kafka доступна?

```bash
kafka-topics --list --bootstrap-server localhost:9092
```

**Проверка 2:** kafkaSendFunction предоставлена?

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  kafkaSendFunction: yourFunction,  // Проверьте!
  verbose: true
});
```

**Проверка 3:** Логи?

```
[API Collector] ⚙️  Режим: Kafka  ← Должно быть Kafka, не HTTP
```

### Consumer не получает сообщения

**Проверка 1:** Consumer запущен?

```bash
# В логах сервиса:
[Kafka Consumer] ✓ Consumer запущен и слушает топик api-collector-topic
```

**Проверка 2:** Правильный топик?

```javascript
const TOPIC = 'api-collector-topic';  // Тот же что в автотестах
```

**Проверка 3:** Группа consumer'а?

```javascript
const consumer = kafka.consumer({ 
  groupId: 'api-collector-group'  // Уникальная группа
});
```

### Данные не попадают в БД

**Проверка 1:** Таблица создана?

```sql
SELECT * FROM qa.api_requests LIMIT 1;
```

**Проверка 2:** Ошибки в логах?

```
[Kafka Consumer] Ошибка сохранения в БД: ...
```

---

## Производительность

### Kafka vs HTTP

| Параметр | HTTP | Kafka |
|----------|------|-------|
| **Throughput** | ~50 req/sec | ~1000 msg/sec |
| **Latency** | ~50ms | ~5ms |
| **Блокирует тесты** | Да | Нет |
| **Размер данных** | Ограничен | Без ограничений |
| **Надёжность** | ⚠️ | ✅ |

### Настройки производительности

**Для большого количества тестов:**

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  batchSize: 100,      // Большой batch
  sendInterval: 30000  // 30 секунд
});
```

**Для быстрой доставки:**

```typescript
setupApiCollector(page, testInfo, {
  useKafka: true,
  batchSize: 10,      // Маленький batch
  sendInterval: 1000  // 1 секунда
});
```

---

## Пример полной интеграции

```typescript
// test-helpers/api-collector.ts
import { Kafka } from 'kafkajs';
import { createCollector } from '@your-company/api-codegen';

const kafka = new Kafka({
  clientId: 'playwright-tests',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();
let connected = false;

async function kafkaSendFunction(topic: string, message: any) {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
  
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
}

export const apiCollector = createCollector({
  useKafka: true,
  kafkaTopic: 'api-collector-topic',
  kafkaSendFunction,
  urlFilters: ['/api/v1/'],
  batchSize: 50,
  sendInterval: 5000,
  verbose: process.env.VERBOSE === 'true'
});

// tests/example.spec.ts
import { test } from '@playwright/test';
import { apiCollector } from '../test-helpers/api-collector';

test.beforeEach(async ({ page }, testInfo) => {
  await getReportData(page, testInfo);
  apiCollector.setup(page, testInfo);
});

test('пример', async ({ page }) => {
  // Ваш тест
  // Данные автоматически отправляются в Kafka!
});
```

---

## ✅ Итого

- ✅ **Kafka** - асинхронно, быстро, надёжно
- ✅ **Без лимитов** - любые размеры body
- ✅ **Не блокирует** - тесты работают быстро
- ✅ **Масштабируемость** - легко добавить consumers
- ✅ **Готовое решение** - используйте существующее Kafka подключение

**Production ready!** 🎉✨
