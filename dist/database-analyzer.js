"use strict";
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
exports.DatabaseAnalyzer = void 0;
exports.analyzeAndGenerateTestData = analyzeAndGenerateTestData;
const fs = __importStar(require("fs"));
const axios_1 = __importDefault(require("axios"));
/**
 * Анализатор базы данных для генерации тестовых данных
 */
class DatabaseAnalyzer {
    constructor(config, dbConnectFunction) {
        this.schemaCache = new Map();
        this.config = {
            force: false,
            dataStrategy: 'existing',
            samplesCount: 5,
            ...config
        };
        this.dbConnect = dbConnectFunction;
    }
    /**
     * Главный метод - анализирует тест и генерирует данные
     */
    async analyze() {
        console.log('🔍 Начинаю анализ теста и БД...');
        console.log(`📄 Тест файл: ${this.config.testFilePath}`);
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
        let dtoFields = [];
        if (testInfo.dtoPath && testInfo.dtoName) {
            dtoFields = await this.extractDTOFields(testInfo.dtoPath, testInfo.dtoName);
            console.log(`✓ Извлечены поля DTO: ${dtoFields.join(', ')}`);
        }
        // 4. ЭТАП 1: Schema Analysis - находим подозрительные таблицы
        console.log('\n📊 ЭТАП 1: Анализ схемы БД...');
        const suspectedTables = await this.findTablesByFields(dtoFields);
        console.log(`✓ Найдено подозрительных таблиц: ${suspectedTables.length}`);
        suspectedTables.forEach(t => console.log(`  - ${t.name} (confidence: ${(t.confidence * 100).toFixed(0)}%)`));
        // 5. ЭТАП 2: FK Analysis - расширяем список связанными таблицами
        console.log('\n🔗 ЭТАП 2: Анализ Foreign Keys...');
        const relatedTables = await this.findRelatedTables(suspectedTables.map(t => t.name));
        console.log(`✓ Найдено связанных таблиц: ${relatedTables.length}`);
        relatedTables.forEach(t => console.log(`  - ${t}`));
        // 6. ЭТАП 3: Empirical Test - подтверждаем реальным вызовом
        console.log('\n🎯 ЭТАП 3: Эмпирический тест...');
        const allTablesToCheck = [
            ...suspectedTables.map(t => t.name),
            ...relatedTables
        ];
        const confirmedTables = await this.confirmWithRealCall(testInfo.endpoint, testInfo.httpMethod, dtoFields, allTablesToCheck);
        console.log(`✓ Подтверждено таблиц: ${confirmedTables.length}`);
        confirmedTables.forEach(t => console.log(`  - ${t}`));
        // 7. Генерируем тестовые данные
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
    }
    /**
     * Извлекает информацию из тест файла
     */
    async extractTestInfo() {
        const content = fs.readFileSync(this.config.testFilePath, 'utf-8');
        // Извлекаем endpoint
        const endpointMatch = content.match(/const endpoint = ['`](.+?)['`];/);
        const endpoint = endpointMatch ? endpointMatch[1] : '';
        // Извлекаем HTTP метод
        const methodMatch = content.match(/const httpMethod = ['"](.+?)['"];/);
        const httpMethod = methodMatch ? methodMatch[1] : 'GET';
        // Извлекаем DTO информацию
        const dtoNameMatch = content.match(/const dtoName = ['"](.+?)['"];/);
        const dtoName = dtoNameMatch ? dtoNameMatch[1] : undefined;
        const dtoPathMatch = content.match(/const dtoPath = ['"](.+?)['"];/);
        const dtoPath = dtoPathMatch ? dtoPathMatch[1] : undefined;
        // Извлекаем существующие таблицы
        const tablesMatch = content.match(/\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[(.*?)\];/s);
        let existingTables = [];
        if (tablesMatch && tablesMatch[1].trim()) {
            existingTables = tablesMatch[1]
                .split(',')
                .map(t => t.trim().replace(/['"]/g, ''))
                .filter(t => t.length > 0);
        }
        return {
            endpoint,
            httpMethod,
            dtoName,
            dtoPath,
            existingTables
        };
    }
    /**
     * Извлекает поля из DTO
     */
    async extractDTOFields(dtoPath, dtoName) {
        const content = fs.readFileSync(dtoPath, 'utf-8');
        // Ищем интерфейс
        const interfaceRegex = new RegExp(`export\\s+interface\\s+${dtoName}\\s*{([^}]+)}`, 's');
        const match = content.match(interfaceRegex);
        if (!match)
            return [];
        const interfaceBody = match[1];
        const fields = [];
        // Парсим поля
        const lines = interfaceBody.split('\n');
        for (const line of lines) {
            const fieldMatch = line.match(/^\s*['"]?(\w+)['"]?\??:/);
            if (fieldMatch) {
                fields.push(fieldMatch[1]);
            }
        }
        return fields;
    }
    /**
     * ЭТАП 1: Находит таблицы по полям DTO
     */
    async findTablesByFields(dtoFields) {
        if (dtoFields.length === 0) {
            console.log('⚠️  Поля DTO не найдены, пропускаю schema analysis');
            return [];
        }
        // Получаем все таблицы и колонки
        const result = await this.dbConnect `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;
        // Группируем по таблицам
        const tableColumns = new Map();
        for (const row of result) {
            if (!tableColumns.has(row.table_name)) {
                tableColumns.set(row.table_name, []);
            }
            tableColumns.get(row.table_name).push({
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES',
            });
        }
        // Подсчитываем совпадения
        const scores = [];
        for (const [tableName, columns] of tableColumns.entries()) {
            let matchCount = 0;
            for (const dtoField of dtoFields) {
                // Генерируем варианты имени поля
                const variants = this.generateFieldVariants(dtoField);
                if (columns.some(col => variants.includes(col.name))) {
                    matchCount++;
                }
            }
            if (matchCount > 0) {
                const confidence = matchCount / dtoFields.length;
                scores.push({
                    name: tableName,
                    columns,
                    foreignKeys: [], // Заполним позже
                    confidence
                });
            }
        }
        // Сортируем по confidence и возвращаем топ-10
        return scores
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10);
    }
    /**
     * Генерирует варианты имени поля (camelCase, snake_case, etc)
     */
    generateFieldVariants(field) {
        const variants = new Set();
        // Оригинал
        variants.add(field);
        variants.add(field.toLowerCase());
        // snake_case
        const snakeCase = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        variants.add(snakeCase);
        variants.add(snakeCase.replace(/^_/, ''));
        // Plural формы
        variants.add(field + 's');
        variants.add(snakeCase + 's');
        // Без префиксов
        const withoutPrefix = field.replace(/^(is|has|get|set)/, '');
        variants.add(withoutPrefix);
        variants.add(withoutPrefix.toLowerCase());
        return Array.from(variants);
    }
    /**
     * ЭТАП 2: Находит связанные таблицы через FK
     */
    async findRelatedTables(mainTables) {
        if (mainTables.length === 0)
            return [];
        const related = new Set();
        for (const table of mainTables) {
            // Прямые FK (куда ссылается эта таблица)
            const directFKs = await this.dbConnect `
        SELECT
          ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ${table}
      `;
            directFKs.forEach((row) => related.add(row.foreign_table));
            // Обратные FK (кто ссылается на эту таблицу)
            const reverseFKs = await this.dbConnect `
        SELECT
          tc.table_name AS referencing_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = ${table}
      `;
            reverseFKs.forEach((row) => related.add(row.referencing_table));
        }
        // Убираем основные таблицы из результата
        mainTables.forEach(t => related.delete(t));
        return Array.from(related);
    }
    /**
     * ЭТАП 3: Подтверждает таблицы реальным вызовом endpoint
     */
    async confirmWithRealCall(endpoint, method, dtoFields, tablesToCheck) {
        if (tablesToCheck.length === 0) {
            console.log('⚠️  Нет таблиц для проверки');
            return [];
        }
        // 1. Снимаем snapshot ДО вызова
        console.log('  📸 Снимаем snapshot таблиц...');
        const before = {};
        for (const table of tablesToCheck) {
            try {
                const rows = await this.dbConnect `
          SELECT * FROM ${this.dbConnect(table)}
          ORDER BY id DESC
          LIMIT 10
        `;
                before[table] = rows;
            }
            catch (error) {
                console.warn(`  ⚠️  Не удалось прочитать таблицу ${table}`);
            }
        }
        // 2. Генерируем уникальные тестовые данные
        const uniqueData = this.generateUniqueTestData(dtoFields);
        console.log('  🎲 Сгенерированы уникальные данные');
        // 3. Вызываем endpoint
        console.log(`  📡 Вызываем ${method} ${endpoint}...`);
        let callSuccess = false;
        try {
            // Предполагаем что endpoint доступен через process.env.StandURL
            const baseUrl = process.env.StandURL || 'http://localhost:3000';
            const url = baseUrl + endpoint;
            if (method === 'GET') {
                await axios_1.default.get(url);
            }
            else if (method === 'POST') {
                await axios_1.default.post(url, uniqueData);
            }
            else if (method === 'PUT') {
                await axios_1.default.put(url, uniqueData);
            }
            else if (method === 'PATCH') {
                await axios_1.default.patch(url, uniqueData);
            }
            else if (method === 'DELETE') {
                await axios_1.default.delete(url);
            }
            callSuccess = true;
            console.log('  ✓ Endpoint вызван успешно');
        }
        catch (error) {
            console.warn(`  ⚠️  Endpoint вернул ошибку: ${error.response?.status || error.message}`);
            console.log('  ℹ️  Продолжаем анализ (данные могли быть записаны)');
        }
        // 4. Ждем немного (для асинхронных операций)
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 5. Снимаем snapshot ПОСЛЕ вызова
        console.log('  📸 Снимаем snapshot после вызова...');
        const after = {};
        for (const table of tablesToCheck) {
            try {
                const rows = await this.dbConnect `
          SELECT * FROM ${this.dbConnect(table)}
          ORDER BY id DESC
          LIMIT 10
        `;
                after[table] = rows;
            }
            catch (error) {
                // Игнорируем
            }
        }
        // 6. Детектим изменения
        const confirmed = [];
        const uniqueValues = Object.values(uniqueData).flat();
        for (const table of tablesToCheck) {
            if (!before[table] || !after[table])
                continue;
            // Ищем новые строки
            const newRows = after[table].filter(afterRow => !before[table].some(beforeRow => beforeRow.id === afterRow.id));
            if (newRows.length > 0) {
                // Проверяем что наши уникальные значения попали в таблицу
                const hasUniqueValues = newRows.some(row => Object.values(row).some(value => uniqueValues.some(uniqueVal => String(value).includes(String(uniqueVal)))));
                if (hasUniqueValues) {
                    confirmed.push(table);
                }
            }
        }
        return confirmed;
    }
    /**
     * Генерирует уникальные тестовые данные
     */
    generateUniqueTestData(dtoFields) {
        const timestamp = Date.now();
        const unique = {};
        for (const field of dtoFields) {
            const fieldLower = field.toLowerCase();
            // Определяем тип по имени поля
            if (fieldLower.includes('id') && fieldLower !== 'id') {
                unique[field] = 999900000 + (timestamp % 100000);
            }
            else if (fieldLower.includes('email')) {
                unique[field] = `test_${timestamp}@analyzer.test`;
            }
            else if (fieldLower.includes('phone')) {
                unique[field] = `+1${timestamp % 10000000000}`;
            }
            else if (fieldLower.includes('name')) {
                unique[field] = `TEST_${timestamp}_NAME`;
            }
            else if (fieldLower.includes('status')) {
                unique[field] = `TEST_STATUS_${timestamp}`;
            }
            else if (fieldLower.includes('amount') || fieldLower.includes('price')) {
                unique[field] = 999.99 + (timestamp % 100);
            }
            else if (fieldLower.includes('date') || fieldLower.includes('time')) {
                unique[field] = new Date().toISOString();
            }
            else if (fieldLower.includes('is') || fieldLower.includes('has')) {
                unique[field] = true;
            }
            else {
                unique[field] = `TEST_${timestamp}_${field.toUpperCase()}`;
            }
        }
        return unique;
    }
    /**
     * Генерирует тестовые данные для таблиц
     */
    async generateTestData(tables) {
        const testData = {};
        for (const table of tables) {
            try {
                if (this.config.dataStrategy === 'existing' || this.config.dataStrategy === 'both') {
                    // Берем существующие данные
                    const existing = await this.dbConnect `
            SELECT * FROM ${this.dbConnect(table)}
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT ${this.config.samplesCount}
          `;
                    if (existing.length > 0) {
                        testData[table] = existing.map((row) => this.sanitizeRow(row));
                        console.log(`  ✓ ${table}: ${existing.length} записей из БД`);
                    }
                    else {
                        console.log(`  ⚠️  ${table}: нет данных в БД`);
                    }
                }
                // TODO: Реализовать генерацию новых данных если нужно
                if (this.config.dataStrategy === 'generate') {
                    console.log(`  ℹ️  Генерация новых данных пока не реализована`);
                }
            }
            catch (error) {
                console.warn(`  ⚠️  Ошибка при получении данных из ${table}: ${error.message}`);
            }
        }
        return testData;
    }
    /**
     * Очищает строку от служебных полей
     */
    sanitizeRow(row) {
        const sanitized = {};
        for (const [key, value] of Object.entries(row)) {
            // Пропускаем служебные поля
            if (['created_at', 'updated_at', 'deleted_at'].includes(key)) {
                continue;
            }
            // Преобразуем даты в строки
            if (value instanceof Date) {
                sanitized[key] = value.toISOString();
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    /**
     * Обновляет тест файл с найденными таблицами и данными
     */
    async updateTestFile(tables, testData) {
        let content = fs.readFileSync(this.config.testFilePath, 'utf-8');
        // 1. Обновляем список таблиц
        const tablesArray = tables.map(t => `'${t}'`).join(', ');
        content = content.replace(/\/\/ @db-tables:start\s*\n.*?const dbTables.*?=.*?\[.*?\];.*?\n\/\/ @db-tables:end/s, `// @db-tables:start\nconst dbTables: string[] = [${tablesArray}];\n// @db-tables:end`);
        // 2. Добавляем/обновляем секцию с тестовыми данными
        const dataSection = this.generateTestDataSection(testData);
        // Ищем существующую секцию
        if (content.includes('// @test-data:start')) {
            content = content.replace(/\/\/ @test-data:start[\s\S]*?\/\/ @test-data:end/, dataSection);
        }
        else {
            // Добавляем после dbTables
            const insertPos = content.indexOf('// @db-tables:end') + '// @db-tables:end'.length;
            content = content.slice(0, insertPos) + '\n\n' + dataSection + content.slice(insertPos);
        }
        // 3. Сохраняем файл
        fs.writeFileSync(this.config.testFilePath, content);
    }
    /**
     * Генерирует секцию с тестовыми данными
     */
    generateTestDataSection(testData) {
        const lines = [];
        lines.push('// @test-data:start');
        lines.push('// Тестовые данные из БД (автоматически сгенерировано)');
        lines.push('/* @protected:start:dbTestData */');
        lines.push('const dbTestData = {');
        const tableNames = Object.keys(testData);
        tableNames.forEach((tableName, tableIndex) => {
            const rows = testData[tableName];
            lines.push(`  ${tableName}: [`);
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
exports.DatabaseAnalyzer = DatabaseAnalyzer;
/**
 * Основная функция для анализа и генерации тестовых данных
 */
async function analyzeAndGenerateTestData(config, dbConnectFunction) {
    const analyzer = new DatabaseAnalyzer(config, dbConnectFunction);
    return await analyzer.analyze();
}
//# sourceMappingURL=database-analyzer.js.map