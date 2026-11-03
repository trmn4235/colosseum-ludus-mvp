'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Implement only the positive *, ** patterns used by the migrated workflows.
// New syntax must be supported and tested here before it is accepted.
function glob(pattern) {
  if (typeof pattern !== 'string' || !pattern || !/^[A-Za-z0-9_./*\-]+$/.test(pattern) || pattern.includes('***')) {
    throw new Error(`Unsupported CI glob: ${pattern}`);
  }
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*') {
      if (pattern[i + 1] === '*') {
        i++;
        if (pattern[i + 1] === '/') { re += '(?:.*/)?'; i++; }
        else re += '.*';
      } else re += '[^/]*';
    } else re += pattern[i] === '.' ? '\\.' : pattern[i];
  }
  return new RegExp(re + '$');
}

function validateConfig(config) {
  if (config?.version !== 1 || !Array.isArray(config.suites) || !config.suites.length) throw new Error('Missing CI suite configuration');
  const ids = new Set(), workflows = new Set();
  for (const suite of config.suites) {
    if (!/^[a-z][a-z0-9_]*$/.test(suite.id) || ids.has(suite.id)) throw new Error('Invalid or duplicate suite id');
    if (!/^[a-z0-9-]+\.yml$/.test(suite.workflow) || workflows.has(suite.workflow)) throw new Error('Invalid or duplicate workflow');
    if (!Array.isArray(suite.paths) || !suite.paths.length || !Array.isArray(suite.branches) || !suite.branches.length) throw new Error('Missing suite filters');
    suite.paths.forEach(glob); suite.branches.forEach(glob);
    ids.add(suite.id); workflows.add(suite.workflow);
  }
  return config;
}

function changedPaths(files) {
  if (!Array.isArray(files)) throw new Error('Invalid changed-file response');
  return files.flatMap(file => {
    if (typeof file?.filename !== 'string' || !file.filename || (file.status === 'renamed' && !file.previous_filename)) throw new Error('Incomplete changed-file record');
    const names = [file.filename];
    if (file.previous_filename !== undefined) {
      if (typeof file.previous_filename !== 'string' || !file.previous_filename) throw new Error('Invalid previous filename');
      names.push(file.previous_filename);
    }
    return names;
  });
}

function selectSuites(config, files, branch, forceAll = false) {
  validateConfig(config);
  if (typeof branch !== 'string' || !branch) throw new Error('Missing target branch');
  const paths = changedPaths(files);
  const policyChanged = paths.some(p => p.startsWith('.github/workflows/') || p.startsWith('.github/ci/') || p === 'tests/merge-gate.test.cjs');
  return config.suites.filter(s => forceAll || policyChanged || (
    s.branches.some(p => glob(p).test(branch)) && paths.some(file => s.paths.some(p => glob(p).test(file)))
  )).map(s => s.id);
}

function checkGate(config, selected, needs) {
  validateConfig(config);
  const ids = config.suites.map(s => s.id);
  if (!Array.isArray(selected) || selected.some(id => typeof id !== 'string' || !ids.includes(id)) || new Set(selected).size !== selected.length) throw new Error('Invalid or missing suite plan');
  if (!needs || needs.plan?.result !== 'success') throw new Error('Suite planning did not succeed');
  if (needs.build_pages?.result !== 'success') throw new Error('Pages artifact build did not succeed');
  const keys = Object.keys(needs).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['plan', 'build_pages', ...ids].sort())) throw new Error('Gate dependencies do not cover exactly the configured suites');
  for (const id of ids) {
    const expected = selected.includes(id) ? 'success' : 'skipped';
    if (needs[id]?.result !== expected) throw new Error(`${id}: expected ${expected}, got ${needs[id]?.result ?? 'missing'}`);
  }
  return true;
}

function validateRevision(pr, event, repository) {
  const expected = event.pull_request;
  if (!expected || !Number.isSafeInteger(event.number) || event.number < 1 || event.repository?.full_name !== repository) throw new Error('Invalid PR event');
  if (pr.state !== 'open' || pr.number !== event.number || pr.head?.sha !== expected.head?.sha || pr.base?.sha !== expected.base?.sha || pr.base?.ref !== expected.base?.ref || pr.base?.repo?.full_name !== repository) {
    throw new Error('PR revision changed; this run cannot approve the current revision');
  }
  for (const sha of [pr.head.sha, pr.base.sha]) if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid PR SHA');
}

