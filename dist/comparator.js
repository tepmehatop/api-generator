"use strict";
/**
 * Модуль для сравнения двух версий API
 * Анализирует изменения в методах, endpoints и DTO
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiComparator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
const tar = __importStar(require("tar"));
class ApiComparator {
    constructor() {
        this.tempDir = path.join(process.cwd(), '.temp-comparison');
    }
    /**
     * Скачивает и распаковывает предыдущую версию пакета
     */
    async downloadAndExtractPackage(packageUrl) {
        console.log(`📦 Скачиваю предыдущую версию: ${packageUrl}`);
        // Создаём временную директорию
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        // Читаем .npmrc для получения токена авторизации
        const npmrcPath = path.join(process.cwd(), '.npmrc');
        let authToken;
        if (fs.existsSync(npmrcPath)) {
            console.log('🔑 Найден .npmrc, использую авторизацию...');
            const npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');
            // Парсим .npmrc для поиска токена
            // Формат: //registry.npmjs.org/:_authToken=YOUR_TOKEN
            // Или: //customRegistry.niu.ru/repo/npm/:_authToken=YOUR_TOKEN
            const authTokenMatch = npmrcContent.match(/:_authToken=([^\s\n]+)/);
            if (authTokenMatch) {
                authToken = authTokenMatch[1];
                console.log('✓ Токен авторизации найден');
            }
            else {
                // Пробуем найти _auth (base64)
                const authMatch = npmrcContent.match(/:_auth=([^\s\n]+)/);
                if (authMatch) {
                    authToken = authMatch[1];
                    console.log('✓ Base64 авторизация найдена');
                }
            }
        }
        else {
            console.log('⚠️ .npmrc не найден, пробую без авторизации...');
        }
        // Настраиваем заголовки для axios
        const headers = {};
        if (authToken) {
            // Если токен начинается с "Bearer " - используем как есть
            // Иначе добавляем Bearer
            if (authToken.startsWith('Bearer ')) {
                headers['Authorization'] = authToken;
            }
            else if (authToken.includes(':')) {
                // Это base64 формат (username:password)
                headers['Authorization'] = `Basic ${authToken}`;
            }
            else {
                // Обычный токен
                headers['Authorization'] = `Bearer ${authToken}`;
            }
        }
        // Скачиваем пакет
        const tgzPath = path.join(this.tempDir, 'package.tgz');
        try {
            const response = await axios_1.default.get(packageUrl, {
                responseType: 'stream',
                headers
            });
            const writer = fs.createWriteStream(tgzPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', reject);
            });
            console.log('✓ Пакет скачан');
        }
        catch (error) {
            if (error.response?.status === 401) {
                console.error('❌ Ошибка авторизации (401)');
                console.error('   Проверьте:');
                console.error('   1. Файл .npmrc существует в корне проекта');
                console.error('   2. Токен в .npmrc актуален и корректен');
                console.error('   3. У токена есть доступ к приватному registry');
                throw new Error('Не удалось авторизоваться для скачивания пакета. Проверьте .npmrc');
            }
            throw error;
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
     * Извлекает информацию о методах из папки API
     */
    extractApiInfo(distPath, serviceName) {
        const servicePath = path.join(distPath, serviceName);
        if (!fs.existsSync(servicePath)) {
            throw new Error(`Service folder not found: ${servicePath}`);
        }
        const endpoints = [];
        const methods = [];
        const dtos = [];
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
    parseFields(body) {
        const fields = [];
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
    compare(oldInfo, newInfo, serviceName) {
        const result = {
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
            if (!oldDto)
                continue;
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
    compareDtos(oldDto, newDto) {
        const change = {
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
            if (!oldField)
                continue;
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
    generateComparisonReport(result) {
        const lines = [];
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
    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true });
            console.log('✓ Временные файлы очищены');
        }
    }
}
exports.ApiComparator = ApiComparator;
//# sourceMappingURL=comparator.js.map