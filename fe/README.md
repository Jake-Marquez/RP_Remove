# RP Manager - Frontend

A mobile-first Progressive Web App (PWA) for discovering and controlling Raspberry Pi devices running the RP Manager backend.

## Features

- **Device Discovery**: Automatically scans the local network to find Raspberry Pi devices
- **Function Execution**: View available functions on each device and execute them with parameters
- **Offline Support**: PWA capabilities with service worker for offline functionality
- **Mobile-First**: Responsive design optimized for mobile devices
- **Persistent Storage**: Uses IndexedDB to remember discovered devices

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Mantine UI** - Component library
- **Dexie.js** - IndexedDB wrapper for persistent storage
- **PWA** - Service worker and manifest for mobile app experience

## Getting Started

### Prerequisites

- Node.js 18+ installed
- At least one Raspberry Pi running the RP Manager backend

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
fe/
├── app/
│   ├── api/
│   │   ├── discover/          # Device discovery API
│   │   └── device/            # Device interaction APIs
│   ├── device/[host]/[port]/  # Device detail page
│   ├── layout.tsx             # Root layout with Mantine provider
│   ├── page.tsx               # Discovery page (home)
│   └── theme.ts               # Mantine theme configuration
├── lib/
│   └── db.ts                  # IndexedDB setup with Dexie
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── *.png                  # App icons
└── package.json
```

## How It Works

1. **Discovery**: The frontend scans the local network for devices running the RP Manager backend
2. **Storage**: Discovered devices are saved to IndexedDB for quick access
3. **Function Loading**: When you select a device, it fetches available functions from `/functions` endpoint
4. **Execution**: Functions can be called via the `/call/<function_id>` endpoint with parameters
5. **Results**: Function results are displayed in a modal with formatted JSON

## API Endpoints (Backend)

The frontend expects the following endpoints on each Raspberry Pi device:

- `GET /discover` - Returns device information
- `GET /functions` - Returns available functions
- `POST /call/<function_id>` - Executes a function with input parameters

## PWA Installation

On mobile devices, you can install this app to your home screen:

1. Open the app in your mobile browser
2. Look for "Add to Home Screen" option
3. The app will behave like a native application

## Configuration

### Network Scanning

The discovery API currently scans:
- localhost (127.0.0.1)
- 192.168.1.1-254 range
- Ports: 5000, 8000, 8080, 3001

You can modify these in [app/api/discover/route.ts](app/api/discover/route.ts).

## Future Enhancements

- Dashboard views for monitoring multiple devices
- Real-time status updates via WebSockets
- Custom network range configuration
- Function scheduling and automation
- Historical data and analytics
