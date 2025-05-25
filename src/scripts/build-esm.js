const fs = require('fs-extra');
const path = require('path');

function convertToESM(content, relativePath) {
  content = content.replace(/const\s+(\{[^}]+\}|\w+)\s+=\s+require\(['"]([^'"]+)['"]\);/g, (match, imported, source) => {
    let adjustedSource = source;
    if (source.startsWith('./') || source.startsWith('../')) {
      if (!source.endsWith('.js')) {
        adjustedSource = `${source}.js`;
      }
    }
    
    if (imported.startsWith('{') && imported.endsWith('}')) {
      return `import ${imported} from '${adjustedSource}';`;
    } else {
      return `import ${imported} from '${adjustedSource}';`;
    }
  });

  content = content.replace(/module\.exports\s+=\s+(\{[^}]+\});/g, 'export $1;');
  content = content.replace(/module\.exports\s+=\s+(\w+);/g, 'export default $1;');
  content = content.replace(/module\.exports\.(\w+)\s+=\s+(\w+);/g, 'export const $1 = $2;');
  
  content = content.replace(/require\(['"](\.\/[^'"]+)['"]\);/g, 'import "$1.js";');

  return content;
}

async function processFile(file, outputDir) {
  const content = await fs.readFile(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);
  const esmContent = convertToESM(content, relativePath);
  
  const outputPath = path.join(outputDir, relativePath);
  
  await fs.ensureDir(path.dirname(outputPath));
  
  await fs.writeFile(outputPath, esmContent);
  console.log(`Converted: ${relativePath} -> ${outputPath}`);
}

async function findJsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const res = path.resolve(dir, entry.name);
    return entry.isDirectory() ? findJsFiles(res) : res;
  }));
  return Array.prototype.concat(...files)
    .filter(file => file.endsWith('.js'));
}

async function build() {
  const outputDir = path.join(process.cwd(), 'esm');
  
  await fs.emptyDir(outputDir);
  
  const mainFile = path.join(process.cwd(), 'main.js');
  const srcUtilsDir = path.join(process.cwd(), 'src/utils');
  const srcScriptsDir = path.join(process.cwd(), 'src/scripts');
  
  const filesToConvert = [mainFile];
  
  if (await fs.pathExists(srcUtilsDir)) {
    const utilsFiles = await findJsFiles(srcUtilsDir);
    filesToConvert.push(...utilsFiles);
  }
  
  if (await fs.pathExists(srcScriptsDir)) {
    const scriptsFiles = await findJsFiles(srcScriptsDir);
    filesToConvert.push(...scriptsFiles);
  }
  
  console.log(`Found ${filesToConvert.length} files to convert.`);
  for (const file of filesToConvert) {
    await processFile(file, outputDir);
  }
  
  console.log('ESM build completed!');
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});