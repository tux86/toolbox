import React from "react";
import { Box, Text } from "ink";
import { AwsIdentity } from "../hooks/useIdentity.js";
import { Spinner } from "./Spinner.js";

export interface IdentityCardProps {
  identity: AwsIdentity | null;
  loading?: boolean;
  error?: string | null;
}

export function IdentityCard({ identity, loading, error }: IdentityCardProps) {
  if (loading) {
    return (
      <Box marginBottom={1}>
        <Spinner label="Loading AWS identity..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor="red"
        paddingX={1}
        marginBottom={1}
      >
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (!identity) {
    return null;
  }

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginBottom={1}
      flexDirection="column"
    >
      {/* Title */}
      <Box marginTop={-1} marginLeft={1} marginBottom={0}>
        <Text dimColor> AWS Identity </Text>
      </Box>

      {/* Content */}
      <Box>
        <Text color="cyan">{identity.accountId}</Text>
        <Text dimColor> › </Text>
        <Text>{identity.profile}</Text>
        <Text dimColor> › </Text>
        <Text>{identity.role}</Text>
      </Box>
    </Box>
  );
}
