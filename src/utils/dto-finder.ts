/**
 * Утилиты для поиска и работы с DTO из сгенерированных файлов (Пункт 10)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DTOField {
  name: string;
  type: string;
  required: boolean;
}

export interface DTOInfo {
  name: string;
  fields: DTOField[];
  filePath: string;
}

/**
 * Ищет все .ts файлы в директории
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  function scan(currentDir: string) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'node_modules') {
        scan(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
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
export function findDtoForEndpoint(
  apiGeneratedPath: string,
  endpoint: string,
  method: string
): DTOInfo | null {
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
function parseDtoFromContent(content: string, dtoName: string): DTOField[] | null {
  // Ищем interface или type
  const regex = new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${dtoName}\\s*[={]([^}]+)}`, 's');
  const match = content.match(regex);
  
  if (!match) {
    return null;
  }
  
  const body = match[1];
  const fields: DTOField[] = [];
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
export function generateDtoValidationCode(dtoInfo: DTOInfo): string[] {
  const lines: string[] = [];
  
  lines.push('    // Проверка обязательных полей из DTO');
  
  for (const field of dtoInfo.fields) {
    if (field.required) {
      lines.push(`    await expect(response.data.${field.name}).toBeDefined();`);
    }
  }
  
  return lines;
}
