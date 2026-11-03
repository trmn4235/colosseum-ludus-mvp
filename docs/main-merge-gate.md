# Main branch merge checks

`Main merge gate` is the single required GitHub Actions status for `main`.
The repository ruleset must require a pull request, an up-to-date branch and
this status, with no bypass. Force pushes and branch deletion remain blocked.
Changing workflow files alone does not enable these repository settings.

`.github/workflows/main-merge.yml` runs for every pull request, including drafts
and documentation changes. Its planner validates the PR head and base before
and after paginating the changed-file list. Renames match both filenames;
over 3000 changed files run all suites rather than trusting a truncated list.

`.github/ci/suites.json` retains the previous 23 workflows' branch/path filters and adds a 24th
model-delivery suite for active model files, loaders and verification tests.
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

V225 removes duplicate validation after an unchanged PR is merged. The workflow
records the actual `github.sha` checkout in its run title. A main push may reuse
the latest successful same-repository PR run only when:

- The previous main revision has a successful main workflow run.
- Exactly one associated merged PR targets main at that previous revision.
- The PR head tree, tested merge tree and current main tree are identical.
- The tested merge has precisely the expected base and PR-head parents.
- The run belongs to the expected workflow, event, repository, branch and head.

The gate independently verifies the same run again. Missing, changed, failed or
unverifiable evidence cannot authorize reuse. Discovery failures fall back to
normal tests. Older runs without the checkout SHA in their title cannot be reused.

Without reusable validation, a normal main push selects suites from all changed
paths since its successfully validated previous main revision. Renames include
both paths. Unknown/failed baselines, force pushes, divergent history and
comparisons reaching GitHub's 300-file cap select all suites. API failures during
required baseline/diff validation fail closed. CI policy changes select every
suite unless that exact tree already passed them in the reusable PR run.
Manual main runs always perform all 24 suites.

The equipment suite runs its unchanged 43 commands across eight isolated matrix
jobs (core, identity, shields, armour, helmets, halberd, renders and recovery).
The core group keeps production-state generation and all eight consumers together;
no group relies on another runner’s temporary files. Every group must pass; fail-fast is disabled so all failures remain visible.

Every job checks out `github.sha`; the Pages build preserves the existing official
Jekyll build and uploads only `_site`. Even when PR validation is reused, main
builds its own artifact and the gate requires that build to succeed. PR artifacts
are never deployed.

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
   merge revision or verifies exact-tree PR validation, then publishes only if
   validation and its own build pass.
4. Verify the deployment run's commit and live URL. If a test fails, the current
   published site remains intact; fix the failure without weakening the gate.

CI success verifies automated checks; it does not replace physical iPhone
testing.
