import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckError } from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';
import { DatabaseHealthIndicator } from '../indicators/database.health-indicator';
import { ValkeyHealthIndicator } from '../indicators/valkey.health-indicator';
import { MigrationHealthIndicator } from '../../../common/database';
import type { HealthCheckResult } from '../health.types';

const makeResult = (overrides: Partial<HealthCheckResult> = {}): HealthCheckResult => ({
  status: 'alive',
  timestamp: '2026-04-04T12:00:00.000Z',
  services: {
    database: { status: 'alive', latency_ms: 2 },
    valkey: { status: 'alive', latency_ms: 1 },
    migrations: { status: 'alive', schemaVersion: '20260101_init', appliedCount: 5, pendingMigrations: [] },
  },
  ...overrides,
});

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { getComprehensiveHealth: ReturnType<typeof vi.fn> };
  let migrationHealth: { isHealthy: ReturnType<typeof vi.fn> };
  let terminusHealthCheck: { check: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    healthService = { getComprehensiveHealth: vi.fn() };
    migrationHealth = { isHealthy: vi.fn() };
    terminusHealthCheck = { check: vi.fn() };

    // Direct instantiation to avoid NestJS DI resolution issues in unit tests
    controller = new HealthController(
      terminusHealthCheck as any,
      migrationHealth as any,
      healthService as any,
    );
  });

  describe('getHealth', () => {
    const mockRes = () => ({ status: vi.fn().mockReturnThis() }) as unknown as import('express').Response;

    it('returns alive result when all services are healthy', async () => {
      const result = makeResult();
      healthService.getComprehensiveHealth.mockResolvedValue(result);

      const res = mockRes();
      const response = await controller.getHealth(res);

      expect(response).toEqual(result);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns start status when app is bootstrapping', async () => {
      const result = makeResult({ status: 'start' });
      healthService.getComprehensiveHealth.mockResolvedValue(result);

      const res = mockRes();
      const response = await controller.getHealth(res);

      expect(response.status).toBe('start');
    });

    it('returns 503 in production when status is error', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const result = makeResult({ status: 'error' });
      healthService.getComprehensiveHealth.mockResolvedValue(result);

      const res = mockRes();
      await controller.getHealth(res);

      expect(res.status).toHaveBeenCalledWith(503);
      process.env['NODE_ENV'] = originalEnv;
    });

    it('does not return 503 in development when status is error', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const result = makeResult({ status: 'error' });
      healthService.getComprehensiveHealth.mockResolvedValue(result);

      const res = mockRes();
      await controller.getHealth(res);

      expect(res.status).not.toHaveBeenCalled();
      process.env['NODE_ENV'] = originalEnv;
    });

    it('does not set 503 for pending status even in production', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const result = makeResult({ status: 'pending' });
      healthService.getComprehensiveHealth.mockResolvedValue(result);

      const res = mockRes();
      await controller.getHealth(res);

      expect(res.status).not.toHaveBeenCalled();
      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('getLiveness', () => {
    it('always returns ok', () => {
      const response = controller.getLiveness();
      expect(response.status).toBe('ok');
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('getReadiness', () => {
    it('delegates to terminus health check with migration indicator', async () => {
      const terminusResult = { status: 'ok', info: {}, error: {}, details: {} };
      terminusHealthCheck.check.mockResolvedValue(terminusResult);

      const response = await controller.getReadiness();

      expect(terminusHealthCheck.check).toHaveBeenCalledWith([expect.any(Function)]);
      expect(response).toEqual(terminusResult);
    });
  });
});

describe('HealthService', () => {
  let service: HealthService;
  let dbIndicator: { check: ReturnType<typeof vi.fn> };
  let valkeyIndicator: { check: ReturnType<typeof vi.fn> };
  let migrationHealth: { isHealthy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dbIndicator = { check: vi.fn() };
    valkeyIndicator = { check: vi.fn() };
    migrationHealth = { isHealthy: vi.fn() };

    // Direct instantiation with mocks
    service = new HealthService(
      dbIndicator as unknown as DatabaseHealthIndicator,
      valkeyIndicator as unknown as ValkeyHealthIndicator,
      migrationHealth as unknown as MigrationHealthIndicator,
    );
  });

  it('returns start status before onModuleInit', async () => {
    const result = await service.getComprehensiveHealth();
    expect(result.status).toBe('start');
    expect(result.services.database.status).toBe('start');
    expect(result.services.valkey.status).toBe('start');
    expect(result.services.migrations.status).toBe('start');
  });

  it('returns alive when all services are healthy', async () => {
    service.onModuleInit();
    dbIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 2 });
    valkeyIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 1 });
    migrationHealth.isHealthy.mockResolvedValue({
      migrations: { status: 'up', schemaVersion: '20260101', appliedCount: 5, pendingMigrations: [] },
    });

    const result = await service.getComprehensiveHealth();
    expect(result.status).toBe('alive');
    expect(result.services.database.status).toBe('alive');
    expect(result.services.valkey.status).toBe('alive');
    expect(result.services.migrations.status).toBe('alive');
  });

  it('returns error when database fails', async () => {
    service.onModuleInit();
    dbIndicator.check.mockResolvedValue({ status: 'error', latency_ms: 0, error: 'Connection refused' });
    valkeyIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 1 });
    migrationHealth.isHealthy.mockResolvedValue({ migrations: { status: 'up' } });

    const result = await service.getComprehensiveHealth();
    expect(result.status).toBe('error');
    expect(result.services.database.status).toBe('error');
  });

  it('returns pending when valkey is pending', async () => {
    service.onModuleInit();
    dbIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 2 });
    valkeyIndicator.check.mockResolvedValue({ status: 'pending', latency_ms: 5, error: 'PONG not received' });
    migrationHealth.isHealthy.mockResolvedValue({ migrations: { status: 'up' } });

    const result = await service.getComprehensiveHealth();
    expect(result.status).toBe('pending');
  });

  it('returns error when migrations indicator throws', async () => {
    service.onModuleInit();
    dbIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 2 });
    valkeyIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 1 });
    const healthCheckError = new HealthCheckError('Pending migrations detected', {
      migrations: { status: 'down', schemaVersion: null, appliedCount: 0, pendingMigrations: ['20260101_init'] },
    });
    migrationHealth.isHealthy.mockRejectedValue(healthCheckError);

    const result = await service.getComprehensiveHealth();
    expect(result.status).toBe('error');
    expect(result.services.migrations.status).toBe('error');
    expect(result.services.migrations.error).toBe('Pending migrations detected');
  });

  it('includes timestamp in response', async () => {
    service.onModuleInit();
    dbIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 1 });
    valkeyIndicator.check.mockResolvedValue({ status: 'alive', latency_ms: 1 });
    migrationHealth.isHealthy.mockResolvedValue({ migrations: {} });

    const result = await service.getComprehensiveHealth();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
