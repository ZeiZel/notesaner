/**
 * Benchmark Infrastructure — public API
 *
 * Re-exports the harness utilities for use in benchmark tests.
 *
 * @module tools/benchmarks
 */

export {
  type BenchmarkTimings,
  type BenchmarkResult,
  type BenchmarkSuite,
  type RegressionAlert,
  type RegressionReport,
  percentile,
  stddev,
  computeTimings,
  collectResult,
  createSuite,
  writeSuiteResults,
  readBaseline,
  saveAsBaseline,
  checkRegression,
  printSummaryTable,
  printRegressionReport,
  runBenchmark,
  runBenchmarkAsync,
} from './harness';
