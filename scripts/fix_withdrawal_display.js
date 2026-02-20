const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'dashboard', 'SuperadminWithdrawals.js');
let content = fs.readFileSync(filePath, 'utf8');

// Add International badge after the amount block - target the closing </div> after the DollarSign block
const oldBlock = `                        </div>
                        <div className="text-sm text-slate-500">
                          Requested: {formatDate(withdrawal.requested_at)}
                        </div>`;

const newBlock = `                        </div>
                        {isInternationalTutor(tutor) && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
                            \u{1F310} International
                          </span>
                        )}
                        <div className="text-sm text-slate-500">
                          Requested: {formatDate(withdrawal.requested_at)}
                        </div>`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  console.log('Added International badge');
} else {
  console.log('Could not find target for badge, skipping.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
process.exit(0);
