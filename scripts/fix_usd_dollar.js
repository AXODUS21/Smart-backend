const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'dashboard', 'PayoutReports.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the missing $ in the USD amount line (template literal $ got consumed)
// Looking for: ? `${parseFloat(w.amount || 0).toFixed(2)} USD`
// Should be:   ? `$${parseFloat(w.amount || 0).toFixed(2)} USD`
const badLine = '? `${parseFloat(w.amount || 0).toFixed(2)} USD`';
const goodLine = '? `$${parseFloat(w.amount || 0).toFixed(2)} USD`';

if (content.includes(badLine)) {
  const count = content.split(badLine).length - 1;
  content = content.split(badLine).join(goodLine);
  console.log(`Fixed ${count} instance(s) of missing $ in USD amount`);
} else {
  console.log('No fix needed or already correct.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
process.exit(0);
