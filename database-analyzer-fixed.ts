import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Конфигурация для анализа БД и генерации тестовых данных
 */
export interface DatabaseAnalyzerConfig {
  testFilePath: string;
  dbConnectionMethod: string;
  dbSchema?: string | null;
  force?: boolean;
  dataStrategy?: 'existing' | 'generate' | 'both';
  samplesCount?: number;
}

interface TableInfo {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  confidence: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

interface TestInfo {
  endpoint: string;
  httpMethod: string;
  dtoName?: string;
  dtoPath?: string;
  dtoFields: string[];
  existingTables: string[];
}

interface AnalysisResult {
  endpoint: string;
  confirmedTables: string[];
  suspectedTables: string[];
  relatedTables: string[];
  testData: Record<string, any[]>;
}

export class DatabaseAnalyzer {
  private config: Required<DatabaseAnalyzerConfig>;
  private sql: any; // Postgres connection
  
  constructor(config: DatabaseAnalyzerConfig, sqlConnection: any) {
    this.config = {
      force: false,
      dataStrategy: 'existing',
      samplesCount: 5,
      dbSchema: null,
      ...config
    };
    this.sql = sqlConnection;
  }
  
  /**
   * Главный метод анализа
   */
  async analyze(): Promise<AnalysisResult> {
    console.log('🔍 Начинаю анализ теста и БД...');
    console.log(`📄 Тест файл: ${this.config.testFilePath}\n`);
    
    // 1. Извлекаем информацию из теста
    const testInfo = await this.extractTestInfo();
    
    // Если force=false и таблицы уже найдены, пропускаем анализ
    if (!this.config.force && testInfo.existingTables.length > 0) {
      console.log('ℹ️  Таблицы уже найдены, пропускаю анализ (используйте force: true для повтора)');
      return {
        endpoint: testInfo.endpoint,
        confirmedTables: testInfo.existingTables,
        suspectedTables: [],
        relatedTables: [],
        testData: await this.generateTestData(testInfo.existingTables)
      };
    }
    
    // 2. ЭТАП 1: Анализ схемы БД
    console.log('📊 ЭТАП 1: Анализ схемы БД...');
    const suspectedTables = await this.analyzeDbSchema(testInfo.dtoFields);
    console.log(`✓ Найдено подозрительных таблиц: ${suspectedTables.length}`);
    suspectedTables.forEach(t => console.log(`  - ${t.schema}.${t.name} (confidence: ${t.confidence}%)`));
    console.log('');
    
    // 3. ЭТАП 2: Анализ Foreign Keys
    console.log('🔗 ЭТАП 2: Анализ Foreign Keys...');
    const relatedTables = await this.analyzeForeignKeys(suspectedTables);
    console.log(`✓ Найдено связанных таблиц: ${relatedTables.length}`);
    relatedTables.forEach(t => console.log(`  - ${t}`));
    console.log('');
    
    // 4. ЭТАП 3: Эмпирический тест
    console.log('🎯 ЭТАП 3: Эмпирический тест...');
    const allTables = [...suspectedTables.map(t => `${t.schema}.${t.name}`), ...relatedTables];
    const confirmedTables = await this.empiricalTest(testInfo, allTables);
    console.log(`✓ Подтверждено таблиц: ${confirmedTables.length}`);
    confirmedTables.forEach(t => console.log(`  - ${t}`));
    console.log('');
    
    // 5. Генерация тестовых данных
    console.log('💾 Генерация тестовых данных...');
    const testData = await this.generateTestData(confirmedTables);
    
    // 6. Обновляем тест файл
    await this.updateTestFile(testInfo, confirmedTables, testData);
    
    console.log('✓ Тест файл обновлен\n');
    
    return {
      endpoint: testInfo.endpoint,
      confirmedTables,
      suspectedTables: suspectedTables.map(t => `${t.schema}.${t.name}`),
      relatedTables,
      testData
    };
  }
  
