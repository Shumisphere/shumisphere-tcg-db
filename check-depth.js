const fs = require('fs');

const content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

const pipelineLines = lines.slice(663, 1024);

let depth = 0;
let lineNum = 664;
for (const line of pipelineLines) {
    const openMatches = line.match(/<div/g);
    const closeMatches = line.match(/<\/div>/g);
    
    if (openMatches) depth += openMatches.length;
    if (closeMatches) depth -= closeMatches.length;
    
    // console.log(`${lineNum}: ${depth} - ${line.trim()}`);
    lineNum++;
}

console.log('Final pipeline depth:', depth);
