import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';

function addJsExtensions(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      addJsExtensions(fullPath);
    } else if (extname(entry) === '.js') {
      let content = readFileSync(fullPath, 'utf8');
      const fileDir = dirname(fullPath);
      content = content.replace(
        /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
        (match, prefix, importPath, suffix) => {
          if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.endsWith('.ts')) return match;
          if (importPath.includes('node_modules')) return match;

          const resolvedPath = join(fileDir, importPath);

          if (existsSync(resolvedPath + '.js')) {
            return `${prefix}${importPath}.js${suffix}`;
          }

          if (existsSync(join(resolvedPath, 'index.js'))) {
            return `${prefix}${importPath}/index.js${suffix}`;
          }

          return `${prefix}${importPath}.js${suffix}`;
        }
      );
      writeFileSync(fullPath, content);
    }
  }
}

const distDir = join(process.cwd(), 'dist');
addJsExtensions(distDir);
console.log('Added .js extensions to all relative imports in dist/');
