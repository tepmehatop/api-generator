import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Конфигурация для анализа БД и генерации тестовых данных
 */
export interface DatabaseAnalyzerConfig {
  /**
   * Путь к тест файлу который нужно проанализировать
   * Например: './tests/api/orders/createOrder.test.ts'
   */
  testFilePath: string;
  
  /**
   * Имя метода для подключения к БД (template literal)
   * Например: 'testDbConnect' - будет использоваться как await testDbConnect`SELECT ...`
   */
  dbConnectionMethod: string;
  
  /**
   * Схема БД для поиска таблиц
   * @default null - искать во всех схемах
   * Примеры: 'public', 'app', 'orders_schema'
   */
  dbSchema?: string | null;
  
  /**
   * Force режим - заново искать таблицы даже если они уже найдены
   * @default false
   */
  force?: boolean;
  
  /**
   * Генерировать новые данные или использовать существующие
   * @default 'existing' - брать существующие данные из БД
   */
  dataStrategy?: 'existing' | 'generate' | 'both';
  
  /**
   * Количество примеров данных для каждой таблицы
   * @default 5
   */
  samplesCount?: number;
  
  /**
   * Этапы анализа которые нужно выполнить
   * @default { schemaAnalysis: true, foreignKeys: true, empiricalTest: true }
   */
  stages?: {
    schemaAnalysis?: boolean;    // Этап 1: Анализ схемы БД
    foreignKeys?: boolean;        // Этап 2: Анализ Foreign Keys
    empiricalTest?: boolean;      // Этап 3: Эмпирический тест (вызов endpoint)
  };
  
  /**
   * Токен авторизации для вызова endpoint (для Этапа 3)
   * Будет добавлен в заголовок Authorization: Bearer <token>
   */
  authToken?: string;
  
  /**
   * Поля которые нужно исключить при генерации данных для эмпирического теста (Этап 3)
   * Например: ['id', 'created_at', 'updated_at']
   */
  excludeFieldsForEmpirical?: string[];
  
  /**
   * Детализация логов для каждого этапа
   * @default { stage1: true, stage2: true, stage3: true }
   */
  verboseStages?: {
    stage1?: boolean;  // Детальные логи Этапа 1
    stage2?: boolean;  // Детальные логи Этапа 2
    stage3?: boolean;  // Детальные логи Этапа 3
  };
}

/**
 * Информация о таблице БД
 */
interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  confidence: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

interface ForeignKeyInfo {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

/**
 * Извлеченная информация из теста
 */
interface TestInfo {
  endpoint: string;
  httpMethod: string;
  dtoName?: string;
  dtoPath?: string;
  existingTables: string[];
}

/**
 * Результат анализа
 */
interface AnalysisResult {
  endpoint: string;
  confirmedTables: string[];
  suspectedTables: string[];
  relatedTables: string[];
  testData: Record<string, any[]>;
}

/**
 * Анализатор базы данных для генерации тестовых данных
 */
export class DatabaseAnalyzer {
  private config: Required<DatabaseAnalyzerConfig>;
  private dbConnect: any; // Функция подключения к БД
  private schemaCache: Map<string, TableInfo> = new Map();
  
  constructor(config: DatabaseAnalyzerConfig, dbConnectFunction: any) {
    const defaultStages = {
      schemaAnalysis: true,
      foreignKeys: true,
      empiricalTest: true
    };
    
    const defaultVerbose = {
      stage1: true,
      stage2: true,
      stage3: true
    };
    
    this.config = {
      force: false,
      dataStrategy: 'existing',
      samplesCount: 15,  // Увеличено до 15 для pairwise
      dbSchema: null,
      authToken: undefined,
      stages: { ...defaultStages, ...(config.stages || {}) },
      verboseStages: { ...defaultVerbose, ...(config.verboseStages || {}) },
      ...config
    } as Required<DatabaseAnalyzerConfig>;
    
    this.dbConnect = dbConnectFunction;
  }
  
