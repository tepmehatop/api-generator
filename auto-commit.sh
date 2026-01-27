#!/bin/bash
# Автоматический коммит исправлений v11.1

cd /Users/marknadelman/IdeaProjects/api-generator

git add src/happy-path-generator.ts scripts/update-exports.cjs

git commit -m "fix: динамический импорт utils из NPM пакета (v11.1)

- Добавлен параметр packageName в HappyPathTestConfig
- Автоматическое чтение названия пакета из package.json  
- Изменен импорт compareDbWithResponse на динамический
- Убран utils из excludeItems в update-exports.cjs
- Теперь utils корректно экспортируется в package.json

Fixes: Package subpath './dist/utils/data-comparison' is not defined"

git push origin main
