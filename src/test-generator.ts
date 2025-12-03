/**
 * Генератор API тестов из сгенерированных API методов
 */

import * as fs from 'fs';
import * as path from 'path';
import { toCamelCase, toPascalCase } from './utils/string-helpers';

export interface ApiTestConfig {
  /**
   * Путь к файлу с API методами (например, ./src/api/pets.api.ts)
   */
  apiFilePath: string;
  
  /**
   * Папка для выгрузки тестов
   */
  outputDir: string;
  
  /**
   * Генерировать тесты для негативных сценариев (401, 403, 400, 405)
   * @default true
   */
  generateNegativeTests?: boolean;
  
  /**
   * Генерировать тесты для позитивных сценариев (200, 201)
   * @default true
   */
  generatePositiveTests?: boolean;
}

interface ExtractedMethod {
  name: string;
  httpMethod: string;
  path: string;
  parameters: string[];
  returnType: string;
  tags: string[];
  hasAuth: boolean;
}

/**
 * Генерирует API тесты из файла с методами
 */
export async function generateApiTests(config: ApiTestConfig): Promise<void> {
  const fullConfig = {
    generateNegativeTests: true,
    generatePositiveTests: true,
    ...config
  };
  
  console.log('🧪 Начинаю генерацию API тестов...');
  
  // Читаем файл с API методами
  const apiFileContent = fs.readFileSync(fullConfig.apiFilePath, 'utf-8');
  
  // Извлекаем информацию о методах
  const methods = extractMethodsFromFile(apiFileContent);
  
  console.log(`✓ Найдено методов: ${methods.length}`);
  
  // Создаем выходную папку если не существует
  if (!fs.existsSync(fullConfig.outputDir)) {
    fs.mkdirSync(fullConfig.outputDir, { recursive: true });
  }
  
  // Генерируем тест для каждого метода
  let generatedCount = 0;
  for (const method of methods) {
    const testContent = generateTestForMethod(method, fullConfig);
    const testFileName = generateTestFileName(method);
    const testFilePath = path.join(fullConfig.outputDir, testFileName);
    
    fs.writeFileSync(testFilePath, testContent);
    console.log(`  → ${testFileName}`);
    generatedCount++;
  }
  
  console.log(`\n✨ Генерация завершена! Создано тестов: ${generatedCount}`);
  console.log(`📁 Путь: ${fullConfig.outputDir}`);
}

/**
 * Извлекает информацию о методах из файла
 */
function extractMethodsFromFile(content: string): ExtractedMethod[] {
  const methods: ExtractedMethod[] = [];
  
  // Регулярка для поиска JSDoc + функции
  const methodRegex = /\/\*\*[\s\S]*?\*\/\s*export\s+async\s+function\s+(\w+)\s*\((.*?)\)\s*:\s*Promise<(.+?)>\s*{/g;
  
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const methodName = match[1];
    const params = match[2];
    const returnType = match[3];
    
    // Извлекаем информацию из JSDoc
    const jsdocMatch = fullMatch.match(/\/\*\*([\s\S]*?)\*\//);
    const jsdoc = jsdocMatch ? jsdocMatch[1] : '';
    
    // Извлекаем @tags
    const tagsMatch = jsdoc.match(/@tags\s+(.+)/);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
    
    // Извлекаем @request (метод и путь)
    const requestMatch = jsdoc.match(/@request\s+(\w+):(.+)/);
    const httpMethod = requestMatch ? requestMatch[1].trim() : 'GET';
    const apiPath = requestMatch ? requestMatch[2].trim() : '';
    
    // Проверяем есть ли @secure
    const hasAuth = jsdoc.includes('@secure');
    
    // Парсим параметры
    const parameters = params
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        const colonIndex = p.indexOf(':');
        return colonIndex > 0 ? p.substring(0, colonIndex).trim() : p;
      });
    
    methods.push({
      name: methodName,
      httpMethod,
      path: apiPath,
      parameters,
      returnType,
      tags,
      hasAuth
    });
  }
  
  return methods;
}

/**
 * Генерирует имя файла теста
 */
function generateTestFileName(method: ExtractedMethod): string {
  // Используем имя функции как базу для имени файла
  return `${method.name}.spec.ts`;
}

/**
 * Генерирует содержимое теста для метода
 */
