import { Router, Request, Response } from 'express';
import { generateTestCode } from '../services/ollama';

export const generateRouter = Router();

// Generate test code using Ollama
generateRouter.post('/test-code', async (req: Request, res: Response) => {
  try {
    const { scenario, framework, repoContext } = req.body;

    if (!scenario) {
      return res.status(400).json({ error: 'Scenario is required' });
    }

    const validFrameworks = ['jest', 'junit', 'testng', 'cypress', 'playwright', 'mocha'];
    const targetFramework = validFrameworks.includes(framework) ? framework : 'jest';

    console.log(`🤖 Generating ${targetFramework} test code with Ollama...`);
    
    const testCode = await generateTestCode(scenario, targetFramework, repoContext);

    res.json({
      success: true,
      framework: targetFramework,
      testCode,
      scenario: scenario.title,
    });
  } catch (error) {
    console.error('Error generating test code:', error);
    res.status(500).json({ error: 'Failed to generate test code' });
  }
});

// Batch generate test code for multiple scenarios
generateRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { scenarios, framework, repoContext } = req.body;

    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({ error: 'Scenarios array is required' });
    }

    const validFrameworks = ['jest', 'junit', 'testng', 'cypress', 'playwright', 'mocha'];
    const targetFramework = validFrameworks.includes(framework) ? framework : 'jest';

    console.log(`🤖 Batch generating ${scenarios.length} ${targetFramework} tests with Ollama...`);

    const results = [];
    for (const scenario of scenarios) {
      try {
        const testCode = await generateTestCode(scenario, targetFramework, repoContext);
        results.push({
          scenarioId: scenario.id,
          title: scenario.title,
          success: true,
          testCode,
        });
      } catch (err) {
        results.push({
          scenarioId: scenario.id,
          title: scenario.title,
          success: false,
          error: 'Failed to generate',
        });
      }
    }

    res.json({
      success: true,
      framework: targetFramework,
      generated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('Error in batch generation:', error);
    res.status(500).json({ error: 'Failed to batch generate test code' });
  }
});
