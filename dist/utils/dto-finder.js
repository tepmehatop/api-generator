"use strict";
/**
 * Утилиты для поиска и работы с DTO из сгенерированных файлов (Пункт 10)
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.findDtoForEndpoint = findDtoForEndpoint;
exports.generateDtoValidationCode = generateDtoValidationCode;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Ищет все .ts файлы в директории
 */
function findTsFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) {
        return files;
    }
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && item !== 'node_modules') {
                scan(fullPath);
            }
            else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }
    }
    scan(dir);
    return files;
}
/**
 * Ищет DTO для endpoint в сгенерированных файлах
 */
function findDtoForEndpoint(apiGeneratedPath, endpoint, method) {
    if (!apiGeneratedPath || !fs.existsSync(apiGeneratedPath)) {
        return null;
    }
    const files = findTsFiles(apiGeneratedPath);
    const normalizedEndpoint = endpoint.replace(/\{[^}]+\}/g, '{id}');
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        // Ищем endpoint в комментариях (@request METHOD:PATH)
        const requestRegex = new RegExp(`@request\\s+${method}:${normalizedEndpoint.replace(/\//g, '\\/')}`);
        if (!requestRegex.test(content)) {
            continue;
        }
        // Нашли файл с нужным endpoint, ищем DTO
        // Ищем строку с Promise<...>
        const promiseRegex = /Promise<([^>]+)>/;
        const match = content.match(promiseRegex);
        if (match) {
            const dtoName = match[1].trim();
            const dto = parseDtoFromContent(content, dtoName);
            if (dto) {
                return {
                    name: dtoName,
                    fields: dto,
                    filePath: file
                };
            }
        }
    }
    return null;
}
/**
 * Парсит DTO из содержимого файла
 */
function parseDtoFromContent(content, dtoName) {
    // Ищем interface или type
    const regex = new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${dtoName}\\s*[={]([^}]+)}`, 's');
    const match = content.match(regex);
    if (!match) {
        return null;
    }
    const body = match[1];
    const fields = [];
    const lines = body.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            continue;
        }
        // Парсим поле: name?: string
        const fieldMatch = trimmed.match(/^(\w+)(\?)?:\s*([^;,]+)/);
        if (fieldMatch) {
            fields.push({
                name: fieldMatch[1],
                type: fieldMatch[3].trim(),
                required: !fieldMatch[2]
            });
        }
    }
    return fields.length > 0 ? fields : null;
}
/**
 * Генерирует код проверки обязательных полей из DTO
 */
function generateDtoValidationCode(dtoInfo) {
    const lines = [];
    lines.push('    // Проверка обязательных полей из DTO');
    for (const field of dtoInfo.fields) {
        if (field.required) {
            lines.push(`    await expect(response.data.${field.name}).toBeDefined();`);
        }
    }
    return lines;
}
//# sourceMappingURL=dto-finder.js.map