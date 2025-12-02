/**
 * Парсер для OpenAPI спецификаций различных версий
 */
export class OpenAPIParser {
  private spec: any;
  private version: '2.0' | '3.0' | '3.1';
  
  constructor(spec: any) {
    this.spec = spec;
    this.version = this.detectVersion();
  }
  
  /**
   * Определяет версию OpenAPI спецификации
   */
  private detectVersion(): '2.0' | '3.0' | '3.1' {
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
  parse(): ParsedSpec {
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
  private parseInfo(): ApiInfo {
    return {
      title: this.spec.info?.title || 'API',
      version: this.spec.info?.version || '1.0.0',
      description: this.spec.info?.description || '',
    };
  }
  
  /**
   * Парсит базовый URL
   */
  private parseBaseUrl(): string {
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
  private parseTags(): Tag[] {
    const tags = this.spec.tags || [];
    return tags.map((tag: any) => ({
      name: tag.name,
      description: tag.description || '',
    }));
  }
  
  /**
   * Парсит пути (endpoints)
   */
  private parsePaths(): PathItem[] {
    const paths: PathItem[] = [];
    const specPaths = this.spec.paths || {};
    
    for (const [path, pathItem] of Object.entries(specPaths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
      
      for (const method of methods) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;
        
        paths.push({
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId || this.generateOperationId(method, path),
          summary: operation.summary || '',
          description: operation.description || '',
          tags: operation.tags || ['default'],
          parameters: this.parseParameters(operation, pathItem as any),
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
  private generateOperationId(method: string, path: string): string {
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
  private parseParameters(operation: any, pathItem: any): Parameter[] {
    const parameters: Parameter[] = [];
    
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
  private parseRequestBody(operation: any): RequestBody | undefined {
    if (this.version === '2.0') {
      // В Swagger 2.0 body параметр находится в parameters
      const bodyParam = operation.parameters?.find((p: any) => p.in === 'body');
      if (!bodyParam) return undefined;
      
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
    if (!operation.requestBody) return undefined;
    
    const requestBody = operation.requestBody;
    const content: Record<string, { schema: Schema }> = {};
    
    for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content || {})) {
      content[mediaType] = {
        schema: this.parseSchema((mediaTypeObj as any).schema),
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
  private parseResponses(operation: any): Record<string, Response> {
    const responses: Record<string, Response> = {};
    
    for (const [statusCode, response] of Object.entries(operation.responses || {})) {
      const resp = response as any;
      
      if (this.version === '2.0') {
        responses[statusCode] = {
          description: resp.description || '',
          schema: resp.schema ? this.parseSchema(resp.schema) : undefined,
        };
      } else {
        // OpenAPI 3.x
        let schema: Schema | undefined;
        
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
  private parseSchemas(): Record<string, Schema> {
    const schemas: Record<string, Schema> = {};
    
    if (this.version === '2.0') {
      // В Swagger 2.0 схемы находятся в definitions
      const definitions = this.spec.definitions || {};
      for (const [name, schema] of Object.entries(definitions)) {
        schemas[name] = this.parseSchema(schema);
      }
    } else {
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
  private parseSchema(schema: any): Schema {
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
        schemas: (schema[compositor] || []).map((s: any) => this.parseSchema(s)),
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
      const properties: Record<string, Schema> = {};
      
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
  private resolveRef(ref: string): any {
    const parts = ref.split('/');
    let current = this.spec;
    
    for (const part of parts) {
      if (part === '#') continue;
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
  private extractRefName(ref: string): string {
    return ref.split('/').pop() || ref;
  }
}

// Типы для распарсенной спецификации
export interface ParsedSpec {
  version: '2.0' | '3.0' | '3.1';
  info: ApiInfo;
  baseUrl: string;
  tags: Tag[];
  paths: PathItem[];
  schemas: Record<string, Schema>;
}

export interface ApiInfo {
  title: string;
  version: string;
  description: string;
}

export interface Tag {
  name: string;
  description: string;
}

export interface PathItem {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated: boolean;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie' | 'body' | 'formData';
  required: boolean;
  description: string;
  schema: Schema;
}

export interface RequestBody {
  required: boolean;
  content: Record<string, { schema: Schema }>;
}

export interface Response {
  description: string;
  schema?: Schema;
}

export interface Schema {
  type: string;
  format?: string;
  ref?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: any[];
  description?: string;
  nullable?: boolean;
  default?: any;
  additionalProperties?: any;
  compositor?: 'allOf' | 'oneOf' | 'anyOf';
  schemas?: Schema[];
}
