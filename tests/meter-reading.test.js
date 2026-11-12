const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let response = { data: { readable: true, reading: '0123' }, error: null };
const storage = new Map();
const api = {};
vm.runInNewContext(compile('src/services/meterService.ts'), {
  exports: api, Date,
  require: name => name.includes('async-storage') ? { __esModule: true, default: { setItem: async (key, value) => storage.set(key, value) } } : { supabase: { functions: { invoke: async () => response } } },
});

(async () => {
  assert.equal(api.validReading('0123', 'analog'), true);
  for (const invalid of ['', '123', '12345', '12.3', '1e03', '-123']) assert.equal(api.validReading(invalid, 'analog'), false);
  assert.equal(api.validReading('00123.456', 'digital'), true);
  for (const invalid of ['', '123.', '-1', '1e3', '123456789', '0.1234']) assert.equal(api.validReading(invalid, 'digital'), false);
  assert.equal(await api.analyzeMeter('photo', 'analog'), '0123');
  response = { data: { readable: false, reading: '' }, error: null };
  assert.equal(await api.analyzeMeter('photo', 'analog'), null);
  response = { data: { readable: true, reading: '12345' }, error: null };
  assert.equal(await api.analyzeMeter('photo', 'analog'), null);
  response = { data: null, error: new Error('offline') };
  await assert.rejects(api.analyzeMeter('photo', 'analog'), /unavailable/);
  await api.saveMeterReading('alice', '0123', 'analog');
  await api.saveMeterReading('bob', '0001.2', 'digital');
  assert.equal(JSON.parse(storage.get('meter-reading:alice')).reading, '0123');
  assert.equal(JSON.parse(storage.get('meter-reading:bob')).reading, '0001.2');
  await assert.rejects(api.saveMeterReading('alice', '123', 'analog'), /invalid/);

  let handler, authorized = true, upstreamOk = true, result = { readable: true, reading: '0012' }, upstreamCalls = 0;
  vm.runInNewContext(compile('supabase/functions/analyze-meter/index.ts'), {
    Response, Request, AbortSignal,
    Deno: { env: { get: () => 'configured' }, serve: fn => { handler = fn; } },
    fetch: async url => {
      if (url.endsWith('/auth/v1/user')) return Response.json(authorized ? { id: 'alice', email_confirmed_at: '2026-11-12' } : {}, { status: authorized ? 200 : 401 });
      upstreamCalls++;
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }, { status: upstreamOk ? 200 : 502 });
    },
  });
  const request = (body, token = 'Bearer user') => new Request('https://local/analyze-meter', { method: 'POST', headers: token ? { Authorization: token } : {}, body: JSON.stringify(body) });
  const payload = { image: 'YWJj', meterType: 'analog' };
  assert.equal((await handler(request(payload, ''))).status, 401);
  authorized = false;
  assert.equal((await handler(request(payload))).status, 401);
  assert.equal(upstreamCalls, 0);
  authorized = true;
  assert.equal((await handler(request({ ...payload, image: 'not an image!' }))).status, 400);
  assert.deepEqual(await (await handler(request(payload))).json(), { readable: true, reading: '0012' });
  result = { readable: true, reading: '12345' };
  assert.deepEqual(await (await handler(request(payload))).json(), { readable: false, reading: '' });
  result = { readable: false, reading: '' };
  assert.deepEqual(await (await handler(request(payload))).json(), result);
  upstreamOk = false;
  assert.equal((await handler(request(payload))).status, 502);
  console.log('Meter validation, analysis fallback, account-scoped saving, and server authorization tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
