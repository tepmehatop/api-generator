"use strict";
/**
 * Утилиты для валидации данных Happy Path тестов
 * ВЕРСИЯ 14.4
 *
 * Решает проблему "stale data" (устаревшие данные):
 * - Проверяет актуальность данных перед генерацией
 * - Обнаруживает изменения в значимых полях (status, state, type)
 * - Обновляет или удаляет устаревшие тесты
 *
 * НОВОЕ v14.3:
 * - Сбор 422 ошибок с детальными сообщениями для генерации тестов валидации
 * - Пропуск и логирование "Bad Request" без детализации
 *
 * НОВОЕ v14.4:
 * - Сбор 400 ошибок "Уже существует" для генерации парных тестов
 * - Негативный тест: оригинальные данные → 400 + проверка сообщения
 * - Позитивный тест: данные с uniqueFields → 2xx + проверка response
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
exports.validateRequests = validateRequests;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Проверяет соответствие имени поля паттерну
 * Поддерживает wildcard '*'
 */
function matchesPattern(fieldName, pattern) {
    if (pattern === fieldName)
        return true;
    if (!pattern.includes('*'))
        return false;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(fieldName);
}
/**
 * Проверяет является ли изменение поля "допустимым"
 * Допустимые изменения: timestamps, даты
 */
function isAllowedChange(fieldPath, allowPatterns) {
    if (!allowPatterns || allowPatterns.length === 0) {
        return false;
    }
    const fieldName = fieldPath.split('.').pop() || fieldPath;
    for (const pattern of allowPatterns) {
        if (matchesPattern(fieldName, pattern)) {
            return true;
        }
    }
    return false;
}
/**
 * Проверяет является ли изменение поля "значимым"
 * Значимые изменения: status, state, type, role
 */
function isSignificantChange(fieldPath, stalePatterns) {
    if (!stalePatterns || stalePatterns.length === 0) {
        return false;
    }
    const fieldName = fieldPath.split('.').pop() || fieldPath;
    for (const pattern of stalePatterns) {
        if (matchesPattern(fieldName, pattern)) {
            return true;
        }
    }
    return false;
}
/**
 * Сравнивает два объекта и находит различия
 */
function compareObjects(oldObj, newObj, config, path = 'root') {
    const changes = [];
    if (oldObj === null || oldObj === undefined || newObj === null || newObj === undefined) {
        if (oldObj !== newObj) {
            changes.push({
                path,
                oldValue: oldObj,
                newValue: newObj,
                isSignificant: isSignificantChange(path, config.staleIfChanged)
            });
        }
        return changes;
    }
    const oldType = typeof oldObj;
    const newType = typeof newObj;
    if (oldType !== newType) {
        changes.push({
            path,
            oldValue: oldObj,
            newValue: newObj,
            isSignificant: true // Изменение типа всегда значимо
        });
        return changes;
    }
    if (oldType !== 'object') {
        if (oldObj !== newObj) {
            changes.push({
                path,
                oldValue: oldObj,
                newValue: newObj,
                isSignificant: isSignificantChange(path, config.staleIfChanged)
            });
        }
        return changes;
    }
    // Массивы
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
        if (oldObj.length !== newObj.length) {
            changes.push({
                path: `${path}.length`,
                oldValue: oldObj.length,
                newValue: newObj.length,
                isSignificant: true // Изменение длины массива значимо
            });
        }
        const maxLength = Math.max(oldObj.length, newObj.length);
        for (let i = 0; i < maxLength; i++) {
            if (i >= oldObj.length || i >= newObj.length)
                continue;
            changes.push(...compareObjects(oldObj[i], newObj[i], config, `${path}[${i}]`));
        }
        return changes;
    }
    // Объекты
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
        const fieldPath = `${path}.${key}`;
        const oldValue = oldObj[key];
        const newValue = newObj[key];
        // Пропускаем допустимые изменения (timestamps)
        if (isAllowedChange(fieldPath, config.allowChanges)) {
            continue;
        }
        if (!(key in oldObj)) {
            // Новое поле
            changes.push({
                path: fieldPath,
                oldValue: undefined,
                newValue: newValue,
                isSignificant: isSignificantChange(fieldPath, config.staleIfChanged)
            });
        }
        else if (!(key in newObj)) {
            // Удаленное поле
            changes.push({
                path: fieldPath,
                oldValue: oldValue,
                newValue: undefined,
                isSignificant: isSignificantChange(fieldPath, config.staleIfChanged)
            });
        }
        else {
            // Рекурсивное сравнение
            changes.push(...compareObjects(oldValue, newValue, config, fieldPath));
        }
    }
    return changes;
}
/**
 * Валидирует request - проверяет актуальность данных
 * Вызывает LIVE API и сравнивает с сохраненным response
 */
