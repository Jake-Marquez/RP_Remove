import { NextResponse } from 'next/server';

// Type definitions
interface DiscoveryResponse {
  name: string;
  description: string;
  version: string;
  timestamp: string;
}

interface DeviceInfo {
  host: string;
  port: number;
  name: string;
  description: string;
  version: string;
  discovered: string;
}

// Function to discover devices on the local network
async function discoverDevices(): Promise<DeviceInfo[]> {
  const devices: DeviceInfo[] = [];

  // For now, we'll implement a simple IP scan for devices on common ports
  // This will check localhost and common local IPs for the backend service
  const portsToCheck = [5000, 8000, 8080, 3001];
  const hostsToCheck = ['localhost', '127.0.0.1'];

  // Add local network scanning (192.168.x.x range)
  // In production, you'd want to get the actual network range
  for (let i = 1; i < 255; i++) {
    hostsToCheck.push(`192.168.1.${i}`);
  }

  const promises = hostsToCheck.flatMap(host =>
    portsToCheck.map(async port => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500); // 500ms timeout

        const response = await fetch(`http://${host}:${port}/discover`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data: DiscoveryResponse = await response.json();
          return {
            host,
            port,
            name: data.name,
            description: data.description,
            version: data.version,
            discovered: new Date().toISOString(),
          };
        }
      } catch (error) {
        // Silently fail - device not found at this address
      }
      return null;
    })
  );

  const results = await Promise.all(promises);
  return results.filter((device): device is DeviceInfo => device !== null);
}

export async function GET() {
  console.log("API GET!")
  try {
    const devices = await discoverDevices();
    console.log(devices);

    return NextResponse.json({
      devices,
      count: devices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to discover devices' },
      { status: 500 }
    );
  }
}
