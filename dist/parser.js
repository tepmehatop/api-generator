"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIParser = void 0;
/**
 * Парсер для OpenAPI спецификаций различных версий
 */
class OpenAPIParser {
    constructor(spec) {
        this.spec = spec;
        this.version = this.detectVersion();
    }
    /**
     * Определяет версию OpenAPI спецификации
     */
    detectVersion() {
        if (this.spec.swagger === '2.0') {
            return '2.0';
        }
        if (this.spec.openapi) {
            const version = this.spec.openapi;
            if (version.startsWith('3.0')) {
                return '3.0';
            }
            if (version.startsWith('3.1')) {
                return '3.1';
            }
        }
        throw new Error('Неподдерживаемая версия OpenAPI спецификации');
    }
    /**
     * Парсит спецификацию и возвращает унифицированную структуру
     */
    parse() {
        console.log(`📋 Версия спецификации: ${this.version}`);
        return {
            version: this.version,
            info: this.parseInfo(),
            baseUrl: this.parseBaseUrl(),
            tags: this.parseTags(),
            paths: this.parsePaths(),
            schemas: this.parseSchemas(),
        };
    }
    /**
     * Парсит информацию о API
     */
    parseInfo() {
        return {
            title: this.spec.info?.title || 'API',
            version: this.spec.info?.version || '1.0.0',
            description: this.spec.info?.description || '',
        };
    }
    /**
     * Парсит базовый URL
     */
    parseBaseUrl() {
        if (this.version === '2.0') {
            const scheme = this.spec.schemes?.[0] || 'https';
            const host = this.spec.host || '';
            const basePath = this.spec.basePath || '';
            return host ? `${scheme}://${host}${basePath}` : '';
        }
        // OpenAPI 3.x
        if (this.spec.servers && this.spec.servers.length > 0) {
            return this.spec.servers[0].url;
        }
        return '';
    }
    /**
     * Парсит теги
     */
    parseTags() {
        const tags = this.spec.tags || [];
        return tags.map((tag) => ({
            name: tag.name,
            description: tag.description || '',
        }));
    }
    /**
     * Парсит пути (endpoints)
     */
    parsePaths() {
        const paths = [];
        const specPaths = this.spec.paths || {};
        for (const [path, pathItem] of Object.entries(specPaths)) {
            const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
            for (const method of methods) {
                const operation = pathItem[method];
                if (!operation)
                    continue;
                paths.push({
                    path,
                    method: method.toUpperCase(),
                    operationId: operation.operationId || this.generateOperationId(method, path),
                    summary: operation.summary || '',
                    description: operation.description || '',
                    tags: operation.tags || ['default'],
                    parameters: this.parseParameters(operation, pathItem),
                    requestBody: this.parseRequestBody(operation),
                    responses: this.parseResponses(operation),
                    deprecated: operation.deprecated || false,
                });
            }
        }
        return paths;
    }
    /**
     * Генерирует operationId если он отсутствует
     */
    generateOperationId(method, path) {
        // Превращаем /pet/{petId} в petPetId
        const segments = path.split('/').filter(s => s);
        const pathPart = segments
            .map(s => s.replace(/[{}]/g, ''))
            .map((s, i) => i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))
            .join('');
        return method + pathPart.charAt(0).toUpperCase() + pathPart.slice(1);
    }
    /**
     * Парсит параметры операции
     */
    parseParameters(operation, pathItem) {
        const parameters = [];
        // Параметры из pathItem (общие для всех методов)
        const pathParams = pathItem.parameters || [];
        // Параметры из самой операции
        const opParams = operation.parameters || [];
        const allParams = [...pathParams, ...opParams];
        for (const param of allParams) {
            // Обработка $ref
            const resolved = param.$ref ? this.resolveRef(param.$ref) : param;
            parameters.push({
                name: resolved.name,
                in: resolved.in,
                required: resolved.required || false,
                description: resolved.description || '',
                schema: this.parseSchema(resolved.schema || resolved),
            });
        }
        return parameters;
    }
    /**
     * Парсит тело запроса
     */
    parseRequestBody(operation) {
        if (this.version === '2.0') {
            // В Swagger 2.0 body параметр находится в parameters
            const bodyParam = operation.parameters?.find((p) => p.in === 'body');
            if (!bodyParam)
                return undefined;
            return {
                required: bodyParam.required || false,
                content: {
                    'application/json': {
                        schema: this.parseSchema(bodyParam.schema),
                    },
                },
            };
        }
        // OpenAPI 3.x
        if (!operation.requestBody)
            return undefined;
        const requestBody = operation.requestBody;
        const content = {};
        for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content || {})) {
            content[mediaType] = {
                schema: this.parseSchema(mediaTypeObj.schema),
            };
        }
        return {
            required: requestBody.required || false,
            content,
        };
    }
    /**
     * Парсит ответы
     */
    parseResponses(operation) {
        const responses = {};
        for (const [statusCode, response] of Object.entries(operation.responses || {})) {
            const resp = response;
            if (this.version === '2.0') {
                responses[statusCode] = {
                    description: resp.description || '',
                    schema: resp.schema ? this.parseSchema(resp.schema) : undefined,
                };
            }
            else {
                // OpenAPI 3.x
                let schema;
                if (resp.content) {
                    // Берем первый доступный content type
                    const firstContentType = Object.keys(resp.content)[0];
                    if (firstContentType && resp.content[firstContentType].schema) {
                        schema = this.parseSchema(resp.content[firstContentType].schema);
                    }
                }
                responses[statusCode] = {
                    description: resp.description || '',
                    schema,
                };
            }
        }
        return responses;
    }
    /**
     * Парсит схемы (models/DTOs)
     */
    parseSchemas() {
        const schemas = {};
        if (this.version === '2.0') {
            // В Swagger 2.0 схемы находятся в definitions
            const definitions = this.spec.definitions || {};
            for (const [name, schema] of Object.entries(definitions)) {
                schemas[name] = this.parseSchema(schema);
            }
        }
        else {
            // OpenAPI 3.x - схемы в components/schemas
            const components = this.spec.components?.schemas || {};
            for (const [name, schema] of Object.entries(components)) {
                schemas[name] = this.parseSchema(schema);
            }
        }
        return schemas;
    }
    /**
     * Парсит отдельную схему
     */
    parseSchema(schema) {
        if (!schema) {
            return { type: 'any' };
        }
        // Обработка $ref
        if (schema.$ref) {
            return {
                type: 'ref',
                ref: this.extractRefName(schema.$ref),
            };
        }
        // Обработка allOf, oneOf, anyOf
        if (schema.allOf || schema.oneOf || schema.anyOf) {
            const compositor = schema.allOf ? 'allOf' : schema.oneOf ? 'oneOf' : 'anyOf';
            return {
                type: 'composite',
                compositor,
                schemas: (schema[compositor] || []).map((s) => this.parseSchema(s)),
            };
        }
        // Обработка массивов
        if (schema.type === 'array') {
            return {
                type: 'array',
                items: this.parseSchema(schema.items),
            };
        }
        // Обработка объектов
        if (schema.type === 'object' || schema.properties) {
            const properties = {};
            for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
                properties[propName] = this.parseSchema(propSchema);
            }
            return {
                type: 'object',
                properties,
                required: schema.required || [],
                additionalProperties: schema.additionalProperties,
            };
        }
        // Примитивные типы
        return {
            type: schema.type || 'any',
            format: schema.format,
            enum: schema.enum,
            description: schema.description,
            nullable: schema.nullable,
            default: schema.default,
        };
    }
    /**
     * Разрешает $ref ссылку
     */
    resolveRef(ref) {
        const parts = ref.split('/');
        let current = this.spec;
        for (const part of parts) {
            if (part === '#')
                continue;
            current = current[part];
            if (!current) {
                throw new Error(`Не удалось разрешить ссылку: ${ref}`);
            }
        }
        return current;
    }
    /**
     * Извлекает имя из $ref
     */
    extractRefName(ref) {
        return ref.split('/').pop() || ref;
    }
}
exports.OpenAPIParser = OpenAPIParser;
//# sourceMappingURL=parser.js.map