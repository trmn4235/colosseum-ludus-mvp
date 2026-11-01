'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {glob, validateConfig, selectSuites, checkGate, planFromApi, planForEvent, authorizeDeployment} = require('../.github/ci/merge-gate.cjs');
const config = require('../.github/ci/suites.json');
const ids = config.suites.map(s => s.id);
const file = (filename, extra = {}) => ({filename, status: 'modified', ...extra});
const validNeeds = selected => Object.fromEntries([['plan', {result: 'success'}], ['build_pages', {result: 'success'}], ...ids.map(id => [id, {result: selected.includes(id) ? 'success' : 'skipped'}])]);
const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'owner/repo';
const event = {number: 7, repository: {full_name: repository}, pull_request: {head: {sha: head}, base: {sha: base, ref: 'main'}}};
const pr = (changed_files, extra = {}) => ({number: 7, state: 'open', head: {sha: head}, base: {sha: base, ref: 'main', repo: {full_name: repository}}, changed_files, ...extra});

test('supported globs distinguish files, directories, and literal dots', () => {
  assert.ok(glob('assets/**').test('assets/a/b.glb'));
  assert.ok(glob('tests/**/*.cjs').test('tests/a.cjs'));
  assert.ok(glob('tests/**/*.cjs').test('tests/deep/a.cjs'));
  assert.ok(glob('tests/*.test.cjs').test('tests/a.test.cjs'));
  assert.ok(!glob('tests/*.test.cjs').test('tests/deep/a.test.cjs'));
  assert.ok(!glob('arena.html').test('arenaXhtml'));
  for (const bad of ['!excluded/**', '**/*.?js', '[ab]', '+(x)', '***', '']) assert.throws(() => glob(bad), /Unsupported/);
});

test('every original suite is configured and called, and no reusable suite self-triggers on PRs', () => {
  validateConfig(config);
  const workflows = path.resolve(__dirname, '../.github/workflows');
  const actual = fs.readdirSync(workflows).filter(f => f.endsWith('.yml') && f !== 'main-merge.yml').sort();
  assert.deepEqual(config.suites.map(s => s.workflow).sort(), actual);
  assert.equal(actual.length, 24);
  const master = fs.readFileSync(path.join(workflows, 'main-merge.yml'), 'utf8');
  assert.match(master, /name: Main merge gate/);
  assert.match(master, /if: \$\{\{ always\(\) \}\}/);
  const prTrigger = master.split('  pull_request:\n')[1].split('  push:\n')[0];
  assert.ok(!/\n    (?:branches|paths|paths-ignore):/.test(prTrigger));
  assert.ok(!master.includes('draft'));
  const needs = master.match(/    needs: \[([^\]]+)\]/)[1].split(', ');
  assert.deepEqual(needs.sort(), ['plan', 'build_pages', ...ids].sort());
  const calls = [...master.matchAll(/uses: \.\/.github\/workflows\/(.+\.yml)/g)].map(m => m[1]).sort();
  assert.deepEqual(calls, actual);
  for (const suite of config.suites) {
    const text = fs.readFileSync(path.join(workflows, suite.workflow), 'utf8');
    assert.match(text, /^  workflow_call:\s*$/m);
    assert.ok(!/^  pull_request:/m.test(text));
    assert.ok(master.includes(`contains(fromJSON(needs.plan.outputs.selected), '${suite.id}')`));
  }
});

test('representative old path filters and target branch rules are retained', () => {
  assert.ok(selectSuites(config, [file('arena.html')], 'main').includes('arena_realism'));
  assert.ok(selectSuites(config, [file('assets/naval/example.glb')], 'main').includes('naval_regression'));
  assert.ok(!selectSuites(config, [file('assets/naval/deeper/example.glb')], 'main').includes('naval_regression'));
  assert.ok(selectSuites(config, [file('ludus.html')], 'main').includes('first_quests'));
  assert.ok(!selectSuites(config, [file('ludus.html')], 'release').includes('first_quests'));
  assert.ok(selectSuites(config, [file('pit-new.js')], 'release').includes('pit_v174'));
});

