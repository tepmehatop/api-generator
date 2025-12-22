/**
 * Модуль для сравнения двух версий API
 * Анализирует изменения в методах, endpoints и DTO
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as tar from 'tar';
import { PathItem, Schema } from './parser';

export interface ComparisonResult {
  serviceName: string;
  
  // Новые элементы
  newEndpoints: EndpointInfo[];
  newMethods: MethodInfo[];
  newDtos: DtoInfo[];
  
  // Удалённые элементы
  removedEndpoints: EndpointInfo[];
  removedMethods: MethodInfo[];
  removedDtos: DtoInfo[];
  
  // Изменённые элементы
  modifiedDtos: DtoChange[];
}

export interface EndpointInfo {
  path: string;
  method: string;
  operationId: string;
}

export interface MethodInfo {
  name: string;
  endpoint: string;
  httpMethod: string;
}

export interface DtoInfo {
  name: string;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  required: boolean;
}

export interface DtoChange {
  dtoName: string;
  addedFields: FieldInfo[];
  removedFields: FieldInfo[];
  modifiedFields: FieldModification[];
}

export interface FieldModification {
  fieldName: string;
  oldType: string;
  newType: string;
  wasRequired: boolean;
  nowRequired: boolean;
}

export class ApiComparator {
  private tempDir: string;
  
  constructor() {
    this.tempDir = path.join(process.cwd(), '.temp-comparison');
  }
  
  /**
   * Скачивает и распаковывает предыдущую версию пакета
   */
  async downloadAndExtractPackage(packageUrl: string): Promise<string> {
    console.log(`📦 Скачиваю предыдущую версию: ${packageUrl}`);
    
    // Создаём временную директорию
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    const tgzPath = path.join(this.tempDir, 'package.tgz');
    
    // Проверяем это URL или локальный файл
    if (packageUrl.startsWith('http://') || packageUrl.startsWith('https://')) {
      // Скачиваем с URL
      await this.downloadFromUrl(packageUrl, tgzPath);
    } else {
      // Копируем локальный файл
      console.log('📁 Копирую локальный файл...');
      if (!fs.existsSync(packageUrl)) {
        throw new Error(`Файл не найден: ${packageUrl}`);
      }
      fs.copyFileSync(packageUrl, tgzPath);
      console.log('✓ Файл скопирован');
    }
    
    // Распаковываем
    const extractPath = path.join(this.tempDir, 'extracted');
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true });
    }
    fs.mkdirSync(extractPath, { recursive: true });
    
    await tar.extract({
      file: tgzPath,
      cwd: extractPath,
    });
    
    console.log('✓ Пакет распакован');
    
    // Возвращаем путь к package/dist
    return path.join(extractPath, 'package', 'dist');
  }
  
  /**
   * Скачивает файл с URL с авторизацией
   */
  private async downloadFromUrl(packageUrl: string, destPath: string): Promise<void> {
    // Читаем .npmrc для получения токена авторизации
    const npmrcPath = path.join(process.cwd(), '.npmrc');
    let authHeader: string | undefined;
    
    if (fs.existsSync(npmrcPath)) {
      console.log('🔑 Найден .npmrc, использую авторизацию...');
      const npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
      
      // Извлекаем registry из URL для точного поиска токена
      const urlObj = new URL(packageUrl);
      const registryHost = urlObj.hostname + urlObj.pathname.split('/').slice(0, -1).join('/');
      
      console.log(`   Registry: //${registryHost}`);
      
      // Ищем токен для конкретного registry
      // Формат: //customRegistry.niu.ru/repo/npm/:_authToken=TOKEN
      const specificTokenRegex = new RegExp(`//${registryHost.replace(/\//g, '\\/')}/:_authToken=([^\\s\\n]+)`);
      const specificAuthRegex = new RegExp(`//${registryHost.replace(/\//g, '\\/')}/:_auth=([^\\s\\n]+)`);
      
      let authToken: string | undefined;
      let isBase64Auth = false;
      
      // Проверяем специфичный для registry токен
      let match = npmrcContent.match(specificTokenRegex);
      if (match) {
        authToken = match[1];
        console.log('✓ Найден _authToken для registry');
      } else {
        // Проверяем _auth (base64)
        match = npmrcContent.match(specificAuthRegex);
        if (match) {
          authToken = match[1];
          isBase64Auth = true;
          console.log('✓ Найден _auth (base64) для registry');
        } else {
          // Fallback: ищем любой токен
          const anyTokenMatch = npmrcContent.match(/:_authToken=([^\s\n]+)/);
          if (anyTokenMatch) {
            authToken = anyTokenMatch[1];
            console.log('✓ Найден общий _authToken');
          } else {
            const anyAuthMatch = npmrcContent.match(/:_auth=([^\s\n]+)/);
            if (anyAuthMatch) {
              authToken = anyAuthMatch[1];
              isBase64Auth = true;
              console.log('✓ Найден общий _auth (base64)');
            }
          }
        }
      }
      
      if (authToken) {
        // Формируем правильный заголовок
        if (isBase64Auth) {
          // _auth уже base64, используем как Basic
          authHeader = `Basic ${authToken}`;
          console.log('   Использую: Basic auth (base64)');
        } else if (authToken.startsWith('Bearer ')) {
          // Уже с Bearer
          authHeader = authToken;
          console.log('   Использую: Bearer token');
        } else if (authToken.startsWith('npm_')) {
          // npm токен
          authHeader = `Bearer ${authToken}`;
          console.log('   Использую: Bearer token (npm)');
        } else {
          // Обычный токен
          authHeader = `Bearer ${authToken}`;
          console.log('   Использую: Bearer token');
        }
      } else {
        console.log('⚠️ Токен не найден в .npmrc');
      }
    } else {
      console.log('⚠️ .npmrc не найден');
    }
    
    // Настраиваем headers
    const headers: Record<string, string> = {
      'Accept': 'application/octet-stream',
      'User-Agent': 'npm/api-codegen'
    };
    
    if (authHeader) {
      headers['Authorization'] = authHeader;
      console.log('   Authorization header установлен');
    }
    
    // Скачиваем
    try {
      console.log('📥 Отправляю запрос...');
      const response = await axios.get(packageUrl, { 
        responseType: 'stream',
        headers,
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // Разрешаем редиректы
      });
      
      if (response.status === 401) {
        throw new Error('401 Unauthorized');
      }
      
      if (response.status === 404) {
        throw new Error('404 Not Found - пакет не существует');
      }
      
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);
      
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });
      
      console.log('✓ Пакет скачан');
    } catch (error: any) {
      if (error.response?.status === 401 || error.message?.includes('401')) {
        console.error('\n❌ Ошибка 401: Не удалось авторизоваться');
        console.error('\n💡 Попробуйте альтернативный метод:');
        console.error('   1. Вместо URL используйте локальный файл из Git:');
        console.error('      "prevPackage": "./archive/api-codegen-1.55.0.tgz"');
        console.error('');
        console.error('   2. Или положите файл в репозиторий Bitbucket:');
        console.error('      mkdir -p archive');
        console.error('      cp api-codegen-1.55.0.tgz archive/');
        console.error('      git add archive/ && git commit -m "Add version 1.55.0"');
        console.error('');
        console.error('   3. Проверьте .npmrc:');
        if (fs.existsSync(path.join(process.cwd(), '.npmrc'))) {
          console.error('      ✓ .npmrc найден');
          const content = fs.readFileSync(path.join(process.cwd(), '.npmrc'), 'utf-8');
          if (content.includes('_authToken') || content.includes('_auth')) {
            console.error('      ✓ Токен найден в файле');
          } else {
            console.error('      ❌ Токен НЕ найден в файле');
          }
        } else {
          console.error('      ❌ .npmrc не найден');
        }
        throw new Error('Не удалось скачать пакет из-за ошибки авторизации (401)');
      }
      
      if (error.response?.status === 404) {
        console.error('\n❌ Ошибка 404: Пакет не найден');
        console.error(`   URL: ${packageUrl}`);
        console.error('\n💡 Используйте локальный файл:');
        console.error('   "prevPackage": "./archive/api-codegen-1.55.0.tgz"');
        throw new Error('Пакет не найден (404)');
      }
      
      throw error;
    }
  }
  
  /**
   * Извлекает информацию о методах из папки API
   */
  extractApiInfo(distPath: string, serviceName: string): ApiInfo {
    const servicePath = path.join(distPath, serviceName);
    
    if (!fs.existsSync(servicePath)) {
      throw new Error(`Service folder not found: ${servicePath}`);
    }
    
    const endpoints: EndpointInfo[] = [];
    const methods: MethodInfo[] = [];
    const dtos: DtoInfo[] = [];
    
    // Читаем все .api.ts файлы
    const files = fs.readdirSync(servicePath).filter(f => f.endsWith('.api.ts'));
    
    for (const file of files) {
      const filePath = path.join(servicePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Парсим методы
      const methodRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
      let match;
      while ((match = methodRegex.exec(content)) !== null) {
        methods.push({
          name: match[1],
          endpoint: '', // Будет заполнено из комментария
          httpMethod: ''
        });
      }
      
      // Парсим комментарии для извлечения endpoint и HTTP method
      const commentRegex = /\/\*\*[\s\S]*?\*\s+@request\s+(\w+):(.+?)\n[\s\S]*?\*\/\s*export\s+async\s+function\s+(\w+)/g;
      while ((match = commentRegex.exec(content)) !== null) {
        const httpMethod = match[1];
        const endpoint = match[2].trim();
        const methodName = match[3];
        
        endpoints.push({
          path: endpoint,
          method: httpMethod,
          operationId: methodName
        });
        
        // Обновляем информацию о методе
        const methodInfo = methods.find(m => m.name === methodName);
        if (methodInfo) {
          methodInfo.endpoint = endpoint;
          methodInfo.httpMethod = httpMethod;
        }
      }
    }
    
    // Парсим DTO из .api.ts файлов
    for (const file of files) {
      const filePath = path.join(servicePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Находим все interface и type определения
      const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]*)}/g;
      let match;
      while ((match = interfaceRegex.exec(content)) !== null) {
        const dtoName = match[1];
        const body = match[2];
        const fields = this.parseFields(body);
        
        dtos.push({
          name: dtoName,
          fields
        });
      }
    }
    
    // Парсим базовые типы если есть
    const baseTypesPath = path.join(servicePath, 'base.types.ts');
    if (fs.existsSync(baseTypesPath)) {
      const content = fs.readFileSync(baseTypesPath, 'utf-8');
      const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]*)}/g;
      let match;
      while ((match = interfaceRegex.exec(content)) !== null) {
        const dtoName = match[1];
        const body = match[2];
        const fields = this.parseFields(body);
        
        dtos.push({
          name: dtoName,
          fields
        });
      }
    }
    
    return { endpoints, methods, dtos };
  }
  
  /**
   * Парсит поля из тела интерфейса
   */
  private parseFields(body: string): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const lines = body.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue;
      }
      
      // Парсим: fieldName?: type;
      const fieldMatch = trimmed.match(/^(\w+)(\?)?:\s*([^;]+);?/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[3].trim(),
          required: !fieldMatch[2] // Если нет ?, то required
        });
      }
    }
    
    return fields;
  }
  
  /**
   * Сравнивает две версии API
   */
  compare(oldInfo: ApiInfo, newInfo: ApiInfo, serviceName: string): ComparisonResult {
    const result: ComparisonResult = {
      serviceName,
      newEndpoints: [],
      newMethods: [],
      newDtos: [],
      removedEndpoints: [],
      removedMethods: [],
      removedDtos: [],
      modifiedDtos: []
    };
    
    // Сравниваем endpoints
    const oldEndpointKeys = new Set(oldInfo.endpoints.map(e => `${e.method}:${e.path}`));
    const newEndpointKeys = new Set(newInfo.endpoints.map(e => `${e.method}:${e.path}`));
    
    for (const endpoint of newInfo.endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (!oldEndpointKeys.has(key)) {
        result.newEndpoints.push(endpoint);
      }
    }
    
    for (const endpoint of oldInfo.endpoints) {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (!newEndpointKeys.has(key)) {
        result.removedEndpoints.push(endpoint);
      }
    }
    
    // Сравниваем методы
    const oldMethodNames = new Set(oldInfo.methods.map(m => m.name));
    const newMethodNames = new Set(newInfo.methods.map(m => m.name));
    
    for (const method of newInfo.methods) {
      if (!oldMethodNames.has(method.name)) {
        result.newMethods.push(method);
      }
    }
    
    for (const method of oldInfo.methods) {
      if (!newMethodNames.has(method.name)) {
        result.removedMethods.push(method);
      }
    }
    
    // Сравниваем DTO
    const oldDtoMap = new Map(oldInfo.dtos.map(d => [d.name, d]));
    const newDtoMap = new Map(newInfo.dtos.map(d => [d.name, d]));
    
    // Новые DTO
    for (const dto of newInfo.dtos) {
      if (!oldDtoMap.has(dto.name)) {
        result.newDtos.push(dto);
      }
    }
    
    // Удалённые DTO
    for (const dto of oldInfo.dtos) {
      if (!newDtoMap.has(dto.name)) {
        result.removedDtos.push(dto);
      }
    }
    
    // Изменённые DTO
    for (const [dtoName, newDto] of newDtoMap.entries()) {
      const oldDto = oldDtoMap.get(dtoName);
      if (!oldDto) continue;
      
      const change = this.compareDtos(oldDto, newDto);
      if (change.addedFields.length > 0 || 
          change.removedFields.length > 0 || 
          change.modifiedFields.length > 0) {
        result.modifiedDtos.push(change);
      }
    }
    
    return result;
  }
  
  /**
   * Сравнивает два DTO
   */
  private compareDtos(oldDto: DtoInfo, newDto: DtoInfo): DtoChange {
    const change: DtoChange = {
      dtoName: oldDto.name,
      addedFields: [],
      removedFields: [],
      modifiedFields: []
    };
    
    const oldFieldMap = new Map(oldDto.fields.map(f => [f.name, f]));
    const newFieldMap = new Map(newDto.fields.map(f => [f.name, f]));
    
    // Новые поля
    for (const field of newDto.fields) {
      if (!oldFieldMap.has(field.name)) {
        change.addedFields.push(field);
      }
    }
    
    // Удалённые поля
    for (const field of oldDto.fields) {
      if (!newFieldMap.has(field.name)) {
        change.removedFields.push(field);
      }
    }
    
    // Изменённые поля
    for (const [fieldName, newField] of newFieldMap.entries()) {
      const oldField = oldFieldMap.get(fieldName);
      if (!oldField) continue;
      
      if (oldField.type !== newField.type || oldField.required !== newField.required) {
        change.modifiedFields.push({
          fieldName,
          oldType: oldField.type,
          newType: newField.type,
          wasRequired: oldField.required,
          nowRequired: newField.required
        });
      }
    }
    
    return change;
  }
  
  /**
   * Генерирует markdown отчёт о сравнении
   */
  generateComparisonReport(result: ComparisonResult): string {
    const lines: string[] = [];
    
    lines.push(`# API Comparison Report: ${result.serviceName}`);
    lines.push('');
    lines.push(`Сравнение изменений API между версиями`);
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // Новые endpoints
    if (result.newEndpoints.length > 0) {
      lines.push('## ✅ Новые Endpoints');
      lines.push('');
      lines.push('| HTTP Method | Endpoint | Operation ID |');
      lines.push('|-------------|----------|--------------|');
      for (const endpoint of result.newEndpoints) {
        lines.push(`| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.operationId}\` |`);
      }
      lines.push('');
    }
    
    // Удалённые endpoints
    if (result.removedEndpoints.length > 0) {
      lines.push('## ❌ Удалённые Endpoints');
      lines.push('');
      lines.push('| HTTP Method | Endpoint | Operation ID |');
      lines.push('|-------------|----------|--------------|');
      for (const endpoint of result.removedEndpoints) {
        lines.push(`| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.operationId}\` |`);
      }
      lines.push('');
    }
    
    // Новые методы
    if (result.newMethods.length > 0) {
      lines.push('## ✅ Новые Методы');
      lines.push('');
      lines.push('| Method Name | Endpoint | HTTP Method |');
      lines.push('|-------------|----------|-------------|');
      for (const method of result.newMethods) {
        lines.push(`| \`${method.name}\` | \`${method.endpoint}\` | ${method.httpMethod} |`);
      }
      lines.push('');
    }
    
    // Удалённые методы
    if (result.removedMethods.length > 0) {
      lines.push('## ❌ Удалённые Методы');
      lines.push('');
      lines.push('| Method Name | Endpoint | HTTP Method |');
      lines.push('|-------------|----------|-------------|');
      for (const method of result.removedMethods) {
        lines.push(`| \`${method.name}\` | \`${method.endpoint}\` | ${method.httpMethod} |`);
      }
      lines.push('');
    }
    
    // Новые DTO
    if (result.newDtos.length > 0) {
      lines.push('## ✅ Новые DTO');
      lines.push('');
      for (const dto of result.newDtos) {
        lines.push(`### \`${dto.name}\``);
        lines.push('');
        lines.push('| Field | Type | Required |');
        lines.push('|-------|------|----------|');
        for (const field of dto.fields) {
          const required = field.required ? '✓' : '✗';
          lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} |`);
        }
        lines.push('');
      }
    }
    
    // Удалённые DTO
    if (result.removedDtos.length > 0) {
      lines.push('## ❌ Удалённые DTO');
      lines.push('');
      for (const dto of result.removedDtos) {
        lines.push(`### \`${dto.name}\``);
        lines.push('');
        lines.push('| Field | Type | Required |');
        lines.push('|-------|------|----------|');
        for (const field of dto.fields) {
          const required = field.required ? '✓' : '✗';
          lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} |`);
        }
        lines.push('');
      }
    }
    
    // Изменённые DTO
    if (result.modifiedDtos.length > 0) {
      lines.push('## 🔄 Изменённые DTO');
      lines.push('');
      
      for (const change of result.modifiedDtos) {
        lines.push(`### \`${change.dtoName}\``);
        lines.push('');
        
        if (change.addedFields.length > 0) {
          lines.push('#### ✅ Добавленные поля:');
          lines.push('');
          lines.push('| Field | Type | Required |');
          lines.push('|-------|------|----------|');
          for (const field of change.addedFields) {
            const required = field.required ? '✓' : '✗';
            lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} |`);
          }
          lines.push('');
        }
        
        if (change.removedFields.length > 0) {
          lines.push('#### ❌ Удалённые поля:');
          lines.push('');
          lines.push('| Field | Type | Required |');
          lines.push('|-------|------|----------|');
          for (const field of change.removedFields) {
            const required = field.required ? '✓' : '✗';
            lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} |`);
          }
          lines.push('');
        }
        
        if (change.modifiedFields.length > 0) {
          lines.push('#### 🔄 Изменённые поля:');
          lines.push('');
          lines.push('| Field | Old Type | New Type | Was Required | Now Required |');
          lines.push('|-------|----------|----------|--------------|--------------|');
          for (const mod of change.modifiedFields) {
            const wasReq = mod.wasRequired ? '✓' : '✗';
            const nowReq = mod.nowRequired ? '✓' : '✗';
            lines.push(`| \`${mod.fieldName}\` | \`${mod.oldType}\` | \`${mod.newType}\` | ${wasReq} | ${nowReq} |`);
          }
          lines.push('');
        }
      }
    }
    
    // Если нет изменений
    if (result.newEndpoints.length === 0 && 
        result.removedEndpoints.length === 0 &&
        result.newMethods.length === 0 &&
        result.removedMethods.length === 0 &&
        result.newDtos.length === 0 &&
        result.removedDtos.length === 0 &&
        result.modifiedDtos.length === 0) {
      lines.push('## ✅ Изменений не обнаружено');
      lines.push('');
      lines.push('API осталось без изменений между версиями.');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
    lines.push('*Сгенерировано автоматически*');
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * Очищает временные файлы
   */
  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true });
      console.log('✓ Временные файлы очищены');
    }
  }
}

export interface ApiInfo {
  endpoints: EndpointInfo[];
  methods: MethodInfo[];
  dtos: DtoInfo[];
}
