#!/usr/bin/env tsx
/**
 * Benchmark Runner
 *
 * Orchestrates the execution of all performance benchmark suites and
 * produces a unified report. This script is the entry point for the
 * `pnpm nx benchmark web` NX target.
 *
 * Suites:
 *   1. Vitest unit benchmarks (editor, render)
 *   2. Playwright browser benchmarks (input latency, LCP, note open)
 *   3. Lighthouse CI (optional, skipped if @lhci/cli not installed)
 *
 * Usage:
 *   npx tsx tools/benchmarks/run-benchmarks.ts [--suite <name>] [--save-baseline]
 *
 * Options:
 *   --suite editor     Run only editor performance benchmarks
 *   --suite render     Run only render benchmarks
 *   --suite browser    Run only Playwright browser benchmarks
 *   --suite lighthouse Run only Lighthouse CI
 *   --suite all        Run all suites (default)
 *   --save-baseline    Save results as baseline after run
 *   --skip-regression  Skip regression check
 *
 * @module tools/benchmarks/run-benchmarks
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getFlag(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return defaultValue;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const suite = getFlag('suite', 'all');
const saveBaseline = hasFlag('save-baseline');
const skipRegression = hasFlag('skip-regression');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '../..');
const WEB_DIR = resolve(ROOT, 'apps/web');

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

function run(command: string, label: string): boolean {
  console.log(`\n${'='.repeat(70)}`);

  console.log(`  Running: ${label}`);

  console.log(`${'='.repeat(70)}\n`);

  try {
    execSync(command, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        BENCHMARK_MODE: 'true',
      },
    });

    console.log(`\n  [PASS] ${label}\n`);
    return true;
  } catch (_error) {
    console.error(`\n  [FAIL] ${label}\n`);
    return false;
  }
}

function runVitestBenchmarks(): boolean {
  return run(
    `pnpm vitest run --config ${WEB_DIR}/vitest.perf.config.ts`,
    'Vitest Performance Benchmarks (editor + render + search + websocket)',
  );
}

function runPlaywrightBenchmarks(): boolean {
  return run(
    `pnpm exec playwright test --config=${WEB_DIR}/playwright/benchmark.config.ts`,
    'Playwright Browser Benchmarks',
  );
}

function runLighthouseCI(): boolean {
  try {
    // Check if @lhci/cli is available
    execSync('npx @lhci/cli --version', { stdio: 'pipe', cwd: ROOT });
  } catch {
    console.log('\n  [SKIP] Lighthouse CI: @lhci/cli not installed');

    console.log('         Install with: pnpm add -Dw @lhci/cli\n');
    return true; // Not a failure, just skipped
  }

  return run('npx @lhci/cli autorun --config=.lighthouserc.js', 'Lighthouse CI');
}

function runRegressionCheck(): boolean {
  const flags: string[] = [];
  if (saveBaseline) {
    flags.push('--save-baseline');
  }

  return run(`npx tsx tools/benchmarks/regression-check.ts ${flags.join(' ')}`, 'Regression Check');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('\n--- Notesaner Performance Benchmark Suite ---\n');

  console.log(`  Suite:          ${suite}`);

  console.log(`  Save baseline:  ${saveBaseline}`);

  console.log(`  Skip regression: ${skipRegression}`);

  console.log(`  Root:           ${ROOT}`);

  console.log('');

  const results: Array<{ name: string; passed: boolean }> = [];

  // Run selected suites
  if (suite === 'all' || suite === 'editor' || suite === 'render') {
    results.push({
      name: 'Vitest Performance Benchmarks',
      passed: runVitestBenchmarks(),
    });
  }

  if (suite === 'all' || suite === 'browser') {
    results.push({
      name: 'Playwright Browser Benchmarks',
      passed: runPlaywrightBenchmarks(),
    });
  }

  if (suite === 'all' || suite === 'lighthouse') {
    results.push({
      name: 'Lighthouse CI',
      passed: runLighthouseCI(),
    });
  }

  // Regression check
  if (!skipRegression) {
    results.push({
      name: 'Regression Check',
      passed: runRegressionCheck(),
    });
  }

  // Summary

  console.log(`\n${'='.repeat(70)}`);

  console.log('  BENCHMARK SUMMARY');

  console.log(`${'='.repeat(70)}\n`);

  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? ' PASS ' : ' FAIL ';

    console.log(`  ${status} ${result.name}`);
    if (!result.passed) allPassed = false;
  }

  console.log(`\n${'='.repeat(70)}\n`);

  if (!allPassed) {
    console.error('  Some benchmarks failed. See details above.\n');
    process.exit(1);
  }

  console.log('  All benchmarks passed.\n');
}

main();