async function validateRequest(request, config, axios) {
    if (!config.enabled || !config.validateBeforeGeneration) {
        return {
            isValid: true,
            isStale: false,
            changes: [],
            action: 'keep'
        };
    }
    try {
        // Вызываем LIVE API
        const standUrl = config.standUrl || '';
        if (!standUrl) {
            console.warn(`⚠️  Stand URL не указан в конфигурации валидации`);
            return {
                isValid: true,
                isStale: false,
                changes: [],
                action: 'keep'
            };
        }
        const fullUrl = standUrl + request.endpoint;
        console.log(`🔍 Валидация: ${request.method} ${fullUrl}`);
        let liveResponse;
        if (request.method === 'GET') {
            liveResponse = await axios.get(fullUrl, config.axiosConfig);
        }
        else if (request.method === 'POST') {
            liveResponse = await axios.post(fullUrl, request.request_body, config.axiosConfig);
        }
        else if (request.method === 'PUT') {
            liveResponse = await axios.put(fullUrl, request.request_body, config.axiosConfig);
        }
        else if (request.method === 'PATCH') {
            liveResponse = await axios.patch(fullUrl, request.request_body, config.axiosConfig);
        }
        else if (request.method === 'DELETE') {
            liveResponse = await axios.delete(fullUrl, config.axiosConfig);
        }
        else {
            console.warn(`⚠️  Неподдерживаемый метод: ${request.method}`);
            return {
                isValid: true,
                isStale: false,
                changes: [],
                action: 'keep'
            };
        }
        // Сравниваем ответы
        const changes = compareObjects(request.response_body, liveResponse.data, config);
        // Проверяем есть ли значимые изменения
        const significantChanges = changes.filter(c => c.isSignificant);
        const isStale = significantChanges.length > 0;
        // Логируем изменения
        if (config.logChanges && changes.length > 0) {
            await logChanges(request, changes, config);
        }
        // Определяем действие
        let action = 'keep';
        if (isStale) {
            if (config.onStaleData === 'update') {
                action = 'update';
            }
            else if (config.onStaleData === 'skip') {
                action = 'skip';
            }
            else if (config.onStaleData === 'delete') {
                action = 'delete';
            }
        }
        return {
            isValid: !isStale || action === 'update',
            isStale,
            changes,
            updatedResponse: action === 'update' ? liveResponse.data : undefined,
            action
        };
    }
    catch (error) {
        const errorCode = error.response?.status || 0;
        const errorMessage = error.response?.statusText || error.message || 'Unknown error';
        const responseData = error.response?.data;
        console.error(`❌ Ошибка при валидации ${request.method} ${request.endpoint}: ${errorCode} ${errorMessage}`);
        // НОВОЕ v14.1: Логирование ошибок в файлы
        const isServerError = errorCode >= 500 && errorCode <= 599;
        const isClientError = errorCode >= 400 && errorCode <= 499;
        // НОВОЕ v14.3: Отдельная обработка 422 ошибок
        const is422Error = errorCode === 422;
        // НОВОЕ v14.4: Отдельная обработка 400 ошибок
        const is400Error = errorCode === 400;
        if (isServerError) {
            // 5xx ошибки - логируем в отдельный файл + отправляем email
            await logValidationError(request, errorCode, errorMessage, responseData, config, true);
            await sendServerErrorEmail(request, errorCode, errorMessage, responseData, config);
        }
        else if (isClientError && !is422Error && !is400Error) {
            // 4xx ошибки (кроме 422 и 400) - логируем в файл клиентских ошибок
            await logValidationError(request, errorCode, errorMessage, responseData, config, false);
        }
        // 422 и 400 ошибки обрабатываются отдельно в validateRequests
        // При ошибке API считаем данные устаревшими
        return {
            isValid: false,
            isStale: true,
            changes: [{
                    path: 'root',
                    oldValue: request.response_body,
                    newValue: null,
                    isSignificant: true
                }],
            action: config.onStaleData === 'delete' ? 'delete' : 'skip',
            // НОВОЕ v14.3: Маркируем 422 ошибки для сбора
            is422Error: is422Error,
            // НОВОЕ v14.4: Маркируем 400 ошибки для сбора
            is400Error: is400Error,
            errorCode: errorCode,
            errorResponseData: (is422Error || is400Error) ? responseData : undefined
        };
    }
}
/**
 * Логирует изменения данных в файл
 */
