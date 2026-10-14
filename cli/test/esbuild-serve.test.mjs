import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import * as esbuild from 'esbuild';

// Exercise the upstream GHSA-g7r4-m6w7-qqqr patch contract on every OS.
// Only Windows interprets backslashes as filesystem traversal separators.
test('esbuild rejects backslash paths and still serves ordinary files', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'd2i-esbuild-'));
  let context;
  try {
    const servedir = path.join(root, 'public');
    await mkdir(servedir);
    await writeFile(path.join(root, 'sentinel.txt'), 'outside-test-sentinel');
    await writeFile(path.join(servedir, 'ok.txt'), 'inside-test-sentinel');
    context = await esbuild.context({ stdin: { contents: 'console.log(1)' }, write: false });
    const { port } = await context.serve({ host: '127.0.0.1', port: 0, servedir });
    const request = (requestPath) => new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path: requestPath }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
        res.on('error', reject);
      });
      req.setTimeout(2000, () => req.destroy(new Error('Request timed out')));
      req.on('error', reject);
    });
    assert.deepEqual(await request('/ok.txt'), { status: 200, body: 'inside-test-sentinel' });
    for (const requestPath of ['/..\\sentinel.txt', '/..%5csentinel.txt']) {
      const result = await request(requestPath);
      console.log(JSON.stringify({ esbuild: esbuild.version, platform: process.platform, requestPath, ...result }));
      assert.equal(result.status, 400, `Expected backslash rejection for ${requestPath}`);
      assert.ok(!result.body.includes('outside-test-sentinel'));
    }
  } finally {
    await context?.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
