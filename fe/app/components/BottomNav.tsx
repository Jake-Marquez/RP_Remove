'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Group, Text, Stack } from '@mantine/core';
import { IconWorldSearch, IconDeviceRemote } from '@tabler/icons-react';

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--mantine-color-body)',
        borderTop: '1px solid var(--mantine-color-dark-4)',
        padding: '8px 0',
        zIndex: 100,
      }}
    >
      <Group justify="space-around" gap={0}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Stack align="center" gap={4} style={{ padding: '8px 16px' }}>
            <IconWorldSearch
              size={24}
              color={isActive('/') && !pathname.startsWith('/remotes') ? '#228be6' : '#868e96'}
              stroke={1.5}
            />
            <Text
              size="xs"
              c={isActive('/') && !pathname.startsWith('/remotes') ? 'blue' : 'dimmed'}
              fw={isActive('/') && !pathname.startsWith('/remotes') ? 600 : 400}
            >
              Discover
            </Text>
          </Stack>
        </Link>

        <Link
          href="/remotes"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Stack align="center" gap={4} style={{ padding: '8px 16px' }}>
            <IconDeviceRemote
              size={24}
              color={isActive('/remotes') ? '#228be6' : '#868e96'}
              stroke={1.5}
            />
            <Text
              size="xs"
              c={isActive('/remotes') ? 'blue' : 'dimmed'}
              fw={isActive('/remotes') ? 600 : 400}
            >
              Remotes
            </Text>
          </Stack>
        </Link>
      </Group>
    </div>
  );
}
