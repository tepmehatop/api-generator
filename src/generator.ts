import { ParsedSpec, PathItem, Schema, Tag } from './parser';
import { GeneratorConfig } from './index';
import { transliterate } from './utils/transliterate';
import { capitalize, toCamelCase, toPascalCase, isValidIdentifier } from './utils/string-helpers';

interface GeneratedFile {
  filename: string;
  content: string;
}

/**
 * Генератор TypeScript кода из распарсенной OpenAPI спецификации
 */
export class CodeGenerator {
  private config: GeneratorConfig;
  private spec: ParsedSpec;
  private usedSchemas: Set<string> = new Set();
  private baseSchemas: Set<string> = new Set();
  
  constructor(config: GeneratorConfig, spec: ParsedSpec) {
    this.config = config;
    this.spec = spec;
    this.identifyBaseSchemas();
  }
  
  /**
   * Определяет базовые схемы, используемые в нескольких тегах
   */
  private identifyBaseSchemas(): void {
    const schemaUsage = new Map<string, Set<string>>();
    
    // Подсчитываем использование схем по тегам
    for (const path of this.spec.paths) {
      const schemas = this.extractSchemasFromPath(path);
      
      for (const schema of schemas) {
        if (!schemaUsage.has(schema)) {
          schemaUsage.set(schema, new Set());
        }
        
        for (const tag of path.tags) {
          schemaUsage.get(schema)!.add(tag);
        }
      }
    }
    
    // Схемы, используемые в 2+ тегах = базовые
    for (const [schema, tags] of schemaUsage.entries()) {
      if (tags.size >= 2) {
        this.baseSchemas.add(schema);
      }
    }
  }
  
  /**
   * Проверяет есть ли security в операции
   */
  private hasSecurityInSpec(operation: PathItem): boolean {
    // Проверяем в оригинальной спецификации
    const originalPath = this.spec.paths.find(p => p.operationId === operation.operationId);
    if (!originalPath) return false;
    
    // В swagger 2.0 и OpenAPI 3.x security может быть массивом
    return !!(originalPath as any).security || false;
  }
  
  /**
   * Извлекает имена схем из операции
   */
  private extractSchemasFromPath(path: PathItem): Set<string> {
    const schemas = new Set<string>();
    
    const collectSchemas = (schema: Schema) => {
      if (schema.ref) {
        schemas.add(schema.ref);
      }
      if (schema.items) {
        collectSchemas(schema.items);
      }
      if (schema.properties) {
        for (const prop of Object.values(schema.properties)) {
          collectSchemas(prop);
        }
      }
      if (schema.schemas) {
        for (const s of schema.schemas) {
          collectSchemas(s);
        }
      }
    };
    
    // Параметры
    for (const param of path.parameters) {
      collectSchemas(param.schema);
    }
    
    // Request body
    if (path.requestBody) {
      for (const media of Object.values(path.requestBody.content)) {
        collectSchemas(media.schema);
      }
    }
    
    // Responses
    for (const response of Object.values(path.responses)) {
      if (response.schema) {
        collectSchemas(response.schema);
      }
    }
    
    return schemas;
  }
  
  /**
   * Генерирует все файлы
   */
  generate(): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    
    // Группируем операции по тегам
    const operationsByTag = this.groupOperationsByTag();
    
    // Генерируем файл с базовыми типами
    if (this.baseSchemas.size > 0) {
      files.push(this.generateBaseTypesFile());
    }
    
    // Генерируем файл для каждого тега
    for (const [tag, operations] of operationsByTag.entries()) {
      files.push(this.generateTagFile(tag, operations));
    }
    
    // Генерируем index файл (barrel export для всех API)
    files.push(this.generateIndexFile(Array.from(operationsByTag.keys())));
    
    // Генерируем HTTP client helper
    files.push(this.generateHttpClientFile());
    
    // ВАЖНО: Анализируем и добавляем недостающие импорты
    this.fixMissingImports(files);
    
