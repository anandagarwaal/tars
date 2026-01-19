// ============================================
// Test Execution Service
// Supports Jest, JUnit, and other frameworks
// ============================================

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createTestRun, completeTestRun, getTestRunById, TestRun } from '../db/database';

// Test execution configuration
interface TestConfig {
  framework: 'jest' | 'junit' | 'testng' | 'cypress' | 'playwright' | 'mocha';
  testFile: string;
  workingDir: string;
  timeout?: number; // milliseconds
  env?: Record<string, string>;
}

interface TestResult {
  id: string;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  exitCode: number;
  output: string;
  durationMs: number;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

// Framework-specific commands
const frameworkCommands: Record<string, (config: TestConfig) => { command: string; args: string[] }> = {
  jest: (config) => ({
    command: 'npx',
    args: ['jest', config.testFile, '--json', '--outputFile=/dev/stdout', '--colors'],
  }),
  mocha: (config) => ({
    command: 'npx',
    args: ['mocha', config.testFile, '--reporter', 'json'],
  }),
  cypress: (config) => ({
    command: 'npx',
    args: ['cypress', 'run', '--spec', config.testFile, '--reporter', 'json'],
  }),
  playwright: (config) => ({
    command: 'npx',
    args: ['playwright', 'test', config.testFile, '--reporter=json'],
  }),
  junit: (config) => {
    // Detect build tool
    const hasMaven = fs.existsSync(path.join(config.workingDir, 'pom.xml'));
    const hasGradle = fs.existsSync(path.join(config.workingDir, 'build.gradle')) || 
                      fs.existsSync(path.join(config.workingDir, 'build.gradle.kts'));
    
    if (hasMaven) {
      return {
        command: 'mvn',
        args: ['test', `-Dtest=${path.basename(config.testFile, '.java')}`, '-q'],
      };
    } else if (hasGradle) {
      return {
        command: './gradlew',
        args: ['test', '--tests', path.basename(config.testFile, '.java'), '-q'],
      };
    }
    // Fallback to direct java execution
    return {
      command: 'java',
      args: ['-cp', '.', config.testFile],
    };
  },
  testng: (config) => {
    const hasMaven = fs.existsSync(path.join(config.workingDir, 'pom.xml'));
    if (hasMaven) {
      return {
        command: 'mvn',
        args: ['test', `-Dtest=${path.basename(config.testFile, '.java')}`, '-q'],
      };
    }
    return {
      command: 'java',
      args: ['-cp', '.', 'org.testng.TestNG', config.testFile],
    };
  },
};

/**
 * Run a single test file
 */
export async function runTest(config: TestConfig): Promise<TestResult> {
  const runId = uuidv4();
  const startTime = Date.now();
  const timeout = config.timeout || 60000; // 60 seconds default

  // Create test run record
  createTestRun({
    id: runId,
    framework: config.framework,
    status: 'running',
    test_file: config.testFile,
    created_at: new Date().toISOString(),
  });

  return new Promise((resolve) => {
    const commandConfig = frameworkCommands[config.framework];
    if (!commandConfig) {
      const result: TestResult = {
        id: runId,
        status: 'error',
        exitCode: 1,
        output: `Unsupported framework: ${config.framework}`,
        durationMs: Date.now() - startTime,
      };
      completeTestRun(runId, {
        status: 'error',
        output: result.output,
        exitCode: 1,
        durationMs: result.durationMs,
      });
      resolve(result);
      return;
    }

    const { command, args } = commandConfig(config);
    let output = '';
    let killed = false;

    console.log(`🧪 Running: ${command} ${args.join(' ')}`);
    console.log(`   Working dir: ${config.workingDir}`);

    const proc = spawn(command, args, {
      cwd: config.workingDir,
      env: { ...process.env, ...config.env, CI: 'true', FORCE_COLOR: '1' },
      shell: true,
    });

    // Timeout handler
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 5000);
    }, timeout);

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      
      let status: TestResult['status'];
      if (killed) {
        status = 'timeout';
      } else if (code === 0) {
        status = 'passed';
      } else {
        status = 'failed';
      }

      // Parse summary if possible
      const summary = parseTestSummary(output, config.framework);

      const result: TestResult = {
        id: runId,
        status,
        exitCode: code || 0,
        output,
        durationMs,
        summary,
      };

      // Update database
      completeTestRun(runId, {
        status,
        output,
        exitCode: code || 0,
        durationMs,
      });

