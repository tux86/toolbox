/**
 * AWS common utilities
 */

import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CallerIdentity {
  accountId: string;
  arn: string;
  userId: string;
}

export interface AwsEnv {
  profile?: string;
  region?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export function getAwsEnv(): AwsEnv {
  return {
    profile: process.env.AWS_PROFILE,
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  };
}

export function getAwsClientConfig() {
  const { region } = getAwsEnv();
  return {
    ...(region && { region }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

export async function getCallerIdentity(sts?: STSClient): Promise<CallerIdentity> {
  const client = sts || new STSClient(getAwsClientConfig());
  const cmd = new GetCallerIdentityCommand({});
  const resp = await client.send(cmd);

  return {
    accountId: resp.Account || "unknown",
    arn: resp.Arn || "unknown",
    userId: resp.UserId || "unknown",
  };
}

export function parseIdentityArn(arn: string): { name: string; type: "Role" | "User" } {
  const arnParts = arn.split("/");
  const name = arnParts[arnParts.length - 1] || arn;
  const type = arn.includes(":assumed-role/") ? "Role" : "User";
  return { name, type };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAndDisplayIdentity(): Promise<CallerIdentity> {
  const { profile, region } = getAwsEnv();
  const spinner = p.spinner();
  spinner.start("Fetching account info...");

  let identity: CallerIdentity;
  try {
    identity = await getCallerIdentity();
    spinner.stop("Account info loaded");
  } catch (err: any) {
    spinner.stop("Failed to get account info");
    p.log.error(err.message);
    process.exit(1);
  }

  // Show account info
  const accountInfo = [
    `Account: ${pc.cyan(identity.accountId)}`,
    profile && `Profile: ${pc.cyan(profile)}`,
    region && `Region: ${pc.cyan(region)}`,
  ].filter(Boolean).join(pc.dim(" | "));
  p.log.info(accountInfo);

  // Show role/user
  const { name, type } = parseIdentityArn(identity.arn);
  p.log.info(`${type}: ${pc.cyan(name)}`);

  return identity;
}
