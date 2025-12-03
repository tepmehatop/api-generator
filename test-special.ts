import { generateApi } from './dist/index';
import * as path from 'path';

async function test() {
  await generateApi({
    specUrl: path.join(__dirname, 'test-special-fields.json'),
    outputDir: path.join(__dirname, 'generated/test-special'),
  });
  console.log('Готово! Проверьте generated/test-special/');
}

test();