function generateTestForMethod(method: ExtractedMethod, config: Required<ApiTestConfig>): string {
  const lines: string[] = [];
  
  // Импорты
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push("import axios from 'axios';");
  lines.push('');
  
  // Вспомогательные классы и константы
  lines.push('// Коды статусов');
  lines.push('const apiErrorCodes = {');
  lines.push('  success: 200,');
  lines.push('  created: 201,');
  lines.push('  badRequest: 400,');
  lines.push('  unauthorized: 401,');
  lines.push('  forbidden: 403,');
  lines.push('  notFound: 404,');
  lines.push('  methodNotAllowed: 405,');
  lines.push('  unsupportedMediaType: 415,');
  lines.push('  unprocessableEntity: 422,');
  lines.push('};');
  lines.push('');
  
  // Эндпоинт и метод
  lines.push(`const endpoint = '${method.path}';`);
  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');
  
  // Коды для удобства
  lines.push('const unauthorized = apiErrorCodes.unauthorized;');
  lines.push('const badRequest = apiErrorCodes.badRequest;');
  lines.push('const forbidden = apiErrorCodes.forbidden;');
  lines.push('const notFound = apiErrorCodes.notFound;');
  lines.push('const methodNotAllowed = apiErrorCodes.methodNotAllowed;');
  lines.push('const unsupportedMediaType = apiErrorCodes.unsupportedMediaType;');
  lines.push(`const success = ${getSuccessCode(method)};`);
  lines.push('');
  
  // Headers конфигурации
  lines.push('// Конфигурация headers');
  lines.push('const configHeaders = {');
  lines.push('  headers: {');
  lines.push("    'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,");
  lines.push("    'Content-Type': 'application/json',");
  lines.push('  }');
  lines.push('};');
  lines.push('');
  lines.push('const configHeadersNoRights = {');
  lines.push('  headers: {');
  lines.push("    'Authorization': 'Bearer restricted_token_here', // TODO: заменить на токен без прав");
  lines.push("    'Content-Type': 'application/json',");
  lines.push('  }');
  lines.push('};');
  lines.push('');
  
  // CaseInfo
  lines.push('// Информация о тест-кейсе');
  lines.push('const caseInfoObj = {');
  lines.push(`  testCase: 'T${Math.floor(Math.random() * 10000)}',`);
  lines.push("  aqaOwner: 'AutoGenerated',");
  lines.push(`  tms_testName: '${method.httpMethod} ${method.path}',`);
  lines.push("  testType: 'api'");
  lines.push('};');
  lines.push('');
  
  // Комментарий с проверками
  lines.push('/**');
  lines.push(' * Проверки:');
  lines.push(' * - Без токена (401)');
  if (hasBodyParam(method)) {
    lines.push(' * - С токеном но без Body (400)');
    lines.push(' * - Без указания обязательных полей (400)');
  }
  lines.push(' * - Проверка methodNotAllowed для неподдерживаемых HTTP методов');
  if (method.hasAuth) {
    lines.push(' * - С токеном пользователя без прав (403)');
  }
  lines.push(' * - С неверными заголовками Content-Type (415)');
  if (hasPathParams(method)) {
    lines.push(' * - С несуществующим ID (404)');
  }
  lines.push(' * ');
  lines.push(' * Дополнительные проверки:');
  lines.push(' * - Проверка структуры ответа');
  lines.push(' * - Проверка всех полей response');
  lines.push(' */');
  lines.push('');
  
  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API тесты для эндпоинта \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');
  
  // Вспомогательная функция для построения URL
  const urlBuilder = generateUrlBuilder(method);
  lines.push(urlBuilder);
  lines.push('');
  
  // Тест 1: Без токена (401)
  if (config.generateNegativeTests) {
    lines.push(`  test(\`\${httpMethod} без TOKEN (\${unauthorized}) @api\`, async ({ page }, testInfo) => {`);
    const axiosCall = generateAxiosCall(method, false, false);
    lines.push(`    await ${axiosCall}.catch(async function(error) {`);
    lines.push('      await expect(error.response.status).toBe(unauthorized);');
    lines.push('      await expect(error.response.statusText).toBe("Unauthorized");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
    lines.push('      await expect(error.config.url).toContain(endpoint);');
    lines.push('    });');
    lines.push('  });');
    lines.push('');
    
    // Тест 2: С токеном но без body (если есть body параметр)
    if (hasBodyParam(method)) {
      lines.push(`  test(\`\${httpMethod} с токеном без Body (\${badRequest}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoBody = generateAxiosCall(method, true, false);
      lines.push(`    await ${axiosCallNoBody}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(badRequest);');
      lines.push('      await expect(error.response.statusText).toBe("Bad Request");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
      lines.push('      await expect(error.config.url).toContain(endpoint);');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 3-5: Method Not Allowed для других HTTP методов
    const otherMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter(m => m !== method.httpMethod);
    for (const otherMethod of otherMethods.slice(0, 3)) {
      lines.push(`  test(\`${otherMethod} с токеном (\${methodNotAllowed}) @api\`, async ({ page }, testInfo) => {`);
      const wrongMethodCall = generateAxiosCallWrongMethod(method, otherMethod);
      lines.push(`    await ${wrongMethodCall}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(methodNotAllowed);');
      lines.push('      await expect(error.response.statusText).toBe("Method Not Allowed");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${otherMethod.toLowerCase()}');`);
      lines.push('      await expect(error.config.url).toContain(endpoint);');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 6: С пользователем без прав (403)
    if (method.hasAuth) {
      lines.push(`  test(\`\${httpMethod} с пользователем без прав (\${forbidden}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoRights = generateAxiosCall(method, true, true, 'configHeadersNoRights');
      lines.push(`    await ${axiosCallNoRights}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(forbidden);');
      lines.push('      await expect(error.response.statusText).toBe("Forbidden");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
      lines.push('      await expect(error.config.url).toContain(endpoint);');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 7: С неверным Content-Type (415)
    if (hasBodyParam(method)) {
      lines.push(`  test(\`\${httpMethod} с неверным Content-Type (\${unsupportedMediaType}) @api\`, async ({ page }, testInfo) => {`);
      lines.push('    const wrongHeaders = {');
      lines.push('      headers: {');
      lines.push("        'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,");
      lines.push("        'Content-Type': 'application/xml',");
      lines.push('      }');
      lines.push('    };');
      const axiosCallWrongType = generateAxiosCall(method, true, true, 'wrongHeaders');
      lines.push(`    await ${axiosCallWrongType}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(unsupportedMediaType);');
      lines.push('      await expect(error.response.statusText).toContain("Unsupported Media Type");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 8: 404 для несуществующего ресурса
    if (hasPathParams(method)) {
      lines.push(`  test(\`\${httpMethod} с несуществующим ID (\${notFound}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCall404 = generateAxiosCall(method, true, true, 'configHeaders', true);
      lines.push(`    await ${axiosCall404}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(notFound);');
      lines.push('      await expect(error.response.statusText).toBe("Not Found");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
  }
  
  // Позитивный тест
  if (config.generatePositiveTests) {
    lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api\`, async ({ page }, testInfo) => {`);
    lines.push('    // TODO: Подготовить валидные тестовые данные');
    const axiosCallSuccess = generateAxiosCall(method, true, true);
    lines.push(`    const response = await ${axiosCallSuccess};`);
    lines.push('');
    lines.push('    // Проверки статуса');
    lines.push('    await expect(response.status).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('');
    lines.push('    // TODO: Добавить проверки структуры response');
    lines.push('    // TODO: Добавить проверки обязательных полей');
    lines.push('    // TODO: Добавить проверки типов данных');
    lines.push('  });');
    lines.push('');
  }
  
  lines.push('});');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Определяет код успеха для метода
 */
function getSuccessCode(method: ExtractedMethod): string {
  if (method.httpMethod === 'POST') {
    return 'apiErrorCodes.created';
  }
  return 'apiErrorCodes.success';
}

/**
 * Проверяет есть ли body параметр
 */
function hasBodyParam(method: ExtractedMethod): boolean {
  return method.parameters.some(p => p === 'body' || p === 'data') ||
         ['POST', 'PUT', 'PATCH'].includes(method.httpMethod);
}

/**
 * Проверяет есть ли path параметры
 */
function hasPathParams(method: ExtractedMethod): boolean {
  return method.path.includes('{');
}

/**
 * Генерирует функцию для построения URL
 */
function generateUrlBuilder(method: ExtractedMethod): string {
  const lines: string[] = [];
  
  lines.push('  // Функция для построения URL');
  lines.push('  function buildUrl(params: any = {}) {');
  lines.push('    let url = process.env.STAND_URL + endpoint;');
  
  if (hasPathParams(method)) {
    lines.push('    // Подставляем path параметры');
    const pathParams = extractPathParams(method.path);
    for (const param of pathParams) {
      lines.push(`    url = url.replace('{${param}}', params.${param} || '1');`);
    }
  }
  
  lines.push('    return url;');
  lines.push('  }');
  
  return lines.join('\n');
}

/**
 * Извлекает path параметры из пути
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/[{}]/g, ''));
}

/**
 * Генерирует axios вызов
 */
function generateAxiosCall(
  method: ExtractedMethod, 
  withAuth: boolean, 
  withBody: boolean, 
  configVar: string = 'configHeaders',
  use404Id: boolean = false
): string {
  const axiosMethod = method.httpMethod.toLowerCase();
  const pathParams = extractPathParams(method.path);
  
  let params = 'buildUrl(';
  if (pathParams.length > 0) {
    if (use404Id) {
      params += '{ ' + pathParams.map(p => `${p}: 999999999`).join(', ') + ' }';
    } else {
      params += '{ ' + pathParams.map(p => `${p}: 1`).join(', ') + ' }';
    }
  }
  params += ')';
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    if (withAuth) {
      return `axios.${axiosMethod}(${params}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${params})`;
    }
  } else {
    // POST, PUT, PATCH
    const body = withBody ? '{ /* TODO: заполнить тестовыми данными */ }' : '{}';
    if (withAuth) {
      return `axios.${axiosMethod}(${params}, ${body}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${params}, ${body})`;
    }
  }
}

/**
 * Генерирует axios вызов с неправильным методом
 */
function generateAxiosCallWrongMethod(method: ExtractedMethod, wrongMethod: string): string {
  const axiosMethod = wrongMethod.toLowerCase();
  const pathParams = extractPathParams(method.path);
  
  let params = 'buildUrl(';
  if (pathParams.length > 0) {
    params += '{ ' + pathParams.map(p => `${p}: 1`).join(', ') + ' }';
  }
  params += ')';
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    return `axios.${axiosMethod}(${params}, configHeaders)`;
  } else {
    return `axios.${axiosMethod}(${params}, {}, configHeaders)`;
  }
}

/**
 * Генерирует моковые параметры для вызова метода
 */
function generateMockParameters(method: ExtractedMethod): string {
  if (method.parameters.length === 0) {
    return '';
  }
  
  return method.parameters.map(param => {
    // Определяем тип параметра по имени
    if (param === 'body' || param === 'data') {
      return '{ /* TODO: заполнить тестовыми данными */ }';
    } else if (param.toLowerCase().includes('id')) {
      return '1';
    } else if (param.toLowerCase().includes('name')) {
      return "'test'";
    } else if (param.toLowerCase().includes('status')) {
      return "'active'";
    } else {
      return `'${param}_value'`;
    }
  }).join(', ');
}

/**
 * Генерирует невалидные параметры
 */
function generateInvalidParameters(method: ExtractedMethod): string {
  if (method.parameters.length === 0) {
    return '';
  }
  
  return method.parameters.map(param => {
    if (param === 'body' || param === 'data') {
      return '{}'; // Пустой объект
    } else if (param.toLowerCase().includes('id')) {
      return '-1'; // Невалидный ID
    } else {
      return "''"; // Пустая строка
    }
  }).join(', ');
}

/**
 * Генерирует параметры для 404 ошибки
 */
function generateNotFoundParameters(method: ExtractedMethod): string {
  if (method.parameters.length === 0) {
    return '';
  }
  
  return method.parameters.map(param => {
    if (param.toLowerCase().includes('id')) {
      return '999999999'; // Несуществующий ID
    } else if (param === 'body' || param === 'data') {
      return '{ /* данные */ }';
    } else {
      return `'${param}_value'`;
    }
  }).join(', ');
}

/**
 * Вычисляет относительный путь для импорта
 */
function getRelativeImportPath(apiFilePath: string, outputDir: string, filename?: string): string {
  const apiDir = path.dirname(apiFilePath);
  const apiFileName = path.basename(apiFilePath, '.ts');
  
  const relativePath = path.relative(outputDir, apiDir);
  const importPath = path.join(relativePath, filename || apiFileName).replace(/\\/g, '/');
  
  return importPath.startsWith('.') ? importPath : './' + importPath;
}
