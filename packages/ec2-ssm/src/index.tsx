#!/usr/bin/env bun
/**
 * EC2 SSM Shell - Interactive TUI for connecting to EC2 instances via SSM
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import { spawn } from "child_process";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { SSMClient, DescribeInstanceInformationCommand } from "@aws-sdk/client-ssm";
import {
  App,
  renderApp,
  List,
  Spinner,
  StatusMessage,
  IdentityCard,
  ACTIONS,
  useIdentity,
  getAwsEnv,
  getAwsClientConfig,
  type ListItemData,
} from "@toolbox/common";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EC2Instance {
  instanceId: string;
  name: string;
  privateIp: string;
  instanceType: string;
  ssmOnline: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Operations
// ─────────────────────────────────────────────────────────────────────────────

async function getSSMOnlineInstances(ssm: SSMClient): Promise<Set<string>> {
  const online = new Set<string>();
  let nextToken: string | undefined;

  do {
    const cmd = new DescribeInstanceInformationCommand({
      NextToken: nextToken,
      Filters: [{ Key: "PingStatus", Values: ["Online"] }],
    });
    const resp = await ssm.send(cmd);

    for (const info of resp.InstanceInformationList || []) {
      if (info.InstanceId) online.add(info.InstanceId);
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  return online;
}

async function listEC2Instances(ec2: EC2Client, ssm: SSMClient): Promise<EC2Instance[]> {
  const instances: EC2Instance[] = [];
  let nextToken: string | undefined;

  const ssmOnline = await getSSMOnlineInstances(ssm);

  do {
    const cmd = new DescribeInstancesCommand({
      NextToken: nextToken,
      Filters: [{ Name: "instance-state-name", Values: ["running"] }],
    });
    const resp = await ec2.send(cmd);

    for (const reservation of resp.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        if (!instance.InstanceId) continue;

        const nameTag = instance.Tags?.find((t) => t.Key === "Name");
        instances.push({
          instanceId: instance.InstanceId,
          name: nameTag?.Value || "-",
          privateIp: instance.PrivateIpAddress || "-",
          instanceType: instance.InstanceType || "-",
          ssmOnline: ssmOnline.has(instance.InstanceId),
        });
      }
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  return instances.filter((i) => i.ssmOnline).sort((a, b) => a.name.localeCompare(b.name));
}

function startSSMSession(instanceId: string, profile?: string, region?: string): void {
  const args = ["ssm", "start-session", "--target", instanceId];
  if (profile) args.push("--profile", profile);
  if (region) args.push("--region", region);

  spawn("aws", args, { stdio: "inherit" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useInstances
// ─────────────────────────────────────────────────────────────────────────────

function useInstances() {
  const [instances, setInstances] = useState<EC2Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const config = getAwsClientConfig();
      const ec2 = new EC2Client(config);
      const ssm = new SSMClient(config);
      const result = await listEC2Instances(ec2, ssm);
      setInstances(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch instances");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return { instances, loading, error, refresh: fetchInstances };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function EC2SSM() {
  const { identity, loading: identityLoading, error: identityError } = useIdentity();
  const { instances, loading: instancesLoading, error: instancesError, refresh } = useInstances();
  const [connecting, setConnecting] = useState<string | null>(null);
  const { profile, region } = getAwsEnv();

  // Convert to list items
  const items: ListItemData[] = instances.map((inst) => ({
    id: inst.instanceId,
    label: inst.name,
    description: `${inst.privateIp} · ${inst.instanceType} · ${inst.instanceId}`,
    value: inst,
  }));

  // Handle selection
  const handleSelect = (item: ListItemData) => {
    const instance = item.value as EC2Instance;
    setConnecting(instance.name);

    // Small delay to show connecting message
    setTimeout(() => {
      startSSMSession(instance.instanceId, profile, region);
    }, 100);
  };

  const isLoading = identityLoading || instancesLoading;
  const error = identityError || instancesError;

  return (
    <App
      title="EC2 SSM Shell"
      icon="🖥️"
      color="cyan"
      actions={[
        ACTIONS.navigate,
        ACTIONS.select,
        ACTIONS.refresh,
        ACTIONS.quit,
      ]}
    >
      {/* AWS Identity */}
      <IdentityCard
        identity={identity}
        loading={identityLoading}
        error={identityError}
      />

      {/* Loading */}
      {instancesLoading && !identityLoading && (
        <Spinner label="Fetching EC2 instances..." />
      )}

      {/* Error */}
      {error && !isLoading && (
        <StatusMessage type="error">{error}</StatusMessage>
      )}

      {/* Connecting */}
      {connecting && (
        <StatusMessage type="info">
          Connecting to <Text bold>{connecting}</Text>...
        </StatusMessage>
      )}

      {/* Instance List */}
      {!isLoading && !connecting && (
        <>
          <Box marginBottom={1}>
            <Text>
              <Text color="cyan">?</Text> Select an instance to connect
              {instances.length > 0 && (
                <Text dimColor> ({instances.length} available)</Text>
              )}
            </Text>
          </Box>

          <List
            items={items}
            onSelect={handleSelect}
            onRefresh={refresh}
            emptyMessage="No instances with SSM agent online found"
            maxVisible={8}
          />
        </>
      )}
    </App>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────

renderApp(<EC2SSM />);
