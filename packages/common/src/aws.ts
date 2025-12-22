/**
 * AWS common utilities
 */

import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

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
