/**
 * Утилиты для дедупликации Happy Path тестов
 * ВЕРСИЯ 12.0
 *
 * Реализует:
 * - Идея 1: Группировка по "signature" (игнорируем технические поля)
 * - Идея 2: Обнаружение edge cases (пустые массивы, null, редкие значения)
 */

export interface DeduplicationConfig {
  enabled?: boolean;
  ignoreFields?: string[];
  significantFields?: string[];
  detectEdgeCases?: boolean;
  maxTestsPerEndpoint?: number;
  preserveTaggedTests?: string[];
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

export interface EdgeCaseInfo {
  type: 'empty_array' | 'null_field' | 'rare_value';
  path: string;
  value: any;
}

/**
 * Проверяет соответствие имени поля паттерну
 * Поддерживает wildcard '*' (например '*_id', '*_timestamp')
 */
function matchesPattern(fieldName: string, pattern: string): boolean {
  if (pattern === fieldName) return true;
  if (!pattern.includes('*')) return false;

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(fieldName);
}

/**
 * Проверяет должно ли поле игнорироваться при сравнении
 */
function shouldIgnoreField(fieldPath: string, ignorePatterns?: string[]): boolean {
  if (!ignorePatterns || ignorePatterns.length === 0) {
    return false;
  }

  const fieldName = fieldPath.split('.').pop() || fieldPath;

  for (const pattern of ignorePatterns) {
    if (matchesPattern(fieldName, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Проверяет является ли поле "значимым" (важным для бизнес-логики)
 */
function isSignificantField(fieldPath: string, significantFields?: string[]): boolean {
  if (!significantFields || significantFields.length === 0) {
    return false;
  }

  const fieldName = fieldPath.split('.').pop() || fieldPath;

  for (const pattern of significantFields) {
    if (matchesPattern(fieldName, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Вычисляет "signature" (отпечаток) ответа
 * Игнорирует технические поля (id, timestamps)
 * Учитывает значимые поля (status, type, role)
 */
export function calculateResponseSignature(
  response: any,
  config: DeduplicationConfig,
  path: string = 'root'
): string {
  if (response === null || response === undefined) {
    return String(response);
  }

  // Примитивные типы
  if (typeof response !== 'object') {
    return String(response);
  }

  // Массивы
  if (Array.isArray(response)) {
    // Для массивов: учитываем длину и signature первого элемента
    if (response.length === 0) {
      return 'array:empty';
    }

    const firstElementSignature = calculateResponseSignature(response[0], config, `${path}[0]`);
    return `array:${response.length}:${firstElementSignature}`;
  }

  // Объекты
  const parts: string[] = [];

  for (const key of Object.keys(response).sort()) {
    const fieldPath = `${path}.${key}`;
    const value = response[key];

    // Пропускаем технические поля
    if (shouldIgnoreField(fieldPath, config.ignoreFields)) {
      continue;
    }

    // Значимые поля всегда включаем в signature со значением
    if (isSignificantField(fieldPath, config.significantFields)) {
      parts.push(`${key}=${String(value)}`);
      continue;
    }

    // Остальные поля: только тип
    if (value === null) {
      parts.push(`${key}=null`);
    } else if (Array.isArray(value)) {
      parts.push(`${key}=array:${value.length}`);
    } else {
      parts.push(`${key}=${typeof value}`);
    }
  }

  return parts.join('|');
}

/**
 * Обнаруживает edge cases в ответе
 */
export function detectEdgeCases(response: any, path: string = 'root'): EdgeCaseInfo[] {
  const edgeCases: EdgeCaseInfo[] = [];

  if (response === null || response === undefined) {
    edgeCases.push({
      type: 'null_field',
      path,
      value: response
    });
    return edgeCases;
  }

  if (typeof response !== 'object') {
    return edgeCases;
  }

  // Массивы
  if (Array.isArray(response)) {
    if (response.length === 0) {
      edgeCases.push({
        type: 'empty_array',
        path,
        value: []
      });
    } else {
      // Рекурсивно для элементов массива
      response.forEach((item, index) => {
        edgeCases.push(...detectEdgeCases(item, `${path}[${index}]`));
      });
    }
    return edgeCases;
  }

  // Объекты
  for (const key of Object.keys(response)) {
    const value = response[key];
    const fieldPath = `${path}.${key}`;

    if (value === null || value === undefined) {
      edgeCases.push({
        type: 'null_field',
        path: fieldPath,
        value: value
      });
    } else if (Array.isArray(value) && value.length === 0) {
      edgeCases.push({
        type: 'empty_array',
        path: fieldPath,
        value: []
      });
    } else if (typeof value === 'object') {
      edgeCases.push(...detectEdgeCases(value, fieldPath));
    }
  }

  return edgeCases;
}

/**
 * Вычисляет частоту значений в массиве
 * Используется для обнаружения "редких" значений
 */
function calculateValueFrequency(values: any[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const value of values) {
    const key = JSON.stringify(value);
    frequency.set(key, (frequency.get(key) || 0) + 1);
  }

  return frequency;
}

/**
 * Группирует запросы по signature с учетом edge cases
 * Возвращает: { signature → массив запросов }
 */
export function groupRequestsBySignature(
  requests: TestRequest[],
  config: DeduplicationConfig
): Map<string, TestRequest[]> {
  const grouped = new Map<string, TestRequest[]>();

  for (const request of requests) {
    let signature = calculateResponseSignature(request.response_body, config);

    // Если включено обнаружение edge cases - добавляем их в signature
    if (config.detectEdgeCases) {
      const edgeCases = detectEdgeCases(request.response_body);
      if (edgeCases.length > 0) {
        const edgeSignature = edgeCases.map(e => `${e.type}:${e.path}`).join('|');
        signature = `${signature}|EDGE:${edgeSignature}`;
      }
    }

    if (!grouped.has(signature)) {
      grouped.set(signature, []);
    }

    grouped.get(signature)!.push(request);
  }

  return grouped;
}

/**
 * Обнаруживает редкие значения в значимых полях
 * Редкое значение = встречается < 20% от всех запросов
 */
export function detectRareValues(
  requests: TestRequest[],
  significantFields: string[]
): TestRequest[] {
  if (requests.length < 3) {
    // Слишком мало данных для анализа
    return requests;
  }

  const rareRequests: TestRequest[] = [];

  // Анализируем каждое значимое поле
  for (const field of significantFields) {
    const values: any[] = [];

    // Собираем все значения этого поля
    for (const request of requests) {
      const value = getValueByPath(request.response_body, field);
      if (value !== undefined) {
        values.push(value);
      }
    }

    if (values.length === 0) continue;

    // Вычисляем частоту
    const frequency = calculateValueFrequency(values);
    const threshold = values.length * 0.2; // 20%

    // Находим редкие значения
    for (const [valueStr, count] of frequency.entries()) {
      if (count < threshold) {
        // Это редкое значение - находим соответствующий request
        const value = JSON.parse(valueStr);
        const rareRequest = requests.find(
          r => JSON.stringify(getValueByPath(r.response_body, field)) === valueStr
        );

        if (rareRequest && !rareRequests.includes(rareRequest)) {
          rareRequests.push(rareRequest);
        }
      }
    }
  }

  return rareRequests;
}

/**
 * Получает значение по пути (например 'root.data.status')
 */
function getValueByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Выбирает лучшие тесты из группы
 * Стратегия: 1 базовый + edge cases + редкие значения (до maxTests)
 */
export function selectBestTests(
  requests: TestRequest[],
  config: DeduplicationConfig
): TestRequest[] {
  const maxTests = config.maxTestsPerEndpoint || 10;

  if (requests.length <= maxTests) {
    return requests;
  }

  const selected: TestRequest[] = [];

  // 1. Проверяем защищенные тесты (с тегами [KEEP], [IMPORTANT])
  const protectedTests = requests.filter(r => {
    return (config.preserveTaggedTests || []).some(tag => r.test_name.includes(tag));
  });

  for (const protectedTest of protectedTests) {
    if (selected.length >= maxTests) break;
    selected.push(protectedTest);
  }

  // 2. Добавляем первый тест (базовый случай)
  if (selected.length < maxTests && !selected.includes(requests[0])) {
    selected.push(requests[0]);
  }

  // 3. Добавляем тесты с edge cases
  if (config.detectEdgeCases && selected.length < maxTests) {
    for (const request of requests) {
      if (selected.includes(request)) continue;

      const edgeCases = detectEdgeCases(request.response_body);
      if (edgeCases.length > 0) {
        selected.push(request);
        if (selected.length >= maxTests) break;
      }
    }
  }

  // 4. Добавляем тесты с редкими значениями
  if (selected.length < maxTests && config.significantFields) {
    const rareTests = detectRareValues(requests, config.significantFields);
    for (const rareTest of rareTests) {
      if (selected.includes(rareTest)) continue;

      selected.push(rareTest);
      if (selected.length >= maxTests) break;
    }
  }

  // 5. Если все еще не хватает - добавляем оставшиеся
  if (selected.length < maxTests) {
    for (const request of requests) {
      if (selected.includes(request)) continue;

      selected.push(request);
      if (selected.length >= maxTests) break;
    }
  }

  return selected.slice(0, maxTests);
}

/**
 * Главная функция дедупликации
 * Принимает массив запросов, возвращает отфильтрованный массив
 */
export function deduplicateTests(
  requests: TestRequest[],
  config: DeduplicationConfig
): TestRequest[] {
  const maxTests = config.maxTestsPerEndpoint || 10;

  if (!config.enabled || requests.length <= maxTests) {
    return requests;
  }

  // 1. Группируем по signature
  const grouped = groupRequestsBySignature(requests, config);

  // 2. Из каждой группы выбираем лучшие тесты
  const deduplicated: TestRequest[] = [];

  for (const [signature, groupRequests] of grouped.entries()) {
    const selected = selectBestTests(groupRequests, config);
    deduplicated.push(...selected);
  }

  console.log(`🔍 Дедупликация: ${requests.length} → ${deduplicated.length} тестов`);
  console.log(`   Уникальных signatures: ${grouped.size}`);

  return deduplicated;
}
