# Monthly Player Data Refresh Failure

## Checklist

- [x] Read the failed GitHub Actions run logs and identify the root cause.
- [x] Confirm whether the failure depended on the local computer being on.
- [x] Reproduce or isolate the failing script behavior locally where practical.
- [x] Make the automated refresh more resilient without adding unnecessary complexity.
- [x] Verify the updated path works and record the result.

## Review

- GitHub Actions ran in GitHub's hosted Ubuntu environment, so the local computer restart/Wi-Fi was not the cause.
- The July 1 run failed because Spotrac served markup the old parser could not handle; the script found only 1 team and exited before committing.
- The same run also lacked the `BALLDONTLIE_API_KEY` GitHub secret, which would have made player data weaker if the workflow had reached the commit step.
- Added data validation, safer fetch scripts, workflow fallback to last committed good data, and the missing GitHub secret.
- Verified with `npx tsc --noEmit`, `npx tsx scripts/fetch-teams.ts`, `npx tsx scripts/fetch-players.ts`, `npm run validate-data`, and `npm run build`.
