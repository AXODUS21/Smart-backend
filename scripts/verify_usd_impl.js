const fs = require('fs');

const checks = {
  'TutorHome.js': {
    path: 'components/dashboard/TutorHome.js',
    tests: [
      ['pricing_region fetched', 'pricing_region'],
      ['tutorRegion state', 'tutorRegion'],
      ['Earnings USD title', 'Earnings (USD)'],
      ['1.5 conversion', '* 1.5'],
    ]
  },
  'SuperadminWithdrawals.js': {
    path: 'components/dashboard/SuperadminWithdrawals.js',
    tests: [
      ['formatAmount helper exists', 'formatAmount'],
      ['isInternationalTutor helper', 'isInternationalTutor'],
      ['USD in formatAmount', 'USD'],
      ['formatAmount used in card', 'formatAmount(tutor, withdrawal.amount)'],
    ]
  },
  'payout-stats/route.js': {
    path: 'app/api/superadmin/payout-stats/route.js',
    tests: [
      ['CREDIT_TO_USD_RATE', 'CREDIT_TO_USD_RATE'],
      ['pricing_region in select', 'pricing_region'],
      ['is_international field', 'is_international'],
    ]
  },
  'withdrawals/list/route.js': {
    path: 'app/api/superadmin/withdrawals/list/route.js',
    tests: [
      ['pricing_region in Tutors select', 'pricing_region'],
    ]
  },
  'PayoutReports.js': {
    path: 'components/dashboard/PayoutReports.js',
    tests: [
      ['pricing_region check in card', "pricing_region !== 'PH'"],
      ['USD display in card', 'USD'],
    ]
  }
};

let allPassed = true;
for (const [name, { path, tests }] of Object.entries(checks)) {
  const content = fs.readFileSync(path, 'utf8');
  console.log(name + ':');
  for (const [label, search] of tests) {
    const found = content.includes(search);
    if (!found) allPassed = false;
    console.log(`  [${found ? 'PASS' : 'FAIL'}] ${label}`);
  }
}

console.log('\n' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(0);