    return files;
  }
  
  /**
   * Анализирует файлы и автоматически добавляет недостающие импорты
   */
  private fixMissingImports(files: GeneratedFile[]): void {
    // Создаем карту: какие типы в каких файлах определены
    const typeLocations = new Map<string, string>();
    
    for (const file of files) {
      // Пропускаем служебные файлы
      if (file.filename === 'index.ts' || file.filename === 'http-client.ts') {
        continue;
      }
      
      // Извлекаем все экспортируемые интерфейсы
      const interfaceMatches = file.content.matchAll(/export interface (\w+)/g);
      for (const match of interfaceMatches) {
        const typeName = match[1];
        typeLocations.set(typeName, file.filename);
      }
    }
    
    // Для каждого файла анализируем используемые типы
    for (const file of files) {
      if (file.filename === 'index.ts' || file.filename === 'http-client.ts') {
        continue;
      }
      
      const usedTypes = this.extractUsedTypes(file.content);
      const definedTypes = this.extractDefinedTypes(file.content);
      const existingImports = this.extractExistingImports(file.content);
      
      // Находим типы которые используются но не определены и не импортированы
      const missingTypes = usedTypes.filter(type => 
        !definedTypes.has(type) && 
        !existingImports.has(type) &&
        typeLocations.has(type)
      );
      
      if (missingTypes.length > 0) {
        // Группируем импорты по файлам
        const importsByFile = new Map<string, Set<string>>();
        
        for (const type of missingTypes) {
          const sourceFile = typeLocations.get(type)!;
          if (!importsByFile.has(sourceFile)) {
            importsByFile.set(sourceFile, new Set());
          }
          importsByFile.get(sourceFile)!.add(type);
        }
        
        // Добавляем импорты в начало файла
        file.content = this.addImportsToFile(file.content, file.filename, importsByFile);
      }
    }
  }
  
  /**
   * Извлекает все используемые типы из содержимого файла
   */
  private extractUsedTypes(content: string): string[] {
    const types = new Set<string>();
    
    // Ищем типы в полях интерфейсов: name: TypeName или name?: TypeName
    const fieldMatches = content.matchAll(/:\s*(\w+)(?:\[\])?[;,\s}]/g);
    for (const match of fieldMatches) {
      const typeName = match[1];
      // Пропускаем примитивные типы
      if (!['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined', 'object'].includes(typeName)) {
        types.add(typeName);
      }
    }
    
    // Ищем типы в Promise<Type>
    const promiseMatches = content.matchAll(/Promise<(\w+)(?:\[\])?>/g);
    for (const match of promiseMatches) {
      types.add(match[1]);
    }
    
    return Array.from(types);
  }
  
  /**
   * Извлекает все определенные типы в файле
   */
  private extractDefinedTypes(content: string): Set<string> {
    const types = new Set<string>();
    
    const interfaceMatches = content.matchAll(/export interface (\w+)/g);
    for (const match of interfaceMatches) {
      types.add(match[1]);
    }
    
    return types;
  }
  
  /**
   * Извлекает уже существующие импорты
   */
  private extractExistingImports(content: string): Set<string> {
    const types = new Set<string>();
    
    const importMatches = content.matchAll(/import\s+\{([^}]+)\}\s+from/g);
    for (const match of importMatches) {
      const imports = match[1].split(',').map(s => s.trim());
      for (const imp of imports) {
        types.add(imp);
      }
    }
    
    return types;
  }
  
  /**
   * Добавляет импорты в файл
   */
  private addImportsToFile(
    content: string, 
    currentFile: string,
    importsByFile: Map<string, Set<string>>
  ): string {
    const lines = content.split('\n');
    const importLines: string[] = [];
    
    // Находим где заканчиваются существующие импорты
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    // Генерируем новые импорты
    for (const [sourceFile, types] of importsByFile.entries()) {
      const relativePath = './' + sourceFile.replace('.ts', '');
      const typesList = Array.from(types).sort().join(', ');
      importLines.push(`import { ${typesList} } from '${relativePath}';`);
    }
    
    // Вставляем импорты после существующих
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, ...importLines);
    } else {
      // Если импортов нет, добавляем в начало после первой строки
      lines.splice(1, 0, ...importLines);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Группирует операции по тегам
   */
  private groupOperationsByTag(): Map<string, PathItem[]> {
    const map = new Map<string, PathItem[]>();
    
    for (const path of this.spec.paths) {
      for (const tag of path.tags) {
        if (!map.has(tag)) {
          map.set(tag, []);
        }
        map.get(tag)!.push(path);
      }
    }
    
    return map;
  }
  
  /**
   * Генерирует файл с базовыми типами
   */
  private generateBaseTypesFile(): GeneratedFile {
    const types: string[] = [];
    
    types.push('/**');
    types.push(' * Базовые типы, используемые в нескольких модулях');
    types.push(' * Автоматически сгенерировано из OpenAPI спецификации');
    types.push(' */\n');
    
    // Собираем ВСЕ зависимые схемы для базовых типов рекурсивно
    const allRequiredSchemas = new Set<string>();
    
    // Начинаем с базовых схем
    for (const schemaName of this.baseSchemas) {
      allRequiredSchemas.add(schemaName);
      // Рекурсивно добавляем все зависимости
      this.collectAllDependencies(schemaName, allRequiredSchemas);
    }
    
    // Генерируем все собранные схемы
    for (const schemaName of allRequiredSchemas) {
      const schema = this.spec.schemas[schemaName];
      if (schema) {
        types.push(this.generateTypeDefinition(schemaName, schema));
        types.push('');
      }
    }
    
    return {
      filename: 'base.types.ts',
      content: types.join('\n'),
    };
  }
  
  /**
   * Рекурсивно собирает все зависимости схемы
   */
  private collectAllDependencies(schemaName: string, collected: Set<string>): void {
    const schema = this.spec.schemas[schemaName];
    if (!schema) return;
    
    const deps = this.extractSchemasDependencies(schema);
    
    for (const dep of deps) {
      if (!collected.has(dep)) {
        collected.add(dep);
        // Рекурсивно собираем зависимости этой зависимости
        this.collectAllDependencies(dep, collected);
      }
    }
  }
  
  /**
   * Генерирует файл для конкретного тега
   */
  private generateTagFile(tag: string, operations: PathItem[]): GeneratedFile {
    const filename = this.getTagFilename(tag);
    const imports: string[] = [];
    const types: string[] = [];
    const functions: string[] = [];
    
    // Импорты
    imports.push("import { httpClient } from './http-client';");
    imports.push("import type { AxiosResponse } from 'axios';");
    
    // Определяем какие базовые типы используются
    const usedBaseTypes = new Set<string>();
    for (const op of operations) {
      const schemas = this.extractSchemasFromPath(op);
      for (const schema of schemas) {
        if (this.baseSchemas.has(schema)) {
          usedBaseTypes.add(schema);
        }
      }
    }
    
    if (usedBaseTypes.size > 0) {
      imports.push(`import { ${Array.from(usedBaseTypes).join(', ')} } from './base.types';`);
    }
    
    imports.push('');
    
    // Типы специфичные для этого тега
    types.push('/**');
    types.push(` * Типы для модуля: ${tag}`);
    types.push(' */\n');
    
    const localSchemas = this.getLocalSchemasForTag(operations);
    for (const schemaName of localSchemas) {
      const schema = this.spec.schemas[schemaName];
      if (schema) {
        types.push(this.generateTypeDefinition(schemaName, schema));
        types.push('');
      }
    }
    
    // Генерируем функции или класс
    if (this.config.useClasses) {
      functions.push(this.generateApiClass(tag, operations));
    } else {
      functions.push('/**');
      functions.push(` * API методы для: ${tag}`);
      functions.push(' */\n');
      
      for (const operation of operations) {
        functions.push(this.generateApiFunction(operation));
        functions.push('');
      }
    }
    
    return {
      filename,
      content: [...imports, ...types, ...functions].join('\n'),
    };
  }
  
  /**
   * Генерирует класс API для тега
   */
  private generateApiClass(tag: string, operations: PathItem[]): string {
    // Транслитерируем русские названия
    let className = tag;
    if (this.config.transliterateRussian && /[а-яА-Я]/.test(tag)) {
      className = transliterate(tag);
    }
    
    // Преобразуем в PascalCase и добавляем Api
    className = toPascalCase(className) + 'Api';
    
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(` * API класс для: ${tag}`);
    lines.push(' */');
    lines.push(`export class ${className} {`);
    lines.push('');
    
    // Генерируем методы класса
    for (const operation of operations) {
      lines.push(this.generateClassMethod(operation));
      lines.push('');
    }
    
    lines.push('}');
    lines.push('');
    lines.push(`// Экспортируем синглтон инстанс`);
    
    // Имя инстанса тоже транслитерируем
    let instanceName = tag;
    if (this.config.transliterateRussian && /[а-яА-Я]/.test(tag)) {
      instanceName = transliterate(tag);
    }
    instanceName = toCamelCase(instanceName) + 'Api';
    
    lines.push(`export const ${instanceName} = new ${className}();`);
    
    return lines.join('\n');
  }
  
  /**
   * Генерирует метод класса
   */
  private generateClassMethod(operation: PathItem): string {
    const lines: string[] = [];
    const funcName = toCamelCase(operation.operationId);
    
    // JSDoc
    lines.push('  /**');
    
    if (operation.summary || operation.description) {
      lines.push(`   * ${operation.summary || operation.description || 'No Description'}`);
    } else {
      lines.push('   * No Description');
    }
    
    lines.push('   *');
    
    if (operation.tags && operation.tags.length > 0) {
      lines.push(`   * @tags ${operation.tags.join(', ')}`);
    }
    
    // @name - используем имя функции (camelCase)
    lines.push(`   * @name ${funcName}`);
    lines.push(`   * @request ${operation.method}:${operation.path}`);
    
    const hasAuth = this.spec.paths.some(p => 
      p.operationId === operation.operationId && 
      this.hasSecurityInSpec(p)
    );
    if (hasAuth) {
      lines.push('   * @secure');
    }
    
    for (const [statusCode, response] of Object.entries(operation.responses)) {
      const responseType = response.schema ? this.schemaToTypeScript(response.schema) : 'void';
      const description = response.description || 'Success';
      lines.push(`   * @response '${statusCode}' '${responseType}' ${description}`);
    }
    
    if (operation.deprecated) {
      lines.push('   * @deprecated');
    }
    
    lines.push('   */');
    
    // Сигнатура метода
    const params = this.generateFunctionParameters(operation);
    const returnType = this.generateReturnType(operation);
    
    lines.push(`  async ${funcName}(${params}): Promise<${returnType}> {`);
    
    // Тело метода
    const pathParams = operation.parameters.filter(p => p.in === 'path');
    const queryParams = operation.parameters.filter(p => p.in === 'query');
    const headerParams = operation.parameters.filter(p => p.in === 'header');
    
    let urlTemplate = operation.path;
    for (const param of pathParams) {
      urlTemplate = urlTemplate.replace(`{${param.name}}`, `\${${toCamelCase(param.name)}}`);
    }
    
    lines.push('    const response = await httpClient.request({');
    lines.push(`      method: '${operation.method}',`);
    lines.push(`      url: \`${urlTemplate}\`,`);
    
    if (queryParams.length > 0) {
      lines.push('      params: {');
      for (const param of queryParams) {
        lines.push(`        ${param.name}: ${toCamelCase(param.name)},`);
      }
      lines.push('      },');
    }
    
    if (headerParams.length > 0) {
      lines.push('      headers: {');
      for (const param of headerParams) {
        lines.push(`        '${param.name}': ${toCamelCase(param.name)},`);
      }
      lines.push('      },');
    }
    
    const hasBody = operation.requestBody && operation.method !== 'GET';
    if (hasBody) {
      lines.push('      data: body,');
    }
    
    lines.push('    });');
    lines.push('    return response;');
    lines.push('  }');
    
    return lines.join('\n');
  }
  
  /**
   * Получает локальные схемы для тега (не базовые)
   */
  private getLocalSchemasForTag(operations: PathItem[]): Set<string> {
    const schemas = new Set<string>();
    const collected = new Set<string>();
    
    // Собираем все схемы из операций
    for (const op of operations) {
      const opSchemas = this.extractSchemasFromPath(op);
      for (const schema of opSchemas) {
        if (!this.baseSchemas.has(schema)) {
          schemas.add(schema);
          collected.add(schema);
        }
      }
    }
    
    // Рекурсивно добавляем зависимые схемы
    const toProcess = Array.from(schemas);
    while (toProcess.length > 0) {
      const schemaName = toProcess.pop()!;
      const schema = this.spec.schemas[schemaName];
      
      if (!schema) continue;
      
      const dependencies = this.extractSchemasDependencies(schema);
      for (const dep of dependencies) {
        if (!collected.has(dep) && !this.baseSchemas.has(dep)) {
          schemas.add(dep);
          collected.add(dep);
          toProcess.push(dep);
        }
      }
    }
    
    return schemas;
  }
  
  /**
   * Извлекает зависимости схемы
   */
  private extractSchemasDependencies(schema: Schema): Set<string> {
    const deps = new Set<string>();
    
    if (schema.ref) {
      deps.add(schema.ref);
    }
    
    if (schema.items) {
      const itemDeps = this.extractSchemasDependencies(schema.items);
      for (const dep of itemDeps) {
        deps.add(dep);
      }
    }
    
    if (schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        const propDeps = this.extractSchemasDependencies(prop);
        for (const dep of propDeps) {
          deps.add(dep);
        }
      }
    }
    
    if (schema.schemas) {
      for (const s of schema.schemas) {
        const sDeps = this.extractSchemasDependencies(s);
        for (const dep of sDeps) {
          deps.add(dep);
        }
      }
    }
    
    return deps;
  }
  
  /**
   * Генерирует определение типа из схемы
   */
  private generateTypeDefinition(name: string, schema: Schema): string {
    const lines: string[] = [];
    
    if (schema.description) {
      lines.push('/**');
      lines.push(` * ${schema.description}`);
      lines.push(' */');
    }
    
    lines.push(`export interface ${name} {`);
    
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(propName);
        const tsType = this.schemaToTypeScript(propSchema);
        
        if (propSchema.description) {
          lines.push(`  /** ${propSchema.description} */`);
        }
        
        // Если имя поля содержит @ или другие спецсимволы, оборачиваем в кавычки
        const safePropName = this.sanitizePropertyName(propName);
        
        lines.push(`  ${safePropName}${isRequired ? '' : '?'}: ${tsType};`);
      }
    }
    
    lines.push('}');
    
    return lines.join('\n');
  }
  
  /**
   * Безопасное имя свойства - оборачивает в кавычки если нужно
   */
  private sanitizePropertyName(name: string): string {
    // Если содержит @, -, пробелы или другие спецсимволы, оборачиваем в кавычки
    if (/[@\-\s\.]/.test(name) || !isValidIdentifier(name)) {
      return `'${name}'`;
    }
    return name;
  }
  
  /**
   * Преобразует схему в TypeScript тип
   */
  private schemaToTypeScript(schema: Schema): string {
    if (schema.ref) {
      return schema.ref;
    }
    
    if (schema.type === 'array') {
      const itemType = schema.items ? this.schemaToTypeScript(schema.items) : 'any';
      return `${itemType}[]`;
    }
    
    if (schema.type === 'object') {
      if (schema.properties) {
        // Inline object
        const props = Object.entries(schema.properties).map(([key, val]) => {
          const isRequired = schema.required?.includes(key);
          return `${key}${isRequired ? '' : '?'}: ${this.schemaToTypeScript(val)}`;
        });
        return `{ ${props.join('; ')} }`;
      }
      
      if (schema.additionalProperties) {
        if (typeof schema.additionalProperties === 'object') {
          return `Record<string, ${this.schemaToTypeScript(schema.additionalProperties as Schema)}>`;
        }
        return 'Record<string, any>';
      }
      
      return 'object';
    }
    
    if (schema.enum) {
      return schema.enum.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
    }
    
    if (schema.type === 'composite' && schema.schemas) {
      const operator = schema.compositor === 'allOf' ? ' & ' : ' | ';
      return schema.schemas.map(s => this.schemaToTypeScript(s)).join(operator);
    }
    
    // Примитивные типы
    const typeMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      null: 'null',
      any: 'any',
    };
    
    let tsType = typeMap[schema.type] || 'any';
    
    if (schema.nullable) {
      tsType += ' | null';
    }
    
    return tsType;
  }
  
  /**
   * Генерирует функцию API метода
   */
  private generateApiFunction(operation: PathItem): string {
    const lines: string[] = [];
    const funcName = toCamelCase(operation.operationId);
    
    // JSDoc с подробной информацией
    lines.push('/**');
    
    // Описание
    if (operation.summary || operation.description) {
      lines.push(` * ${operation.summary || operation.description || 'No Description'}`);
    } else {
      lines.push(' * No Description');
    }
    
    lines.push(' *');
    
    // @tags
    if (operation.tags && operation.tags.length > 0) {
      lines.push(` * @tags ${operation.tags.join(', ')}`);
    }
    
    // @name - используем имя функции (camelCase), а не operationId
    lines.push(` * @name ${funcName}`);
    
    // @request
    lines.push(` * @request ${operation.method}:${operation.path}`);
    
    // @secure (если есть security)
    const hasAuth = this.spec.paths.some(p => 
      p.operationId === operation.operationId && 
      this.hasSecurityInSpec(p)
    );
    if (hasAuth) {
      lines.push(' * @secure');
    }
    
    // @response
    for (const [statusCode, response] of Object.entries(operation.responses)) {
      const responseType = response.schema ? this.schemaToTypeScript(response.schema) : 'void';
      const description = response.description || 'Success';
      lines.push(` * @response '${statusCode}' '${responseType}' ${description}`);
    }
    
    if (operation.deprecated) {
      lines.push(' * @deprecated');
    }
    
    lines.push(' */');
    
    // Параметры функции
    const params = this.generateFunctionParameters(operation);
    const returnType = this.generateReturnType(operation);
    
    lines.push(`export async function ${funcName}(${params}): Promise<${returnType}> {`);
    
    // Тело функции
    const pathParams = operation.parameters.filter(p => p.in === 'path');
    const queryParams = operation.parameters.filter(p => p.in === 'query');
    const headerParams = operation.parameters.filter(p => p.in === 'header');
    
    // Формируем URL с подстановкой path параметров
    let urlTemplate = operation.path;
    for (const param of pathParams) {
      urlTemplate = urlTemplate.replace(`{${param.name}}`, `\${${toCamelCase(param.name)}}`);
    }
    
    // HTTP запрос
    if (this.config.httpClient === 'axios') {
      lines.push('  const response = await httpClient.request({');
      lines.push(`    method: '${operation.method}',`);
      lines.push(`    url: \`${urlTemplate}\`,`);
      
      if (queryParams.length > 0) {
        lines.push('    params: {');
        for (const param of queryParams) {
          lines.push(`      ${param.name}: ${toCamelCase(param.name)},`);
        }
        lines.push('    },');
      }
      
      if (headerParams.length > 0) {
        lines.push('    headers: {');
        for (const param of headerParams) {
          lines.push(`      '${param.name}': ${toCamelCase(param.name)},`);
        }
        lines.push('    },');
      }
      
      // Request body
      const hasBody = operation.requestBody && operation.method !== 'GET';
      if (hasBody) {
        lines.push('    data: body,');
      }
      
      lines.push('  });');
      lines.push('  return response;');
    }
    
    lines.push('}');
    
    return lines.join('\n');
  }
  
  /**
   * Генерирует параметры функции
   */
  private generateFunctionParameters(operation: PathItem): string {
    const params: string[] = [];
    
    // Path и query параметры
    for (const param of operation.parameters) {
      if (param.in === 'path' || param.in === 'query' || param.in === 'header') {
        const paramName = toCamelCase(param.name);
        const paramType = this.schemaToTypeScript(param.schema);
        const optional = param.required ? '' : '?';
        params.push(`${paramName}${optional}: ${paramType}`);
      }
    }
    
    // Request body
    if (operation.requestBody) {
      const bodyType = this.getRequestBodyType(operation.requestBody);
      const optional = operation.requestBody.required ? '' : '?';
      params.push(`body${optional}: ${bodyType}`);
    }
    
    return params.join(', ');
  }
  
  /**
   * Получает тип для request body
   */
  private getRequestBodyType(requestBody: any): string {
    const contentTypes = Object.keys(requestBody.content);
    if (contentTypes.length === 0) return 'any';
    
    // Берем первый content type (обычно application/json)
    const firstType = contentTypes[0];
    const schema = requestBody.content[firstType].schema;
    
    return this.schemaToTypeScript(schema);
  }
  
  /**
   * Генерирует тип возвращаемого значения
   */
  private generateReturnType(operation: PathItem): string {
    // Ищем успешный ответ (200, 201, etc.)
    for (const [code, response] of Object.entries(operation.responses)) {
      if (code.startsWith('2') && response.schema) {
        const dataType = this.schemaToTypeScript(response.schema);
        // Возвращаем AxiosResponse с типизированным data
        return `AxiosResponse<${dataType}>`;
      }
    }
    
    // Если нет схемы - возвращаем any
    return 'AxiosResponse<any>';
  }
  
  /**
   * Генерирует index файл
   */
  private generateIndexFile(tags: string[]): GeneratedFile {
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(' * Barrel export для всех API методов и типов');
    lines.push(' * Этот файл позволяет IDE автоматически импортировать методы и типы');
    lines.push(' * @example');
    lines.push(' * import { createOrder, getOrderById } from "@company/api-codegen/dist/api"');
    lines.push(' * import type { CreateOrderRequest, OrderResponse } from "@company/api-codegen/dist/api"');
    lines.push(' */\n');
    
    // Экспорт базовых типов
    if (this.baseSchemas.size > 0) {
      lines.push("// Базовые типы");
      lines.push("export * from './base.types';");
      lines.push('');
    }
    
    // Экспорт каждого тега (методы и типы)
    for (const tag of tags) {
      const filename = this.getTagFilename(tag).replace('.ts', '');
      const displayName = tag.charAt(0).toUpperCase() + tag.slice(1);
      
      lines.push(`// ${displayName} API`);
      lines.push(`export * from './${filename}';`);
    }
    
    lines.push('');
    
    return {
      filename: 'index.ts',
      content: lines.join('\n'),
    };
  }
  
  /**
   * Генерирует HTTP client файл
   */
  private generateHttpClientFile(): GeneratedFile {
    let content = '';
    
    if (this.config.httpClient === 'axios') {
      const baseUrlValue = this.config.baseUrl || this.spec.baseUrl;
      const isEnvVar = baseUrlValue.startsWith('process.env.');
      
      const lines: string[] = [];
      lines.push("import axios from 'axios';\n");
      lines.push('/**');
      lines.push(' * HTTP клиент для API запросов');
      lines.push(' */');
      lines.push('export const httpClient = axios.create({');
      
      // baseURL - либо переменная окружения, либо статичная строка
      if (isEnvVar) {
        lines.push(`  baseURL: ${baseUrlValue},`);
      } else {
        lines.push(`  baseURL: '${baseUrlValue}',`);
      }
      
      lines.push('  timeout: 30000,');
      lines.push('  headers: {');
      lines.push("    'Content-Type': 'application/json',");
      lines.push('  },');
      lines.push('});\n');
      
      // Interceptor для токена авторизации
      if (this.config.authTokenVar) {
        lines.push('// Interceptor для добавления токена авторизации');
        lines.push('httpClient.interceptors.request.use(');
        lines.push('  (config) => {');
        lines.push(`    const token = ${this.config.authTokenVar};`);
        lines.push('    if (token) {');
        lines.push("      config.headers.Authorization = `Bearer ${token}`;");
        lines.push('    }');
        lines.push('    return config;');
        lines.push('  },');
        lines.push('  (error) => Promise.reject(error)');
        lines.push(');\n');
      }
      
      // Interceptor для обработки ошибок
      if (this.config.generateErrorHandlers) {
        lines.push('// Interceptor для обработки ошибок');
        lines.push('httpClient.interceptors.response.use(');
        lines.push('  (response) => response,');
        lines.push('  (error) => {');
        lines.push('    console.error(\'API Error:\', error);');
        lines.push('    return Promise.reject(error);');
        lines.push('  }');
        lines.push(');\n');
      }
      
      // Утилиты для управления токеном
      lines.push('/**');
      lines.push(' * Устанавливает кастомный токен для всех последующих запросов');
      lines.push(' * @param token - Токен авторизации или null для удаления токена');
      lines.push(' */');
      lines.push('export function setAuthToken(token: string | null) {');
      lines.push('  if (token === null) {');
      lines.push("    delete httpClient.defaults.headers.common['Authorization'];");
      lines.push('  } else {');
      lines.push("    httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;");
      lines.push('  }');
      lines.push('}\n');
      
      lines.push('/**');
      lines.push(' * Выполняет запрос с переопределенным токеном (одноразово)');
      lines.push(' * @param config - Конфигурация axios');
      lines.push(' * @param token - Токен авторизации или null для запроса без токена');
      lines.push(' */');
      lines.push('export async function requestWithToken<T = any>(');
      lines.push('  config: any,');
      lines.push('  token: string | null = null');
      lines.push(') {');
      lines.push('  const customConfig = { ...config };');
      lines.push('  if (token === null) {');
      lines.push("    customConfig.headers = { ...customConfig.headers, Authorization: undefined };");
      lines.push('  } else {');
      lines.push("    customConfig.headers = { ...customConfig.headers, Authorization: `Bearer ${token}` };");
      lines.push('  }');
      lines.push('  return httpClient.request<T>(customConfig);');
      lines.push('}');
      
      content = lines.join('\n');
    }
    
    return {
      filename: 'http-client.ts',
      content,
    };
  }
  
  /**
   * Получает имя файла для тега
   */
  private getTagFilename(tag: string): string {
    let filename = tag;
    
    // Транслитерация русских названий
    if (this.config.transliterateRussian && /[а-яА-Я]/.test(tag)) {
      filename = transliterate(tag);
    }
    
    // Преобразуем в kebab-case
    filename = filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `${filename}.api.ts`;
  }
}
