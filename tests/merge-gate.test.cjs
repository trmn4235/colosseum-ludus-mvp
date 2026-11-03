'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {glob, validateConfig, selectSuites, checkGate, planFromApi, planForEvent, planExecution, findReusableRun, verifyExecution, authorizeDeployment} = require('../.github/ci/merge-gate.cjs');
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

function releaseFixture(files = [file('arena.html')]) {
  const context = mainContext(); context.event.before = base;
  const root = `/repos/${repository}`, source = 'c'.repeat(40), merge = 'd'.repeat(40), tree = 'e'.repeat(40);
  const run = {id: 101, event: 'pull_request', path: '.github/workflows/main-merge.yml', head_sha: source,
    status: 'completed', conclusion: 'success', repository: {full_name: repository}, head_repository: {full_name: repository},
    head_branch: 'feature', workflow_id: 55, display_title: `Main checks: ${merge}`};
  const previous = {...run, id: 100, event: 'push', head_branch: 'main', head_sha: base};
  const merged = {number: 7, state: 'closed', merged_at: '2026-11-03T12:00:00Z', merge_commit_sha: head,
    base: {sha: base, ref: 'main', repo: {full_name: repository}}, head: {sha: source, ref: 'feature', repo: {full_name: repository}}};
  const data = {
    [`${root}/branches/main`]: {commit: {sha: head}},
    [`${root}/actions/workflows/main-merge.yml/runs?event=push&head_sha=${base}&per_page=1`]: {workflow_runs: [previous]},
    [`${root}/compare/${base}...${head}?per_page=1`]: {status: 'ahead', merge_base_commit: {sha: base}, files},
    [`${root}/commits/${head}/pulls?per_page=100`]: [merged],
    [`${root}/git/commits/${head}`]: {tree: {sha: tree}},
    [`${root}/git/commits/${source}`]: {tree: {sha: tree}},
    [`${root}/git/commits/${merge}`]: {tree: {sha: tree}, parents: [{sha: base}, {sha: source}]},
    [`${root}/actions/workflows/main-merge.yml`]: {id: 55, path: '.github/workflows/main-merge.yml'},
    [`${root}/actions/workflows/main-merge.yml/runs?event=pull_request&head_sha=${source}&per_page=1`]: {workflow_runs: [run]}
  };
  const get = async endpoint => {assert.ok(Object.hasOwn(data, endpoint), endpoint); return structuredClone(data[endpoint]);};
  return {context, data, get, run, previous, merged, root, source, merge};
}

test('validated main baseline permits path selection including renames and documentation', async () => {
  for (const files of [[file('README.md')], [file('arena.html')], [file('docs/old.md', {status: 'renamed', previous_filename: 'arena.html'})]]) {
    const f = releaseFixture(files);
    assert.deepEqual(await planForEvent(config, f.context, f.get), selectSuites(config, files, 'main'));
  }
});

test('unknown or failed baseline, force push, divergent history and capped diff run all suites', async () => {
  const mutations = [
    f => {f.previous.conclusion = 'failure';}, f => {f.previous.status = 'in_progress';},
    f => {f.previous.head_branch = 'feature';}, f => {f.previous.repository = {full_name: 'other/repo'};},
    f => {f.context.event.forced = true;}, f => {f.context.event.before = '0'.repeat(40);},
    f => {f.data[`${f.root}/compare/${base}...${head}?per_page=1`].status = 'diverged';},
    f => {f.data[`${f.root}/compare/${base}...${head}?per_page=1`].merge_base_commit.sha = head;},
    f => {f.data[`${f.root}/compare/${base}...${head}?per_page=1`].files = Array.from({length: 300}, (_, i) => file(`docs/${i}.md`));},
    f => {delete f.data[`${f.root}/compare/${base}...${head}?per_page=1`].files;}
  ];
  for (const mutate of mutations) {
    const f = releaseFixture([file('README.md')]); mutate(f);
    assert.deepEqual(await planForEvent(config, f.context, f.get), ids);
  }
});

test('exact tested PR merge tree is reused and independently reverified by the gate', async () => {
  const f = releaseFixture();
  assert.deepEqual(await planExecution(config, f.context, f.get), {selected: [], reusedRun: 101});
  assert.ok(await verifyExecution(config, f.context, [], validNeeds([]), 101, f.get));
  f.run.conclusion = 'failure';
  await assert.rejects(verifyExecution(config, f.context, [], validNeeds([]), 101, f.get), /could not be verified/);
});