test('renames match old and new paths, deletion matches its former path', () => {
  const selected = selectSuites(config, [file('docs/retired.txt', {status: 'renamed', previous_filename: 'arena.html'})], 'main');
  assert.ok(selected.includes('arena_realism'));
  assert.ok(selectSuites(config, [file('arena.html', {status: 'removed'})], 'main').includes('arena_realism'));
  assert.throws(() => selectSuites(config, [file('docs/a', {status: 'renamed'})], 'main'), /Incomplete/);
});

test('docs-only and zero-file changes deliberately select no game suite', () => {
  assert.deepEqual(selectSuites(config, [file('README.md')], 'main'), []);
  assert.deepEqual(selectSuites(config, [], 'main'), []);
  assert.ok(checkGate(config, [], validNeeds([])));
});

test('workflow, policy, or policy-test changes force every suite', () => {
  for (const p of ['.github/workflows/new.yml', '.github/ci/suites.json', '.github/ci/merge-gate.cjs', 'tests/merge-gate.test.cjs']) {
    assert.deepEqual(selectSuites(config, [file(p)], 'main'), ids);
  }
  assert.deepEqual(selectSuites(config, [file('docs/old.txt', {status: 'renamed', previous_filename: '.github/ci/suites.json'})], 'main'), ids);
});

test('gate rejects failed/cancelled/unexpectedly skipped or missing required suite', () => {
  const selected = [ids[0]];
  assert.ok(checkGate(config, selected, validNeeds(selected)));
  for (const result of ['failure', 'cancelled', 'skipped', 'neutral', undefined]) {
    const needs = validNeeds(selected); needs[ids[0]] = {result};
    assert.throws(() => checkGate(config, selected, needs), /expected success/);
  }
  const missing = validNeeds(selected); delete missing[ids[0]];
  assert.throws(() => checkGate(config, selected, missing), /dependencies/);
  const extra = validNeeds(selected); extra.unconfigured = {result: 'success'};
  assert.throws(() => checkGate(config, selected, extra), /dependencies/);
  const unexpected = validNeeds([]); unexpected[ids[0]].result = 'success';
  assert.throws(() => checkGate(config, [], unexpected), /expected skipped/);
});

test('gate rejects absent, malformed or duplicate plans and failed planner', () => {
  for (const selected of [undefined, null, {}, ['missing'], [ids[0], ids[0]]]) assert.throws(() => checkGate(config, selected, validNeeds([])), /plan/);
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const needs = validNeeds([]); needs.plan.result = result;
    assert.throws(() => checkGate(config, [], needs), /planning/);
  }
});

