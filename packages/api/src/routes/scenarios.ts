import { Router, Request, Response } from 'express';
import { 
  getAllScenarios, 
  getScenarioById, 
  updateScenarioStatus, 
  bulkUpdateScenarioStatus,
  getScenariosByPrdId,
  updateScenario,
  deleteScenario
} from '../db/database';

export const scenarioRouter = Router();

// Get all scenarios
scenarioRouter.get('/', (req: Request, res: Response) => {
  try {
    const { prdId, status } = req.query;
    
    const scenarios = getAllScenarios({
      prdId: prdId as string,
      status: status as string,
    });
    
    // Parse JSON fields
    const parsedScenarios = scenarios.map((s: any) => ({
      ...s,
      steps: JSON.parse(s.steps || '[]'),
      test_data: JSON.parse(s.test_data || '{}'),
      tags: JSON.parse(s.tags || '[]'),
    }));

    res.json(parsedScenarios);
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// Get single scenario
scenarioRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const scenario = getScenarioById(req.params.id);
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({
      ...scenario,
      steps: JSON.parse(scenario.steps || '[]'),
      test_data: JSON.parse(scenario.test_data || '{}'),
      tags: JSON.parse(scenario.tags || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scenario' });
  }
});

// Update scenario status (approve/reject)
scenarioRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const success = updateScenarioStatus(req.params.id, status);

    if (!success) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ message: 'Scenario status updated', status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update scenario status' });
  }
});

// Bulk approve scenarios
scenarioRouter.post('/bulk-approve', (req: Request, res: Response) => {
  try {
    const { scenarioIds } = req.body;
    
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
      return res.status(400).json({ error: 'scenarioIds array is required' });
    }

    const updated = bulkUpdateScenarioStatus(scenarioIds, 'approved');

    res.json({ message: `Approved ${updated} scenarios` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk approve scenarios' });
  }
});

// Get scenarios by PRD ID
scenarioRouter.get('/prd/:prdId', (req: Request, res: Response) => {
  try {
    const scenarios = getScenariosByPrdId(req.params.prdId);

    const parsedScenarios = scenarios.map((s: any) => ({
      ...s,
      steps: JSON.parse(s.steps || '[]'),
      test_data: JSON.parse(s.test_data || '{}'),
      tags: JSON.parse(s.tags || '[]'),
    }));

    res.json(parsedScenarios);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// Update scenario (full update)
scenarioRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const { title, description, type, priority, steps, testData, tags } = req.body;
    
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (priority !== undefined) updates.priority = priority;
    if (steps !== undefined) updates.steps = JSON.stringify(steps);
    if (testData !== undefined) updates.test_data = JSON.stringify(testData);
    if (tags !== undefined) updates.tags = JSON.stringify(tags);

    const success = updateScenario(req.params.id, updates);

    if (!success) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    // Return updated scenario
    const scenario = getScenarioById(req.params.id);
    res.json({
      ...scenario,
      steps: JSON.parse(scenario?.steps || '[]'),
      test_data: JSON.parse(scenario?.test_data || '{}'),
      tags: JSON.parse(scenario?.tags || '[]'),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update scenario' });
  }
});

// Delete scenario
scenarioRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const success = deleteScenario(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ message: 'Scenario deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

// Export scenarios (JSON)
scenarioRouter.get('/export/json', (req: Request, res: Response) => {
  try {
    const { prdId, status } = req.query;
    
    const scenarios = getAllScenarios({
      prdId: prdId as string,
      status: status as string,
    });
    
    const exportData = scenarios.map((s: any) => ({
      id: s.id,
      prdId: s.prd_id,
      title: s.title,
      description: s.description,
      type: s.type,
      priority: s.priority,
      status: s.status,
      steps: JSON.parse(s.steps || '[]'),
      testData: JSON.parse(s.test_data || '{}'),
      tags: JSON.parse(s.tags || '[]'),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tars-scenarios-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export scenarios' });
  }
});

// Export scenarios (Gherkin/BDD format)
scenarioRouter.get('/export/gherkin', (req: Request, res: Response) => {
  try {
    const { prdId, status } = req.query;
    
    const scenarios = getAllScenarios({
      prdId: prdId as string,
      status: status as string,
    });
    
    let gherkin = `# TARS Generated Test Scenarios
# Generated: ${new Date().toISOString()}

`;

    for (const scenario of scenarios) {
      const steps = JSON.parse(scenario.steps || '[]');
      const tags = JSON.parse(scenario.tags || '[]');
      
      gherkin += `@${scenario.priority} @${scenario.type}`;
      if (tags.length > 0) {
        gherkin += ` ${tags.map((t: string) => `@${t}`).join(' ')}`;
      }
      gherkin += `
Feature: ${scenario.title}
  ${scenario.description}

  Scenario: ${scenario.title}
`;

      steps.forEach((step: any, index: number) => {
        const keyword = index === 0 ? 'Given' : index === steps.length - 1 ? 'Then' : 'When';
        gherkin += `    ${keyword} ${step.action}
    # Expected: ${step.expected}
`;
      });

      gherkin += '\n';
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="tars-scenarios-${Date.now()}.feature"`);
    res.send(gherkin);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export scenarios' });
  }
});