async function logChanges(request, changes, config) {
    if (!config.logPath)
        return;
    try {
        const logDir = path.dirname(config.logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            request_id: request.id,
            endpoint: request.endpoint,
            method: request.method,
            test_name: request.test_name,
            changes: changes.map(c => ({
                path: c.path,
                oldValue: c.oldValue,
                newValue: c.newValue,
                isSignificant: c.isSignificant
            })),
            significant_changes_count: changes.filter(c => c.isSignificant).length,
            total_changes_count: changes.length
        };
        const logLine = JSON.stringify(logEntry) + '\n';
        // Append to log file
        fs.appendFileSync(config.logPath, logLine, 'utf-8');
    }
    catch (error) {
        console.error('❌ Ошибка при логировании изменений:', error);
    }
}
/**
 * НОВОЕ v14.1: Генерирует CURL команду для запроса
 */
function generateCurlCommand(method, fullUrl, requestBody, axiosConfig) {
    const authHeader = axiosConfig?.headers?.Authorization ||
        axiosConfig?.headers?.authorization ||
        'Bearer YOUR_TOKEN';
    let curl = `curl -X ${method} '${fullUrl}'`;
    curl += ` \\\n  -H 'Authorization: ${authHeader}'`;
    if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody) {
        curl += ` \\\n  -H 'Content-Type: application/json'`;
        curl += ` \\\n  -d '${JSON.stringify(requestBody)}'`;
    }
    return curl;
}
/**
 * НОВОЕ v14.1: Логирует ошибку валидации в JSON файл
 */
async function logValidationError(request, errorCode, errorMessage, responseData, config, isServerError) {
    const logPath = isServerError ? config.serverErrorsLogPath : config.clientErrorsLogPath;
    if (!logPath)
        return;
    try {
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const now = new Date();
        const fullUrl = (config.standUrl || '') + request.endpoint;
        const errorEntry = {
            timestamp: now.toISOString(),
            timestampMsk: now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' (МСК)',
            errorCode,
            errorMessage,
            endpoint: request.endpoint,
            method: request.method,
            fullUrl,
            requestBody: request.request_body,
            responseData,
            curlCommand: generateCurlCommand(request.method, fullUrl, request.request_body, config.axiosConfig),
            requestId: request.id,
            testName: request.test_name
        };
        // Читаем существующий файл или создаем новую структуру
        let errorLog;
        if (fs.existsSync(logPath)) {
            try {
                const content = fs.readFileSync(logPath, 'utf-8');
                errorLog = JSON.parse(content);
                errorLog.lastUpdated = now.toISOString();
                errorLog.totalErrors = errorLog.errors.length + 1;
            }
            catch {
                // Если файл поврежден, создаем новый
                errorLog = {
                    generatedAt: now.toISOString(),
                    lastUpdated: now.toISOString(),
                    errorType: isServerError ? '5xx Server Errors' : '4xx Client Errors',
                    totalErrors: 1,
                    errors: []
                };
            }
        }
        else {
            errorLog = {
                generatedAt: now.toISOString(),
                lastUpdated: now.toISOString(),
                errorType: isServerError ? '5xx Server Errors' : '4xx Client Errors',
                totalErrors: 1,
                errors: []
            };
        }
        // Добавляем новую ошибку
        errorLog.errors.push(errorEntry);
        errorLog.totalErrors = errorLog.errors.length;
        // Записываем с красивым форматированием
        fs.writeFileSync(logPath, JSON.stringify(errorLog, null, 2), 'utf-8');
        const errorTypeLabel = isServerError ? '🔴 5xx' : '🟠 4xx';
        console.log(`  ${errorTypeLabel} Ошибка ${errorCode} записана в ${path.basename(logPath)}`);
    }
    catch (error) {
        console.error('❌ Ошибка при логировании ошибки валидации:', error);
    }
}
/**
 * НОВОЕ v14.1: Отправляет email уведомление о 5xx ошибке
 */
