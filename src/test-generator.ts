/**
 * Генератор API тестов из сгенерированных API методов
 */

import * as fs from 'fs';
import * as path from 'path';

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
   * Путь к baseTest фикстуре (например, ../../../fixtures/baseTest)
   */
  baseTestPath?: string;
  
  /**
   * Путь к axiosHelpers (например, ../../../helpers/axiosHelpers)
   */
  axiosHelpersPath?: string;
  
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
  
  /**
   * Генерировать pairwise тесты (комбинаторное покрытие)
   * @default false
   */
  generatePairwiseTests?: boolean;
}

interface ExtractedMethod {
  name: string;
  httpMethod: string;
  path: string;
  parameters: string[];
  returnType: string;
  tags: string[];
  hasAuth: boolean;
  bodySchema?: DTOSchema; // Схема body параметра
}

interface DTOSchema {
  name: string;
  fields: DTOField[];
}

interface DTOField {
  name: string;
  type: string;
  required: boolean;
  isArray: boolean;
  enumValues?: string[]; // Если поле - enum
}

/**
 * Генерирует API тесты из файла с методами
 */
export async function generateApiTests(config: ApiTestConfig): Promise<void> {
  const fullConfig = {
    generateNegativeTests: true,
    generatePositiveTests: true,
    generatePairwiseTests: false,
    baseTestPath: '../../../fixtures/baseTest',
    axiosHelpersPath: '../../../helpers/axiosHelpers',
    ...config
  };
  
  console.log('🧪 Начинаю генерацию API тестов...');
  
  // Читаем файл с API методами
  const apiFileContent = fs.readFileSync(fullConfig.apiFilePath, 'utf-8');
  
  // Извлекаем информацию о методах
  const methods = extractMethodsFromFile(apiFileContent);
  
  console.log(`✓ Найдено методов: ${methods.length}`);
  
  // Проверяем что у всех методов есть path
  const methodsWithoutPath = methods.filter(m => !m.path || m.path.trim() === '');
  if (methodsWithoutPath.length > 0) {
    console.warn('⚠️  Предупреждение: Найдены методы без endpoint:');
    methodsWithoutPath.forEach(m => console.warn(`   - ${m.name}`));
  }
  
  // Создаем выходную папку если не существует
  if (!fs.existsSync(fullConfig.outputDir)) {
    fs.mkdirSync(fullConfig.outputDir, { recursive: true });
  }
  
  // Генерируем тест для каждого метода
  let generatedCount = 0;
  for (const method of methods) {
    if (!method.path || method.path.trim() === '') {
      console.warn(`⚠️  Пропускаю ${method.name} - endpoint не найден`);
      continue;
    }
    
    const testContent = generateTestForMethod(method, fullConfig as Required<ApiTestConfig>);
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
  
  // Сначала извлекаем все DTO из файла
  const dtoSchemas = extractDTOSchemas(content);
  
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
    
    // Находим body параметр и его тип
    let bodySchema: DTOSchema | undefined;
    if (params.includes('body:') || params.includes('data:')) {
      const bodyMatch = params.match(/(?:body|data):\s*(\w+)/);
      if (bodyMatch) {
        const bodyTypeName = bodyMatch[1];
        bodySchema = dtoSchemas.find(dto => dto.name === bodyTypeName);
      }
    }
    
    methods.push({
      name: methodName,
      httpMethod,
      path: apiPath,
      parameters,
      returnType,
      tags,
      hasAuth,
      bodySchema
    });
  }
  
  return methods;
}

/**
 * Извлекает DTO схемы из файла
 */
function extractDTOSchemas(content: string): DTOSchema[] {
  const schemas: DTOSchema[] = [];
  
  // Регулярка для поиска интерфейсов
  const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]+)}/g;
  
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const interfaceName = match[1];
    const interfaceBody = match[2];
    
    const fields = extractFieldsFromInterface(interfaceBody);
    
    schemas.push({
      name: interfaceName,
      fields
    });
  }
  
  return schemas;
}

