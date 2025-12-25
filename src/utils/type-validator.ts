/**
 * Утилиты для валидации структуры и типов данных в response (Пункт 9)
 */

export interface FieldSchema {
  name: string;
  type: string;
  required: boolean;
  isArray?: boolean;
}

/**
 * Генерирует код валидации типов для response
 */
export function generateTypeValidationCode(data: any, varName: string = 'response.data'): string[] {
  const lines: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return lines;
  }
  
  // Для каждого поля генерируем проверку типа
  for (const key in data) {
    const value = data[key];
    const fieldPath = `${varName}.${key}`;
    
    if (value === null || value === undefined) {
      continue;
    }
    
    if (Array.isArray(value)) {
      lines.push(`    await expect(Array.isArray(${fieldPath})).toBe(true);`);
      if (value.length > 0 && typeof value[0] === 'object') {
        lines.push(`    if (${fieldPath}.length > 0) {`);
        lines.push(`      await expect(${fieldPath}[0]).toBeDefined();`);
        lines.push(`    }`);
      }
    } else if (typeof value === 'object') {
      lines.push(`    await expect(typeof ${fieldPath}).toBe('object');`);
    } else {
      const jsType = typeof value;
      lines.push(`    await expect(typeof ${fieldPath}).toBe('${jsType}');`);
    }
  }
  
  return lines;
}