  /**
   * Главный метод - анализирует тест и генерирует данные
   */
  async analyze(): Promise<AnalysisResult> {
    console.log('🔍 Начинаю анализ теста и БД...');
    console.log(`📄 Тест файл: ${this.config.testFilePath}`);
    
    // Показываем какие этапы включены
    console.log('');
    console.log('⚙️  Конфигурация этапов:');
    console.log(`  Этап 1 (Schema Analysis): ${this.config.stages!.schemaAnalysis ? '✅ Включен' : '❌ Выключен'}`);
    console.log(`  Этап 2 (Foreign Keys): ${this.config.stages!.foreignKeys ? '✅ Включен' : '❌ Выключен'}`);
    console.log(`  Этап 3 (Empirical Test): ${this.config.stages!.empiricalTest ? '✅ Включен' : '❌ Выключен'}`);
    console.log('');
    
    // 1. Читаем тест файл и извлекаем информацию
    const testInfo = await this.extractTestInfo();
    console.log(`✓ Извлечена информация о тесте`);
    console.log(`  Endpoint: ${testInfo.httpMethod} ${testInfo.endpoint}`);
    console.log(`  DTO: ${testInfo.dtoName || 'не указано'}`);
    
    // 2. Проверяем нужно ли заново искать таблицы
    if (!this.config.force && testInfo.existingTables.length > 0) {
      console.log(`✓ Используются существующие таблицы: ${testInfo.existingTables.join(', ')}`);
      
      // Генерируем только данные
      const testData = await this.generateTestData(testInfo.existingTables);
      
      return {
        endpoint: testInfo.endpoint,
        confirmedTables: testInfo.existingTables,
        suspectedTables: [],
        relatedTables: [],
        testData
      };
    }
    
    // 3. Загружаем DTO если указан
    let dtoFields: string[] = [];
    if (testInfo.dtoPath && testInfo.dtoName) {
      dtoFields = await this.extractDTOFields(testInfo.dtoPath, testInfo.dtoName);
      console.log(`✓ Извлечены поля DTO: ${dtoFields.join(', ')}`);
    }
    
    let suspectedTables: TableInfo[] = [];
    let relatedTables: string[] = [];
    let confirmedTables: string[] = [];
    
    // 4. ЭТАП 1: Schema Analysis - находим подозрительные таблицы
    if (this.config.stages!.schemaAnalysis) {
      console.log('\n📊 ЭТАП 1: Анализ схемы БД...');
      suspectedTables = await this.findTablesByFields(dtoFields);
      
      if (suspectedTables.length > 0) {
        console.log(`✓ Найдено подозрительных таблиц: ${suspectedTables.length}`);
        suspectedTables.forEach(t => 
          console.log(`  - ${t.name} (confidence: ${(t.confidence * 100).toFixed(0)}%)`)
        );
      } else {
        console.log(`⚠️  Подозрительные таблицы не найдены`);
      }
    } else {
      console.log('\n⏭️  ЭТАП 1: Пропущен (отключен в конфигурации)');
    }
    
    // 5. ЭТАП 2: FK Analysis - расширяем список связанными таблицами
    if (this.config.stages!.foreignKeys && suspectedTables.length > 0) {
      console.log('\n🔗 ЭТАП 2: Анализ Foreign Keys...');
      relatedTables = await this.findRelatedTables(
        suspectedTables.map(t => t.name)
      );
      
      if (relatedTables.length > 0) {
        console.log(`✓ Найдено связанных таблиц: ${relatedTables.length}`);
        relatedTables.forEach(t => console.log(`  - ${t}`));
      } else {
        console.log(`ℹ️  Связанные таблицы не найдены (или нет Foreign Keys)`);
      }
    } else if (this.config.stages!.foreignKeys) {
      console.log('\n⏭️  ЭТАП 2: Пропущен (нет подозрительных таблиц)');
    } else {
      console.log('\n⏭️  ЭТАП 2: Пропущен (отключен в конфигурации)');
    }
    
    // 6. ЭТАП 3: Empirical Test - подтверждаем реальным вызовом
    if (this.config.stages!.empiricalTest && suspectedTables.length > 0) {
      console.log('\n🎯 ЭТАП 3: Эмпирический тест...');
      const allTablesToCheck = [
        ...suspectedTables.map(t => t.name),
        ...relatedTables
      ];
      
      confirmedTables = await this.confirmWithRealCall(
        testInfo.endpoint,
        testInfo.httpMethod,
        dtoFields,
        allTablesToCheck
      );
      
      if (confirmedTables.length > 0) {
        console.log(`✓ Подтверждено таблиц: ${confirmedTables.length}`);
        confirmedTables.forEach(t => console.log(`  - ${t}`));
      } else {
        console.log(`⚠️  Таблицы не подтверждены (endpoint не создал данных или вернул ошибку)`);
        console.log(`💡 Используем таблицу с наивысшим confidence из Этапа 1`);
        
        // Используем таблицу с наивысшим confidence
        if (suspectedTables.length > 0) {
          confirmedTables = [suspectedTables[0].name];
          console.log(`✓ Выбрана таблица: ${confirmedTables[0]} (${(suspectedTables[0].confidence * 100).toFixed(0)}% confidence)`);
        }
      }
    } else if (this.config.stages!.empiricalTest) {
      console.log('\n⏭️  ЭТАП 3: Пропущен (нет подозрительных таблиц)');
      
      // Используем результаты Этапа 1
      if (suspectedTables.length > 0) {
        confirmedTables = [suspectedTables[0].name];
        console.log(`✓ Используется таблица с наивысшим confidence: ${confirmedTables[0]} (${(suspectedTables[0].confidence * 100).toFixed(0)}%)`);
      }
    } else {
      console.log('\n⏭️  ЭТАП 3: Пропущен (отключен в конфигурации)');
      
      // Используем результаты Этапа 1
      if (suspectedTables.length > 0) {
        confirmedTables = [suspectedTables[0].name];
        console.log(`✓ Используется таблица с наивысшим confidence: ${confirmedTables[0]} (${(suspectedTables[0].confidence * 100).toFixed(0)}%)`);
      }
    }
    
    // 7. Генерируем тестовые данные
    if (confirmedTables.length > 0) {
      console.log('\n💾 Генерация тестовых данных...');
      const testData = await this.generateTestData(confirmedTables);
      console.log(`✓ Сгенерированы данные для ${Object.keys(testData).length} таблиц`);
      
      // 8. Обновляем тест файл
      await this.updateTestFile(confirmedTables, testData);
      console.log(`✓ Тест файл обновлен`);
      
      return {
        endpoint: testInfo.endpoint,
        confirmedTables,
        suspectedTables: suspectedTables.map(t => t.name),
        relatedTables,
        testData
      };
    } else {
      console.log('\n❌ Не удалось найти подходящие таблицы');
      console.log('💡 Попробуйте:');
      console.log('   1. Проверить что DTO указано правильно');
      console.log('   2. Указать конкретную схему БД (dbSchema)');
      console.log('   3. Проверить naming convention (camelCase vs snake_case)');
      
      return {
        endpoint: testInfo.endpoint,
        confirmedTables: [],
        suspectedTables: suspectedTables.map(t => t.name),
        relatedTables,
        testData: {}
      };
    }
  }
  
