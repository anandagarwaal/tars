import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  getAllPrds, 
  getPrdById, 
  createPrd, 
  updatePrdStatus, 
  deletePrd,
  createScenario 
} from '../db/database';
import { generateTestScenarios } from '../services/ollama';
import { wsService } from '../services/websocket';
import { telemetry } from '../services/telemetry';

export const prdRouter = Router();

// Get all PRDs
prdRouter.get('/', (req: Request, res: Response) => {
  try {
    const prds = getAllPrds();
    res.json(prds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PRDs' });
  }
});

// Get single PRD
prdRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const prd = getPrdById(req.params.id);
    if (!prd) {
      return res.status(404).json({ error: 'PRD not found' });
    }
    res.json(prd);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PRD' });
  }
});

// Create PRD and generate scenarios
prdRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let prdId: string | null = null;
  
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    prdId = uuidv4();
    const now = new Date().toISOString();

    // Create PRD
    createPrd({
      id: prdId,
      title,
      content,
      status: 'processing',
      created_at: now,
      updated_at: now,
    });

    // Emit WebSocket: PRD processing started
    wsService.emitPrdProcessing(prdId, title);

    // Generate scenarios using LLM
    console.log('🤖 Generating test scenarios with Ollama...');
    const scenariosJson = await generateTestScenarios(content);

    let scenarios: any[] = [];
    try {
      scenarios = JSON.parse(scenariosJson);
    } catch (e) {
      console.error('Failed to parse scenarios:', e);
      scenarios = [];
    }

    // Insert scenarios and emit WebSocket updates for each
    const insertedScenarios: any[] = [];
    const totalScenarios = scenarios.length;
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const scenarioId = uuidv4();
      const scenarioNow = new Date().toISOString();
      
      const scenarioData = {
        id: scenarioId,
        prd_id: prdId,
        title: scenario.title || 'Untitled Scenario',
        description: scenario.description || '',
        type: scenario.type || 'integration',
        priority: scenario.priority || 'medium',
        status: 'pending',
        steps: JSON.stringify(scenario.steps || []),
        test_data: JSON.stringify(scenario.testData || {}),
        tags: JSON.stringify(scenario.tags || []),
        created_at: scenarioNow,
        updated_at: scenarioNow,
      };
      
      createScenario(scenarioData);
      
      const insertedScenario = {
        id: scenarioId,
        ...scenario,
        status: 'pending',
      };
      
      insertedScenarios.push(insertedScenario);
      
      // Emit WebSocket: Scenario generated
      wsService.emitScenarioGenerated(prdId, insertedScenario, i + 1, totalScenarios);
    }

    // Update PRD status
    updatePrdStatus(prdId, 'completed');

    // Emit WebSocket: PRD processing complete
    wsService.emitPrdComplete(prdId, insertedScenarios.length);

    // Track telemetry
    const durationMs = Date.now() - startTime;
    telemetry.trackPrdUpload(prdId, insertedScenarios.length, durationMs);

    res.status(201).json({
      prd: {
        id: prdId,
        title,
        content,
        status: 'completed',
      },
      scenarios: insertedScenarios,
      message: `Generated ${insertedScenarios.length} test scenarios`,
    });
  } catch (error) {
    console.error('Error creating PRD:', error);
    
    // Emit WebSocket: Error
    if (prdId) {
      wsService.emitPrdError(prdId, (error as Error).message);
      updatePrdStatus(prdId, 'failed');
    }
    
    // Track error in telemetry
    telemetry.trackError('prd.upload', (error as Error).message);
    
    res.status(500).json({ error: 'Failed to create PRD and generate scenarios' });
  }
});

// Delete PRD
prdRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const success = deletePrd(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'PRD not found' });
    }
    
    // Track telemetry
    telemetry.track('prd.delete', { prdId: req.params.id });
    
    res.json({ message: 'PRD deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete PRD' });
  }
});
