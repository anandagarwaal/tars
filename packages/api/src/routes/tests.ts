// ============================================
// Test Execution Routes
// ============================================

import { Router, Request, Response } from 'express';
import * as path from 'path';
import { runTest, runTestsInDirectory, checkFrameworkAvailable, TestConfig } from '../services/testRunner';
import { getTestRuns, getTestRunById, getTestRunsByScenario } from '../db/database';

export const testsRouter = Router();

/**
 * Run a single test file
 * POST /api/tests/run
 */
testsRouter.post('/run', async (req: Request, res: Response) => {
  try {
    const { testFile, framework, workingDir, timeout, env } = req.body;

    if (!testFile || !framework || !workingDir) {
      return res.status(400).json({
        error: 'testFile, framework, and workingDir are required',
      });
    }

    // Validate framework
    const validFrameworks = ['jest', 'junit', 'testng', 'cypress', 'playwright', 'mocha'];
    if (!validFrameworks.includes(framework)) {
      return res.status(400).json({
        error: `Invalid framework. Supported: ${validFrameworks.join(', ')}`,
      });
    }

    // Check if test file exists
    const fullPath = path.isAbsolute(testFile) ? testFile : path.join(workingDir, testFile);
    
    console.log(`🧪 Executing test: ${testFile}`);

    const config: TestConfig = {
      framework,
      testFile: fullPath,
      workingDir: path.resolve(workingDir),
      timeout: timeout || 60000,
      env,
    };

    const result = await runTest(config);

    res.json({
      success: result.status === 'passed',
      result,
    });
  } catch (error: any) {
    console.error('Test execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run all tests in a directory
 * POST /api/tests/run-all
 */
testsRouter.post('/run-all', async (req: Request, res: Response) => {
  try {
    const { directory, framework, pattern } = req.body;

    if (!directory || !framework) {
      return res.status(400).json({
        error: 'directory and framework are required',
      });
    }

    console.log(`🧪 Running all ${framework} tests in: ${directory}`);

    const results = await runTestsInDirectory(
      path.resolve(directory),
      framework,
      pattern
    );

    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length,
      timeouts: results.filter(r => r.status === 'timeout').length,
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    };

    res.json({
      success: summary.failed === 0 && summary.errors === 0,
      summary,
      results,
    });
  } catch (error: any) {
    console.error('Test execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if a framework is available in a directory
 * POST /api/tests/check-framework
 */
testsRouter.post('/check-framework', async (req: Request, res: Response) => {
  try {
    const { framework, workingDir } = req.body;

    if (!framework || !workingDir) {
      return res.status(400).json({
        error: 'framework and workingDir are required',
      });
    }

    const available = await checkFrameworkAvailable(framework, path.resolve(workingDir));

    res.json({
      framework,
      available,
      workingDir,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get test run history
 * GET /api/tests/runs
 */
testsRouter.get('/runs', (req: Request, res: Response) => {
  try {
    const { scenarioId, limit } = req.query;

    let runs;
    if (scenarioId) {
      runs = getTestRunsByScenario(scenarioId as string);
    } else {
      runs = getTestRuns();
    }

    if (limit) {
      runs = runs.slice(0, parseInt(limit as string));
    }

    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific test run
 * GET /api/tests/runs/:id
 */
testsRouter.get('/runs/:id', (req: Request, res: Response) => {
  try {
    const run = getTestRunById(req.params.id);

    if (!run) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run generated tests for a PRD
 * POST /api/tests/run-generated
 */
testsRouter.post('/run-generated', async (req: Request, res: Response) => {
  try {
    const { testsDirectory, framework } = req.body;

    if (!testsDirectory) {
      return res.status(400).json({
        error: 'testsDirectory is required',
      });
    }

    const resolvedDir = path.resolve(testsDirectory);
    const detectedFramework = framework || 'jest'; // Default to Jest

    console.log(`🧪 Running generated tests from: ${resolvedDir}`);

    const results = await runTestsInDirectory(resolvedDir, detectedFramework);

    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    res.json({
      success: summary.failed === 0 && summary.errors === 0,
      summary,
      results: results.map(r => ({
        id: r.id,
        status: r.status,
        durationMs: r.durationMs,
        summary: r.summary,
        // Truncate output for API response
        output: r.output.length > 5000 ? r.output.substring(0, 5000) + '\n... (truncated)' : r.output,
      })),
    });
  } catch (error: any) {
    console.error('Test execution error:', error);
    res.status(500).json({ error: error.message });
  }
});
