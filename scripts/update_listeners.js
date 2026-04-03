const fs = require('fs');
const path = require('path');

const dir = './src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('useEffect(() => { reload(); }, []);')) {
    content = content.replace(
      'useEffect(() => { reload(); }, []);',
      `useEffect(() => {
    reload();
    window.addEventListener('app-data-mutation', reload);
    return () => window.removeEventListener('app-data-mutation', reload);
  }, []);`
    );
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
