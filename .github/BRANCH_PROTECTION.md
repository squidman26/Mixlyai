# Protect the `main` branch

The cloud agent cannot enable branch protection on this repository (admin access required). A repo owner should apply these settings in GitHub:

1. Open **Settings → Branches → Branch protection rules**
2. Add a rule for `main`
3. Enable:
   - **Require a pull request before merging**
   - **Require approvals** (1 or more)
   - **Require status checks to pass** (add the Vercel check when available)
   - **Do not allow bypassing the above settings** (recommended)
   - **Restrict who can push to matching branches** (optional)

Direct link: https://github.com/squidman26/spotifybot/settings/branches