  /**
   * Извлекает информацию из тест файла
   */
  private async extractTestInfo(): Promise<TestInfo> {
    console.log('  🔍 Читаю тест файл...');
    
    try {
      const content = fs.readFileSync(this.config.testFilePath, 'utf-8');
      console.log(`  ✓ Файл прочитан, размер: ${content.length} символов`);
      
      // Извлекаем endpoint
      const endpointMatch = content.match(/const endpoint = ['`](.+?)['`];/);
      const endpoint = endpointMatch ? endpointMatch[1] : '';
      console.log(`  ✓ Endpoint: ${endpoint || 'НЕ НАЙДЕН'}`);
      
      // Извлекаем HTTP метод
      const methodMatch = content.match(/const httpMethod = ['"](.+?)['"];/);
      const httpMethod = methodMatch ? methodMatch[1] : 'GET';
      console.log(`  ✓ HTTP Method: ${httpMethod}`);
      
      // Извлекаем DTO информацию
      const dtoNameMatch = content.match(/const dtoName = ['"](.+?)['"];/);
      const dtoName = dtoNameMatch ? dtoNameMatch[1] : undefined;
      console.log(`  ✓ DTO Name: ${dtoName || 'НЕ НАЙДЕНО'}`);
      
      const dtoPathMatch = content.match(/const dtoPath = ['"](.+?)['"];/);
      const dtoPath = dtoPathMatch ? dtoPathMatch[1] : undefined;
      console.log(`  ✓ DTO Path: ${dtoPath || 'НЕ НАЙДЕНО'}`);
      
      // Извлекаем существующие таблицы
      const tablesMatch = content.match(
        /\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[(.*?)\];/s
      );
      
      let existingTables: string[] = [];
      if (tablesMatch && tablesMatch[1].trim()) {
        existingTables = tablesMatch[1]
          .split(',')
          .map(t => t.trim().replace(/['"]/g, ''))
          .filter(t => t.length > 0);
        console.log(`  ✓ Существующие таблицы: ${existingTables.join(', ')}`);
      } else {
        console.log(`  ℹ️  Таблицы еще не определены`);
      }
      
      return {
        endpoint,
        httpMethod,
        dtoName,
        dtoPath,
        existingTables
      };
    } catch (error: any) {
      console.error(`  ❌ Ошибка при чтении теста: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Извлекает поля из DTO
   */
  private async extractDTOFields(dtoPath: string, dtoName: string): Promise<string[]> {
    console.log(`  🔍 Читаю DTO из ${dtoPath}...`);
    
    try {
      // Проверяем существование файла
      if (!fs.existsSync(dtoPath)) {
        console.error(`  ❌ Файл не найден: ${dtoPath}`);
        return [];
      }
      
      const content = fs.readFileSync(dtoPath, 'utf-8');
      console.log(`  ✓ Файл прочитан, размер: ${content.length} символов`);
      
      // Ищем интерфейс или type
      const interfaceRegex = new RegExp(
        `export\\s+(?:interface|type)\\s+${dtoName}\\s*[={]([^}]+)}`,
        's'
      );
      
      const match = content.match(interfaceRegex);
      if (!match) {
        console.error(`  ❌ DTO '${dtoName}' не найдено в файле`);
        console.log(`  💡 Ищу варианты в файле...`);
        
        // Показываем какие интерфейсы есть
        const allInterfaces = content.match(/export\s+(?:interface|type)\s+(\w+)/g);
        if (allInterfaces) {
          console.log(`  📋 Найденные типы в файле:`);
          allInterfaces.slice(0, 10).forEach(i => console.log(`      - ${i}`));
        }
        
        return [];
      }
      
      const interfaceBody = match[1];
      const fields: string[] = [];
      
      console.log(`  ✓ DTO найдено, парсим поля...`);
      
      // Парсим поля
      const lines = interfaceBody.split('\n');
      for (const line of lines) {
        const fieldMatch = line.match(/^\s*['"]?(\w+)['"]?\??:/);
        if (fieldMatch) {
          fields.push(fieldMatch[1]);
        }
      }
      
      console.log(`  ✓ Извлечено полей: ${fields.length}`);
      fields.forEach(f => console.log(`      - ${f}`));
      
      return fields;
    } catch (error: any) {
      console.error(`  ❌ Ошибка при чтении DTO: ${error.message}`);
      return [];
    }
  }
  
  /**
   * ЭТАП 1: Находит таблицы по полям DTO
   */
  private async findTablesByFields(dtoFields: string[]): Promise<TableInfo[]> {
    if (dtoFields.length === 0) {
      console.log('⚠️  Поля DTO не найдены, пропускаю schema analysis');
      return [];
    }
    
    console.log(`  🔍 Ищу таблицы для полей: ${dtoFields.join(', ')}`);
    
    // Определяем режим поиска
    const searchMode = this.config.dbSchema 
      ? `в схеме "${this.config.dbSchema}"` 
      : 'во всех схемах';
    console.log(`  📊 Режим поиска: ${searchMode}`);
    
    // Получаем все таблицы и колонки
    try {
      // Формируем WHERE условие для схемы
      const schemaCondition = this.config.dbSchema 
        ? `table_schema = '${this.config.dbSchema}'`
        : `table_schema NOT IN ('information_schema', 'pg_catalog')`;
      
      const sqlQuery = `
        SELECT 
          table_schema,
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE ${schemaCondition}
        ORDER BY table_schema, table_name, ordinal_position
      `;
      
      console.log('  📋 SQL запрос для получения схемы БД:');
      console.log('  ┌─────────────────────────────────────────────────────────────────┐');
      sqlQuery.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`  │ ${line.padEnd(63)} │`);
        }
      });
      console.log('  └─────────────────────────────────────────────────────────────────┘');
      
      let result;
      if (this.config.dbSchema) {
        // Ищем в конкретной схеме
        result = await this.dbConnect`
          SELECT 
            table_schema,
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = ${this.config.dbSchema}
          ORDER BY table_schema, table_name, ordinal_position
        `;
      } else {
        // Ищем во всех схемах (кроме системных)
        result = await this.dbConnect`
          SELECT 
            table_schema,
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
          ORDER BY table_schema, table_name, ordinal_position
        `;
      }
      
      console.log(`  ✓ Получено ${result.length} колонок из БД`);
      
      // Показываем найденные схемы
      const schemas = new Set(result.map((row: any) => row.table_schema));
      console.log(`  ✓ Найдено схем: ${schemas.size}`);
      schemas.forEach(schema => console.log(`      - ${schema}`));
      
      // Показываем первые 10 колонок для примера
      if (result.length > 0) {
        console.log('  📊 Примеры колонок из БД (первые 10):');
        result.slice(0, 10).forEach((row: any) => {
          console.log(`      ${row.table_schema}.${row.table_name}.${row.column_name} (${row.data_type})`);
        });
        if (result.length > 10) {
          console.log(`      ... и еще ${result.length - 10} колонок`);
        }
      }
      
      // Группируем по таблицам (с учетом схемы)
      const tableColumns = new Map<string, ColumnInfo[]>();
      const tableSchemas = new Map<string, string>(); // table_name → schema
      
      for (const row of result) {
        const fullTableName = `${row.table_schema}.${row.table_name}`;
        
        if (!tableColumns.has(fullTableName)) {
          tableColumns.set(fullTableName, []);
          tableSchemas.set(fullTableName, row.table_schema);
        }
        
        tableColumns.get(fullTableName)!.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
        });
      }
      
      console.log(`  ✓ Найдено ${tableColumns.size} таблиц в БД`);
      
      const verbose = this.config.verboseStages!.stage1;
      
      if (verbose) {
        console.log('');
        console.log('  🔎 ДЕТАЛЬНЫЙ АНАЛИЗ КАЖДОГО ПОЛЯ DTO:');
        console.log('  ═══════════════════════════════════════════════════════════════════');
      }
      
      // Подсчитываем совпадения с детальным логированием
      const scores: TableInfo[] = [];
      
      for (const [fullTableName, columns] of tableColumns.entries()) {
        let matchCount = 0;
        const matchedFields: string[] = [];
        
        for (const dtoField of dtoFields) {
          // Генерируем варианты имени поля
          const variants = this.generateFieldVariants(dtoField);
          
          if (verbose) {
            console.log(`  📌 Поле DTO: "${dtoField}"`);
            console.log(`     Генерирую варианты: ${variants.slice(0, 8).join(', ')}${variants.length > 8 ? ', ...' : ''}`);
          }
          
          // Ищем совпадение
          const matchedColumn = columns.find(col => variants.includes(col.name));
          
          if (matchedColumn) {
            matchCount++;
            matchedFields.push(`${dtoField} → ${matchedColumn.name}`);
            
            if (verbose) {
              console.log(`     ✓ НАЙДЕНО в таблице "${fullTableName}": ${matchedColumn.name}`);
            }
          } else if (verbose) {
            // Показываем что есть в таблице для отладки
            const similarColumns = columns
              .filter(col => {
                const colLower = col.name.toLowerCase();
                const fieldLower = dtoField.toLowerCase();
                return colLower.includes(fieldLower) || fieldLower.includes(colLower);
              })
              .slice(0, 3);
            
            if (similarColumns.length > 0) {
              console.log(`     ⚠️  НЕ НАЙДЕНО в "${fullTableName}", но есть похожие:`);
              similarColumns.forEach(col => {
                console.log(`        - ${col.name}`);
              });
            } else {
              console.log(`     ✗ НЕ НАЙДЕНО в "${fullTableName}"`);
            }
          }
          
          if (verbose) {
            console.log('');
          }
        }
        
        if (matchCount > 0) {
          const confidence = matchCount / dtoFields.length;
          
          if (verbose) {
            console.log(`  ╔═══════════════════════════════════════════════════════════════╗`);
            console.log(`  ║ 🎯 ТАБЛИЦА: ${fullTableName.padEnd(48)} ║`);
            console.log(`  ║ Совпадений: ${matchCount}/${dtoFields.length} (${(confidence * 100).toFixed(0)}%)${' '.repeat(43 - matchCount.toString().length - dtoFields.length.toString().length)} ║`);
            console.log(`  ╠═══════════════════════════════════════════════════════════════╣`);
            matchedFields.forEach(m => {
              console.log(`  ║ ✓ ${m.padEnd(60)} ║`);
            });
            console.log(`  ╚═══════════════════════════════════════════════════════════════╝`);
            console.log('');
          }
          
          scores.push({
            name: fullTableName, // Сохраняем полное имя со схемой
            columns,
            foreignKeys: [],
            confidence
          });
        }
      }
      
      if (scores.length === 0) {
        console.log('  ╔═══════════════════════════════════════════════════════════════╗');
        console.log('  ║ ⚠️  СОВПАДЕНИЙ НЕ НАЙДЕНО                                    ║');
        console.log('  ╚═══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  🔧 ОТЛАДОЧНАЯ ИНФОРМАЦИЯ:');
        console.log('');
        console.log('  📋 Ваши поля DTO:');
        dtoFields.forEach(field => {
          console.log(`     - ${field}`);
        });
        console.log('');
        console.log('  🔄 Примеры генерируемых вариантов:');
        dtoFields.slice(0, 3).forEach(field => {
          const variants = this.generateFieldVariants(field);
          console.log(`     ${field} →`);
          variants.slice(0, 8).forEach(v => {
            console.log(`        - "${v}"`);
          });
          if (variants.length > 8) {
            console.log(`        ... и еще ${variants.length - 8} вариантов`);
          }
        });
        console.log('');
        console.log('  💡 ВОЗМОЖНЫЕ ПРОБЛЕМЫ:');
        console.log('     1. Naming convention отличается от стандартной');
        console.log('     2. Поля находятся в разных таблицах');
        console.log('     3. Имена полей в БД сильно отличаются от DTO');
        console.log('     4. Таблицы находятся в другой схеме');
        console.log('');
        console.log('  📝 РЕКОМЕНДАЦИИ:');
        console.log('     1. Проверьте реальные имена колонок в БД:');
        if (this.config.dbSchema) {
          console.log(`        SELECT column_name FROM information_schema.columns`);
          console.log(`        WHERE table_schema = '${this.config.dbSchema}'`);
          console.log(`          AND table_name = 'предполагаемая_таблица';`);
        } else {
          console.log(`        SELECT table_schema, table_name, column_name`);
          console.log(`        FROM information_schema.columns`);
          console.log(`        WHERE table_name = 'предполагаемая_таблица';`);
        }
        console.log('');
        console.log('     2. Сравните с вашими полями DTO:');
        dtoFields.forEach(field => {
          console.log(`        DTO: ${field} → БД: ${this.toSnakeCase(field)}`);
        });
        console.log('');
        console.log('     3. Если таблицы в другой схеме, укажите dbSchema:');
        console.log('        dbSchema: "your_schema_name"');
        console.log('');
        console.log('     4. Если naming сильно отличается, используйте force: false');
        console.log('        и укажите таблицы вручную в тесте');
      }
      
      // Сортируем по confidence и возвращаем топ-10
      return scores
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10);
    } catch (error: any) {
      console.error(`  ❌ Ошибка при чтении схемы БД: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
      return [];
    }
  }
  
  /**
   * Конвертирует camelCase в snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
  
  /**
   * Генерирует варианты имени поля (camelCase, snake_case, etc)
   */
  private generateFieldVariants(field: string): string[] {
    const variants = new Set<string>();
    
    // 1. Оригинал
    variants.add(field);
    variants.add(field.toLowerCase());
    
    // 2. snake_case (правильная конвертация)
    // orderType → order_type
    // productId → product_id
    // regNumberS → reg_number_s
    const snakeCase = field
      .replace(/([A-Z])/g, (match, char, offset) => {
        // Если заглавная буква в начале, не добавляем подчеркивание
        return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
      });
    
    variants.add(snakeCase);
    
    // 3. Вариант с подчеркиванием в начале (на случай если было с заглавной)
    if (snakeCase.startsWith('_')) {
      variants.add(snakeCase.substring(1));
    }
    
    // 4. SCREAMING_SNAKE_CASE
    variants.add(snakeCase.toUpperCase());
    
    // 5. kebab-case
    const kebabCase = snakeCase.replace(/_/g, '-');
    variants.add(kebabCase);
    
    // 6. PascalCase
    const pascalCase = field.charAt(0).toUpperCase() + field.slice(1);
    variants.add(pascalCase);
    
    // 7. Plural формы
    variants.add(field + 's');
    variants.add(snakeCase + 's');
    variants.add(field.toLowerCase() + 's');
    
    // 8. Без последней буквы (для множественного числа)
    if (field.endsWith('s') || field.endsWith('S')) {
      const singular = field.slice(0, -1);
      variants.add(singular);
      variants.add(singular.toLowerCase());
      
      const singularSnake = singular
        .replace(/([A-Z])/g, (match, char, offset) => {
          return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
        });
      variants.add(singularSnake);
    }
    
    // 9. Без префиксов (is, has, get, set)
    const withoutPrefix = field.replace(/^(is|has|get|set|use|can|should)/, '');
    if (withoutPrefix !== field) {
      variants.add(withoutPrefix);
      variants.add(withoutPrefix.toLowerCase());
      
      const withoutPrefixSnake = withoutPrefix
        .replace(/([A-Z])/g, (match, char, offset) => {
          return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
        });
      variants.add(withoutPrefixSnake);
    }
    
    // 10. Без суффиксов (Id, ID, Type, Status, etc)
    const withoutSuffix = field
      .replace(/(Id|ID|Type|Status|Date|Time|At|By)$/, '');
    if (withoutSuffix !== field) {
      variants.add(withoutSuffix);
      variants.add(withoutSuffix.toLowerCase());
      
      const withoutSuffixSnake = withoutSuffix
        .replace(/([A-Z])/g, (match, char, offset) => {
          return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
        });
      variants.add(withoutSuffixSnake);
    }
    
    // 11. Альтернативные варианты для распространенных паттернов
    // userId → user_id, uid
    if (field.toLowerCase().endsWith('id')) {
      const base = field.slice(0, -2);
      const baseSnake = base
        .replace(/([A-Z])/g, (match, char, offset) => {
          return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
        });
      
      variants.add(baseSnake + '_id');
      variants.add(baseSnake + 'id');
      variants.add(base.toLowerCase() + '_id');
      variants.add(base.toLowerCase() + 'id');
    }
    
    // 12. Убираем пустые строки
    const result = Array.from(variants).filter(v => v.length > 0);
    
    return result;
  }
  
  /**
   * ЭТАП 2: Находит связанные таблицы через FK
   */
  private async findRelatedTables(mainTables: string[]): Promise<string[]> {
    if (mainTables.length === 0) return [];
    
    const verbose = this.config.verboseStages!.stage2;
    const related = new Set<string>();
    
    if (verbose) {
      console.log('  🔍 Ищу Foreign Keys для таблиц...');
    }
    
    for (const table of mainTables) {
      if (verbose) {
        console.log(`  📊 Анализирую таблицу: ${table}`);
      }
      
      try {
        // Прямые FK (куда ссылается эта таблица)
        const directFKs = await this.dbConnect`
          SELECT
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = ${table.split('.').pop()}
        `;
        
        if (verbose && directFKs.length > 0) {
          console.log(`     → Прямые FK (куда ссылается):`);
          directFKs.forEach((row: any) => {
            const fullName = row.foreign_schema ? `${row.foreign_schema}.${row.foreign_table}` : row.foreign_table;
            console.log(`        - ${fullName}`);
            related.add(fullName);
          });
        } else {
          directFKs.forEach((row: any) => {
            const fullName = row.foreign_schema ? `${row.foreign_schema}.${row.foreign_table}` : row.foreign_table;
            related.add(fullName);
          });
        }
        
        // Обратные FK (кто ссылается на эту таблицу)
        const reverseFKs = await this.dbConnect`
          SELECT
            tc.table_schema AS referencing_schema,
            tc.table_name AS referencing_table
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = ${table.split('.').pop()}
        `;
        
        if (verbose && reverseFKs.length > 0) {
          console.log(`     ← Обратные FK (кто ссылается):`);
          reverseFKs.forEach((row: any) => {
            const fullName = row.referencing_schema ? `${row.referencing_schema}.${row.referencing_table}` : row.referencing_table;
            console.log(`        - ${fullName}`);
            related.add(fullName);
          });
        } else {
          reverseFKs.forEach((row: any) => {
            const fullName = row.referencing_schema ? `${row.referencing_schema}.${row.referencing_table}` : row.referencing_table;
            related.add(fullName);
          });
        }
        
        if (verbose && directFKs.length === 0 && reverseFKs.length === 0) {
          console.log(`     ℹ️  Foreign Keys не найдены`);
        }
      } catch (error: any) {
        if (verbose) {
          console.log(`     ⚠️  Ошибка при поиске FK: ${error.message}`);
        }
      }
    }
    
    // Убираем основные таблицы из результата
    mainTables.forEach(t => related.delete(t));
    
    return Array.from(related);
  }
  
  /**
   * ЭТАП 3: Подтверждает таблицы реальным вызовом endpoint
   */
  private async confirmWithRealCall(
    endpoint: string,
    method: string,
    dtoFields: string[],
    tablesToCheck: string[]
  ): Promise<string[]> {
    if (tablesToCheck.length === 0) {
      console.log('⚠️  Нет таблиц для проверки');
      return [];
    }
    
    // 1. Снимаем snapshot ДО вызова
    console.log('  📸 Снимаем snapshot таблиц...');
    const before: Record<string, any[]> = {};
    
    for (const table of tablesToCheck) {
      try {
        // Парсим schema.table или просто table
        const [schema, tableName] = table.includes('.') 
          ? table.split('.') 
          : [this.config.dbSchema || 'public', table];
        
        const rows = await this.dbConnect`
          SELECT * FROM ${this.dbConnect(schema + '.' + tableName)}
          ORDER BY id DESC
          LIMIT 10
        `;
        before[table] = rows;
      } catch (error: any) {
        console.warn(`  ⚠️  Не удалось прочитать таблицу ${table}: ${error.message}`);
      }
    }
    
    // 2. Генерируем тестовые данные на основе существующих записей
    const uniqueData = await this.generateTestDataFromExisting(dtoFields, tablesToCheck);
    
    const verbose = this.config.verboseStages!.stage3;
    
    if (verbose) {
      console.log('  🎲 Сгенерированы уникальные данные:');
      console.log(JSON.stringify(uniqueData, null, 2).split('\n').map(l => '     ' + l).join('\n'));
    } else {
      console.log('  🎲 Сгенерированы уникальные данные');
    }
    
    // 3. Вызываем endpoint
    const baseUrl = process.env.StandURL || 'http://localhost:3000';
    const url = baseUrl + endpoint;
    
    console.log(`  📡 Вызываем ${method} ${url}`);
    
    // Подготавливаем headers
    const headers: any = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
      if (verbose) {
        console.log(`     ✓ Добавлен токен авторизации: Bearer ${this.config.authToken.substring(0, 10)}...`);
      }
    } else {
      if (verbose) {
        console.log(`     ⚠️  Токен авторизации не указан (может быть ошибка 401)`);
      }
    }
    
    if (verbose) {
      console.log('');
      console.log('  📋 CURL команда для отладки:');
      console.log('  ┌─────────────────────────────────────────────────────────────────┐');
      
      const curlLines = [];
      curlLines.push(`curl -X ${method} '${url}' \\`);
      
      Object.entries(headers).forEach(([key, value]) => {
        curlLines.push(`  -H '${key}: ${value}' \\`);
      });
      
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const dataStr = JSON.stringify(uniqueData);
        curlLines.push(`  -d '${dataStr}'`);
      } else {
        // Убираем последний backslash
        const lastLine = curlLines[curlLines.length - 1];
        curlLines[curlLines.length - 1] = lastLine.replace(' \\', '');
      }
      
      curlLines.forEach(line => {
        console.log(`  │ ${line.padEnd(63)} │`);
      });
      
      console.log('  └─────────────────────────────────────────────────────────────────┘');
      console.log('');
    }
    
    let callSuccess = false;
    try {
      const config = { headers };
      
      if (method === 'GET') {
        await axios.get(url, config);
      } else if (method === 'POST') {
        await axios.post(url, uniqueData, config);
      } else if (method === 'PUT') {
        await axios.put(url, uniqueData, config);
      } else if (method === 'PATCH') {
        await axios.patch(url, uniqueData, config);
      } else if (method === 'DELETE') {
        await axios.delete(url, config);
      }
      
      callSuccess = true;
      console.log('  ✓ Endpoint вызван успешно');
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      
      console.warn(`  ⚠️  Endpoint вернул ошибку: ${status || 'Network Error'} ${statusText || error.message}`);
      
      if (status === 401) {
        console.log('  💡 Ошибка 401 (Unauthorized) - добавьте authToken в конфигурацию');
      } else if (status === 403) {
        console.log('  💡 Ошибка 403 (Forbidden) - проверьте права токена');
      } else if (status === 400) {
        console.log('  💡 Ошибка 400 (Bad Request) - данные не прошли валидацию');
        if (verbose && error.response?.data) {
          console.log('     Ответ сервера:', JSON.stringify(error.response.data, null, 2).split('\n').map(l => '     ' + l).join('\n'));
        }
      }
      
      console.log('  ℹ️  Продолжаем анализ (данные могли быть записаны до ошибки)');
    }
    
    // 4. Ждем немного (для асинхронных операций)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Снимаем snapshot ПОСЛЕ вызова
    console.log('  📸 Снимаем snapshot после вызова...');
    const after: Record<string, any[]> = {};
    
    for (const table of tablesToCheck) {
      try {
        // Парсим schema.table или просто table
        const [schema, tableName] = table.includes('.') 
          ? table.split('.') 
          : [this.config.dbSchema || 'public', table];
        
        const rows = await this.dbConnect`
          SELECT * FROM ${this.dbConnect(schema + '.' + tableName)}
          ORDER BY id DESC
          LIMIT 10
        `;
        after[table] = rows;
      } catch (error: any) {
        console.warn(`  ⚠️  Ошибка при чтении ${table}: ${error.message}`);
      }
    }
    
    // 6. Детектим изменения
    const confirmed: string[] = [];
    const uniqueValues = Object.values(uniqueData).flat();
    
    for (const table of tablesToCheck) {
      if (!before[table] || !after[table]) continue;
      
      // Ищем новые строки
      const newRows = after[table].filter(afterRow =>
        !before[table].some(beforeRow => beforeRow.id === afterRow.id)
      );
      
      if (newRows.length > 0) {
        // Проверяем что наши уникальные значения попали в таблицу
        const hasUniqueValues = newRows.some(row =>
          Object.values(row).some(value =>
            uniqueValues.some(uniqueVal =>
              String(value).includes(String(uniqueVal))
            )
          )
        );
        
        if (hasUniqueValues) {
          confirmed.push(table);
        }
      }
    }
    
    return confirmed;
  }
  
  /**
   * Генерирует тестовые данные на основе существующих записей в БД
   */
  private async generateTestDataFromExisting(
    dtoFields: string[],
    tablesToCheck: string[]
  ): Promise<Record<string, any>> {
    const testData: Record<string, any> = {};
    
    // Исключаемые поля
    const excludeFields = [
      'id',
      'created_at',
      'updated_at',
      'deleted_at',
      ...(this.config.excludeFieldsForEmpirical || [])
    ];
    
    const verbose = this.config.verboseStages!.stage3;
    
    if (verbose) {
      console.log(`     🔍 Ищу существующие данные в таблицах: ${tablesToCheck.join(', ')}`);
      console.log(`     ⏭️  Исключаю поля: ${excludeFields.join(', ')}`);
    }
    
    // Пробуем взять данные из первой таблицы
    if (tablesToCheck.length > 0) {
      try {
        const tableName = tablesToCheck[0];
        const [schema, table] = tableName.includes('.') 
          ? tableName.split('.') 
          : [this.config.dbSchema || 'public', tableName];
        
        const fullTableName = `${schema}.${table}`;
        
        // Берем случайную запись
        const rows = await this.dbConnect`
          SELECT * FROM ${this.dbConnect(fullTableName)}
          ORDER BY RANDOM()
          LIMIT 1
        `;
        
        if (rows && rows.length > 0) {
          const row = rows[0];
          
          if (verbose) {
            console.log(`     ✓ Найдена запись в ${tableName}`);
          }
          
          // Копируем данные, исключая служебные поля
          for (const field of dtoFields) {
            // Проверяем варианты имени поля
            const variants = this.generateFieldVariants(field);
            
            // Ищем совпадение в записи
            const matchedKey = Object.keys(row).find(key => 
              variants.includes(key) && !excludeFields.includes(key)
            );
            
            if (matchedKey) {
              testData[field] = row[matchedKey];
              
              if (verbose) {
                console.log(`     ✓ ${field} = ${JSON.stringify(row[matchedKey])} (из ${matchedKey})`);
              }
            }
          }
        }
      } catch (error: any) {
        if (verbose) {
          console.log(`     ⚠️  Не удалось получить данные: ${error.message}`);
        }
      }
    }
    
    // Для полей которые не заполнили, генерируем значения
    for (const field of dtoFields) {
      if (testData[field] === undefined) {
        testData[field] = this.generateFallbackValue(field);
        
        if (verbose) {
          console.log(`     ⚠️  ${field} = ${JSON.stringify(testData[field])} (сгенерировано)`);
        }
      }
    }
    
    return testData;
  }
  
  /**
   * Генерирует fallback значение для поля
   */
  private generateFallbackValue(field: string): any {
    const fieldLower = field.toLowerCase();
    const timestamp = Date.now();
    
    if (fieldLower.includes('email')) {
      return `test_${timestamp}@analyzer.test`;
    } else if (fieldLower.includes('phone')) {
      return `+1${timestamp % 10000000000}`;
    } else if (fieldLower.includes('name')) {
      return `TEST_${timestamp}_NAME`;
    } else if (fieldLower.includes('status')) {
      return 'active';
    } else if (fieldLower.includes('amount') || fieldLower.includes('price')) {
      return 99.99;
    } else if (fieldLower.includes('count') || fieldLower.includes('quantity')) {
      return 1;
    } else if (fieldLower.includes('date') || fieldLower.includes('time')) {
      return new Date().toISOString();
    } else if (fieldLower.includes('is') || fieldLower.includes('has')) {
      return true;
    } else if (fieldLower.includes('type')) {
      return 'standard';
    } else {
      return `test_value_${timestamp}`;
    }
  }
  
  /**
   * Генерирует уникальные тестовые данные (устаревший метод)
   * @deprecated Используйте generateTestDataFromExisting
   */
  private generateUniqueTestData(dtoFields: string[]): Record<string, any> {
    const timestamp = Date.now();
    const unique: Record<string, any> = {};
    
    for (const field of dtoFields) {
      const fieldLower = field.toLowerCase();
      
      // Определяем тип по имени поля
      if (fieldLower.includes('id') && fieldLower !== 'id') {
        unique[field] = 999900000 + (timestamp % 100000);
      } else if (fieldLower.includes('email')) {
        unique[field] = `test_${timestamp}@analyzer.test`;
      } else if (fieldLower.includes('phone')) {
        unique[field] = `+1${timestamp % 10000000000}`;
      } else if (fieldLower.includes('name')) {
        unique[field] = `TEST_${timestamp}_NAME`;
      } else if (fieldLower.includes('status')) {
        unique[field] = `TEST_STATUS_${timestamp}`;
      } else if (fieldLower.includes('amount') || fieldLower.includes('price')) {
        unique[field] = 999.99 + (timestamp % 100);
      } else if (fieldLower.includes('date') || fieldLower.includes('time')) {
        unique[field] = new Date().toISOString();
      } else if (fieldLower.includes('is') || fieldLower.includes('has')) {
        unique[field] = true;
      } else {
        unique[field] = `TEST_${timestamp}_${field.toUpperCase()}`;
      }
    }
    
    return unique;
  }
  
  /**
   * Генерирует тестовые данные для таблиц
   */
  private async generateTestData(tables: string[]): Promise<Record<string, any[]>> {
    const testData: Record<string, any[]> = {};
    
    for (const table of tables) {
      try {
        // Парсим schema.table или просто table
        const [schema, tableName] = table.includes('.') 
          ? table.split('.') 
          : [this.config.dbSchema || 'public', table];
        
        const fullTableName = `${schema}.${tableName}`;
        
        if (this.config.dataStrategy === 'existing' || this.config.dataStrategy === 'both') {
          // Берем разнообразные данные (не только последние)
          // Стратегия: берем записи с разными датами в пределах года
          let existing;
          
          try {
            // Пробуем взять разнообразные записи
            existing = await this.dbConnect`
              SELECT * FROM ${this.dbConnect(fullTableName)}
              WHERE deleted_at IS NULL
                AND created_at >= NOW() - INTERVAL '1 year'
              ORDER BY RANDOM()
              LIMIT ${this.config.samplesCount}
            `;
            
            // Если мало записей, берем без ограничения по дате
            if (!existing || existing.length < this.config.samplesCount) {
              existing = await this.dbConnect`
                SELECT * FROM ${this.dbConnect(fullTableName)}
                WHERE deleted_at IS NULL
                ORDER BY RANDOM()
                LIMIT ${this.config.samplesCount}
              `;
            }
          } catch (error: any) {
            // Возможно нет поля deleted_at или created_at
            if (error.message.includes('does not exist') || error.message.includes('column')) {
              try {
                // Пробуем с RANDOM без фильтров
                existing = await this.dbConnect`
                  SELECT * FROM ${this.dbConnect(fullTableName)}
                  ORDER BY RANDOM()
                  LIMIT ${this.config.samplesCount}
                `;
              } catch (randomError: any) {
                // Если RANDOM не поддерживается, берем просто LIMIT
                existing = await this.dbConnect`
                  SELECT * FROM ${this.dbConnect(fullTableName)}
                  LIMIT ${this.config.samplesCount}
                `;
              }
            } else {
              throw error;
            }
          }
          
          if (existing && existing.length > 0) {
            testData[table] = existing.map((row: any) => this.sanitizeRow(row));
            console.log(`  ✓ ${table}: ${existing.length} записей из БД`);
          } else {
            console.log(`  ⚠️  ${table}: нет данных в БД`);
          }
        }
        
        // TODO: Реализовать генерацию новых данных если нужно
        if (this.config.dataStrategy === 'generate') {
          console.log(`  ℹ️  Генерация новых данных пока не реализована`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Ошибка при получении данных из ${table}: ${error.message}`);
      }
    }
    
