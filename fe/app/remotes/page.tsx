'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Card, Stack, Group, Badge, ActionIcon, Modal, TextInput, Button, Center, Loader } from '@mantine/core';
import { IconPlus, IconGridDots } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import Link from 'next/link';

export default function RemotesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState('');
  const [creating, setCreating] = useState(false);

  const remotes = useLiveQuery(() => db.remotes.toArray());
  const remoteFunctions = useLiveQuery(() => db.remoteFunctions.toArray());
  const devices = useLiveQuery(() => db.devices.toArray());

  const handleCreateRemote = async () => {
    if (!newRemoteName.trim()) return;

    setCreating(true);
    try {
      await db.remotes.add({
        name: newRemoteName.trim(),
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      });
      setNewRemoteName('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create remote:', error);
    } finally {
      setCreating(false);
    }
  };

  // Calculate device online status for each remote
  const getRemoteDeviceStatus = (remoteId: number) => {
    const functions = remoteFunctions?.filter(rf => rf.remoteId === remoteId) || [];
    const uniqueDevices = new Map<string, boolean>();

    functions.forEach(func => {
      const hostPort = `${func.deviceHost}:${func.devicePort}`;
      if (!uniqueDevices.has(hostPort)) {
        const device = devices?.find(d => d.hostPort === hostPort);
        const isOnline = device ? Date.now() - new Date(device.lastSeen).getTime() < 60000 : false;
        uniqueDevices.set(hostPort, isOnline);
      }
    });

    const totalDevices = uniqueDevices.size;
    const onlineDevices = Array.from(uniqueDevices.values()).filter(Boolean).length;

    return { onlineDevices, totalDevices };
  };

  if (!remotes) {
    return (
      <Container size="md" py="xl">
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1} mb="xs">Remotes</Title>
          <Text c="dimmed" size="sm">
            Manage your custom remotes
          </Text>
        </div>

        {remotes.length === 0 ? (
          <Card withBorder p="xl">
            <Center>
              <Stack align="center" gap="md">
                <IconGridDots size={48} stroke={1.5} opacity={0.5} />
                <div>
                  <Text ta="center" fw={500}>No remotes yet</Text>
                  <Text ta="center" c="dimmed" size="sm">
                    Create a remote to get started
                  </Text>
                </div>
              </Stack>
            </Center>
          </Card>
        ) : (
          <Stack gap="md">
            {remotes.map(remote => {
              const { onlineDevices, totalDevices } = getRemoteDeviceStatus(remote.id!);
              const allOnline = onlineDevices === totalDevices;
              const hasDevices = totalDevices > 0;

              return (
                <Card
                  key={remote.id}
                  withBorder
                  padding="lg"
                  component={Link}
                  href={`/remotes/${remote.id}`}
                  style={{ cursor: 'pointer', textDecoration: 'none' }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size="lg">{remote.name}</Text>
                      {hasDevices && (
                        <Text size="xs" c="dimmed" mt={4}>
                          {remoteFunctions?.filter(rf => rf.remoteId === remote.id).length || 0} functions
                        </Text>
                      )}
                    </div>
                    {hasDevices && (
                      <Badge
                        size="lg"
                        variant="light"
                        color={allOnline ? 'gray' : 'red'}
                      >
                        {onlineDevices}/{totalDevices}
                      </Badge>
                    )}
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>

      {/* Floating Action Button */}
      <ActionIcon
        size="xl"
        radius="xl"
        variant="filled"
        onClick={() => setShowCreateModal(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '56px',
          height: '56px',
        }}
      >
        <IconPlus size={28} />
      </ActionIcon>

      {/* Create Remote Modal */}
      <Modal
        opened={showCreateModal}
        onClose={() => !creating && setShowCreateModal(false)}
        title={<Text fw={600}>Create New Remote</Text>}
      >
        <Stack gap="md">
          <TextInput
            label="Remote Name"
            placeholder="Living Room, Bedroom, etc."
            value={newRemoteName}
            onChange={(e) => setNewRemoteName(e.currentTarget.value)}
            required
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating && newRemoteName.trim()) {
                handleCreateRemote();
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
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
    </Container>
  );
}
