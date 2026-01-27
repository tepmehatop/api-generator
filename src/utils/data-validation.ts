/**
 * Утилиты для валидации данных Happy Path тестов
 * ВЕРСИЯ 12.0
 *
 * Решает проблему "stale data" (устаревшие данные):
 * - Проверяет актуальность данных перед генерацией
 * - Обнаруживает изменения в значимых полях (status, state, type)
 * - Обновляет или удаляет устаревшие тесты
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ValidationConfig {
  enabled: boolean;
  validateBeforeGeneration: boolean;
  onStaleData: 'update' | 'skip' | 'delete';
  staleIfChanged: string[];
  allowChanges: string[];
  validateInDatabase: boolean;
  standUrl?: string;
  axiosConfig?: any;
  logChanges: boolean;
  logPath: string;
}

export interface TestRequest {
  id: number;
  endpoint: string;
  method: string;
  request_body: any;
  response_body: any;
  response_status: number;
  test_name: string;
}

export interface ValidationResult {
  isValid: boolean;
  isStale: boolean;
  changes: FieldChange[];
  updatedResponse?: any;
  action: 'keep' | 'update' | 'delete' | 'skip';
}

export interface FieldChange {
  path: string;
  oldValue: any;
  newValue: any;
  isSignificant: boolean; // Значимое изменение (status, type) vs техническое (timestamp)
}

/**
 * Проверяет соответствие имени поля паттерну
 * Поддерживает wildcard '*'
 */
function matchesPattern(fieldName: string, pattern: string): boolean {
  if (pattern === fieldName) return true;
  if (!pattern.includes('*')) return false;

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(fieldName);
}

/**
 * Проверяет является ли изменение поля "допустимым"
 * Допустимые изменения: timestamps, даты
 */
function isAllowedChange(fieldPath: string, allowPatterns: string[]): boolean {
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
function isSignificantChange(fieldPath: string, stalePatterns: string[]): boolean {
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
function compareObjects(
  oldObj: any,
  newObj: any,
  config: ValidationConfig,
  path: string = 'root'
): FieldChange[] {
  const changes: FieldChange[] = [];

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
      if (i >= oldObj.length || i >= newObj.length) continue;
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
    } else if (!(key in newObj)) {
      // Удаленное поле
      changes.push({
        path: fieldPath,
        oldValue: oldValue,
        newValue: undefined,
        isSignificant: isSignificantChange(fieldPath, config.staleIfChanged)
      });
    } else {
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
export async function validateRequest(
  request: TestRequest,
  config: ValidationConfig,
  axios: any
): Promise<ValidationResult> {
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
    const standUrl = config.standUrl || process.env.StandURL || '';
    const fullUrl = standUrl + request.endpoint;

    let liveResponse;

    if (request.method === 'GET') {
      liveResponse = await axios.get(fullUrl, config.axiosConfig);
    } else if (request.method === 'POST') {
      liveResponse = await axios.post(fullUrl, request.request_body, config.axiosConfig);
    } else if (request.method === 'PUT') {
      liveResponse = await axios.put(fullUrl, request.request_body, config.axiosConfig);
    } else if (request.method === 'PATCH') {
      liveResponse = await axios.patch(fullUrl, request.request_body, config.axiosConfig);
    } else if (request.method === 'DELETE') {
      liveResponse = await axios.delete(fullUrl, config.axiosConfig);
    } else {
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
    let action: 'keep' | 'update' | 'delete' | 'skip' = 'keep';

    if (isStale) {
      if (config.onStaleData === 'update') {
        action = 'update';
      } else if (config.onStaleData === 'skip') {
        action = 'skip';
      } else if (config.onStaleData === 'delete') {
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

  } catch (error: any) {
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
async function logChanges(
  request: TestRequest,
  changes: FieldChange[],
  config: ValidationConfig
): Promise<void> {
  if (!config.logPath) return;

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

  } catch (error) {
    console.error('❌ Ошибка при логировании изменений:', error);
  }
}

/**
 * Валидирует массив requests
 * Возвращает только валидные или обновленные requests
 */
export async function validateRequests(
  requests: TestRequest[],
  config: ValidationConfig,
  axios: any
): Promise<{
  validRequests: TestRequest[];
  deletedCount: number;
  updatedCount: number;
  skippedCount: number;
}> {
  if (!config.enabled || !config.validateBeforeGeneration) {
    return {
      validRequests: requests,
      deletedCount: 0,
      updatedCount: 0,
      skippedCount: 0
    };
  }

  const validRequests: TestRequest[] = [];
  let deletedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  console.log(`\n🔍 Валидация ${requests.length} запросов...`);

  for (const request of requests) {
    const result = await validateRequest(request, config, axios);

    if (result.action === 'keep') {
      validRequests.push(request);
    } else if (result.action === 'update') {
      // Обновляем response на актуальный
      const updatedRequest = {
        ...request,
        response_body: result.updatedResponse
      };
      validRequests.push(updatedRequest);
      updatedCount++;
      console.log(`  ✓ Обновлен: ${request.method} ${request.endpoint} (ID: ${request.id})`);
    } else if (result.action === 'delete') {
      deletedCount++;
      console.log(`  ✗ Удален: ${request.method} ${request.endpoint} (ID: ${request.id})`);
      console.log(`    Причина: ${result.changes.filter(c => c.isSignificant).map(c => `${c.path}: ${c.oldValue} → ${c.newValue}`).join(', ')}`);
    } else if (result.action === 'skip') {
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
