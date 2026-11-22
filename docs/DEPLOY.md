# Deploying DanzStak without CloudShell (D0)

From now on the backend (the Auth API and call-signaling) deploys from GitHub. Claude starts a deploy, and **nothing reaches AWS until you tap Approve** in the GitHub app. No AWS keys exist anywhere: GitHub proves who it is to AWS with a short-lived token, and AWS only accepts it from the `main` branch running in the `production` environment that you approve.

You set this up **once**. It takes about 10 minutes.

## One-time setup

### 1. Merge the PR

In the GitHub app: open the pull request "D0: deploy from GitHub with owner approval" → **Merge**.

### 2. Create the deploy role (CloudShell, about 2 minutes)

Open the AWS console, switch the region to **US West (N. California) us-west-1**, and open **CloudShell** (the `>_` icon at the top). Paste this one command and press Enter:

**CloudShell:**

```bash
cd ~ && rm -rf danzstak-web && git clone --depth 1 https://github.com/danzstak/danzstak-web.git && cd danzstak-web && aws cloudformation deploy --region us-west-1 --stack-name DanzStak-GitHub-Deploy --template-file infrastructure/github-deploy/bootstrap.yaml --capabilities CAPABILITY_NAMED_IAM
```

It ends with `Successfully created/updated stack - DanzStak-GitHub-Deploy`.

**If it fails with "Provider with url https://token.actions.githubusercontent.com already exists"** (the account already trusts GitHub), run this instead:

**CloudShell:**

```bash
cd ~/danzstak-web && aws cloudformation deploy --region us-west-1 --stack-name DanzStak-GitHub-Deploy --template-file infrastructure/github-deploy/bootstrap.yaml --capabilities CAPABILITY_NAMED_IAM --parameter-overrides CreateOidcProvider=false
```

(If the first try left the stack in `ROLLBACK_COMPLETE`, delete it first. **CloudShell:** `aws cloudformation delete-stack --region us-west-1 --stack-name DanzStak-GitHub-Deploy && aws cloudformation wait stack-delete-complete --region us-west-1 --stack-name DanzStak-GitHub-Deploy`, then run the command above.)

Then copy your 12-digit account number for step 3:

**CloudShell:**

```bash
aws sts get-caller-identity --query Account --output text
```

What this creates: the role `DanzStak-GitHub-Deploy` and its limits. It can deploy the call-signaling stack and the Auth API and nothing else. It **cannot** create users or keys, touch any other role, read secret values, change DNS (Zoho mail stays as it is), Organizations or billing, read or change member data or media, or loosen its own limits.

### 3. Two settings on GitHub (website, about 3 minutes)

These pages work best in a phone browser in desktop mode, or on a computer at github.com.

1. **Approve each deploy:** github.com/danzstak/danzstak-web → **Settings** → **Environments** → **New environment** (or open `production` if it's already there) → name it `production` → **Configure environment**:
   - tick **Required reviewers**, add yourself, **Save protection rules**;
   - under **Deployment branches and tags**, choose **Selected branches and tags** → **Add deployment branch or tag rule** → `main` → **Add rule**.
2. **Account number:** **Settings** → **Secrets and variables** → **Actions** → the **Variables** tab (not Secrets) → **New repository variable** → name `AWS_ACCOUNT_ID`, value the 12-digit number from step 2 → **Add variable**.

It's a variable, not a secret, on purpose: the account number on its own grants nothing, and no AWS key exists to store.

## How a deploy works from now on

1. Claude (or you: **Actions** → **Deploy** → **Run workflow**) starts a run on `main` with `target` = `auth-api`, `call-signaling` or `both`, and `dry_run` = true.
2. **You get a notification from GitHub: "Review pending deployments".** Approve it. The dry run runs the tests, signs in to AWS, and prints the plan (the CloudFormation change set and the Auth API's "PLAN" lines) in the run summary. **A dry run changes nothing.**
3. When the plan looks right, the same run is started again with `dry_run` = false. You approve again, it deploys, and the smoke checks confirm the API answers.

A change that would replace or remove a table, the media bucket, the push key or the CDN distribution stops the run on purpose. That kind of change still goes through CloudShell, after a review.

## Approving a run on your phone

1. Install the **GitHub** app (App Store or Google Play) and sign in.
2. Turn on notifications: app **Profile** → **Settings** → **Notifications** → allow push notifications, with **Deployment reviews** on (or watch the repository so Actions alerts reach you).
3. When a deploy waits for you, open the notification, or **danzstak-web** → **Actions** → the **Deploy** run → **Review deployments**.
4. Tick **production** → **Approve and deploy**. Choose **Reject** if you didn't expect the run.

If the app doesn't show the button, open the same run in the phone's browser at github.com (the **Review deployments** button is at the top of the run page).

## Turning it off

**Fast:** GitHub → **Settings** → **Environments** → `production` → **Delete environment**. No run can assume the role after that.

**Completely (CloudShell):** `aws cloudformation delete-stack --region us-west-1 --stack-name DanzStak-GitHub-Deploy`

## The CloudShell way still works

Nothing changed for the old commands: `pwsh ./aws-deploy-auth-api.ps1` in CloudShell deploys exactly as before. `pwsh ./aws-deploy-auth-api.ps1 -DryRun` prints the plan and changes nothing. For call-signaling, `bash scripts/deploy-call-signaling.sh` (dry run) or `DRY_RUN=false bash scripts/deploy-call-signaling.sh` does the same as the GitHub run.
