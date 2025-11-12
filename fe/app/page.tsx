'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Button, Card, Group, Stack, Badge, Loader, Center, Alert } from '@mantine/core';
import { IconRefresh, IconDevicesPc, IconAlertCircle } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Device } from '@/lib/db';
import Link from 'next/link';

interface DiscoveredDevice {
  host: string;
  port: number;
  name: string;
  description: string;
  version: string;
  discovered: string;
}

export default function HomePage() {
  const [scanning, setScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load devices from IndexedDB
  const savedDevices = useLiveQuery(() => db.devices.toArray());

  const scanForDevices = async () => {
    setScanning(true);
    setError(null);
    setDiscoveredDevices([]);

    try {
      const response = await fetch('/api/discover');

      if (!response.ok) {
        throw new Error('Failed to scan for devices');
      }

      const data = await response.json();
      setDiscoveredDevices(data.devices || []);

      // Save discovered devices to IndexedDB, updating existing entries
      for (const device of data.devices || []) {
        const hostPort = `${device.host}:${device.port}`;

        // Check if device already exists
        const existing = await db.devices.where('hostPort').equals(hostPort).first();

        if (existing) {
          // Update existing device
          await db.devices.update(existing.id!, {
            name: device.name,
            description: device.description,
            version: device.version,
            lastSeen: new Date().toISOString(),
          });
        } else {
          // Add new device
          await db.devices.add({
            hostPort,
            host: device.host,
            port: device.port,
            name: device.name,
            description: device.description,
            version: device.version,
            lastSeen: new Date().toISOString(),
            discovered: device.discovered,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for devices');
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  // Auto-scan on mount
  useEffect(() => {
    scanForDevices();
  }, []);

  // Combine and deduplicate devices using a Map keyed by host:port
  const deviceMap = new Map<string, DiscoveredDevice | Device>();

  // Add discovered devices first (they have priority as they're currently online)
  discoveredDevices.forEach(device => {
    const key = `${device.host}:${device.port}`;
    deviceMap.set(key, device);
  });

  // Add saved devices that aren't already in the map
  (savedDevices || []).forEach(device => {
    const key = `${device.host}:${device.port}`;
    if (!deviceMap.has(key)) {
      deviceMap.set(key, device);
    }
  });

  const allDevices = Array.from(deviceMap.values());

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1} mb="xs">RP Manager</Title>
          <Text c="dimmed" size="sm">
            Discover and control your Raspberry Pi devices
          </Text>
        </div>

        <Button
          leftSection={scanning ? <Loader size="xs" /> : <IconRefresh size={18} />}
          onClick={scanForDevices}
          disabled={scanning}
          fullWidth
          size="lg"
        >
          {scanning ? 'Scanning network...' : 'Scan for Devices'}
        </Button>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {scanning && allDevices.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Scanning local network for devices...</Text>
            </Stack>
          </Center>
        )}

        {!scanning && allDevices.length === 0 && (
          <Card withBorder p="xl">
            <Center>
              <Stack align="center" gap="md">
                <IconDevicesPc size={48} stroke={1.5} opacity={0.5} />
                <div>
                  <Text ta="center" fw={500}>No devices found</Text>
                  <Text ta="center" c="dimmed" size="sm">
                    Make sure your Raspberry Pi is connected to the network
                  </Text>
                </div>
              </Stack>
            </Center>
          </Card>
        )}

        <Stack gap="md">
          {allDevices.map((device) => {
            const isOnline = discoveredDevices.some(
              d => d.host === device.host && d.port === device.port
            );

            return (
              <Card
                key={`${device.host}:${device.port}`}
                withBorder
                padding="lg"
                component={Link}
                href={`/device/${device.host}/${device.port}`}
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600} size="lg">{device.name}</Text>
                    <Badge color={isOnline ? 'green' : 'gray'} variant="light">
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </Group>

                  {device.description && (
                    <Text size="sm" c="dimmed">{device.description}</Text>
                  )}

                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {device.host}:{device.port}
                    </Text>
                    <Text size="xs" c="dimmed">•</Text>
                    <Text size="xs" c="dimmed">
                      v{device.version}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Stack>
    </Container>
  );
}
