import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script } from 'node:vm';

const publishedUrl = 'https://djbebs.github.io/mini-crans-montana/crans-montana-p067/';

for (const directory of ['preview-ycoor-design', 'crans-montana-p067']) {
  test(`${directory} redirects direct file opens before starting the app`, () => {
    const html = readFileSync(new URL(`../${directory}/index.html`, import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    const guards = scripts.filter(([, attributes]) => /\sid\s*=\s*["']local-entry-redirect["']/i.test(attributes));
    assert.equal(guards.length, 1, 'expected one local entry redirect script');

    const [guard] = guards;
    assert.doesNotMatch(guard[1], /\s(?:src|type|async|defer|nomodule)(?=\s|=|$)/i);
    const startup = scripts.find(([, , source]) => source.includes('window.__p0Booted=false'));
    const importMap = scripts.find(([, attributes]) => /\stype\s*=\s*["']importmap["']/i.test(attributes));
    const module = scripts.find(([, attributes]) => /\stype\s*=\s*["']module["']/i.test(attributes));
    for (const [name, script] of [['startup', startup], ['import map', importMap], ['3D module', module]]) {
      assert.ok(script, `expected ${name} script`);
      assert.ok(guard.index < script.index, `redirect must run before the ${name}`);
    }

    const redirect = new Script(guard[2]);
    const entries = [
      [`file:///C:/project/${directory}/index.html`, [publishedUrl]],
      [`http://localhost:8000/${directory}/`, []],
      [`https://djbebs.github.io/mini-crans-montana/${directory}/`, []],
    ];
    for (const [href, expected] of entries) {
      const replacements = [];
      const location = {
        href,
        protocol: new URL(href).protocol,
        replace: (target) => replacements.push(target),
      };
      const globals = { location };
      globals.window = globals;
      redirect.runInNewContext(globals);
      assert.deepEqual(replacements, expected, href);
      assert.equal(globals.location, location, href);
      assert.equal(location.href, href, href);
    }
  });
}
