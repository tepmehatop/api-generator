/**
 * Express сервис для сбора API данных из автотестов
 * 
 * Установка:
 *   npm install express postgres cors body-parser
 * 
 * Запуск:
 *   node api-collector-service.js
 */

const express = require('express');
const postgres = require('postgres');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Подключение к PostgreSQL
const sql = postgres({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'your_database',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  // Ваши существующие настройки из микросервиса
});

console.log('✓ Подключение к БД настроено');

/**
 * POST /api/collect-data
 * Принимает данные из автотестов и сохраняет в БД
 * 
 * Body:
 * {
 *   testName: string,
 *   testFile: string,
 *   data: ApiRequestData[]
 * }
 */
app.post('/api/collect-data', async (req, res) => {
  try {
    const { testName, testFile, data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid data format',
        message: 'Expected array of ApiRequestData' 
      });
    }
    
    console.log(`📥 Получено ${data.length} записей из теста: ${testName}`);
    
    // Сохраняем данные в БД
    const savedCount = await saveApiData(data, testName, testFile);
    
    res.json({ 
      success: true,
      savedCount,
      message: `Сохранено ${savedCount} записей`
    });
    
    console.log(`✓ Сохранено ${savedCount} записей в БД`);
  } catch (error) {
    console.error('❌ Ошибка при сохранении данных:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/endpoints
 * Возвращает список уникальных endpoint'ов
 * 
 * Query params:
 *   - method: фильтр по HTTP методу (GET, POST, etc.)
 *   - limit: количество результатов (default: 100)
 */
app.get('/api/endpoints', async (req, res) => {
  try {
    const { method, limit = 100 } = req.query;
    
    let query = sql`
      SELECT DISTINCT 
        endpoint, 
        method,
        COUNT(*) as request_count,
        MAX(created_at) as last_seen
      FROM qa.api_requests
    `;
    
    if (method) {
      query = sql`
        SELECT DISTINCT 
          endpoint, 
          method,
          COUNT(*) as request_count,
          MAX(created_at) as last_seen
        FROM qa.api_requests
        WHERE method = ${method.toUpperCase()}
      `;
    }
    
    query = sql`
      ${query}
      GROUP BY endpoint, method
      ORDER BY request_count DESC
      LIMIT ${parseInt(limit)}
    `;
    
    const endpoints = await query;
    
    res.json({ 
      success: true,
      count: endpoints.length,
      endpoints 
    });
  } catch (error) {
    console.error('❌ Ошибка при получении endpoints:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/endpoint-data/:endpoint
 * Возвращает все данные для конкретного endpoint
 * 
 * Query params:
 *   - method: фильтр по HTTP методу
 *   - limit: количество результатов (default: 10)
 */
app.get('/api/endpoint-data/:endpoint(*)', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { method, limit = 10 } = req.query;
    
    let query;
    
    if (method) {
      query = sql`
        SELECT * FROM qa.api_requests
        WHERE endpoint = ${endpoint} AND method = ${method.toUpperCase()}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    } else {
      query = sql`
        SELECT * FROM qa.api_requests
        WHERE endpoint = ${endpoint}
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `;
    }
    
    const requests = await query;
    
    res.json({ 
      success: true,
      endpoint,
      count: requests.length,
      requests 
    });
  } catch (error) {
    console.error('❌ Ошибка при получении данных endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/unique-requests
 * Возвращает уникальные комбинации endpoint + request body
 * Используется для генерации тестов
 * 
 * Query params:
 *   - endpoint: фильтр по endpoint
 *   - method: фильтр по HTTP методу
 */
app.get('/api/unique-requests', async (req, res) => {
  try {
    const { endpoint, method } = req.query;
    
    let whereClause = [];
    let params = [];
    
    if (endpoint) {
      whereClause.push('endpoint = $1');
      params.push(endpoint);
    }
    
    if (method) {
      whereClause.push(`method = $${params.length + 1}`);
      params.push(method.toUpperCase());
    }
    
    const where = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';
    
    // Группируем по endpoint + method + request_body
    // Берём первый response для каждой уникальной комбинации
    const query = `
      SELECT DISTINCT ON (endpoint, method, request_body)
        id,
        endpoint,
        method,
        request_body,
        response_body,
        response_status,
        test_name,
        test_file,
        created_at
      FROM qa.api_requests
      ${where}
      ORDER BY endpoint, method, request_body, created_at DESC
    `;
    
    const uniqueRequests = await sql.unsafe(query, params);
    
    res.json({ 
      success: true,
      count: uniqueRequests.length,
      requests: uniqueRequests 
    });
  } catch (error) {
    console.error('❌ Ошибка при получении уникальных запросов:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    // Проверяем подключение к БД
    await sql`SELECT 1`;
    
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message 
    });
  }
});

/**
 * Сохраняет API данные в БД
 */
async function saveApiData(dataArray, testName, testFile) {
  let savedCount = 0;
  
  for (const item of dataArray) {
    try {
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
          ${item.endpoint},
          ${item.method},
          ${JSON.stringify(item.requestBody)},
          ${JSON.stringify(item.responseBody)},
          ${item.responseStatus},
          ${testName},
          ${testFile},
          ${item.timestamp},
          NOW()
        )
      `;
      
      savedCount++;
    } catch (error) {
      console.error(`❌ Ошибка при сохранении записи для ${item.endpoint}:`, error.message);
      // Продолжаем сохранять остальные
    }
  }
  
  return savedCount;
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`
  🚀 API Collector Service запущен
  
  📡 Порт: ${PORT}
  🗄️  База: ${process.env.DB_NAME || 'your_database'}
  📊 Схема: qa
  
  Endpoints:
    POST /api/collect-data        - Сбор данных из тестов
    GET  /api/endpoints            - Список endpoints
    GET  /api/endpoint-data/:path  - Данные для endpoint
    GET  /api/unique-requests      - Уникальные запросы
    GET  /health                   - Health check
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM получен, закрываю соединения...');
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT получен, закрываю соединения...');
  await sql.end();
  process.exit(0);
});
