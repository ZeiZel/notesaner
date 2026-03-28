#!/usr/bin/env tsx
/**
 * Performance Benchmark Runner
 *
 * Orchestrates all performance benchmark suites and collects results into
 * a unified JSON report for CI comparison.
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts                    # Run all suites
 *   npx tsx scripts/benchmark.ts --suite=api        # Run specific suite
 *   npx tsx scripts/benchmark.ts --suite=sync       # Run sync benchmarks
 *   npx tsx scripts/benchmark.ts --json             # JSON-only output
 *   npx tsx scripts/benchmark.ts --output=report.json  # Write to file
 *   npx tsx scripts/benchmark.ts --suite=lighthouse  # Lighthouse CI
 *
 * Available suites:
 *   api       — API response time benchmarks
 *   database  — Database query performance
 *   sync      — Yjs CRDT sync performance
 *   editor    — Editor performance with large documents
 *   render    — Component render time measurements
 *   lighthouse — Lighthouse CI (requires running app)
 *   all       — Run all suites (default)
 *
 * Exit codes:
 *   0 — All benchmarks passed their budgets
 *   1 — One or more benchmarks exceeded their budget
 *   2 — Runner error (misconfiguration, missing dependencies)
 */

import { execSync, type ExecSyncOptions } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkTimings {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stddev: number;
}

interface BenchmarkResultEntry {
  name: string;
  endpoint?: string;
  method?: string;
  operation?: string;
  category?: string;
  iterations: number;
  timings: BenchmarkTimings;
  metadata?: Record<string, unknown>;
  timestamp: string;
  withinBudget: boolean;
  budgetMs: number;
}

interface SuiteResult {
  suite: string;
  environment: string;
  nodeVersion: string;
  results: BenchmarkResultEntry[];
  runDate: string;
  durationMs: number;
  passed: boolean;
}

interface BenchmarkReport {
  version: 1;
  timestamp: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  suites: SuiteResult[];
  summary: {
    totalSuites: number;
    totalBenchmarks: number;
    passed: number;
    failed: number;
    overallPassed: boolean;
  };
}

type SuiteName = 'api' | 'database' | 'sync' | 'editor' | 'render' | 'lighthouse';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT_DIR = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SERVER_DIR = resolve(ROOT_DIR, 'apps/server');
const WEB_DIR = resolve(ROOT_DIR, 'apps/web');
const OUTPUT_DIR = resolve(ROOT_DIR, '.benchmarks');

const SUITE_CONFIG: Record<
  SuiteName,
  {
    name: string;
    testFile: string;
    cwd: string;
    vitestConfig: string;
    description: string;
  }
