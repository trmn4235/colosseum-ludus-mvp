'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {glob, validateConfig, selectSuites, checkGate, planFromApi} = require('../.github/ci/merge-gate.cjs');
const config = require('../.github/ci/suites.json');
const ids = config.suites.map(s => s.id);
const file = (filename, extra = {}) => ({filename, status: 'modified', ...extra});
const validNeeds = selected => Object.fromEntries([['plan', {result: 'success'}], ...ids.map(id => [id, {result: selected.includes(id) ? 'success' : 'skipped'}])]);
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
  assert.equal(actual.length, 23);
  const master = fs.readFileSync(path.join(workflows, 'main-merge.yml'), 'utf8');
  assert.match(master, /name: Main merge gate/);
  assert.match(master, /if: \$\{\{ always\(\) \}\}/);
  assert.ok(!/\n    (?:branches|paths|paths-ignore):/.test(master));
  assert.ok(!master.includes('draft'));
  const needs = master.match(/    needs: \[([^\]]+)\]/)[1].split(', ');
  assert.deepEqual(needs.sort(), ['plan', ...ids].sort());
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
