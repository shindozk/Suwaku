const fs = require('fs');
const path = require('path');

function convertToESM(content) {
  // Convert require statements for local modules
  content = content.replace(/const\s+({[^}]+}|\w+)\s*=\s*require\(['"](\.\.[\/\\][^'"]+|\.\/[^'"]+)['"]\);?/g, (match, imports, modulePath) => {
    if (!modulePath.endsWith('.js') && !modulePath.endsWith('.json')) {
      modulePath += '.js';
    }
    return `import ${imports} from '${modulePath}';`;
  });
  
  // Convert require for node modules
  content = content.replace(/const\s+({[^}]+}|\w+)\s*=\s*require\(['"]([^'"\.][^'"]+)['"]\);?/g, `import $1 from '$2';`);
  
  // Convert module.exports = { ... }
  content = content.replace(/module\.exports\s*=\s*\{([^}]+)\};?/gs, 'export {$1};');
  
  // Convert module.exports.default
  content = content.replace(/module\.exports\.default\s*=\s*(\w+);?/g, 'export default $1;');
  
  // Convert standalone module.exports
  content = content.replace(/module\.exports\s*=\s*(\w+);?/g, 'export default $1;');
  
  return content;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // Skip if already ESM
      if (content.includes('import ') && content.includes('export ')) {
        console.log(`⏭️  Skipping ${filePath}`);
        continue;
      }
      
      const converted = convertToESM(content);
      fs.writeFileSync(filePath, converted, 'utf-8');
      console.log(`✅ Converted ${filePath}`);
    }
  }
}

console.log('🔄 Converting to ESM...\n');
walkDir('src');
console.log('\n✨ Done!');