> = {
  api: {
    name: 'API Response Times',
    testFile: 'src/__tests__/performance/api-benchmarks.test.ts',
    cwd: SERVER_DIR,
    vitestConfig: resolve(SERVER_DIR, 'vitest.config.ts'),
    description: 'Measures HTTP handler + serialisation overhead for key endpoints',
  },
  database: {
    name: 'Database Queries',
    testFile: 'src/__tests__/performance/database-benchmarks.test.ts',
    cwd: SERVER_DIR,
    vitestConfig: resolve(SERVER_DIR, 'vitest.config.ts'),
    description: 'Measures query-building, result mapping, and pagination overhead',
  },
  sync: {
    name: 'Yjs Sync',
    testFile: 'src/__tests__/performance/sync-benchmarks.test.ts',
    cwd: SERVER_DIR,
    vitestConfig: resolve(SERVER_DIR, 'vitest.config.ts'),
    description: 'Measures CRDT update, merge, reconnection, and persistence performance',
  },
  editor: {
    name: 'Editor Performance',
    testFile: 'src/__tests__/performance/editor-performance.test.ts',
    cwd: WEB_DIR,
    vitestConfig: resolve(WEB_DIR, 'vitest.config.ts'),
    description: 'Measures editor data-layer operations with large documents',
  },
  render: {
    name: 'Render Benchmarks',
    testFile: 'src/__tests__/performance/render-benchmarks.test.ts',
    cwd: WEB_DIR,
    vitestConfig: resolve(WEB_DIR, 'vitest.config.ts'),
    description: 'Measures component data preparation and state computation overhead',
  },
  lighthouse: {
    name: 'Lighthouse CI',
    testFile: '',
    cwd: WEB_DIR,
    vitestConfig: '',
    description: 'Core Web Vitals via Lighthouse CI (requires running application)',
  },
};

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  suite: SuiteName | 'all';
  json: boolean;
  output: string | null;
  verbose: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    suite: 'all',
    json: false,
    output: null,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--suite=')) {
      result.suite = arg.slice('--suite='.length) as SuiteName | 'all';
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg.startsWith('--output=')) {
      result.output = arg.slice('--output='.length);
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Performance Benchmark Runner for Notesaner

Usage:
  npx tsx scripts/benchmark.ts [options]

Options:
  --suite=<name>     Run a specific suite (api, database, sync, editor, render, lighthouse, all)
  --json             Output JSON only (suppress human-readable output)
  --output=<path>    Write JSON report to file
  --verbose, -v      Show detailed test output
  --help, -h         Show this help message

Examples:
  npx tsx scripts/benchmark.ts                        # Run all suites
  npx tsx scripts/benchmark.ts --suite=api            # API benchmarks only
  npx tsx scripts/benchmark.ts --suite=sync --json    # Sync benchmarks, JSON output
  npx tsx scripts/benchmark.ts --output=report.json   # Save report to file
`);
}

// ---------------------------------------------------------------------------
// Suite runners
// ---------------------------------------------------------------------------

/**
 * Extract benchmark results from vitest output.
 * Looks for JSON between --- BENCHMARK RESULTS (JSON) --- markers.
 */
function extractBenchmarkResults(output: string): BenchmarkResultEntry[] {
  const startMarker = '--- BENCHMARK RESULTS (JSON) ---';
  const endMarker = '--- END BENCHMARK RESULTS ---';

  const results: BenchmarkResultEntry[] = [];
  let searchFrom = 0;

  while (true) {
    const startIdx = output.indexOf(startMarker, searchFrom);
    if (startIdx === -1) break;

    const jsonStart = startIdx + startMarker.length;
    const endIdx = output.indexOf(endMarker, jsonStart);
    if (endIdx === -1) break;

    const jsonStr = output.slice(jsonStart, endIdx).trim();
    try {
      const parsed = JSON.parse(jsonStr) as { results?: BenchmarkResultEntry[] };
      if (parsed.results && Array.isArray(parsed.results)) {
        results.push(...parsed.results);
      }
    } catch {
      // Ignore malformed JSON blocks
    }

    searchFrom = endIdx + endMarker.length;
  }

  return results;
}

function runVitestSuite(suiteName: SuiteName, verbose: boolean): SuiteResult {
  const config = SUITE_CONFIG[suiteName];
  const startTime = Date.now();

  const execOptions: ExecSyncOptions = {
    cwd: config.cwd,
    encoding: 'utf-8',
    stdio: verbose ? 'inherit' : 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Increase memory for large document benchmarks
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    timeout: 300_000, // 5 minutes max per suite
  };

  let output = '';
  let testsPassed = true;

  try {
    const cmd = `npx vitest run ${config.testFile} --config ${config.vitestConfig} --reporter=verbose`;

    if (verbose) {
      execSync(cmd, { ...execOptions, stdio: 'inherit' });
    } else {
      output = execSync(cmd, execOptions) as unknown as string;
    }
  } catch (error: unknown) {
    testsPassed = false;
    if (error && typeof error === 'object' && 'stdout' in error) {
      output = (error as { stdout: string }).stdout ?? '';
    }
  }

  const durationMs = Date.now() - startTime;
  const results = extractBenchmarkResults(output);

  const allWithinBudget = results.every((r) => r.withinBudget);

  return {
    suite: suiteName,
    environment: 'unit',
    nodeVersion: process.version,
    results,
    runDate: new Date().toISOString(),
    durationMs,
    passed: testsPassed && allWithinBudget,
  };
}

function runLighthouseSuite(): SuiteResult {
  const startTime = Date.now();
  const baseUrl = process.env.LHCI_BASE_URL ?? 'http://localhost:3000';

  console.log(`  Running Lighthouse CI against ${baseUrl}...`);

  try {
    execSync('npx @lhci/cli --version', { stdio: 'pipe' });
  } catch {
    console.log('  [SKIP] @lhci/cli not installed. Install with: npm i -g @lhci/cli');
    return {
      suite: 'lighthouse',
      environment: 'browser',
      nodeVersion: process.version,
      results: [],
      runDate: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      passed: true, // Don't fail CI if Lighthouse isn't available
    };
  }

  // Check if the app is running
  try {
    execSync(`curl -sf ${baseUrl} > /dev/null 2>&1`, { timeout: 5000 });
  } catch {
    console.log(`  [SKIP] Application not running at ${baseUrl}. Start with: pnpm nx serve web`);
    return {
      suite: 'lighthouse',
      environment: 'browser',
      nodeVersion: process.version,
      results: [],
      runDate: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      passed: true,
    };
  }

  const configPath = resolve(WEB_DIR, 'src/__tests__/performance/lighthouse.config.ts');
  let lhciPassed = true;

  try {
    execSync(`npx @lhci/cli autorun --config=${configPath}`, {
      cwd: WEB_DIR,
      stdio: 'pipe',
      timeout: 120_000,
    });
  } catch {
    lhciPassed = false;
  }

  return {
    suite: 'lighthouse',
    environment: 'browser',
    nodeVersion: process.version,
    results: [], // Lighthouse results are in .lighthouseci/
    runDate: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    passed: lhciPassed,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function generateReport(suiteResults: SuiteResult[]): BenchmarkReport {
  const totalBenchmarks = suiteResults.reduce((sum, s) => sum + s.results.length, 0);
  const passed = suiteResults.reduce(
    (sum, s) => sum + s.results.filter((r) => r.withinBudget).length,
    0,
  );
  const failed = totalBenchmarks - passed;

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    suites: suiteResults,
    summary: {
      totalSuites: suiteResults.length,
      totalBenchmarks,
      passed,
      failed,
      overallPassed: suiteResults.every((s) => s.passed),
    },
  };
}

function printHumanReport(report: BenchmarkReport): void {
  console.log('\n=== Notesaner Performance Benchmark Report ===\n');
  console.log(`Date:     ${report.timestamp}`);
  console.log(`Node:     ${report.nodeVersion}`);
  console.log(`Platform: ${report.platform}/${report.arch}`);
  console.log('');

  for (const suite of report.suites) {
    const statusIcon = suite.passed ? '[PASS]' : '[FAIL]';
    console.log(`--- ${statusIcon} ${suite.suite} (${suite.durationMs}ms) ---`);

    if (suite.results.length === 0) {
      console.log('  No benchmark results (suite may have been skipped)');
      console.log('');
      continue;
    }

    // Table header
    console.log(
      '  ' +
        'Benchmark'.padEnd(45) +
        'p95'.padStart(10) +
        'Budget'.padStart(10) +
        'Status'.padStart(10),
    );
    console.log('  ' + '-'.repeat(75));

    for (const result of suite.results) {
      const status = result.withinBudget ? 'PASS' : 'FAIL';
      const p95Str = `${result.timings.p95.toFixed(2)}ms`;
      const budgetStr = `${result.budgetMs}ms`;

      console.log(
        '  ' +
          result.name.padEnd(45) +
          p95Str.padStart(10) +
          budgetStr.padStart(10) +
          status.padStart(10),
      );
    }

    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Suites:     ${report.summary.totalSuites}`);
  console.log(`Benchmarks: ${report.summary.totalBenchmarks}`);
  console.log(`Passed:     ${report.summary.passed}`);
  console.log(`Failed:     ${report.summary.failed}`);
  console.log(`Overall:    ${report.summary.overallPassed ? 'PASSED' : 'FAILED'}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  // Determine which suites to run
  const suitesToRun: SuiteName[] =
    args.suite === 'all'
      ? (['api', 'database', 'sync', 'editor', 'render'] as SuiteName[])
      : [args.suite];

  // Validate suite names
  for (const suite of suitesToRun) {
    if (!SUITE_CONFIG[suite]) {
      console.error(`Unknown suite: ${suite}`);
      console.error(`Available suites: ${Object.keys(SUITE_CONFIG).join(', ')}, all`);
      process.exit(2);
    }
  }

  if (!args.json) {
    console.log('Notesaner Performance Benchmark Runner');
    console.log(`Suites: ${suitesToRun.join(', ')}`);
    console.log('');
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Run suites
  const suiteResults: SuiteResult[] = [];

  for (const suiteName of suitesToRun) {
    if (!args.json) {
      console.log(`Running: ${SUITE_CONFIG[suiteName].name}...`);
    }

    let result: SuiteResult;
    if (suiteName === 'lighthouse') {
      result = runLighthouseSuite();
    } else {
      result = runVitestSuite(suiteName, args.verbose);
    }

    suiteResults.push(result);

    if (!args.json) {
      const icon = result.passed ? '[PASS]' : '[FAIL]';
      console.log(`  ${icon} ${result.results.length} benchmarks, ${result.durationMs}ms`);
    }
  }

  // Generate report
  const report = generateReport(suiteResults);

  // Output
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  // Write to file if requested
  const outputPath = args.output
    ? resolve(process.cwd(), args.output)
    : resolve(OUTPUT_DIR, `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  if (!args.json) {
    console.log(`Report saved to: ${outputPath}`);
  }

  // Exit with appropriate code
  process.exit(report.summary.overallPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Benchmark runner failed:', error);
  process.exit(2);
});