      console.log(`   ${status === 'passed' ? '✅' : '❌'} ${status} in ${durationMs}ms`);
      if (summary) {
        console.log(`   📊 ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);
      }

      resolve(result);
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      
      const result: TestResult = {
        id: runId,
        status: 'error',
        exitCode: 1,
        output: `Process error: ${err.message}\n${output}`,
        durationMs,
      };

      completeTestRun(runId, {
        status: 'error',
        output: result.output,
        exitCode: 1,
        durationMs,
      });

      resolve(result);
    });
  });
}

/**
 * Run multiple test files
 */
export async function runTests(configs: TestConfig[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (const config of configs) {
    const result = await runTest(config);
    results.push(result);
  }
  
  return results;
}

/**
 * Run all tests in a directory
 */
export async function runTestsInDirectory(
  directory: string,
  framework: 'jest' | 'junit' | 'testng' | 'cypress' | 'playwright' | 'mocha',
  pattern?: string
): Promise<TestResult[]> {
  const testFiles = findTestFiles(directory, framework, pattern);
  
  if (testFiles.length === 0) {
    console.log(`⚠️ No test files found in ${directory}`);
    return [];
  }

  console.log(`📁 Found ${testFiles.length} test files`);
  
  const configs: TestConfig[] = testFiles.map(file => ({
    framework,
    testFile: file,
    workingDir: directory,
  }));

  return runTests(configs);
}

/**
 * Find test files matching framework patterns
 */
function findTestFiles(directory: string, framework: string, pattern?: string): string[] {
  const patterns: Record<string, RegExp> = {
    jest: /\.(test|spec)\.(ts|js|tsx|jsx)$/,
    mocha: /\.(test|spec)\.(ts|js)$/,
    cypress: /\.cy\.(ts|js)$/,
    playwright: /\.spec\.(ts|js)$/,
    junit: /Test\.java$/,
    testng: /Test\.java$/,
  };

  const testPattern = pattern ? new RegExp(pattern) : patterns[framework];
  const files: string[] = [];

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, build directories, etc.
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'build', 'target', '.git'].includes(entry.name)) {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && testPattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  scanDir(directory);
  return files;
}

/**
 * Parse test summary from output
 */
function parseTestSummary(output: string, framework: string): TestResult['summary'] | undefined {
  try {
    // Try to parse JSON output first (Jest, Mocha with JSON reporter)
    const jsonMatch = output.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      return {
        total: json.numTotalTests || 0,
        passed: json.numPassedTests || 0,
        failed: json.numFailedTests || 0,
        skipped: json.numPendingTests || 0,
      };
    }

    // Jest text output
    const jestMatch = output.match(/Tests:\s+(\d+)\s+passed,?\s*(\d+)?\s*failed?,?\s*(\d+)?\s*skipped?,?\s*(\d+)\s+total/i);
    if (jestMatch) {
      return {
        total: parseInt(jestMatch[4]) || 0,
        passed: parseInt(jestMatch[1]) || 0,
        failed: parseInt(jestMatch[2]) || 0,
        skipped: parseInt(jestMatch[3]) || 0,
      };
    }

    // JUnit/Maven output
    const mavenMatch = output.match(/Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/i);
    if (mavenMatch) {
      const total = parseInt(mavenMatch[1]);
      const failures = parseInt(mavenMatch[2]) + parseInt(mavenMatch[3]);
      const skipped = parseInt(mavenMatch[4]);
      return {
        total,
        passed: total - failures - skipped,
        failed: failures,
        skipped,
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if a framework is available
 */
export async function checkFrameworkAvailable(framework: string, workingDir: string): Promise<boolean> {
  const checks: Record<string, () => boolean> = {
    jest: () => {
      const pkgPath = path.join(workingDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return !!(pkg.devDependencies?.jest || pkg.dependencies?.jest);
      }
      return false;
    },
    junit: () => {
      return fs.existsSync(path.join(workingDir, 'pom.xml')) ||
             fs.existsSync(path.join(workingDir, 'build.gradle'));
    },
    testng: () => {
      const pomPath = path.join(workingDir, 'pom.xml');
      if (fs.existsSync(pomPath)) {
        const pom = fs.readFileSync(pomPath, 'utf-8');
        return pom.includes('testng');
      }
      return false;
    },
    cypress: () => {
      const pkgPath = path.join(workingDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return !!(pkg.devDependencies?.cypress || pkg.dependencies?.cypress);
      }
      return false;
    },
    playwright: () => {
      const pkgPath = path.join(workingDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return !!(pkg.devDependencies?.['@playwright/test'] || pkg.dependencies?.['@playwright/test']);
      }
      return false;
    },
  };

  const check = checks[framework];
  return check ? check() : false;
}

/**
 * Get test run status
 */
export function getTestRunStatus(runId: string): TestRun | undefined {
  return getTestRunById(runId);
}

// Export types
export type { TestConfig, TestResult };
