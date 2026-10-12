import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceURL } from '../packages/orchestration/references.ts';
test('documentation fetch allows primary HTTPS sources and rejects credentials, secrets and local targets', () => {
  assert.equal(
    referenceURL('https://developer.android.com/tools').hostname,
    'developer.android.com',
  );
  assert.equal(
    referenceURL('https://raw.githubusercontent.com/cozmo/jsQR/master/README.md').protocol,
    'https:',
  );
  for (const value of [
    'http://github.com/a',
    'https://127.0.0.1/a',
    'https://evil.example/a',
    'https://user:password@github.com/a',
    'https://github.com:4310/a',
    'https://github.com/a?key=sk-ant-secret',
    'https://github.com.evil.example/a',
  ])
    assert.throws(() => referenceURL(value));
});