test('API planner consumes all pages and verifies unchanged revision afterwards', async () => {
  const calls = [];
  const selected = await planFromApi(config, event, repository, async endpoint => {
    calls.push(endpoint);
    if (endpoint.endsWith('page=1')) return Array.from({length: 100}, (_, i) => file(`docs/${i}.md`));
    if (endpoint.endsWith('page=2')) return [file('arena.html')];
    return pr(101);
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[0], calls[3]);
  assert.ok(selected.includes('arena_realism'));
});

test('API planner rejects head/base changes, missing/duplicate pages, and inaccessible API', async () => {
  for (const change of [{head: {sha: 'c'.repeat(40)}}, {base: {sha: 'c'.repeat(40), ref: 'main', repo: {full_name: repository}}}, {changed_files: 2}]) {
    let snapshots = 0;
    await assert.rejects(planFromApi(config, event, repository, async endpoint => endpoint.includes('/files?') ? [file('arena.html')] : (++snapshots === 1 ? pr(1) : pr(1, change))), /changed/);
  }
  await assert.rejects(planFromApi(config, event, repository, async endpoint => endpoint.includes('/files?') ? [] : pr(1)), /pagination/);
  await assert.rejects(planFromApi(config, event, repository, async endpoint => endpoint.includes('/files?') ? [file('same'), file('same')] : pr(2)), /pagination/);
  await assert.rejects(planFromApi(config, event, repository, async () => { throw new Error('403'); }), /403/);
});

test('more than 3000 files runs every suite, while stale revisions still fail', async () => {
  let calls = 0;
  assert.deepEqual(await planFromApi(config, event, repository, async endpoint => {
    calls++; assert.ok(!endpoint.includes('/files?')); return pr(3001);
  }), ids);
  assert.equal(calls, 2);
  await assert.rejects(planFromApi(config, event, repository, async () => pr(3001, {head: {sha: 'c'.repeat(40)}})), /revision changed/);
});

test('invalid configuration fails closed', () => {
  const copy = () => structuredClone(config);
  const duplicate = copy(); duplicate.suites.push(duplicate.suites[0]);
  assert.throws(() => validateConfig(duplicate), /duplicate/);
  const unsupported = copy(); unsupported.suites[0].paths = ['!ignore'];
  assert.throws(() => selectSuites(unsupported, [], 'main'), /Unsupported/);
  assert.throws(() => checkGate({version: 1, suites: []}, [], {}), /configuration/);
});

const mainContext = (extra = {}) => ({eventName: 'push', event: {repository: {full_name: repository}, ref: 'refs/heads/main', after: head, deleted: false}, repository, ref: 'refs/heads/main', sha: head, ...extra});

test('main pushes and manual main runs always select all suites, even for docs-only releases', async () => {
  for (const eventName of ['push', 'workflow_dispatch']) {
    const calls = [];
    assert.deepEqual(await planForEvent(config, mainContext({eventName}), async endpoint => {
      calls.push(endpoint); return {commit: {sha: head}};
    }), ids);
    assert.deepEqual(calls, [`/repos/${repository}/branches/main`]);
  }
});

test('PR planning retains path selection and cannot request deployment', async () => {
  const context = {...mainContext(), eventName: 'pull_request', event, ref: 'refs/pull/7/merge'};
  const selected = await planForEvent(config, context, async endpoint => endpoint.includes('/files?') ? [file('README.md')] : pr(1));
  assert.deepEqual(selected, []);
  assert.throws(() => authorizeDeployment(context, head, 'success', 'success'), /Unauthorized/);
});

test('non-main, wrong-event, deleted, mismatched or malformed release contexts fail before API use', async () => {
  const bad = [
    mainContext({ref: 'refs/heads/feature'}),
    mainContext({ref: 'refs/tags/main'}),
    mainContext({eventName: 'pull_request_target'}),
    mainContext({eventName: 'workflow_run'}),
    mainContext({event: {...mainContext().event, deleted: true}}),
    mainContext({event: {...mainContext().event, after: base}}),
    mainContext({event: {...mainContext().event, repository: {full_name: 'other/repo'}}}),
    mainContext({sha: 'bad'}),
    mainContext({eventName: 'workflow_dispatch', ref: 'refs/heads/feature'})
  ];
  for (const context of bad) {
    await assert.rejects(planForEvent(config, context, async () => assert.fail('Unauthorized context must not query GitHub')));
    assert.throws(() => authorizeDeployment(context, head, 'success', 'success'));
  }
});

test('stale main runs and unknown current revisions cannot publish over a newer release', async () => {
  for (const current of [base, undefined, null]) {
    await assert.rejects(planForEvent(config, mainContext(), async () => ({commit: {sha: current}})), /Stale/);
    assert.throws(() => authorizeDeployment(mainContext(), current, 'success', 'success'), /Stale/);
  }
  assert.ok(authorizeDeployment(mainContext(), head, 'success', 'success'));
  assert.ok(authorizeDeployment(mainContext({eventName: 'workflow_dispatch'}), head, 'success', 'success'));
  await assert.rejects(planForEvent(config, mainContext(), async () => {throw Error('API unavailable');}), /unavailable/);
});

test('failed, cancelled, missing or skipped artifact builds block both merge and deployment', () => {
  for (const result of ['failure', 'cancelled', 'skipped', 'neutral', undefined]) {
    const needs = validNeeds(ids); needs.build_pages.result = result;
    assert.throws(() => checkGate(config, ids, needs), /artifact build/);
    assert.throws(() => authorizeDeployment(mainContext(), head, 'success', result), /successful tests and artifact/);
    assert.throws(() => authorizeDeployment(mainContext(), head, result, 'success'), /successful tests and artifact/);
  }
  const needs = validNeeds(ids); delete needs.build_pages;
  assert.throws(() => checkGate(config, ids, needs), /artifact build/);
});

test('production workflow couples a same-revision artifact and successful gate without PR deploy credentials', () => {
  const master = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/main-merge.yml'), 'utf8');
  const job = id => master.match(new RegExp(`^  ${id}:\\n([\\s\\S]*?)(?=^  [a-z_][a-z0-9_]*:|$(?![\\s\\S]))`, 'm'))?.[1];
  const build = job('build_pages'), deploy = job('deploy_pages'), gate = job('gate');
  assert.ok(build && deploy && gate, 'build, gate, and deployment jobs exist');
  assert.match(build, /needs: plan/);
  assert.match(build, /pages: read/);
  assert.ok(!build.includes('pages: write') && !build.includes('id-token: write'));
  assert.match(build, /enablement: false/);
  assert.match(build, /actions\/jekyll-build-pages@[a-f0-9]{40}/);
  assert.match(build, /destination: \.\/_site/);
  assert.match(build, /path: \.\/_site/);
  assert.match(build, /build_revision: \$\{\{ github.sha \}\}/);
  assert.match(gate, /needs: \[plan, build_pages,/);
  assert.match(deploy, /needs: \[gate, build_pages\]/);
  assert.match(deploy, /github.event_name != 'pull_request'.*github.ref == 'refs\/heads\/main'.*needs.gate.result == 'success'.*needs.build_pages.result == 'success'/);
  assert.match(deploy, /pages: write/); assert.match(deploy, /id-token: write/);
  assert.match(deploy, /environment:\n      name: github-pages/);
  assert.ok(deploy.indexOf('authorize-deploy') < deploy.indexOf('actions/deploy-pages@'));
  assert.match(deploy, /ref: \$\{\{ github.sha \}\}/);
  assert.equal((master.match(/pages: write/g) || []).length, 1);
  assert.equal((master.match(/id-token: write/g) || []).length, 1);
  assert.match(master, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/);
  assert.match(master, /group: main-checks-\$\{\{ github.event.pull_request.number \|\| github.ref \}\}/);
  for (const suite of config.suites) {
    const child = fs.readFileSync(path.resolve(__dirname, '../.github/workflows', suite.workflow), 'utf8');
    const push = child.match(/^  push:\n(?:^    .*\n)*/m)?.[0] || '';
    assert.ok(!/branches: \[[^\]]*\bmain\b/.test(push), `${suite.id} must not duplicate main CI`);
  }
});

// A broken backup must block publication just like the existing game suites.
test('current-model assets and loader changes require the model delivery suite', () => {
  for (const filename of ['gladiator-mobile-v217.glb', 'arena.html', 'ludus.html', 'savas.html', 'multiplayer.html', 'caravan-assets-v126.js', 'circus-war-view-v186.js', 'tests/model-delivery-v222.test.cjs', 'tools/verify-model-mirrors-v222.py']) {
    const selected = selectSuites(config, [file(filename)], 'main');
    assert.ok(selected.includes('model_delivery'), filename);
    const needs = validNeeds(selected); needs.model_delivery.result = 'failure';
    assert.throws(() => checkGate(config, selected, needs), /model_delivery: expected success/);
  }
});