async function sendServerErrorEmail(request, errorCode, errorMessage, responseData, config) {
    if (!config.sendServerErrorEmail)
        return;
    const sendFn = config.emailSendFunction;
    if (!sendFn) {
        console.warn('⚠️  Email функция не настроена для отправки уведомлений о 5xx ошибках');
        return;
    }
    try {
        const now = new Date();
        const fullUrl = (config.standUrl || '') + request.endpoint;
        const moscowTime = now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        const curlCommand = generateCurlCommand(request.method, fullUrl, request.request_body, config.axiosConfig);
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 20px; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #dc3545; color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #333; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .info-row { display: flex; margin-bottom: 5px; }
    .info-label { font-weight: bold; width: 150px; color: #666; }
    .info-value { color: #333; }
    .error-code { font-size: 48px; font-weight: bold; color: #dc3545; text-align: center; margin: 20px 0; }
    .curl-block { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Ошибка валидации Happy Path - Server Error ${errorCode}</h1>
    </div>

    <div class="warning">
      ⚠️ Эта ошибка произошла во время генерации/валидации Happy Path тестов
    </div>

    <div class="error-code">${errorCode}</div>

    <div class="section">
      <div class="section-title">📋 Информация о запросе</div>
      <div class="info-row"><span class="info-label">Request ID:</span><span class="info-value">${request.id || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">Test Name:</span><span class="info-value">${request.test_name || 'N/A'}</span></div>
      <div class="info-row"><span class="info-label">Время ошибки:</span><span class="info-value">${moscowTime} (МСК)</span></div>
    </div>

    <div class="section">
      <div class="section-title">🌐 Информация об эндпоинте</div>
      <div class="info-row"><span class="info-label">Endpoint:</span><span class="info-value">${request.endpoint}</span></div>
      <div class="info-row"><span class="info-label">HTTP метод:</span><span class="info-value">${request.method}</span></div>
      <div class="info-row"><span class="info-label">Полный URL:</span><span class="info-value">${fullUrl}</span></div>
      <div class="info-row"><span class="info-label">Код ошибки:</span><span class="info-value">${errorCode}</span></div>
      <div class="info-row"><span class="info-label">Сообщение:</span><span class="info-value">${errorMessage}</span></div>
    </div>

    <div class="section">
      <div class="section-title">📋 CURL для повторения запроса</div>
      <div class="curl-block">${curlCommand}</div>
    </div>

    ${request.request_body ? `
    <div class="section">
      <div class="section-title">📤 Request Body</div>
      <div class="curl-block">${JSON.stringify(request.request_body, null, 2)}</div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">📄 Response Data</div>
      <div class="curl-block">${JSON.stringify(responseData, null, 2) || 'No response data'}</div>
    </div>
  </div>
</body>
</html>`;
        await sendFn(emailHtml);
        console.log(`  📧 Email уведомление о 5xx ошибке отправлено`);
    }
    catch (error) {
        console.error('❌ Не удалось отправить email:', error);
    }
}
/**
 * Валидирует массив requests
 * Возвращает только валидные или обновленные requests
 *
 * НОВОЕ v14.3: Также собирает 422 ошибки с детальными сообщениями
 * НОВОЕ v14.4: Также собирает 400 ошибки для парных тестов (негатив + позитив)
 */
async function validateRequests(requests, config, axios) {
    if (!config.enabled || !config.validateBeforeGeneration) {
        return {
            validRequests: requests,
            deletedCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            validation422Errors: [],
            badRequestSkippedCount: 0,
            duplicate400Errors: [],
            badRequest400SkippedCount: 0
        };
    }
    const validRequests = [];
    let deletedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    // НОВОЕ v14.3: Сбор 422 ошибок
    const validation422Errors = [];
    let badRequestSkippedCount = 0;
    // ИСПРАВЛЕНИЕ v14.5.1: Пустой массив по умолчанию - собираем все непустые сообщения
    const skipPatterns = config.skipMessagePatterns || [];
    // НОВОЕ v14.4: Сбор 400 ошибок для парных тестов
    const duplicate400Errors = [];
    let badRequest400SkippedCount = 0;
    // ИСПРАВЛЕНИЕ v14.5.1: Пустой массив по умолчанию - собираем все непустые сообщения
    const skip400Patterns = config.skip400MessagePatterns || [];
    console.log(`\n🔍 Валидация ${requests.length} запросов...`);
    for (const request of requests) {
        const result = await validateRequest(request, config, axios);
        if (result.action === 'keep') {
            validRequests.push(request);
        }
        else if (result.action === 'update') {
            // Обновляем response на актуальный
            const updatedRequest = {
                ...request,
                response_body: result.updatedResponse
            };
            validRequests.push(updatedRequest);
            updatedCount++;
            console.log(`  ✓ Обновлен: ${request.method} ${request.endpoint} (ID: ${request.id})`);
        }
        else if (result.action === 'delete') {
            deletedCount++;
            console.log(`  ✗ Удален: ${request.method} ${request.endpoint} (ID: ${request.id})`);
            console.log(`    Причина: ${result.changes.filter(c => c.isSignificant).map(c => `${c.path}: ${c.oldValue} → ${c.newValue}`).join(', ')}`);
        }
        else if (result.action === 'skip') {
            skippedCount++;
            console.log(`  ⏭️  Пропущен: ${request.method} ${request.endpoint} (ID: ${request.id})`);
        }
        // НОВОЕ v14.3: Обработка 422 ошибок
        if (result.is422Error && config.collect422Errors) {
            const detailMessage = extract422DetailMessage(result.errorResponseData);
            // ИСПРАВЛЕНИЕ v14.5.1: Проверяем есть ли реальное сообщение об ошибке
            // Пропускаем только если: сообщение пустое ИЛИ совпадает с паттерном пропуска
            const isEmptyMessage = !detailMessage || detailMessage.trim() === '';
            const matchesSkipPattern = !isEmptyMessage && skipPatterns
                .filter(p => p && p.length > 0) // Игнорируем пустые паттерны
                .some(pattern => detailMessage.toLowerCase().includes(pattern.toLowerCase()));
            const isSkipMessage = isEmptyMessage || matchesSkipPattern;
            if (isSkipMessage) {
                // Логируем в файл пропущенных Bad Request
                badRequestSkippedCount++;
                await logBadRequestSkipped(request, result.errorResponseData, config);
                console.log(`  ⏭️  422 пропущен (${isEmptyMessage ? 'пустое сообщение' : 'паттерн'}): ${request.method} ${request.endpoint}`);
            }
            else {
                // Собираем для генерации тестов
                validation422Errors.push({
                    requestId: request.id,
                    endpoint: request.endpoint,
                    method: request.method,
                    requestBody: request.request_body,
                    responseStatus: 422,
                    responseData: result.errorResponseData,
                    detailMessage: detailMessage,
                    testName: request.test_name
                });
                console.log(`  📋 422 с детализацией: ${request.method} ${request.endpoint} - "${detailMessage.substring(0, 50)}..."`);
            }
        }
        // НОВОЕ v14.4: Обработка 400 ошибок (для парных тестов негатив + позитив)
        if (result.is400Error && config.collect400Errors) {
            const detailMessage = extract400DetailMessage(result.errorResponseData);
            // ИСПРАВЛЕНИЕ v14.5.1: Проверяем есть ли реальное сообщение об ошибке
            // Пропускаем только если: сообщение пустое ИЛИ совпадает с паттерном пропуска
            const isEmptyMessage = !detailMessage || detailMessage.trim() === '';
            const matchesSkipPattern = !isEmptyMessage && skip400Patterns
                .filter(p => p && p.length > 0) // Игнорируем пустые паттерны
                .some(pattern => detailMessage.toLowerCase().includes(pattern.toLowerCase()));
            const isSkip400Message = isEmptyMessage || matchesSkipPattern;
            if (isSkip400Message) {
                // Логируем в файл пропущенных 400 Bad Request
                badRequest400SkippedCount++;
                await log400BadRequestSkipped(request, result.errorResponseData, config);
                console.log(`  ⏭️  400 пропущен (${isEmptyMessage ? 'пустое сообщение' : 'паттерн'}): ${request.method} ${request.endpoint}`);
            }
            else {
                // Собираем для генерации парных тестов (негатив 400 + позитив с unique)
                duplicate400Errors.push({
                    requestId: request.id,
                    endpoint: request.endpoint,
                    method: request.method,
                    requestBody: request.request_body,
                    expectedResponseBody: request.response_body, // Ожидаемый успешный response из БД
                    expectedStatus: request.response_status, // Ожидаемый успешный статус (201, 200)
                    responseStatus: 400,
                    responseData: result.errorResponseData,
                    detailMessage: detailMessage, // Актуальное сообщение из API
                    testName: request.test_name
                });
                console.log(`  📋 400 с детализацией: ${request.method} ${request.endpoint} - "${detailMessage.substring(0, 50)}..."`);
            }
        }
        // Небольшая задержка чтобы не перегружать API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`\n📊 Результаты валидации:`);
    console.log(`   Валидных: ${validRequests.length}`);
    console.log(`   Обновлено: ${updatedCount}`);
    console.log(`   Удалено: ${deletedCount}`);
    console.log(`   Пропущено: ${skippedCount}`);
    // НОВОЕ v14.3: Статистика 422 ошибок
    if (config.collect422Errors) {
        console.log(`\n📋 422 ошибки:`);
        console.log(`   Для тестов валидации: ${validation422Errors.length}`);
        console.log(`   Bad Request (пропущено): ${badRequestSkippedCount}`);
    }
    // НОВОЕ v14.4: Статистика 400 ошибок
    if (config.collect400Errors) {
        console.log(`\n📋 400 ошибки (дубликаты):`);
        console.log(`   Для парных тестов: ${duplicate400Errors.length}`);
        console.log(`   Bad Request (пропущено): ${badRequest400SkippedCount}`);
    }
    return {
        validRequests,
        deletedCount,
        updatedCount,
        skippedCount,
        validation422Errors,
        badRequestSkippedCount,
        duplicate400Errors,
        badRequest400SkippedCount
    };
}
/**
 * НОВОЕ v14.3: Извлекает детальное сообщение из 422 ответа
 */
function extract422DetailMessage(responseData) {
    if (!responseData)
        return '';
    // Типичные форматы ответов:
    // { "detail": "..." }
    // { "message": "..." }
    // { "error": "..." }
    // { "errors": [...] }
    // { "detail": { "message": "..." } }
    if (typeof responseData === 'string')
        return responseData;
    if (responseData.detail) {
        if (typeof responseData.detail === 'string')
            return responseData.detail;
        if (typeof responseData.detail === 'object' && responseData.detail.message) {
            return responseData.detail.message;
        }
        return JSON.stringify(responseData.detail);
    }
    if (responseData.message)
        return responseData.message;
    if (responseData.error)
        return responseData.error;
    if (responseData.errors && Array.isArray(responseData.errors)) {
        return responseData.errors.map((e) => e.message || e.msg || JSON.stringify(e)).join('; ');
    }
    return JSON.stringify(responseData);
}
/**
 * НОВОЕ v14.4: Извлекает детальное сообщение из 400 ответа
 */
function extract400DetailMessage(responseData) {
    if (!responseData)
        return '';
    // Типичные форматы ответов для 400 "Уже существует":
    // { "detail": "Уже существует" }
    // { "message": "Объект с таким именем уже существует" }
    // { "error": "Duplicate entry" }
    if (typeof responseData === 'string')
        return responseData;
    if (responseData.detail) {
        if (typeof responseData.detail === 'string')
            return responseData.detail;
        if (typeof responseData.detail === 'object' && responseData.detail.message) {
            return responseData.detail.message;
        }
        return JSON.stringify(responseData.detail);
    }
    if (responseData.message)
        return responseData.message;
    if (responseData.error)
        return responseData.error;
    if (responseData.errors && Array.isArray(responseData.errors)) {
        return responseData.errors.map((e) => e.message || e.msg || JSON.stringify(e)).join('; ');
    }
    return JSON.stringify(responseData);
}
/**
 * НОВОЕ v14.4: Логирует пропущенный 400 Bad Request в JSON файл
 */
async function log400BadRequestSkipped(request, responseData, config) {
    const logPath = config.badRequest400SkipLogPath;
    if (!logPath)
        return;
    try {
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const now = new Date();
        const fullUrl = (config.standUrl || '') + request.endpoint;
        const skipEntry = {
            timestamp: now.toISOString(),
            timestampMsk: now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' (МСК)',
            endpoint: request.endpoint,
            method: request.method,
            fullUrl,
            requestBody: request.request_body,
            responseData,
            curlCommand: generateCurlCommand(request.method, fullUrl, request.request_body, config.axiosConfig),
            requestId: request.id,
            testName: request.test_name
        };
        // Читаем существующий файл или создаем новую структуру
        let skipLog;
        if (fs.existsSync(logPath)) {
            try {
                const content = fs.readFileSync(logPath, 'utf-8');
                skipLog = JSON.parse(content);
                skipLog.lastUpdated = now.toISOString();
            }
            catch {
                skipLog = {
                    generatedAt: now.toISOString(),
                    lastUpdated: now.toISOString(),
                    description: '400 Bad Request без детализации - пропущены при генерации тестов на дубликаты',
                    totalSkipped: 0,
                    skippedRequests: []
                };
            }
        }
        else {
            skipLog = {
                generatedAt: now.toISOString(),
                lastUpdated: now.toISOString(),
                description: '400 Bad Request без детализации - пропущены при генерации тестов на дубликаты',
                totalSkipped: 0,
                skippedRequests: []
            };
        }
        skipLog.skippedRequests.push(skipEntry);
        skipLog.totalSkipped = skipLog.skippedRequests.length;
        fs.writeFileSync(logPath, JSON.stringify(skipLog, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('❌ Ошибка при логировании пропущенного 400 Bad Request:', error);
    }
}
/**
 * НОВОЕ v14.3: Логирует пропущенный Bad Request в JSON файл
 */
async function logBadRequestSkipped(request, responseData, config) {
    const logPath = config.badRequestSkipLogPath;
    if (!logPath)
        return;
    try {
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const now = new Date();
        const fullUrl = (config.standUrl || '') + request.endpoint;
        const skipEntry = {
            timestamp: now.toISOString(),
            timestampMsk: now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' (МСК)',
            endpoint: request.endpoint,
            method: request.method,
            fullUrl,
            requestBody: request.request_body,
            responseData,
            curlCommand: generateCurlCommand(request.method, fullUrl, request.request_body, config.axiosConfig),
            requestId: request.id,
            testName: request.test_name
        };
        // Читаем существующий файл или создаем новую структуру
        let skipLog;
        if (fs.existsSync(logPath)) {
            try {
                const content = fs.readFileSync(logPath, 'utf-8');
                skipLog = JSON.parse(content);
                skipLog.lastUpdated = now.toISOString();
            }
            catch {
                skipLog = {
                    generatedAt: now.toISOString(),
                    lastUpdated: now.toISOString(),
                    description: '422 Bad Request без детализации - пропущены при генерации тестов валидации',
                    totalSkipped: 0,
                    skippedRequests: []
                };
            }
        }
        else {
            skipLog = {
                generatedAt: now.toISOString(),
                lastUpdated: now.toISOString(),
                description: '422 Bad Request без детализации - пропущены при генерации тестов валидации',
                totalSkipped: 0,
                skippedRequests: []
            };
        }
        skipLog.skippedRequests.push(skipEntry);
        skipLog.totalSkipped = skipLog.skippedRequests.length;
        fs.writeFileSync(logPath, JSON.stringify(skipLog, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('❌ Ошибка при логировании пропущенного Bad Request:', error);
    }
}
//# sourceMappingURL=data-validation.js.map