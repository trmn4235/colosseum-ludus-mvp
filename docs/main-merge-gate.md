# Main branch merge checks

`Main merge gate` is the single required GitHub Actions status for `main`.
The repository ruleset must require a pull request, an up-to-date branch and
this status, with no bypass. Force pushes and branch deletion remain blocked.
Changing workflow files alone does not enable these repository settings.

`.github/workflows/main-merge.yml` runs for every pull request, including drafts
and documentation changes. Its planner validates the PR head and base before
and after paginating the changed-file list. Renames match both filenames;
over 3000 changed files run all suites rather than trusting a truncated list.

`.github/ci/suites.json` retains the previous 23 workflows' branch/path filters.
Relevant suites run through `workflow_call`; their existing push and manual
triggers still work. CI policy/workflow changes run all suites. Documentation
changes can select no game suites, but still run the planner/gate regression
tests. The final gate always checks the plan and every dependency: selected
suites must succeed, and unselected suites must be explicitly skipped. Failed,
cancelled, missing or unexpectedly skipped suites block merging.

To add a suite, add a reusable workflow, its filters in `suites.json`, a caller
job and a gate dependency in `main-merge.yml`. Run
`node --test tests/merge-gate.test.cjs`. Supported filters use literal paths,
`*` and `**`; unsupported glob syntax fails closed and requires an implementation
and regression test. Keep each suite's actual assertions intact.

CI success verifies automated checks; it does not replace physical iPhone
testing or independently gate the Pages deployment pipeline.
