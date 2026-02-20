const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'dashboard', 'PayoutReports.js');
let content = fs.readFileSync(filePath, 'utf8');

// Add International badge after the status span in ReportDetailsView
const statusSpanClose = `                            {w.status?.toUpperCase() || "PENDING"}
                          </span>
                        </div>`;

const statusSpanWithBadge = `                            {w.status?.toUpperCase() || "PENDING"}
                          </span>
                          {w.pricing_region !== 'PH' && w.is_international !== false && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
                              \u{1F310} International
                            </span>
                          )}
                        </div>`;

if (content.includes(statusSpanClose)) {
  content = content.replace(statusSpanClose, statusSpanWithBadge);
  console.log('Added International badge in PayoutReports.js');
} else {
  console.log('Could not find target for badge.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
process.exit(0);
