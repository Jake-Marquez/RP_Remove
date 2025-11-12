import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import React from 'react';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import { RegisterSW } from './register-sw';
import { BottomNav } from './components/BottomNav';

export const metadata = {
  title: 'RP Manager',
  description: 'Remote control for Raspberry Pi IOT projects',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RP Manager',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1A1B1E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Notifications position="bottom-center" zIndex={1000} styles={{
            notification: {
              bottom: 75
            }
          }}/>
          <RegisterSW />
          <div style={{ paddingBottom: '70px' }}>
            {children}
          </div>
          <BottomNav />
        </MantineProvider>
      </body>
    </html>
  );
}