/**
 * Извлекает поля из интерфейса
 */
function extractFieldsFromInterface(interfaceBody: string): DTOField[] {
  const fields: DTOField[] = [];
  
  // Разбиваем на строки и парсим каждое поле
  const lines = interfaceBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Пропускаем комментарии
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }
    
    // Парсим поле: name?: type;
    const fieldMatch = line.match(/^['"]?(\w+)['"]?\??:\s*(.+?);?$/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].trim();
      const required = !line.includes('?:');
      const isArray = fieldType.includes('[]');
      
      // Проверяем на enum
      let enumValues: string[] | undefined;
      const enumMatch = fieldType.match(/['"]([^'"]+)['"](?:\s*\|\s*['"]([^'"]+)['"])+/);
      if (enumMatch) {
        enumValues = fieldType.match(/['"]([^'"]+)['"]/g)?.map(v => v.replace(/['"]/g, ''));
      }
      
      fields.push({
        name: fieldName,
        type: fieldType.replace('[]', ''),
        required,
        isArray,
        enumValues
      });
    }
  }
  
  return fields;
}

/**
 * Генерирует имя файла теста
 */
function generateTestFileName(method: ExtractedMethod): string {
  return `${method.name}.test.ts`;
}

/**
 * Генерирует содержимое теста для метода
 */
function generateTestForMethod(method: ExtractedMethod, config: Required<ApiTestConfig>): string {
  const lines: string[] = [];
  
  // Импорты
  lines.push(`import test, { expect } from '${config.baseTestPath}';`);
  lines.push("import axios from 'axios';");
  lines.push(`import { configApiHeaderAdmin, configApiHeaderNoRights } from '${config.axiosHelpersPath}';`);
  lines.push('');
  
  // Извлекаем ID параметры из пути
  const pathParams = extractPathParams(method.path);
  const hasIdParams = pathParams.length > 0;
  
  // Если есть ID параметры, объявляем их заранее
  if (hasIdParams) {
    lines.push('// ID параметры для endpoint');
    for (const param of pathParams) {
      lines.push(`const ${param} = 1; // TODO: заменить на актуальный ID`);
    }
    lines.push('');
  }
  
  // Endpoint с подстановкой ID
  let endpointValue = method.path;
  if (hasIdParams) {
    for (const param of pathParams) {
      endpointValue = endpointValue.replace(`{${param}}`, `\${${param}}`);
    }
    lines.push(`const endpoint = \`${endpointValue}\`;`);
  } else {
    lines.push(`const endpoint = '${endpointValue}';`);
  }
  
  lines.push(`const httpMethod = '${method.httpMethod}';`);
  lines.push('');
  
  // Коды статусов
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
  lines.push('};');
  lines.push('');
  
  lines.push('const unauthorized = apiErrorCodes.unauthorized;');
  lines.push('const badRequest = apiErrorCodes.badRequest;');
  lines.push('const forbidden = apiErrorCodes.forbidden;');
  lines.push('const notFound = apiErrorCodes.notFound;');
  lines.push('const methodNotAllowed = apiErrorCodes.methodNotAllowed;');
  lines.push('const unsupportedMediaType = apiErrorCodes.unsupportedMediaType;');
  lines.push(`const success = ${getSuccessCode(method)};`);
  lines.push('');
  
  // Case Info
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
  }
  lines.push(' * - Проверка methodNotAllowed для неподдерживаемых HTTP методов');
  if (method.hasAuth) {
    lines.push(' * - С токеном пользователя без прав (403)');
  }
  lines.push(' * - С неверными заголовками Content-Type (415)');
  if (hasIdParams) {
    lines.push(' * - С несуществующим ID (404)');
  }
  lines.push(' */');
  lines.push('');
  
  // Test suite
  lines.push('test.describe.configure({ mode: "parallel" });');
  lines.push(`test.describe(\`API тесты для эндпоинта \${httpMethod} >> \${endpoint}\`, async () => {`);
  lines.push('');
  
  // Тест 1: Без токена (401)
  if (config.generateNegativeTests) {
    lines.push(`  test(\`\${httpMethod} без TOKEN (\${unauthorized}) @api\`, async ({ page }, testInfo) => {`);
    const axiosCall = generateSimpleAxiosCall(method, false);
    lines.push(`    await ${axiosCall}.catch(async function(error) {`);
    lines.push('      await expect(error.response.status).toBe(unauthorized);');
    lines.push('      await expect(error.response.statusText).toBe("Unauthorized");');
    lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
    lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
    lines.push('      await expect(error.config.url).toContain(endpoint);');
    lines.push('    });');
    lines.push('  });');
    lines.push('');
    
    // Тест 2: С токеном но без body
    if (hasBodyParam(method)) {
      lines.push(`  test(\`\${httpMethod} с токеном без Body (\${badRequest}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoBody = generateSimpleAxiosCall(method, true, true);
      lines.push(`    await ${axiosCallNoBody}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(badRequest);');
      lines.push('      await expect(error.response.statusText).toBe("Bad Request");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${method.httpMethod.toLowerCase()}');`);
      lines.push('    });');
    lines.push('  });');
      lines.push('');
    }
    
    // Тесты 3-5: Method Not Allowed
    const otherMethods = ['GET', 'POST', 'PUT', 'DELETE'].filter(m => m !== method.httpMethod);
    for (const otherMethod of otherMethods.slice(0, 3)) {
      lines.push(`  test(\`${otherMethod} с токеном (\${methodNotAllowed}) @api\`, async ({ page }, testInfo) => {`);
      const wrongMethodCall = generateWrongMethodCall(otherMethod);
      lines.push(`    await ${wrongMethodCall}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(methodNotAllowed);');
      lines.push('      await expect(error.response.statusText).toBe("Method Not Allowed");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
      lines.push(`      await expect(error.config.method).toBe('${otherMethod.toLowerCase()}');`);
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 6: С пользователем без прав (403)
    if (method.hasAuth) {
      lines.push(`  test(\`\${httpMethod} с пользователем без прав (\${forbidden}) @api\`, async ({ page }, testInfo) => {`);
      const axiosCallNoRights = generateSimpleAxiosCall(method, true, false, 'configApiHeaderNoRights');
      lines.push(`    await ${axiosCallNoRights}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(forbidden);');
      lines.push('      await expect(error.response.statusText).toBe("Forbidden");');
      lines.push('      await expect(error.code).toBe("ERR_BAD_REQUEST");');
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
      const axiosCallWrongType = generateSimpleAxiosCall(method, true, false, 'wrongHeaders');
      lines.push(`    await ${axiosCallWrongType}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(unsupportedMediaType);');
      lines.push('      await expect(error.response.statusText).toContain("Unsupported Media Type");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
    
    // Тест 8: 404 для несуществующего ресурса
    if (hasIdParams) {
      lines.push(`  test(\`\${httpMethod} с несуществующим ID (\${notFound}) @api\`, async ({ page }, testInfo) => {`);
      // Переопределяем ID на несуществующий
      for (const param of pathParams) {
        lines.push(`    const ${param}NotFound = 999999999;`);
      }
      const notFoundEndpoint = method.path;
      let endpointWith404 = notFoundEndpoint;
      for (const param of pathParams) {
        endpointWith404 = endpointWith404.replace(`{${param}}`, `\${${param}NotFound}`);
      }
      lines.push(`    const endpoint404 = \`${endpointWith404}\`;`);
      
      const axiosCall404 = generateSimpleAxiosCall(method, true, false, 'configApiHeaderAdmin', 'endpoint404');
      lines.push(`    await ${axiosCall404}.catch(async function(error) {`);
      lines.push('      await expect(error.response.status).toBe(notFound);');
      lines.push('      await expect(error.response.statusText).toBe("Not Found");');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }
  }
  
  // Позитивные тесты
  if (config.generatePositiveTests && method.bodySchema) {
    lines.push('');
    lines.push('  // ============================================');
    lines.push('  // ПОЗИТИВНЫЕ ТЕСТЫ');
    lines.push('  // ============================================');
    lines.push('');
    
    // Генерируем тестовые данные
    const testDataSection = generateTestDataSection(method.bodySchema);
    lines.push(testDataSection);
    lines.push('');
    
    // Тест 1: Только обязательные поля
    lines.push(`  test(\`\${httpMethod} с обязательными полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
    lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, requiredFieldsOnly, configApiHeaderAdmin);');
    lines.push('');
    lines.push('    await expect(response.status).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('    // TODO: Добавить проверки обязательных полей в response');
    lines.push('  });');
    lines.push('');
    
    // Тест 2: Все поля
    lines.push(`  test(\`\${httpMethod} со всеми полями (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
    lines.push('    const response = await axios.' + method.httpMethod.toLowerCase() + '(process.env.StandURL + endpoint, allFieldsFilled, configApiHeaderAdmin);');
    lines.push('');
    lines.push('    await expect(response.status).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('    // TODO: Добавить проверки всех полей в response');
    lines.push('  });');
    lines.push('');
  } else if (config.generatePositiveTests && !hasBodyParam(method)) {
    // Для GET/DELETE без body
    lines.push('');
    lines.push('  // ============================================');
    lines.push('  // ПОЗИТИВНЫЕ ТЕСТЫ');
    lines.push('  // ============================================');
    lines.push('');
    
    lines.push(`  test(\`\${httpMethod} успешный запрос (\${success}) @api @positive\`, async ({ page }, testInfo) => {`);
    const axiosCallSuccess = generateSimpleAxiosCall(method, true);
    lines.push(`    const response = await ${axiosCallSuccess};`);
    lines.push('');
    lines.push('    await expect(response.status).toBe(success);');
    lines.push('    await expect(response.data).toBeDefined();');
    lines.push('  });');
    lines.push('');
  }
  
  // Pairwise тесты
  if (config.generatePairwiseTests && method.bodySchema) {
    lines.push('');
    lines.push('  // ============================================');
    lines.push('  // PAIRWISE ТЕСТЫ');
    lines.push('  // ============================================');
    lines.push('');
    
    // Генерируем pairwise тестовые данные
    const pairwiseDataSection = generatePairwiseTestDataSection(method.bodySchema);
    lines.push(pairwiseDataSection);
    lines.push('');
    
    // Тип 1: Комбинации необязательных полей
    const optionalFields = method.bodySchema.fields.filter(f => !f.required);
    if (optionalFields.length > 0) {
      lines.push('  // Тип 1: Комбинации необязательных полей');
      lines.push('');
      
      const combinations = generateOptionalFieldsCombinations(optionalFields);
      combinations.forEach((combo, index) => {
        lines.push(`  test(\`\${httpMethod} pairwise комбинация ${index + 1} (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
        lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseCombo${index + 1}, configApiHeaderAdmin);`);
        lines.push('');
        lines.push('    await expect(response.status).toBe(success);');
        lines.push('    await expect(response.data).toBeDefined();');
        lines.push('  });');
        lines.push('');
      });
    }
    
    // Тип 2: Различные значения enum полей
    const enumFields = method.bodySchema.fields.filter(f => f.enumValues && f.enumValues.length > 0);
    if (enumFields.length > 0) {
      lines.push('  // Тип 2: Различные значения enum полей');
      lines.push('');
      
      enumFields.forEach(field => {
        field.enumValues?.forEach((enumValue, index) => {
          lines.push(`  test(\`\${httpMethod} с ${field.name}='${enumValue}' (\${success}) @api @pairwise\`, async ({ page }, testInfo) => {`);
          lines.push(`    const response = await axios.${method.httpMethod.toLowerCase()}(process.env.StandURL + endpoint, pairwiseEnum_${field.name}_${index + 1}, configApiHeaderAdmin);`);
          lines.push('');
          lines.push('    await expect(response.status).toBe(success);');
          lines.push('    await expect(response.data).toBeDefined();');
          lines.push('  });');
          lines.push('');
        });
      });
    }
  }
  
  lines.push('});');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Генерирует простой axios вызов с использованием process.env.StandURL
 */
function generateSimpleAxiosCall(
  method: ExtractedMethod,
  withAuth: boolean,
  emptyBody: boolean = false,
  configVar: string = 'configApiHeaderAdmin',
  endpointVar: string = 'endpoint'
): string {
  const axiosMethod = method.httpMethod.toLowerCase();
  const url = `process.env.StandURL + ${endpointVar}`;
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    if (withAuth) {
      return `axios.${axiosMethod}(${url}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${url})`;
    }
  } else {
    // POST, PUT, PATCH
    const body = emptyBody ? '{}' : '{ /* TODO: заполнить тестовыми данными */ }';
    if (withAuth) {
      return `axios.${axiosMethod}(${url}, ${body}, ${configVar})`;
    } else {
      return `axios.${axiosMethod}(${url}, ${body})`;
    }
  }
}

/**
 * Генерирует вызов с неправильным HTTP методом
 */
function generateWrongMethodCall(wrongMethod: string): string {
  const axiosMethod = wrongMethod.toLowerCase();
  const url = 'process.env.StandURL + endpoint';
  
  if (axiosMethod === 'get' || axiosMethod === 'delete') {
    return `axios.${axiosMethod}(${url}, configApiHeaderAdmin)`;
  } else {
    return `axios.${axiosMethod}(${url}, {}, configApiHeaderAdmin)`;
  }
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
 * Генерирует секцию с тестовыми данными
 */
function generateTestDataSection(schema: DTOSchema): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для позитивных тестов');
  lines.push('');
  
  // Только обязательные поля
  lines.push('  // Объект с только обязательными полями');
  lines.push('  const requiredFieldsOnly = {');
  const requiredFields = schema.fields.filter(f => f.required);
  requiredFields.forEach((field, index) => {
    const value = generateMockValue(field);
    const comma = index < requiredFields.length - 1 ? ',' : '';
    lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
  });
  lines.push('  };');
  lines.push('');
  
  // Все поля
  lines.push('  // Объект со всеми полями');
  lines.push('  const allFieldsFilled = {');
  schema.fields.forEach((field, index) => {
    const value = generateMockValue(field);
    const comma = index < schema.fields.length - 1 ? ',' : '';
    lines.push(`    ${field.name}: ${value}${comma} // TODO: заменить на актуальные данные`);
  });
  lines.push('  };');
  
  return lines.join('\n');
}

/**
 * Генерирует секцию с pairwise тестовыми данными
 */
function generatePairwiseTestDataSection(schema: DTOSchema): string {
  const lines: string[] = [];
  
  lines.push('  // Тестовые данные для pairwise тестов');
  lines.push('');
  
  const requiredFields = schema.fields.filter(f => f.required);
  const optionalFields = schema.fields.filter(f => !f.required);
  const enumFields = schema.fields.filter(f => f.enumValues && f.enumValues.length > 0);
  
  // Комбинации необязательных полей
  if (optionalFields.length > 0) {
    const combinations = generateOptionalFieldsCombinations(optionalFields);
    
    combinations.forEach((combo, index) => {
      lines.push(`  // Комбинация ${index + 1}: обязательные поля + ${combo.map(f => f.name).join(', ')}`);
      lines.push(`  const pairwiseCombo${index + 1} = {`);
      
      // Обязательные поля
      requiredFields.forEach(field => {
        const value = generateMockValue(field);
        lines.push(`    ${field.name}: ${value},`);
      });
      
      // Выбранные необязательные поля
      combo.forEach((field, fieldIndex) => {
        const value = generateMockValue(field);
        const comma = fieldIndex < combo.length - 1 ? ',' : '';
        lines.push(`    ${field.name}: ${value}${comma}`);
      });
      
      lines.push('  };');
      lines.push('');
    });
  }
  
  // Различные значения enum полей
  if (enumFields.length > 0) {
    enumFields.forEach(field => {
      field.enumValues?.forEach((enumValue, index) => {
        lines.push(`  // Тест с ${field.name} = '${enumValue}'`);
        lines.push(`  const pairwiseEnum_${field.name}_${index + 1} = {`);
        
        // Обязательные поля
        requiredFields.forEach(reqField => {
          const value = generateMockValue(reqField);
          lines.push(`    ${reqField.name}: ${value},`);
        });
        
        // Enum поле с конкретным значением
        lines.push(`    ${field.name}: '${enumValue}'`);
        
        lines.push('  };');
        lines.push('');
      });
    });
  }
  
  return lines.join('\n');
}

/**
 * Генерирует моковое значение для поля
 */
function generateMockValue(field: DTOField): string {
  // Если есть enum значения
  if (field.enumValues && field.enumValues.length > 0) {
    return `'${field.enumValues[0]}'`;
  }
  
  // Определяем тип
  const type = field.type.toLowerCase();
  
  if (type.includes('string')) {
    if (field.name.toLowerCase().includes('email')) {
      return field.isArray ? "['test@example.com']" : "'test@example.com'";
    }
    if (field.name.toLowerCase().includes('name')) {
      return field.isArray ? "['Test Name']" : "'Test Name'";
    }
    if (field.name.toLowerCase().includes('url')) {
      return field.isArray ? "['https://example.com']" : "'https://example.com'";
    }
    return field.isArray ? "['test']" : "'test'";
  }
  
  if (type.includes('number') || type.includes('integer')) {
    if (field.name.toLowerCase().includes('id')) {
      return field.isArray ? '[1]' : '1';
    }
    return field.isArray ? '[100]' : '100';
  }
  
  if (type.includes('boolean') || type.includes('bool')) {
    return field.isArray ? '[true]' : 'true';
  }
  
  if (type.includes('date')) {
    return field.isArray ? "['2024-01-01']" : "'2024-01-01'";
  }
  
  // По умолчанию
  return field.isArray ? '[]' : 'null';
}

/**
 * Генерирует комбинации необязательных полей для pairwise тестов
 */
function generateOptionalFieldsCombinations(optionalFields: DTOField[]): DTOField[][] {
  const combinations: DTOField[][] = [];
  const maxCombinations = Math.min(10, optionalFields.length + 1);
  
  // Комбинация 1: без необязательных полей (уже есть в requiredFieldsOnly)
  // Комбинация 2: с одним необязательным полем
  if (optionalFields.length > 0) {
    combinations.push([optionalFields[0]]);
  }
  
  // Комбинация 3: с двумя необязательными полями
  if (optionalFields.length > 1) {
    combinations.push([optionalFields[0], optionalFields[1]]);
  }
  
  // Комбинация 4: с тремя необязательными полями
  if (optionalFields.length > 2) {
    combinations.push([optionalFields[0], optionalFields[1], optionalFields[2]]);
  }
  
  // Комбинация 5: с половиной необязательных полей
  if (optionalFields.length > 3) {
    const halfCount = Math.floor(optionalFields.length / 2);
    combinations.push(optionalFields.slice(0, halfCount));
  }
  
  // Комбинация 6: со всеми необязательными полями (кроме одного)
  if (optionalFields.length > 4) {
    combinations.push(optionalFields.slice(0, -1));
  }
  
  // Дополнительные комбинации если полей много
  if (optionalFields.length > 5) {
    // Каждое второе поле
    const everySecond = optionalFields.filter((_, index) => index % 2 === 0);
    combinations.push(everySecond);
  }
  
  if (optionalFields.length > 7) {
    // Каждое третье поле
    const everyThird = optionalFields.filter((_, index) => index % 3 === 0);
    combinations.push(everyThird);
  }
  
  return combinations.slice(0, maxCombinations);
}
