import { useState, useEffect } from "react";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export interface AwsIdentity {
  accountId: string;
  profile: string;
  region: string;
  role: string;
  arn: string;
}

export interface UseIdentityResult {
  identity: AwsIdentity | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function getAwsEnv() {
  return {
    profile: process.env.AWS_PROFILE || "default",
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  };
}

function parseIdentityArn(arn: string): { name: string; type: string } {
  // arn:aws:iam::123456789:user/username
  // arn:aws:sts::123456789:assumed-role/role-name/session
  const parts = arn.split(":");
  const resource = parts[5] || "";

  if (resource.startsWith("user/")) {
    return { type: "User", name: resource.replace("user/", "") };
  }

  if (resource.startsWith("assumed-role/")) {
    const roleParts = resource.replace("assumed-role/", "").split("/");
    return { type: "Role", name: roleParts[1] || roleParts[0] };
  }

  return { type: "Unknown", name: resource };
}

export function useIdentity(): UseIdentityResult {
  const [identity, setIdentity] = useState<AwsIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = () => setRefreshCount((c) => c + 1);

  useEffect(() => {
    let cancelled = false;

    async function fetchIdentity() {
      setLoading(true);
      setError(null);

      try {
        const env = getAwsEnv();
        const client = new STSClient({ region: env.region });
        const response = await client.send(new GetCallerIdentityCommand({}));

        if (cancelled) return;

        const parsed = parseIdentityArn(response.Arn || "");

        setIdentity({
          accountId: response.Account || "Unknown",
          profile: env.profile,
          region: env.region,
          role: parsed.name,
          arn: response.Arn || "",
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to get identity");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchIdentity();

    return () => {
      cancelled = true;
    };
  }, [refreshCount]);

  return { identity, loading, error, refresh };
}
