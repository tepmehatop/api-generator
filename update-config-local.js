#!/usr/bin/env node

/**
 * Обновляет конфиг с путём к локальному файлу
 * 
 * Использование:
 *   node update-config-local.js <config-path> <local-file-path>
 * 
 * Пример:
 *   node update-config-local.js configs/orders_config.json ./archive/api-codegen-1.55.0.tgz
 */

const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];
const localFilePath = process.argv[3];

if (!configPath || !localFilePath) {
  console.error('❌ Использование: node update-config-local.js <config> <local-file>');
  console.error('   Пример: node update-config-local.js configs/orders_config.json ./archive/api-codegen-1.55.0.tgz');
  process.exit(1);
}

// Проверяем конфиг
if (!fs.existsSync(configPath)) {
  console.error(`❌ Конфиг не найден: ${configPath}`);
  process.exit(1);
}

// Проверяем локальный файл
if (!fs.existsSync(localFilePath)) {
  console.error(`❌ Файл не найден: ${localFilePath}`);
  console.error('\n💡 Доступные файлы в archive/:');
  
  const archiveDir = path.join(process.cwd(), 'archive');
  if (fs.existsSync(archiveDir)) {
    const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.tgz'));
    if (files.length > 0) {
      files.forEach(f => console.error(`   - archive/${f}`));
    } else {
      console.error('   (пусто)');
    }
  } else {
    console.error('   Папка archive/ не существует');
  }
  
  process.exit(1);
}

// Читаем конфиг
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Устанавливаем локальный путь
config.prevPackage = localFilePath;

// Сохраняем
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

console.log(`✓ Конфиг обновлён: ${configPath}`);
console.log(`  prevPackage: ${localFilePath}`);
