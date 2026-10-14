'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { configuration, client } = require('../lib/supabase.cjs');
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
(async () => {
  const result = await client(configuration()).health();
  console.log(JSON.stringify(result));
})().catch(error => { console.error(JSON.stringify({ message: error.message, path: error.path, reason: typeof error.reason === 'string' ? error.reason.slice(0, 200) : undefined })); process.exitCode = 1; });
