const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'dashboard', 'SuperadminWithdrawals.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix corrupted ₱ (peso sign) character - â‚± is the UTF-8 mojibake for ₱
content = content.replaceAll('â\x80\x20', ''); // just in case
// The corrupted sequence for ₱ in latin1 read as utf8 is: â‚±
content = content.split('â‚±').join('₱');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding in SuperadminWithdrawals.js');
process.exit(0);
