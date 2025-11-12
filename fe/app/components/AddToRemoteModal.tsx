'use client';

import { useState } from 'react';
import { Modal, Stack, Text, Checkbox, TextInput, Button, Group, Divider } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface AddToRemoteModalProps {
  opened: boolean;
  onClose: () => void;
  deviceHost: string;
  devicePort: number;
  functionId: string;
  functionName: string;
}

export function AddToRemoteModal({
  opened,
  onClose,
  deviceHost,
  devicePort,
  functionId,
  functionName,
}: AddToRemoteModalProps) {
  const [newRemoteName, setNewRemoteName] = useState('');
  const [creating, setCreating] = useState(false);

  const remotes = useLiveQuery(() => db.remotes.toArray());
  const remoteFunctions = useLiveQuery(() => db.remoteFunctions.toArray());

  // Check if function is already in a remote
  const isFunctionInRemote = (remoteId: number) => {
    return remoteFunctions?.some(
      rf =>
        rf.remoteId === remoteId &&
        rf.deviceHost === deviceHost &&
        rf.devicePort === devicePort &&
        rf.functionId === functionId
    ) || false;
  };

  const handleToggleRemote = async (remoteId: number) => {
    try {
      const isCurrentlyInRemote = isFunctionInRemote(remoteId);

      if (isCurrentlyInRemote) {
        // Remove from remote
        const existing = await db.remoteFunctions
          .where('remoteId')
          .equals(remoteId)
          .filter(
            rf =>
              rf.deviceHost === deviceHost &&
              rf.devicePort === devicePort &&
              rf.functionId === functionId
          )
          .first();

        if (existing?.id) {
          await db.remoteFunctions.delete(existing.id);
        }
      } else {
        // Add to remote
        await db.remoteFunctions.add({
          remoteId,
          deviceHost,
          devicePort,
          functionId,
          added: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to toggle remote function:', error);
    }
  };

  const handleCreateRemote = async () => {
    if (!newRemoteName.trim()) return;

    setCreating(true);
    try {
      const newRemoteId = await db.remotes.add({
        name: newRemoteName.trim(),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });

      // Add the function to the newly created remote
      if (newRemoteId) {
        await db.remoteFunctions.add({
          remoteId: newRemoteId as number,
          deviceHost,
          devicePort,
          functionId,
          added: new Date().toISOString(),
        });
      }

      setNewRemoteName('');
    } catch (error) {
      console.error('Failed to create remote:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setNewRemoteName('');
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text fw={600}>Add &quot;{functionName}&quot; to Remote</Text>}
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select one or more remotes to add this function to:
        </Text>

        {remotes && remotes.length > 0 ? (
          <Stack gap="xs">
            {remotes.map(remote => (
              <Checkbox
                key={remote.id}
                label={remote.name}
                checked={isFunctionInRemote(remote.id!)}
                onChange={() => handleToggleRemote(remote.id!)}
              />
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed" ta="center">
            No remotes yet. Create one below.
          </Text>
        )}

        <Divider label="Or create new remote" labelPosition="center" />

        <TextInput
          label="New Remote Name"
          placeholder="Living Room, Bedroom, etc."
          value={newRemoteName}
          onChange={(e) => setNewRemoteName(e.currentTarget.value)}
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !creating && newRemoteName.trim()) {
              handleCreateRemote();
            }
          }}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose} disabled={creating}>
            Close
          </Button>
          <Button
            onClick={handleCreateRemote}
            loading={creating}
            disabled={creating || !newRemoteName.trim()}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