// The API caps this list at 3000 files; select every suite beyond that cap.
// Re-read the PR after pagination, rejecting a head/base change during planning.
async function planFromApi(config, event, repository, get) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository');
  const endpoint = `/repos/${repository}/pulls/${event.number}`;
  const before = await get(endpoint);
  validateRevision(before, event, repository);
  if (!Number.isSafeInteger(before.changed_files) || before.changed_files < 0) throw new Error('Missing changed-file count');
  const all = before.changed_files > 3000;
  const files = [];
  if (!all) {
    for (let page = 1; files.length < before.changed_files; page++) {
      if (page > 30) throw new Error('Changed-file pagination exceeded its limit');
      const batch = await get(`${endpoint}/files?per_page=100&page=${page}`);
      changedPaths(batch);
      if (batch.length === 0 || batch.length > 100) throw new Error('Incomplete changed-file pagination');
      files.push(...batch);
    }
    if (files.length !== before.changed_files || new Set(files.map(f => f.filename)).size !== files.length) throw new Error('Inconsistent changed-file pagination');
  }
  const after = await get(endpoint);
  validateRevision(after, event, repository);
  if (after.changed_files !== before.changed_files) throw new Error('Changed-file count changed during planning');
  return selectSuites(config, files, before.base.ref, all);
}

// Manual runs and pushes may publish only the current main revision. PRs never
// receive deployment credentials, and an old run cannot roll back a newer main.
function validateMainContext({eventName, event, repository, ref, sha}) {
  if (!['push', 'workflow_dispatch'].includes(eventName) || ref !== 'refs/heads/main') throw new Error('Unauthorized deployment event or branch');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || event?.repository?.full_name !== repository) throw new Error('Invalid deployment repository');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid deployment SHA');
  if (eventName === 'push' && (event.ref !== ref || event.after !== sha || event.deleted !== false)) throw new Error('Push revision does not match this run');
}

async function planForEvent(config, context, get) {
  if (context.eventName === 'pull_request') return planFromApi(config, context.event, context.repository, get);
  validateMainContext(context);
  const current = await get(`/repos/${context.repository}/branches/main`);
  if (current.commit?.sha !== context.sha) throw new Error('Stale main revision; refusing to test for deployment');
  validateConfig(config);
  // A previous successful main run is the baseline for incremental checks.
  // Unknown baselines, force pushes and truncated comparisons retain full CI.
  if (await hasValidatedBaseline(context, get)) {
    const comparison = await get(`/repos/${context.repository}/compare/${context.event.before}...${context.sha}?per_page=1`);
    if (comparison.status === 'ahead' && comparison.merge_base_commit?.sha === context.event.before &&
        Array.isArray(comparison.files) && comparison.files.length < 300) {
      return selectSuites(config, comparison.files, 'main');
    }
  }
  return config.suites.map(s => s.id);
}

const workflowPath = '.github/workflows/main-merge.yml';
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

function successfulRun(run, context, eventName, sha) {
  return Number.isSafeInteger(run?.id) && run.id > 0 && run.event === eventName &&
    run.path === workflowPath && run.head_sha === sha && run.status === 'completed' &&
    run.conclusion === 'success' && run.repository?.full_name === context.repository &&
    run.head_repository?.full_name === context.repository;
}

async function hasValidatedBaseline(context, get) {
  if (context.eventName !== 'push' || context.event.forced === true || !isSha(context.event.before) || /^0+$/.test(context.event.before)) return false;
  const result = await get(`/repos/${context.repository}/actions/workflows/main-merge.yml/runs?event=push&head_sha=${context.event.before}&per_page=1`);
  const run = result.workflow_runs?.[0];
  return successfulRun(run, context, 'push', context.event.before) && run.head_branch === 'main';
}

// The run title records github.sha (the actual PR merge checkout), not merely
// the PR head. Both that merge tree AND the PR head tree must equal current main.
// No artifact or execution output from a PR is used for production publishing.
async function findReusableRun(context, get, expectedId) {
  validateMainContext(context);
  if (!await hasValidatedBaseline(context, get)) return null;
  const root = `/repos/${context.repository}`;
  const prs = await get(`${root}/commits/${context.sha}/pulls?per_page=100`);
  if (!Array.isArray(prs)) throw new Error('Invalid associated PR response');
  const candidates = prs.filter(pr => pr.merged_at && pr.state === 'closed' && pr.merge_commit_sha === context.sha &&
    pr.base?.ref === 'main' && pr.base.sha === context.event.before && pr.base.repo?.full_name === context.repository &&
    pr.head?.repo?.full_name === context.repository && isSha(pr.head.sha));
  if (candidates.length !== 1) return null;
  const pr = candidates[0];
  const [main, source, workflow] = await Promise.all([
    get(`${root}/git/commits/${context.sha}`), get(`${root}/git/commits/${pr.head.sha}`),
    get(`${root}/actions/workflows/main-merge.yml`)
  ]);
  if (!isSha(main.tree?.sha) || main.tree.sha !== source.tree?.sha || workflow.path !== workflowPath || !Number.isSafeInteger(workflow.id)) return null;
  const result = await get(`${root}/actions/workflows/main-merge.yml/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=1`);
  const run = result.workflow_runs?.[0];
  if (!successfulRun(run, context, 'pull_request', pr.head.sha) || run.workflow_id !== workflow.id ||
      run.head_branch !== pr.head.ref || (expectedId !== undefined && run.id !== expectedId)) return null;
  const match = /^Main checks: ([a-f0-9]{40})$/.exec(run.display_title || '');
  if (!match) return null;
  const tested = await get(`${root}/git/commits/${match[1]}`);
  if (tested.tree?.sha !== main.tree.sha || tested.parents?.length !== 2 ||
      tested.parents[0]?.sha !== context.event.before || tested.parents[1]?.sha !== pr.head.sha) return null;
  return run.id;
}