  /**
   * Извлекает информацию из теста
   */
  private async extractTestInfo(): Promise<TestInfo> {
    const content = fs.readFileSync(this.config.testFilePath, 'utf-8');
    
    // Ищем endpoint
    const endpointMatch = content.match(/const\s+endpoint\s*=\s*['"`]([^'"`]+)['"`]/);
    const httpMethodMatch = content.match(/const\s+httpMethod\s*=\s*['"`]([^'"`]+)['"`]/);
    
    // Ищем DTO
    const dtoMatch = content.match(/\/\/\s*@dto:\s*(\w+)\s*->\s*(.+)/);
    
    // Ищем существующие таблицы
    const tablesMatch = content.match(/\/\/\s*@db-tables-start([\s\S]*?)\/\/\s*@db-tables:end/);
    const existingTables: string[] = [];
    if (tablesMatch) {
      const tableLines = tablesMatch[1].match(/\/\/\s*-\s*(\S+)/g);
      if (tableLines) {
        tableLines.forEach(line => {
          const match = line.match(/\/\/\s*-\s*(\S+)/);
          if (match) existingTables.push(match[1]);
        });
      }
    }
    
    // Извлекаем поля DTO
    let dtoFields: string[] = [];
    if (dtoMatch) {
      const dtoPath = dtoMatch[2].trim();
      const dtoName = dtoMatch[1];
      
      try {
        const dtoFilePath = path.resolve(path.dirname(this.config.testFilePath), dtoPath);
        const dtoContent = fs.readFileSync(dtoFilePath, 'utf-8');
        
        // Ищем интерфейс или тип
        const dtoInterfaceMatch = dtoContent.match(
          new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${dtoName}\\s*[={]([^}]+)}`, 's')
        );
        
        if (dtoInterfaceMatch) {
          const fieldsText = dtoInterfaceMatch[1];
          const fieldMatches = fieldsText.matchAll(/(\w+)\s*[?:]:/g);
          dtoFields = Array.from(fieldMatches, m => m[1]);
        }
      } catch (e) {
        console.warn(`⚠️  Не удалось прочитать DTO файл: ${e}`);
      }
    }
    
    console.log('✓ Извлечена информация о тесте');
    console.log(`  Endpoint: ${endpointMatch?.[1] || 'не найден'}`);
    console.log(`  Method: ${httpMethodMatch?.[1] || 'не найден'}`);
    console.log(`  DTO: ${dtoMatch?.[1] || 'не найден'}`);
    console.log(`  DTO поля: ${dtoFields.join(', ') || 'не найдены'}`);
    console.log(`  Существующие таблицы: ${existingTables.join(', ') || 'нет'}`);
    console.log('');
    
    return {
      endpoint: endpointMatch?.[1] || '',
      httpMethod: httpMethodMatch?.[1] || 'POST',
      dtoName: dtoMatch?.[1],
      dtoPath: dtoMatch?.[2],
      dtoFields,
      existingTables
    };
  }
  
  /**
   * ЭТАП 1: Анализ схемы БД
   * ВАЖНО: Используем tagged template literal для postgres!
   */
  private async analyzeDbSchema(dtoFields: string[]): Promise<TableInfo[]> {
    console.log(`  🔍 Ищу таблицы для полей: ${dtoFields.join(', ')}`);
    
    if (dtoFields.length === 0) {
      console.log('  ⚠️  Поля DTO не найдены, пропускаю анализ');
      return [];
    }
    
    // Генерируем варианты имен для полей
    const fieldVariants = dtoFields.flatMap(field => this.generateFieldVariants(field));
    
    // ✅ ПРАВИЛЬНО: Используем tagged template literal
    const schemaCondition = this.config.dbSchema 
      ? `table_schema = '${this.config.dbSchema}'`
      : `table_schema NOT IN ('information_schema', 'pg_catalog')`;
    
    console.log(`  📊 Режим поиска: ${this.config.dbSchema ? `в схеме "${this.config.dbSchema}"` : 'во всех схемах'}\n`);
    
    // ✅ ПРАВИЛЬНО: Используем template literal с обратными кавычками
    const columns = await this.sql`
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE ${this.sql(schemaCondition)}
      ORDER BY table_schema, table_name, ordinal_position
    `;
    
    console.log(`  ✓ Получено ${columns.length} колонок из БД`);
    
    // Группируем по таблицам
    const tablesMap = new Map<string, TableInfo>();
    
    for (const col of columns) {
      const tableKey = `${col.table_schema}.${col.table_name}`;
      
      if (!tablesMap.has(tableKey)) {
        tablesMap.set(tableKey, {
          schema: col.table_schema,
          name: col.table_name,
          columns: [],
          confidence: 0
        });
      }
      
      const table = tablesMap.get(tableKey)!;
      table.columns.push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES'
      });
      
      // Проверяем совпадение с вариантами полей
      if (fieldVariants.includes(col.column_name.toLowerCase())) {
        table.confidence += 25; // +25% за каждое совпадение
      }
    }
    
    // Фильтруем таблицы с confidence > 30%
    const suspectedTables = Array.from(tablesMap.values())
      .filter(t => t.confidence > 30)
      .sort((a, b) => b.confidence - a.confidence);
    
    return suspectedTables;
  }
  
  /**
   * Генерирует варианты имен для поля
   * camelCase -> snake_case, plural формы и т.д.
   */
  private generateFieldVariants(field: string): string[] {
    const variants: string[] = [];
    
    // Оригинальное имя
    variants.push(field.toLowerCase());
    
    // camelCase -> snake_case
    const snakeCase = field.replace(/([A-Z])/g, '_$1').toLowerCase();
    variants.push(snakeCase);
    
    // Без подчеркиваний
    variants.push(field.replace(/_/g, '').toLowerCase());
    
    // Множественное число -> единственное
    if (field.endsWith('s')) {
      variants.push(field.slice(0, -1).toLowerCase());
      const snakeSingular = snakeCase.slice(0, -1);
      variants.push(snakeSingular);
    }
    
    // Единственное -> множественное
    variants.push((field + 's').toLowerCase());
    variants.push((snakeCase + 's').toLowerCase());
    
    return [...new Set(variants)];
  }
  
  /**
   * ЭТАП 2: Анализ Foreign Keys
   */
  private async analyzeForeignKeys(suspectedTables: TableInfo[]): Promise<string[]> {
    if (suspectedTables.length === 0) return [];
    
    const relatedTables = new Set<string>();
    
    for (const table of suspectedTables) {
      // ✅ ПРАВИЛЬНО: Используем tagged template literal
      const fks = await this.sql`
        SELECT
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = ${table.schema}
          AND tc.table_name = ${table.name}
      `;
      
      fks.forEach((fk: any) => {
        relatedTables.add(`${fk.foreign_table_schema}.${fk.foreign_table_name}`);
      });
      
      // Обратные FK (кто ссылается на эту таблицу)
      const reverseFks = await this.sql`
        SELECT
          tc.table_schema,
          tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = ${table.schema}
          AND ccu.table_name = ${table.name}
      `;
      
      reverseFks.forEach((fk: any) => {
        relatedTables.add(`${fk.table_schema}.${fk.table_name}`);
      });
    }
    
    return Array.from(relatedTables);
  }
  
  /**
   * ЭТАП 3: Эмпирический тест
   */
  private async empiricalTest(testInfo: TestInfo, tables: string[]): Promise<string[]> {
    if (tables.length === 0) return [];
    
    console.log('  📸 Снимаем snapshot таблиц...');
    
    // Snapshot ДО
    const snapshotsBefore = new Map<string, any[]>();
    for (const tableFullName of tables) {
      const [schema, table] = tableFullName.split('.');
      
      try {
        // ✅ ПРАВИЛЬНО: Используем tagged template literal
        const rows = await this.sql`
          SELECT * FROM ${this.sql(tableFullName)}
          ORDER BY COALESCE(created_at, updated_at, id) DESC
          LIMIT 10
        `;
        snapshotsBefore.set(tableFullName, rows);
      } catch (e) {
        console.warn(`  ⚠️  Не удалось прочитать таблицу ${tableFullName}`);
      }
    }
    
    // Генерируем уникальные данные
    console.log('  🎲 Сгенерированы уникальные данные');
    const timestamp = Date.now();
    const uniqueData = this.generateUniqueTestData(testInfo.dtoFields, timestamp);
    
    // Вызываем endpoint
    console.log(`  📡 Вызываем ${testInfo.httpMethod} ${testInfo.endpoint}...`);
    try {
      await axios({
        method: testInfo.httpMethod.toLowerCase(),
        url: `http://localhost:3000${testInfo.endpoint}`,
        data: uniqueData,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('  ✓ Endpoint вызван успешно');
    } catch (e: any) {
      console.log(`  ⚠️  Endpoint вернул ошибку: ${e.response?.status || e.message}`);
    }
    
    // Небольшая пауза
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Snapshot ПОСЛЕ
    const confirmedTables: string[] = [];
    for (const tableFullName of tables) {
      const [schema, table] = tableFullName.split('.');
      
      try {
        const rowsAfter = await this.sql`
          SELECT * FROM ${this.sql(tableFullName)}
          ORDER BY COALESCE(created_at, updated_at, id) DESC
          LIMIT 10
        `;
        
        // Ищем наши уникальные данные
        const found = rowsAfter.some((row: any) => {
          return Object.values(uniqueData).some(value => {
            return Object.values(row).some(cellValue => {
              return String(cellValue).includes(String(value));
            });
          });
        });
        
        if (found) {
          confirmedTables.push(tableFullName);
        }
      } catch (e) {
        // ignore
      }
    }
    
    return confirmedTables;
  }
  
  /**
   * Генерирует уникальные тестовые данные
   */
  private generateUniqueTestData(fields: string[], timestamp: number): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (const field of fields) {
      const lowerField = field.toLowerCase();
      
      if (lowerField.includes('id')) {
        data[field] = 999900000 + timestamp;
      } else if (lowerField.includes('email')) {
        data[field] = `test_${timestamp}@analyzer.test`;
      } else if (lowerField.includes('name')) {
        data[field] = `TEST_${timestamp}_NAME`;
      } else if (lowerField.includes('amount') || lowerField.includes('price')) {
        data[field] = 999.99 + timestamp;
      } else if (lowerField.includes('date')) {
        data[field] = new Date(timestamp).toISOString();
      } else {
        data[field] = `TEST_${timestamp}`;
      }
    }
    
    return data;
  }
  
  /**
   * Генерирует тестовые данные из БД
   */
  private async generateTestData(tables: string[]): Promise<Record<string, any[]>> {
    const testData: Record<string, any[]> = {};
    
    for (const tableFullName of tables) {
      try {
        // ✅ ПРАВИЛЬНО: Используем tagged template literal
        const rows = await this.sql`
          SELECT * FROM ${this.sql(tableFullName)}
          WHERE deleted_at IS NULL OR deleted_at IS NULL
          ORDER BY COALESCE(created_at, updated_at, id) DESC
          LIMIT ${this.config.samplesCount}
        `;
        
        testData[tableFullName] = rows;
        console.log(`  ✓ ${tableFullName}: ${rows.length} записей из БД`);
      } catch (e) {
        console.warn(`  ⚠️  Не удалось получить данные из ${tableFullName}`);
        testData[tableFullName] = [];
      }
    }
    
    return testData;
  }
  
  /**
   * Обновляет тест файл с найденными таблицами и данными
   */
  private async updateTestFile(
    testInfo: TestInfo,
    confirmedTables: string[],
    testData: Record<string, any[]>
  ): Promise<void> {
    let content = fs.readFileSync(this.config.testFilePath, 'utf-8');
    
    // Формируем секцию с таблицами
    const tablesSection = [
      '// @db-tables-start',
      '// Таблицы используемые в этом тесте:',
      ...confirmedTables.map(t => `//  - ${t}`),
      '// @db-tables:end'
    ].join('\n');
    
    // Заменяем или добавляем секцию
    if (content.includes('@db-tables-start')) {
      content = content.replace(
        /\/\/\s*@db-tables-start[\s\S]*?\/\/\s*@db-tables:end/,
        tablesSection
      );
    } else {
      // Добавляем после endpoint
      content = content.replace(
        /(const\s+httpMethod\s*=\s*['"`][^'"`]+['"`];)/,
        `$1\n\n${tablesSection}`
      );
    }
    
    // Добавляем тестовые данные (если их еще нет)
    if (!content.includes('// Generated test data from DB')) {
      const dataSection = this.formatTestData(testData);
      content = content.replace(
        /(describe\([^{]+{)/,
        `$1\n${dataSection}\n`
      );
    }
    
    fs.writeFileSync(this.config.testFilePath, content, 'utf-8');
  }
  
  /**
   * Форматирует тестовые данные для вставки в тест
   */
  private formatTestData(testData: Record<string, any[]>): string {
    const lines: string[] = ['  // Generated test data from DB', '  const testData = {'];
    
    for (const [table, rows] of Object.entries(testData)) {
      if (rows.length === 0) continue;
      
      const tableName = table.split('.').pop() || table;
      lines.push(`    ${tableName}: [`);
      
      rows.forEach((row, index) => {
        const rowStr = JSON.stringify(row, null, 6).replace(/^/gm, '      ');
        lines.push(rowStr + (index < rows.length - 1 ? ',' : ''));
      });
      
      lines.push('    ],');
    }
    
    lines.push('  };');
    lines.push('');
    
    return lines.join('\n');
  }
}

/**
 * Экспортируемая функция для удобства использования
 */
export async function analyzeAndGenerateTestData(
  config: DatabaseAnalyzerConfig,
  sqlConnection: any
): Promise<AnalysisResult> {
  const analyzer = new DatabaseAnalyzer(config, sqlConnection);
  return await analyzer.analyze();
}
