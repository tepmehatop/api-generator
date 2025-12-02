"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
const transliterate_1 = require("./utils/transliterate");
const string_helpers_1 = require("./utils/string-helpers");
/**
 * Генератор TypeScript кода из распарсенной OpenAPI спецификации
 */
class CodeGenerator {
    constructor(config, spec) {
        this.usedSchemas = new Set();
        this.baseSchemas = new Set();
        this.config = config;
        this.spec = spec;
        this.identifyBaseSchemas();
    }
    /**
     * Определяет базовые схемы, используемые в нескольких тегах
     */
    identifyBaseSchemas() {
        const schemaUsage = new Map();
        // Подсчитываем использование схем по тегам
        for (const path of this.spec.paths) {
            const schemas = this.extractSchemasFromPath(path);
            for (const schema of schemas) {
                if (!schemaUsage.has(schema)) {
                    schemaUsage.set(schema, new Set());
                }
                for (const tag of path.tags) {
                    schemaUsage.get(schema).add(tag);
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
     * Извлекает имена схем из операции
     */
    extractSchemasFromPath(path) {
        const schemas = new Set();
        const collectSchemas = (schema) => {
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
    generate() {
        const files = [];
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
        // Генерируем index файл
        files.push(this.generateIndexFile(Array.from(operationsByTag.keys())));
        // Генерируем HTTP client helper
        files.push(this.generateHttpClientFile());
        return files;
    }
    /**
     * Группирует операции по тегам
     */
    groupOperationsByTag() {
        const map = new Map();
        for (const path of this.spec.paths) {
            for (const tag of path.tags) {
                if (!map.has(tag)) {
                    map.set(tag, []);
                }
                map.get(tag).push(path);
            }
        }
        return map;
    }
    /**
     * Генерирует файл с базовыми типами
     */
    generateBaseTypesFile() {
        const imports = [];
        const types = [];
        types.push('/**');
        types.push(' * Базовые типы, используемые в нескольких модулях');
        types.push(' * Автоматически сгенерировано из OpenAPI спецификации');
        types.push(' */\n');
        for (const schemaName of this.baseSchemas) {
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
     * Генерирует файл для конкретного тега
     */
    generateTagFile(tag, operations) {
        const filename = this.getTagFilename(tag);
        const imports = [];
        const types = [];
        const functions = [];
        // Импорты
        imports.push("import { httpClient } from './http-client';");
        // Определяем какие базовые типы используются
        const usedBaseTypes = new Set();
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
        // Функции API
        functions.push('/**');
        functions.push(` * API методы для: ${tag}`);
        functions.push(' */\n');
        for (const operation of operations) {
            functions.push(this.generateApiFunction(operation));
            functions.push('');
        }
        return {
            filename,
            content: [...imports, ...types, ...functions].join('\n'),
        };
    }
    /**
     * Получает локальные схемы для тега (не базовые)
     */
    getLocalSchemasForTag(operations) {
        const schemas = new Set();
        const collected = new Set();
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
            const schemaName = toProcess.pop();
            const schema = this.spec.schemas[schemaName];
            if (!schema)
                continue;
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
    extractSchemasDependencies(schema) {
        const deps = new Set();
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
    generateTypeDefinition(name, schema) {
        const lines = [];
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
                lines.push(`  ${propName}${isRequired ? '' : '?'}: ${tsType};`);
            }
        }
        lines.push('}');
        return lines.join('\n');
    }
    /**
     * Преобразует схему в TypeScript тип
     */
    schemaToTypeScript(schema) {
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
                    return `Record<string, ${this.schemaToTypeScript(schema.additionalProperties)}>`;
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
        const typeMap = {
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
    generateApiFunction(operation) {
        const lines = [];
        const funcName = (0, string_helpers_1.toCamelCase)(operation.operationId);
        // JSDoc
        lines.push('/**');
        if (operation.summary) {
            lines.push(` * ${operation.summary}`);
        }
        if (operation.description) {
            lines.push(` * ${operation.description}`);
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
        // Подстановка path параметров
        let url = operation.path;
        for (const param of pathParams) {
            url = url.replace(`{${param.name}}`, `\${${(0, string_helpers_1.toCamelCase)(param.name)}}`);
        }
        lines.push(`  const url = \`${url}\`;`);
        // Query параметры
        if (queryParams.length > 0) {
            lines.push('  const params = {');
            for (const param of queryParams) {
                lines.push(`    ${param.name}: ${(0, string_helpers_1.toCamelCase)(param.name)},`);
            }
            lines.push('  };');
        }
        // Headers
        if (headerParams.length > 0) {
            lines.push('  const headers = {');
            for (const param of headerParams) {
                lines.push(`    '${param.name}': ${(0, string_helpers_1.toCamelCase)(param.name)},`);
            }
            lines.push('  };');
        }
        // Request body
        const hasBody = operation.requestBody && operation.method !== 'GET';
        // HTTP запрос
        if (this.config.httpClient === 'axios') {
            lines.push('  const response = await httpClient.request({');
            lines.push(`    method: '${operation.method}',`);
            lines.push('    url,');
            if (queryParams.length > 0) {
                lines.push('    params,');
            }
            if (headerParams.length > 0) {
                lines.push('    headers,');
            }
            if (hasBody) {
                lines.push('    data: body,');
            }
            lines.push('  });');
            lines.push('  return response.data;');
        }
        lines.push('}');
        return lines.join('\n');
    }
    /**
     * Генерирует параметры функции
     */
    generateFunctionParameters(operation) {
        const params = [];
        // Path и query параметры
        for (const param of operation.parameters) {
            if (param.in === 'path' || param.in === 'query' || param.in === 'header') {
                const paramName = (0, string_helpers_1.toCamelCase)(param.name);
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
    getRequestBodyType(requestBody) {
        const contentTypes = Object.keys(requestBody.content);
        if (contentTypes.length === 0)
            return 'any';
        // Берем первый content type (обычно application/json)
        const firstType = contentTypes[0];
        const schema = requestBody.content[firstType].schema;
        return this.schemaToTypeScript(schema);
    }
    /**
     * Генерирует тип возвращаемого значения
     */
    generateReturnType(operation) {
        // Ищем успешный ответ (200, 201, etc.)
        for (const [code, response] of Object.entries(operation.responses)) {
            if (code.startsWith('2') && response.schema) {
                return this.schemaToTypeScript(response.schema);
            }
        }
        return 'void';
    }
    /**
     * Генерирует index файл
     */
    generateIndexFile(tags) {
        const lines = [];
        lines.push('/**');
        lines.push(' * Главный файл экспорта API клиента');
        lines.push(' */\n');
        // Экспорт базовых типов
        if (this.baseSchemas.size > 0) {
            lines.push("export * from './base.types';");
        }
        // Экспорт каждого тега
        for (const tag of tags) {
            const filename = this.getTagFilename(tag).replace('.ts', '');
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
    generateHttpClientFile() {
        let content = '';
        if (this.config.httpClient === 'axios') {
            content = `import axios from 'axios';

/**
 * HTTP клиент для API запросов
 */
export const httpClient = axios.create({
  baseURL: '${this.config.baseUrl || this.spec.baseUrl}',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для обработки ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
`;
        }
        return {
            filename: 'http-client.ts',
            content,
        };
    }
    /**
     * Получает имя файла для тега
     */
    getTagFilename(tag) {
        let filename = tag;
        // Транслитерация русских названий
        if (this.config.transliterateRussian && /[а-яА-Я]/.test(tag)) {
            filename = (0, transliterate_1.transliterate)(tag);
        }
        // Преобразуем в kebab-case
        filename = filename
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${filename}.api.ts`;
    }
}
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=generator.js.map