# Retry a main image build

The repository app can write contents but cannot rerun Actions jobs. The Application workflow accepts the `rebuild-main-image` repository-dispatch event as a supported retry path. GitHub runs this event against the current default-branch commit, and the image job additionally requires `refs/heads/main`. The workflow ignores payload fields and retains verification, image provenance and signing.

Before retrying, check the latest main Application run. Wait for runner recovery during a hosted-runner incident, and check that another main image build is not already queued or running. From a task worktree, dispatch:

```bash
gh api --method POST repos/thaynes43/haynes-quest/dispatches \
  -f event_type=rebuild-main-image
```

Find the resulting Application run with event `repository_dispatch` and record its `headSha`. That SHA is the current main commit; this command cannot select an earlier release. Require successful verification and image jobs, then verify the image attestation against that exact SHA, `refs/heads/main` and `.github/workflows/app.yml` before pinning its digest through a reviewed GitOps PR. A failed or queued run does not authorize deployment.

GitHub documents the [event's default-branch SHA and ref](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#repository_dispatch) and the endpoint's [Contents write permission for app installation tokens](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).
