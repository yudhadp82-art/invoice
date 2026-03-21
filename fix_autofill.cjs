const fs = require('fs');
const path = require('path');

const dir = 'c:/antigravity/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let counter = 1;
  const newContent = content.replace(/<(input|select|textarea)(\s+[^>]*?)(\/?)>/g, (match, tag, rest, selfClose) => {
    // If it already has name or id, skip
    if (/\s(name|id)=/.test(rest)) return match;
    
    // Find value property to inherit name
    let fieldName = tag + '_' + counter++;
    const vMatch = match.match(/value=\{[^\}]+\.([a-zA-Z0-9_]+)\}/);
    if (vMatch) {
      fieldName = vMatch[1];
    }
    
    // Fallback: search for onChange={e => setForm({...form, myField: e.target.value})}
    const setMatch = match.match(/([a-zA-Z0-9_]+)\s*:\s*e\.target\.value/);
    if (setMatch) {
      fieldName = setMatch[1];
    }
    
    // Append index to avoid duplicate warning on multiple loops (e.g. invoice items)
    fieldName = fieldName + '_' + counter++;
    
    return `<${tag} name="${fieldName}"${rest}${selfClose}>`;
  });
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
console.log('Fixed autofill warnings');