test('reuse rejects wrong code, base, source, checkout, workflow, event, status and provenance', async () => {
  const mutations = [
    f => {f.previous.conclusion = 'failure';},
    f => {f.merged.head.repo.full_name = 'fork/repo';}, f => {f.merged.base.sha = head;},
    f => {f.merged.base.ref = 'release';}, f => {f.merged.merge_commit_sha = base;},
    f => {f.merged.merged_at = null;},
    f => {f.data[`${f.root}/git/commits/${head}`].tree.sha = base;},
    f => {f.data[`${f.root}/git/commits/${f.merge}`].tree.sha = base;},
    f => {f.data[`${f.root}/git/commits/${f.merge}`].parents[0].sha = head;},
    f => {f.data[`${f.root}/git/commits/${f.merge}`].parents[1].sha = base;},
    f => {f.run.event = 'workflow_dispatch';}, f => {f.run.head_sha = head;},
    f => {f.run.head_repository.full_name = 'fork/repo';}, f => {f.run.path = '.github/workflows/fake.yml';},
    f => {f.run.workflow_id = 56;}, f => {f.run.head_branch = 'wrong';},
    f => {f.run.display_title = 'Arbitrary PR title';}, f => {f.run.status = 'in_progress';},
    f => {f.run.conclusion = 'cancelled';}, f => {f.run.conclusion = 'failure';},
    f => {f.context.event.forced = true;}
  ];
  for (const mutate of mutations) {
    const f = releaseFixture(); mutate(f);
    assert.equal(await findReusableRun(f.context, f.get), null, mutate.toString());
  }
});

test('reuse uncertainty falls back to tests; manual runs always perform full validation', async () => {
  const f = releaseFixture();
  const get = endpoint => endpoint.includes('/pulls?') ? Promise.reject(Error('Unavailable')) : f.get(endpoint);
  assert.deepEqual(await planExecution(config, f.context, get), {selected: selectSuites(config, [file('arena.html')], 'main'), reusedRun: null});
  f.context.eventName = 'workflow_dispatch';
  assert.deepEqual(await planExecution(config, f.context, f.get), {selected: ids, reusedRun: null});
});

test('reuse never excuses a failed build, changed run, stale main or inconsistent plan', async () => {
  const f = releaseFixture();
  for (const reused of [0, -1, 999, '101']) await assert.rejects(verifyExecution(config, f.context, [], validNeeds([]), reused, f.get));
  await assert.rejects(verifyExecution(config, f.context, ids, validNeeds(ids), 101, f.get));
  const needs = validNeeds([]); needs.build_pages.result = 'failure';
  await assert.rejects(verifyExecution(config, f.context, [], needs, 101, f.get), /artifact/);
  f.data[`${f.root}/branches/main`].commit.sha = base;
  await assert.rejects(verifyExecution(config, f.context, [], validNeeds([]), 101, f.get), /Stale/);
});

test('workflow records actual checkout SHA and passes reuse proof to the gate', () => {
  const master = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/main-merge.yml'), 'utf8');
  assert.match(master, /run-name: 'Main checks: \$\{\{ github.sha \}\}'/);
  assert.match(master, /actions: read/);
  assert.match(master, /reused_run: \$\{\{ steps.plan.outputs.reused_run \}\}/);
  assert.match(master, /MERGE_REUSED_RUN: \$\{\{ needs.plan.outputs.reused_run \}\}/);
});

test('equipment matrix keeps production-state consumers with their producer', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/equipment-v168.yml'), 'utf8');
  const groups = [...workflow.matchAll(/      - name: (\w+) checks\n        if: matrix.group == '\w+'\n        run: \|\n([\s\S]*?)(?=      - name:|$)/g)];
  assert.equal(groups.length, 8);
  let consumers = 0;
  for (const [, group, commands] of groups) {
    for (const match of commands.matchAll(/node (tests\/[^\s]+\.cjs)/g)) {
      const source = fs.readFileSync(path.resolve(__dirname, '..', match[1]), 'utf8');
      const readsState = /readFileSync\('\/tmp\/production-state-v119.json'/.test(source);
      const importsFixture = source.includes("__dirname+'/production-browser-v119.cjs'");
      if (readsState || importsFixture) {
        consumers++;
        assert.equal(group, 'core', match[1]);
        assert.ok(commands.indexOf('LUDUS_EQUIPMENT_TEST=1 node tests/production-v119.cjs') < match.index, match[1]);
      }
    }
  }
  assert.equal(consumers, 8);
});

test('manual runs and main pushes without a validated baseline select all suites', async () => {
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
