/**
 * Reusable Benchmark Harness
 *
 * Provides:
 *   - Statistical collection (min, max, mean, median, p95, p99, stddev)
 *   - JSON result recording to `reports/benchmarks/`
 *   - Regression detection against a baseline file (>20% regression = alert)
 *   - Console summary table
 *
 * Used by both Vitest (Node.js) benchmarks and Playwright browser benchmarks.
 *
 * @module tools/benchmarks/harness
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkTimings {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stddev: number;
}

export interface BenchmarkResult {
  name: string;
  category: string;
  iterations: number;
  timings: BenchmarkTimings;
  metadata: Record<string, unknown>;
  timestamp: string;
  withinBudget: boolean;
  budgetMs: number;
}

export interface BenchmarkSuite {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: BenchmarkResult[];
  runDate: string;
  gitSha?: string;
  gitBranch?: string;
}

export interface RegressionAlert {
  benchmark: string;
  category: string;
  baseline: number;
  current: number;
  regressionPercent: number;
  threshold: number;
  severity: 'warning' | 'critical';
}

export interface RegressionReport {
  alerts: RegressionAlert[];
  hasRegression: boolean;
  baselineFile: string;
  currentFile: string;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORTS_DIR = resolve(__dirname, '../../reports/benchmarks');
const BASELINE_FILE = join(REPORTS_DIR, 'baseline.json');
const REGRESSION_THRESHOLD = 0.2; // 20%

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function stddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const sq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sq / (values.length - 1));
}

export function computeTimings(durations: number[]): BenchmarkTimings {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  return {
    min: parseFloat(sorted[0].toFixed(3)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(3)),
    mean: parseFloat(mean.toFixed(3)),
    median: parseFloat(percentile(sorted, 50).toFixed(3)),
    p95: parseFloat(percentile(sorted, 95).toFixed(3)),
    p99: parseFloat(percentile(sorted, 99).toFixed(3)),
    stddev: parseFloat(stddev(sorted, mean).toFixed(3)),
  };
}

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------

export function collectResult(
  name: string,
  category: string,
  durations: number[],
  budgetMs: number,
  metadata: Record<string, unknown> = {},
): BenchmarkResult {
  const timings = computeTimings(durations);

  return {
    name,
    category,
    iterations: durations.length,
    timings,
    metadata,
    timestamp: new Date().toISOString(),
    withinBudget: timings.p95 <= budgetMs,
    budgetMs,
  };
}

// ---------------------------------------------------------------------------
// Suite management
// ---------------------------------------------------------------------------

export function createSuite(suiteName: string, environment: string): BenchmarkSuite {
  return {
    suite: suiteName,
    environment,
    nodeVersion: typeof process !== 'undefined' ? process.version : 'browser',
    results: [],
    runDate: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

function ensureReportsDir(): void {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

export function writeSuiteResults(suite: BenchmarkSuite): string {
  ensureReportsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${suite.suite}-${timestamp}.json`;
  const filepath = join(REPORTS_DIR, filename);

  writeFileSync(filepath, JSON.stringify(suite, null, 2), 'utf-8');

  // Also write a "latest" file for easy reference
  const latestPath = join(REPORTS_DIR, `${suite.suite}-latest.json`);
  writeFileSync(latestPath, JSON.stringify(suite, null, 2), 'utf-8');

  return filepath;
}

export function readBaseline(): BenchmarkSuite | null {
  if (!existsSync(BASELINE_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(BASELINE_FILE, 'utf-8');
    return JSON.parse(content) as BenchmarkSuite;
  } catch {
    return null;
  }
}

export function saveAsBaseline(suite: BenchmarkSuite): void {
  ensureReportsDir();
  writeFileSync(BASELINE_FILE, JSON.stringify(suite, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Regression detection
// ---------------------------------------------------------------------------

export function checkRegression(
  current: BenchmarkSuite,
  baseline: BenchmarkSuite | null,
  threshold: number = REGRESSION_THRESHOLD,
): RegressionReport {
  const alerts: RegressionAlert[] = [];

  if (!baseline) {
    return {
      alerts: [],
      hasRegression: false,
      baselineFile: BASELINE_FILE,
      currentFile: '(in-memory)',
      checkedAt: new Date().toISOString(),
    };
  }

  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(
      (r) => r.name === currentResult.name && r.category === currentResult.category,
    );

    if (!baselineResult) {
      continue; // New benchmark, no baseline to compare
    }

    const baselineP95 = baselineResult.timings.p95;
    const currentP95 = currentResult.timings.p95;

    if (baselineP95 === 0) continue;

    const regressionPercent = (currentP95 - baselineP95) / baselineP95;

    if (regressionPercent > threshold) {
      alerts.push({
        benchmark: currentResult.name,
        category: currentResult.category,
        baseline: baselineP95,
        current: currentP95,
        regressionPercent: parseFloat((regressionPercent * 100).toFixed(2)),
        threshold: threshold * 100,
        severity: regressionPercent > threshold * 2 ? 'critical' : 'warning',
      });
    }
  }

  return {
    alerts,
    hasRegression: alerts.length > 0,
    baselineFile: BASELINE_FILE,
    currentFile: '(in-memory)',
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

export function printSummaryTable(suite: BenchmarkSuite): void {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  Benchmark Suite: ${suite.suite}`);
  console.log(`  Environment: ${suite.environment} | Node: ${suite.nodeVersion}`);
  console.log(`  Run Date: ${suite.runDate}`);
  console.log(`${'='.repeat(90)}\n`);

  const header = [
    'Name'.padEnd(40),
    'p95 (ms)'.padStart(10),
    'Budget'.padStart(10),
    'Status'.padStart(8),
    'Mean'.padStart(10),
    'Stddev'.padStart(10),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const result of suite.results) {
    const status = result.withinBudget ? ' PASS ' : ' FAIL ';
    const row = [
      result.name.padEnd(40).slice(0, 40),
      result.timings.p95.toFixed(2).padStart(10),
      result.budgetMs.toFixed(0).padStart(10),
      status.padStart(8),
      result.timings.mean.toFixed(2).padStart(10),
      result.timings.stddev.toFixed(2).padStart(10),
    ].join(' | ');

    console.log(row);
  }

  console.log(`\n${'='.repeat(90)}\n`);
}

export function printRegressionReport(report: RegressionReport): void {
  if (!report.hasRegression) {
    console.log('\n  No performance regressions detected.\n');
    return;
  }

  console.log(`\n${'!'.repeat(70)}`);
  console.log(`  PERFORMANCE REGRESSION DETECTED`);
  console.log(`${'!'.repeat(70)}\n`);

  for (const alert of report.alerts) {
    const icon = alert.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
    console.log(`  ${icon} ${alert.benchmark}`);
    console.log(`    Category:   ${alert.category}`);
    console.log(`    Baseline:   ${alert.baseline.toFixed(2)}ms (p95)`);
    console.log(`    Current:    ${alert.current.toFixed(2)}ms (p95)`);
    console.log(`    Regression: +${alert.regressionPercent}% (threshold: ${alert.threshold}%)`);
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Benchmark runner helper
// ---------------------------------------------------------------------------

/**
 * Convenience function that runs a benchmark loop and returns a BenchmarkResult.
 * Handles warm-up iterations, measurement, and cooldown.
 */
export function runBenchmark(
  name: string,
  category: string,
  fn: () => void | Promise<void>,
  options: {
    iterations?: number;
    warmup?: number;
    budgetMs: number;
    metadata?: Record<string, unknown>;
  },
): BenchmarkResult {
  const iterations = options.iterations ?? 100;
  const warmup = options.warmup ?? 5;

  // Warm-up phase
  for (let i = 0; i < warmup; i++) {
    void fn();
  }

  // Measurement phase
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    void fn();
    durations.push(performance.now() - start);
  }

  return collectResult(name, category, durations, options.budgetMs, options.metadata);
}

/**
 * Async version of runBenchmark for async operations.
 */
export async function runBenchmarkAsync(
  name: string,
  category: string,
  fn: () => Promise<void>,
  options: {
    iterations?: number;
    warmup?: number;
    budgetMs: number;
    metadata?: Record<string, unknown>;
  },
): Promise<BenchmarkResult> {
  const iterations = options.iterations ?? 100;
  const warmup = options.warmup ?? 5;

  // Warm-up phase
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Measurement phase
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }

  return collectResult(name, category, durations, options.budgetMs, options.metadata);
}
