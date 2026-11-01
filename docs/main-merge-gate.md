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
Relevant suites run through `workflow_call`; their non-main push and manual
triggers still work. Main pushes are handled only by the shared workflow, so
they do not duplicate the reusable suites. CI policy/workflow changes run all suites. Documentation
changes can select no game suites, but still run the planner/gate regression
tests and build the Pages artifact. The final gate always requires a successful Pages build and checks the plan
and every test dependency: selected
suites must succeed, and unselected suites must be explicitly skipped. Failed,
cancelled, missing or unexpectedly skipped suites block merging.

To add a suite, add a reusable workflow, its filters in `suites.json`, a caller
job and a gate dependency in `main-merge.yml`. Run
`node --test tests/merge-gate.test.cjs`. Supported filters use literal paths,
`*` and `**`; unsupported glob syntax fails closed and requires an implementation
and regression test. Keep each suite's actual assertions intact.

## Gated Pages releases

Main pushes and manual runs on `main` select all 23 suites. Every job checks out
`github.sha`; the Pages build preserves the existing official Jekyll build and
uploads only `_site`. The merge gate also requires that build to succeed.

`deploy_pages` requires both `gate` and `build_pages` to succeed. It runs only
for main pushes or manual main runs, in the existing `github-pages` environment.
Only this job receives `pages: write` and `id-token: write`. PRs build an artifact
for validation but cannot publish. The planner rejects a stale main SHA, and
another main-head check immediately before deployment prevents an old rerun
from overwriting the newer release. Main workflows are serialized without
cancelling an in-progress deployment; outdated queued revisions fail closed.

Keep the `github-pages` environment restricted to the `main` branch. The Pages
source must be **GitHub Actions**, not the independent branch publisher.

Initial cutover order:
1. Verify the PR's suites, Pages build and required merge gate.
2. Change Settings → Pages → Source to GitHub Actions; keep the existing site,
   domain, HTTPS setting and `github-pages` environment unchanged.
3. Merge through the existing main ruleset. The main workflow tests the exact
   merge revision again, then publishes only if all tests and the build pass.
4. Verify the deployment run's commit and live URL. If a test fails, the current
   published site remains intact; fix the failure without weakening the gate.

CI success verifies automated checks; it does not replace physical iPhone
testing.
