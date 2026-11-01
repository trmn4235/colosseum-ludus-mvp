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
  const keys = Object.keys(needs).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['plan', ...ids].sort())) throw new Error('Gate dependencies do not cover exactly the configured suites');
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

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'suites.json'), 'utf8'));
  if (process.argv[2] === 'gate') {
    checkGate(config, JSON.parse(process.env.MERGE_SELECTED), JSON.parse(process.env.MERGE_NEEDS));
    console.log('All planned suites succeeded; every other suite was deliberately skipped.');
  } else if (process.argv[2] === 'plan') {
    if (!process.env.GH_TOKEN || !process.env.GITHUB_OUTPUT) throw new Error('Missing CI credentials or output path');
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const get = async endpoint => {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        headers: {Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`GitHub API read failed (${response.status})`);
      return response.json();
    };
    const selected = await planFromApi(config, event, process.env.GITHUB_REPOSITORY, get);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `selected=${JSON.stringify(selected)}\n`);
    console.log(`Required suites (${selected.length}): ${selected.join(', ') || 'none; CI policy tests passed'}`);
  } else throw new Error('Usage: merge-gate.cjs plan|gate');
}

module.exports = {glob, validateConfig, changedPaths, selectSuites, checkGate, validateRevision, planFromApi};
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
