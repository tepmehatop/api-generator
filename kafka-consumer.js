/**
 * Kafka Consumer для сбора API данных из топика и сохранения в БД
 * 
 * Добавьте этот код в ваш существующий микросервис на Node.js + Express
 * 
 * Предполагается что у вас уже есть:
 * - Подключение к Kafka
 * - Подключение к PostgreSQL через библиотеку 'postgres'
 */

/**
 * Инициализация Kafka Consumer
 * 
 * Добавьте этот код в ваш существующий файл где настроен Kafka
 */
async function initializeApiCollectorConsumer(kafkaConsumer, sql) {
  const TOPIC = process.env.API_COLLECTOR_TOPIC || 'api-collector-topic';
  
  console.log(`[Kafka Consumer] Подписываюсь на топик: ${TOPIC}`);
  
  // Подписываемся на топик (используйте ваш существующий метод подписки)
  await kafkaConsumer.subscribe({ topic: TOPIC, fromBeginning: false });
  
  // Обрабатываем сообщения
  await kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = message.value.toString();
        const data = JSON.parse(value);
        
        console.log(`[Kafka Consumer] Получено сообщение из топика ${topic}`);
        
        // Сохраняем в БД
        await saveApiDataFromKafka(data, sql);
        
      } catch (error) {
        console.error('[Kafka Consumer] Ошибка обработки сообщения:', error);
      }
    },
  });
  
  console.log(`[Kafka Consumer] ✓ Consumer запущен и слушает топик ${TOPIC}`);
}

/**
 * Сохраняет данные из Kafka в БД
 */
async function saveApiDataFromKafka(message, sql) {
  try {
    const { testName, testFile, data } = message;
    
    if (!data) {
      console.error('[Kafka Consumer] Нет данных в сообщении');
      return;
    }
    
    // Вставляем в БД (используем ваше существующее подключение postgres)
    await sql`
      INSERT INTO qa.api_requests (
        endpoint,
        method,
        request_body,
        response_body,
        response_status,
        test_name,
        test_file,
        timestamp,
        created_at
      ) VALUES (
        ${data.endpoint},
        ${data.method},
        ${JSON.stringify(data.requestBody)},
        ${JSON.stringify(data.responseBody)},
        ${data.responseStatus},
        ${testName},
        ${testFile},
        ${data.timestamp},
        NOW()
      )
    `;
    
    console.log(`[Kafka Consumer] ✓ Сохранено: ${data.method} ${data.endpoint}`);
    
  } catch (error) {
    console.error('[Kafka Consumer] Ошибка сохранения в БД:', error);
  }
}

/**
 * Пример интеграции в существующий сервис
 * 
 * Добавьте в ваш основной файл (например index.js или app.js):
 */

/*
// Ваш существующий код
const postgres = require('postgres');
const { Kafka } = require('kafkajs');  // Если нужно установить

const sql = postgres({
  // Ваши настройки БД
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'your_database',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// Ваш существующий Kafka consumer
const kafka = new Kafka({
  clientId: 'api-collector-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'api-collector-group' });

// Инициализируем consumer для API Collector
await consumer.connect();
await initializeApiCollectorConsumer(consumer, sql);

console.log('✓ Kafka Consumer для API Collector запущен');
*/

module.exports = {
  initializeApiCollectorConsumer,
  saveApiDataFromKafka
};
