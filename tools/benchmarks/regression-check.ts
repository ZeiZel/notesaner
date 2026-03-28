#!/usr/bin/env tsx
/**
 * Regression Check Script
 *
 * Compares the latest benchmark results against a saved baseline and
 * exits with code 1 if any regression exceeds the threshold (default 20%).
 *
 * Usage:
 *   npx tsx tools/benchmarks/regression-check.ts [--threshold 0.20] [--save-baseline]
 *
 * Flags:
 *   --threshold <number>   Regression threshold as decimal (default: 0.20 = 20%)
 *   --save-baseline        Save current results as the new baseline after checking
 *   --suite <name>         Suite name to check (default: all *-latest.json files)
 *
 * Exit codes:
 *   0 — No regressions
 *   1 — Regressions detected above threshold
 *   2 — No results found to compare
 *
 * @module tools/benchmarks/regression-check
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  type BenchmarkSuite,
  type RegressionReport,
  checkRegression,
  printRegressionReport,
  readBaseline,
  saveAsBaseline,
} from './harness';

// ---------------------------------------------------------------------------
// CLI argument parsing
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

const threshold = parseFloat(getFlag('threshold', '0.20'));
const shouldSaveBaseline = hasFlag('save-baseline');
const suiteName = getFlag('suite', '');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const REPORTS_DIR = resolve(__dirname, '../../reports/benchmarks');

function findLatestResults(): BenchmarkSuite[] {
  if (!existsSync(REPORTS_DIR)) {
    return [];
  }

  const files = readdirSync(REPORTS_DIR).filter((f) => f.endsWith('-latest.json'));

  if (suiteName) {
    const filtered = files.filter((f) => f.startsWith(suiteName));
    return filtered.map((f) => {
      const content = readFileSync(join(REPORTS_DIR, f), 'utf-8');
      return JSON.parse(content) as BenchmarkSuite;
    });
  }

  return files.map((f) => {
    const content = readFileSync(join(REPORTS_DIR, f), 'utf-8');
    return JSON.parse(content) as BenchmarkSuite;
  });
}

function mergeResults(suites: BenchmarkSuite[]): BenchmarkSuite {
  const merged: BenchmarkSuite = {
    suite: 'all',
    environment: suites[0]?.environment ?? 'unknown',
    nodeVersion: suites[0]?.nodeVersion ?? 'unknown',
    results: [],
    runDate: new Date().toISOString(),
  };

  for (const suite of suites) {
    merged.results.push(...suite.results);
  }

  return merged;
}

function main(): void {
  console.log('\n--- Performance Regression Check ---\n');
  console.log(`  Threshold: ${(threshold * 100).toFixed(0)}%`);
  console.log(`  Reports dir: ${REPORTS_DIR}`);

  const suites = findLatestResults();

  if (suites.length === 0) {
    console.log('\n  No benchmark results found. Run benchmarks first.\n');
    process.exit(2);
  }

  console.log(`  Found ${suites.length} suite(s): ${suites.map((s) => s.suite).join(', ')}`);

  const merged = mergeResults(suites);
  const baseline = readBaseline();

  if (!baseline) {
    console.log('\n  No baseline found. Saving current results as baseline.\n');
    saveAsBaseline(merged);
    console.log(`  Baseline saved to: ${resolve(REPORTS_DIR, 'baseline.json')}\n`);
    process.exit(0);
  }

  console.log(`  Baseline date: ${baseline.runDate}`);
  console.log(`  Baseline results: ${baseline.results.length} benchmarks`);
  console.log(`  Current results: ${merged.results.length} benchmarks`);

  const report: RegressionReport = checkRegression(merged, baseline, threshold);

  printRegressionReport(report);

  // Output as JSON for CI consumption
  const reportPath = join(REPORTS_DIR, 'regression-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`  Report saved to: ${reportPath}`);

  // Optionally save as new baseline
  if (shouldSaveBaseline) {
    saveAsBaseline(merged);
    console.log(`  Updated baseline saved.\n`);
  }

  if (report.hasRegression) {
    const criticalCount = report.alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = report.alerts.filter((a) => a.severity === 'warning').length;

    console.log(`\n  Summary: ${criticalCount} critical, ${warningCount} warning regression(s).\n`);
    process.exit(1);
  }

  console.log('\n  All benchmarks within regression threshold.\n');
  process.exit(0);
}

main();
