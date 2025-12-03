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
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const path = __importStar(require("path"));
/**
 * Пример использования генератора API
 */
async function example() {
    try {
        console.log('=== Пример генерации API клиента ===\n');
        // Пример: Генерация из Petstore (Swagger 2.0)
        await (0, index_1.generateApi)({
            specUrl: path.join(__dirname, '../petstore-local.json'),
            outputDir: path.join(__dirname, '../generated/petstore'),
            httpClient: 'axios',
            baseUrl: 'https://petstore.swagger.io/v2',
            generateErrorHandlers: true,
            generateTypes: true,
            transliterateRussian: true,
        });
        console.log('\n✅ Пример выполнен успешно!');
        console.log('📂 Проверьте папку: generated/petstore');
    }
    catch (error) {
        console.error('❌ Ошибка:', error);
        process.exit(1);
    }
}
// Запускаем пример
example();
//# sourceMappingURL=example.js.map