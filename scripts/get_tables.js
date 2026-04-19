const cp = require('child_process');

try {
  const result = cp.execSync("git grep -oE \"\\.from\\(['\\\"\\`][a-zA-Z0-9_]+['\\\"\\`]\\)\" || true", { encoding: 'utf8' });
  const matches = result.match(/\.from\(['"`]([a-zA-Z0-9_]+)['"`]\)/g);
  const tables = new Set();
  if (matches) {
    matches.forEach(m => {
      const tb = m.match(/\.from\(['"`]([a-zA-Z0-9_]+)['"`]\)/)[1];
      tables.add(tb);
    });
  }
  console.log([...tables].sort().join('\n'));
} catch (e) {
  console.error(e);
}
