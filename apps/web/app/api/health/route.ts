import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ServiceStatus = 'start' | 'pending' | 'alive' | 'error';

interface ServiceHealth {
  status: ServiceStatus;
  latency_ms?: number;
}

interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  services: {
    backend: ServiceHealth;
  };
}

async function checkBackend(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    const latency_ms = Date.now() - start;
    return { status: res.ok ? 'alive' : 'error', latency_ms };
  } catch {
    return { status: 'error', latency_ms: Date.now() - start };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const timestamp = new Date().toISOString();
  const backend = await checkBackend();
  const status: ServiceStatus = backend.status === 'alive' ? 'alive' : 'error';

  const body: HealthResponse = {
    status,
    timestamp,
    services: { backend },
  };

  const isDev = process.env.NODE_ENV !== 'production';
  const httpStatus = isDev || status === 'alive' ? 200 : 503;

  return NextResponse.json(body, { status: httpStatus });
}