async function planExecution(config, context, get) {
  const selected = await planForEvent(config, context, get);
  let reusedRun = null;
  if (context.eventName === 'push') {
    // Optional reuse discovery may fail without blocking a normal test run.
    try { reusedRun = await findReusableRun(context, get); }
    catch (error) { console.warn(`Running planned suites; reuse unavailable: ${error.message}`); }
  }
  return {selected: reusedRun ? [] : selected, reusedRun};
}

async function verifyExecution(config, context, selected, needs, reusedRun, get) {
  checkGate(config, selected, needs);
  if (reusedRun !== null) {
    if (!Number.isSafeInteger(reusedRun) || reusedRun < 1 || selected.length ||
        await findReusableRun(context, get, reusedRun) !== reusedRun) throw new Error('Reusable validation could not be verified');
    const current = await get(`/repos/${context.repository}/branches/main`);
    if (current.commit?.sha !== context.sha) throw new Error('Stale main revision');
  }
  return true;
}

function authorizeDeployment(context, currentSha, gateResult, buildResult) {
  validateMainContext(context);
  if (gateResult !== 'success' || buildResult !== 'success') throw new Error('Deployment requires successful tests and artifact build');
  if (currentSha !== context.sha) throw new Error('Stale main revision; refusing to overwrite the newer release');
  return true;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'suites.json'), 'utf8'));
  if (process.argv[2] === 'gate' && !process.env.MERGE_REUSED_RUN) {
    checkGate(config, JSON.parse(process.env.MERGE_SELECTED), JSON.parse(process.env.MERGE_NEEDS));
    console.log('All planned suites and the Pages artifact build succeeded; every other suite was deliberately skipped.');
    return;
  }
  if (!['plan', 'gate', 'authorize-deploy'].includes(process.argv[2])) throw new Error('Usage: merge-gate.cjs plan|gate|authorize-deploy');
  if (!process.env.GH_TOKEN) throw new Error('Missing CI credentials');
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const context = {eventName: process.env.GITHUB_EVENT_NAME, event, repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA};
  const cache = new Map();
  const read = async endpoint => {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub API read failed (${response.status})`);
    return response.json();
  };
  const get = endpoint => {
    if (context.eventName === 'pull_request') return read(endpoint);
    if (!cache.has(endpoint)) cache.set(endpoint, read(endpoint));
    return cache.get(endpoint);
  };
  if (process.argv[2] === 'plan') {
    if (!process.env.GITHUB_OUTPUT) throw new Error('Missing CI output path');
    const {selected, reusedRun} = await planExecution(config, context, get);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `selected=${JSON.stringify(selected)}\nreused_run=${reusedRun || ''}\n`);
    console.log(`Required suites (${selected.length}): ${selected.join(', ') || 'none; CI policy tests passed'}`);
    if (reusedRun) console.log(`Reusing successful PR run ${reusedRun}: tested merge tree equals current main.`);
  } else if (process.argv[2] === 'gate') {
    await verifyExecution(config, context, JSON.parse(process.env.MERGE_SELECTED), JSON.parse(process.env.MERGE_NEEDS), Number(process.env.MERGE_REUSED_RUN), get);
    console.log(`Verified PR run ${process.env.MERGE_REUSED_RUN} and the new Pages build for this exact main tree.`);
  } else {
    validateMainContext(context);
    const current = await get(`/repos/${context.repository}/branches/main`);
    authorizeDeployment(context, current.commit?.sha, process.env.PAGES_GATE_RESULT, process.env.PAGES_BUILD_RESULT);
    console.log(`Deployment authorized for tested current main ${context.sha}.`);
  }
}

module.exports = {glob, validateConfig, changedPaths, selectSuites, checkGate, validateRevision, planFromApi, validateMainContext, planForEvent, planExecution, findReusableRun, verifyExecution, authorizeDeployment};
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
