const fs = require('fs');
const babel = require('@babel/parser');

try {
  const content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf-8');
  babel.parse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('PARSED SUCCESSFULLY');
} catch (e) {
  console.error('PARSE ERROR:', e.message, 'at line', e.loc.line, 'column', e.loc.column);
}
