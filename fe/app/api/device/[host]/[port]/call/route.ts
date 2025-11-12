import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ host: string; port: string }> }
) {
  const { host, port } = await params;

  try {
    const body = await request.json();
    const { functionId, inputs } = body;

    if (!functionId) {
      return NextResponse.json(
        { error: 'Function ID is required' },
        { status: 400 }
      );
    }

    // Get API key from request headers
    const apiKey = request.headers.get('X-API-Key');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(`http://${host}:${port}/call/${functionId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(inputs || {}),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'Invalid or missing API key' },
          { status: 401 }
        );
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to call function');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling function:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call function' },
      { status: 500 }
    );
  }
}
