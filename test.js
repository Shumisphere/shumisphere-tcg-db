const { execSync } = require('child_process');
try {
  execSync('npx tsc --noEmit src/components/AdminDashboard.tsx', { stdio: 'inherit' });
  console.log('SUCCESS');
} catch (e) {
  console.log('FAILED');
}
