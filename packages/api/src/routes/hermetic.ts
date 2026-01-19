import { Router, Request, Response } from 'express';
import { generateHermeticCode } from '../services/ollama';

export const hermeticRouter = Router();

// Generate Hermetic controller code using Ollama
hermeticRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { serviceName, controllerType, entities, dependencies, repoContext } = req.body;

    if (!serviceName) {
      return res.status(400).json({ error: 'serviceName is required' });
    }

    const validTypes = ['seed', 'reset', 'sample', 'config', 'docker', 'docs', 'fake'];
    const type = validTypes.includes(controllerType) ? controllerType : 'seed';

    console.log(`🤖 Generating Hermetic ${type} code for ${serviceName} with Ollama...`);

    const code = await generateHermeticCode({
      serviceName,
      controllerType: type,
      entities: entities || [],
      dependencies: dependencies || [],
      repoContext,
    });

    res.json({
      success: true,
      serviceName,
      controllerType: type,
      code,
    });
  } catch (error) {
    console.error('Error generating Hermetic code:', error);
    res.status(500).json({ error: 'Failed to generate Hermetic code' });
  }
});

// Analyze repository for Hermetic readiness
hermeticRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { repoStructure, dependencies, existingCode } = req.body;

    console.log('🔍 Analyzing repository for Hermetic readiness...');

    // This would analyze the repo and suggest what needs to be abstracted
    const analysis = await analyzeForHermetic(repoStructure, dependencies, existingCode);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error analyzing repository:', error);
    res.status(500).json({ error: 'Failed to analyze repository' });
  }
});

async function analyzeForHermetic(
  repoStructure: string,
  dependencies: string[],
  existingCode: string
): Promise<any> {
  // For now, return a mock analysis
  // In production, this would use Ollama to analyze the codebase
  return {
    readinessScore: 65,
    recommendations: [
      'Add interface abstractions for external service clients',
      'Implement dependency injection for database connections',
      'Create fake implementations for payment gateway',
    ],
    detectedDependencies: dependencies || ['database', 'cache', 'external-api'],
    suggestedEntities: ['User', 'Order', 'Product'],
  };
}
