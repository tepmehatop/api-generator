"use strict";
/**
 * Утилиты для валидации данных Happy Path тестов
 * ВЕРСИЯ 12.0
 *
 * Решает проблему "stale data" (устаревшие данные):
 * - Проверяет актуальность данных перед генерацией
 * - Обнаруживает изменения в значимых полях (status, state, type)
 * - Обновляет или удаляет устаревшие тесты
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
        console.error(`❌ Ошибка при валидации ${request.method} ${request.endpoint}:`, error.message);
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
            action: config.onStaleData === 'delete' ? 'delete' : 'skip'
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
 * Валидирует массив requests
 * Возвращает только валидные или обновленные requests
 */
async function validateRequests(requests, config, axios) {
    if (!config.enabled || !config.validateBeforeGeneration) {
        return {
            validRequests: requests,
            deletedCount: 0,
            updatedCount: 0,
            skippedCount: 0
        };
    }
    const validRequests = [];
    let deletedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
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
        // Небольшая задержка чтобы не перегружать API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`\n📊 Результаты валидации:`);
    console.log(`   Валидных: ${validRequests.length}`);
    console.log(`   Обновлено: ${updatedCount}`);
    console.log(`   Удалено: ${deletedCount}`);
    console.log(`   Пропущено: ${skippedCount}`);
    return {
        validRequests,
        deletedCount,
        updatedCount,
        skippedCount
    };
}
//# sourceMappingURL=data-validation.js.map