const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'dashboard', 'PayoutReports.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update PDF export tableData: show currency based on tutor region
const oldTableData = `      const tableData = withdrawals.map(w => [
        w.tutor_name || "N/A",
        w.tutor_email || "N/A",
        \`PHP \${parseFloat(w.amount || 0).toFixed(2)}\`,
        w.payment_method?.toUpperCase() || "N/A",
        (w.status || "pending").toUpperCase()
      ]);`;

const newTableData = `      const tableData = withdrawals.map(w => {
        const isIntl = w.pricing_region !== 'PH' && w.is_international !== false;
        const amountStr = isIntl
          ? \`USD \${parseFloat(w.amount || 0).toFixed(2)}\`
          : \`PHP \${parseFloat(w.amount || 0).toFixed(2)}\`;
        return [
          w.tutor_name || "N/A",
          w.tutor_email || "N/A",
          amountStr,
          w.payment_method?.toUpperCase() || "N/A",
          (w.status || "pending").toUpperCase()
        ];
      });`;

if (content.includes(oldTableData)) {
  content = content.replace(oldTableData, newTableData);
  console.log('Updated PDF tableData in PayoutReports.js');
} else {
  console.log('WARNING: Could not find PDF tableData target');
}

// 2. Update individual payout card amount display (line ~739 in ReportDetailsView)
// The current code shows: ₱{parseFloat(w.amount || 0).toFixed(2)}
const oldAmountDisplay = `\u20b1{parseFloat(w.amount || 0).toFixed(2)}`;
const newAmountDisplay = `{w.pricing_region !== 'PH' && w.is_international !== false
                              ? \`$\${parseFloat(w.amount || 0).toFixed(2)} USD\`
                              : \`\u20b1\${parseFloat(w.amount || 0).toFixed(2)}\`}`;

if (content.includes(oldAmountDisplay)) {
  content = content.replace(oldAmountDisplay, newAmountDisplay);
  console.log('Updated individual payout amount in PayoutReports.js');
} else {
  console.log('WARNING: Could not find individual payout amount target');
}

// 3. Update Excel export - in exportToExcel, Amount column label
const oldExcelHeaders = `        "Withdrawal ID",
        "Tutor Name",
        "Tutor Email",
        "Amount (PHP)",`;

const newExcelHeaders = `        "Withdrawal ID",
        "Tutor Name",
        "Tutor Email",
        "Region",
        "Amount",`;

if (content.includes(oldExcelHeaders)) {
  content = content.replace(oldExcelHeaders, newExcelHeaders);
  console.log('Updated Excel headers in PayoutReports.js');
} else {
  console.log('WARNING: Could not find Excel headers target');
}

// 4. Update Excel row data - w.amount display
const oldExcelRow = `          w.withdrawal_id,
          tutorName,
          w.tutor_email || "N/A",
          w.amount || 0,
          w.credits || 0,`;

const newExcelRow = `          w.withdrawal_id,
          tutorName,
          w.tutor_email || "N/A",
          w.pricing_region !== 'PH' && w.is_international !== false ? 'International' : 'Philippines',
          w.amount || 0,
          w.credits || 0,`;

if (content.includes(oldExcelRow)) {
  content = content.replace(oldExcelRow, newExcelRow);
  console.log('Updated Excel row data in PayoutReports.js');
} else {
  console.log('WARNING: Could not find Excel row data target');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done with PayoutReports.js');
process.exit(0);
