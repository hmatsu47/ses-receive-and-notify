#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SesNotifyStack } from './stack.js';

// CDK application entry point. Configuration is read from ENVIRONMENT VARIABLES
// (populated from .env by the operator before running cdk) so the same values
// resolve identically across `cdk synth`, `cdk deploy`, and `cdk diff`.
// CDK context (-c) is intentionally NOT used: context is easy to omit on a
// `cdk diff` run, which would silently produce a misleading diff. No secret
// values are embedded in the template (FR4.1 / NFR3.6); the SLACK_WEBHOOK_URL
// secret is resolved at Lambda runtime from Secrets Manager.
//
// Before running cdk, export .env into the environment, e.g.:
//   set -a; . ./.env; set +a
const app = new App();

// Non-secret operational value from environment variables (.env).
// The S3 bucket names are NOT supplied: CloudFormation auto-generates them and
// the stack injects the generated names into the Lambda env.
const targetDomain = process.env.TARGET_DOMAIN;

// Secrets Manager secret that holds the SLACK_WEBHOOK_URL secret.
// - secretArn: used to grant the Lambda read-only access (deploy time).
// - secretId: passed to the Lambda as an env var so configLoader can fetch
//   the secret at runtime. Not a secret value itself (a name/ARN).
const secretArn = process.env.SECRETS_MANAGER_SECRET_ARN;
const secretId = process.env.SECRETS_MANAGER_SECRET_ID;

new SesNotifyStack(app, 'SesNotifyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  secretArn,
  secretId,
  targetDomain,
});
