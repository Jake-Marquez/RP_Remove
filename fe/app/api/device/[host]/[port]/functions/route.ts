import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ host: string; port: string }> }
) {
  const { host, port } = await params;

  try {
    // Get API key from request headers
    const apiKey = request.headers.get('X-API-Key');

    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(`http://${host}:${port}/functions`, {
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'Invalid or missing API key' },
          { status: 401 }
        );
      }
      throw new Error('Failed to fetch functions');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching functions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch device functions' },
      { status: 500 }
    );
  }
}
