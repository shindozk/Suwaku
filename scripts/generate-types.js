/**
 * Generate TypeScript definitions
 * This is a placeholder - types are manually maintained in types/index.d.ts
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('✅ TypeScript definitions are maintained in types/index.d.ts');
console.log('   No generation needed.');

// Verify types file exists
const typesPath = join(__dirname, '..', 'types', 'index.d.ts');
if (existsSync(typesPath)) {
    console.log('✅ Types file verified');
} else {
    console.error('❌ Types file not found!');
    process.exit(1);
}