    return testData;
  }
  
  /**
   * Очищает строку от служебных полей
   */
  private sanitizeRow(row: any): any {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      // Пропускаем служебные поля
      if (['created_at', 'updated_at', 'deleted_at'].includes(key)) {
        continue;
      }
      
      // Преобразуем даты в строки
      if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Обновляет тест файл с найденными таблицами и данными
   */
  private async updateTestFile(
    tables: string[],
    testData: Record<string, any[]>
  ): Promise<void> {
    let content = fs.readFileSync(this.config.testFilePath, 'utf-8');
    
    // 1. Создаем отдельный файл с данными
    const dataImportPath = await this.createTestDataFile(
      this.config.testFilePath,
      testData
    );
    
    // 2. Добавляем импорт данных в начало файла (если еще нет)
    const importStatement = `import { dbTestData } from '${dataImportPath}';`;
    
    if (!content.includes(dataImportPath)) {
      // Находим последний импорт
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex >= 0) {
        // Вставляем после последнего импорта
        lines.splice(lastImportIndex + 1, 0, importStatement);
      } else {
        // Вставляем в начало файла
        lines.unshift(importStatement);
      }
      
      content = lines.join('\n');
    }
    
    // 3. Обновляем список таблиц
    const tablesArray = tables.map(t => `'${t}'`).join(', ');
    
    content = content.replace(
      /\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[.*?\];.*?\n\/\/ @db-tables:end/s,
      `// @db-tables:start\nconst dbTables: string[] = [${tablesArray}];\n// @db-tables:end`
    );
    
    // 4. Удаляем старую секцию с данными внутри теста (если есть)
    if (content.includes('// @test-data:start')) {
      content = content.replace(
        /\/\/ @test-data:start[\s\S]*?\/\/ @test-data:end/,
        `// Данные импортированы из ${dataImportPath}`
      );
    }
    
    // 5. Сохраняем файл
    fs.writeFileSync(this.config.testFilePath, content);
  }
  
  /**
   * Создает отдельный файл с тестовыми данными
   */
  private async createTestDataFile(
    testFilePath: string,
    testData: Record<string, any[]>
  ): Promise<string> {
    const testDir = path.dirname(testFilePath);
    const testFileName = path.basename(testFilePath, '.test.ts');
    
    // Создаем папку testData если её нет
    const testDataDir = path.join(testDir, 'testData');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    // Имя файла с данными
    const dataFileName = `${testFileName}.data.ts`;
    const dataFilePath = path.join(testDataDir, dataFileName);
    
    // Генерируем содержимое файла
    const lines: string[] = [];
    
    lines.push('/**');
    lines.push(` * Тестовые данные для ${testFileName}`);
    lines.push(' * Автоматически сгенерировано из БД');
    lines.push(' * @generated');
    lines.push(' */');
    lines.push('');
    
    // Экспортируем данные
    lines.push('export const dbTestData = {');
    
    const tableNames = Object.keys(testData);
    tableNames.forEach((tableName, tableIndex) => {
      const rows = testData[tableName];
      
      // Экранируем имя таблицы
      const tableKey = tableName.includes('.') || tableName.includes('-') 
        ? `'${tableName}'` 
        : tableName;
      
      lines.push(`  ${tableKey}: [`);
      rows.forEach((row, rowIndex) => {
        const rowStr = JSON.stringify(row, null, 4);
        const comma = rowIndex < rows.length - 1 ? ',' : '';
        lines.push(`    ${rowStr}${comma}`);
      });
      
      const comma = tableIndex < tableNames.length - 1 ? ',' : '';
      lines.push(`  ]${comma}`);
    });
    
    lines.push('} as const;');
    lines.push('');
    
    // Экспортируем вспомогательные функции для доступа к данным
    lines.push('// Вспомогательные функции');
    lines.push('');
    
    tableNames.forEach(tableName => {
      const cleanTableName = tableName.split('.').pop()!;
      const functionName = `get${cleanTableName.charAt(0).toUpperCase()}${cleanTableName.slice(1)}Data`;
      
      const tableKey = tableName.includes('.') || tableName.includes('-') 
        ? `'${tableName}'` 
        : tableName;
      
      lines.push(`export const ${functionName} = () => dbTestData[${tableKey}];`);
    });
    
    lines.push('');
    lines.push('// Получить случайную запись из таблицы');
    tableNames.forEach(tableName => {
      const cleanTableName = tableName.split('.').pop()!;
      const functionName = `getRandom${cleanTableName.charAt(0).toUpperCase()}${cleanTableName.slice(1)}`;
      
      const tableKey = tableName.includes('.') || tableName.includes('-') 
        ? `'${tableName}'` 
        : tableName;
      
      lines.push(`export const ${functionName} = () => {`);
      lines.push(`  const data = dbTestData[${tableKey}];`);
      lines.push(`  return data[Math.floor(Math.random() * data.length)];`);
      lines.push(`};`);
      lines.push('');
    });
    
    // Записываем файл
    fs.writeFileSync(dataFilePath, lines.join('\n'));
    
    console.log(`  ✓ Создан файл с данными: ${path.relative(process.cwd(), dataFilePath)}`);
    
    // Возвращаем относительный путь для импорта
    return `./testData/${dataFileName.replace('.ts', '')}`;
  }
  
  /**
   * Генерирует секцию с тестовыми данными (устаревший метод)
   * @deprecated Используйте createTestDataFile вместо этого
   */
  private generateTestDataSection(testData: Record<string, any[]>): string {
    const lines: string[] = [];
    
    lines.push('// @test-data:start');
    lines.push('// Тестовые данные из БД (автоматически сгенерировано)');
    lines.push('/* @protected:start:dbTestData */');
    lines.push('const dbTestData = {');
    
    const tableNames = Object.keys(testData);
    tableNames.forEach((tableName, tableIndex) => {
      const rows = testData[tableName];
      
      // Экранируем имя таблицы в кавычки (для schema.table)
      const tableKey = tableName.includes('.') || tableName.includes('-') 
        ? `'${tableName}'` 
        : tableName;
      
      lines.push(`  ${tableKey}: [`);
      rows.forEach((row, rowIndex) => {
        const rowStr = JSON.stringify(row, null, 4);
        const comma = rowIndex < rows.length - 1 ? ',' : '';
        lines.push(`    ${rowStr}${comma}`);
      });
      
      const comma = tableIndex < tableNames.length - 1 ? ',' : '';
      lines.push(`  ]${comma}`);
    });
    
    lines.push('};');
    lines.push('/* @protected:end:dbTestData */');
    lines.push('// @test-data:end');
    
    return lines.join('\n');
  }
}

/**
 * Основная функция для анализа и генерации тестовых данных
 */
export async function analyzeAndGenerateTestData(
  config: DatabaseAnalyzerConfig,
  dbConnectFunction: any
): Promise<AnalysisResult> {
  const analyzer = new DatabaseAnalyzer(config, dbConnectFunction);
  return await analyzer.analyze();
}
