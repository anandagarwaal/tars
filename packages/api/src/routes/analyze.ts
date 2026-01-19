import { Router, Request, Response } from 'express';
import { analyzeCode, summarizeContext, CodeContext, AnalysisRequest } from '../services/codeAnalyzer';

export const analyzeRouter = Router();

// Analyze code and return context
analyzeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { files, language, focusAreas } = req.body as AnalysisRequest;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }

    console.log(`🔍 Analyzing ${files.length} files...`);

    const context = await analyzeCode({ files, language, focusAreas });
    const summary = summarizeContext(context);

    res.json({
      success: true,
      context,
      summary,
    });
  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: 'Failed to analyze code' });
  }
});

// Quick analysis - just structure and dependencies
analyzeRouter.post('/quick', async (req: Request, res: Response) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }

    // Quick analysis without LLM
    const extensions: Record<string, number> = {};
    const sourceFiles: string[] = [];
    const testFiles: string[] = [];
    const configFiles: string[] = [];
    const dependencies: string[] = [];

    for (const file of files) {
      const path = file.path.toLowerCase();
      const ext = path.split('.').pop() || '';
      extensions[ext] = (extensions[ext] || 0) + 1;

      if (path.includes('test') || path.includes('spec')) {
        testFiles.push(file.path);
      } else if (['yml', 'yaml', 'json', 'xml'].includes(ext)) {
        configFiles.push(file.path);
      } else if (['java', 'ts', 'tsx', 'js', 'jsx'].includes(ext)) {
        sourceFiles.push(file.path);
      }

      // Extract package.json deps
      if (path.endsWith('package.json') && file.content) {
        try {
          const pkg = JSON.parse(file.content);
          dependencies.push(...Object.keys(pkg.dependencies || {}));
        } catch (e) {}
      }
    }

    // Detect language
    let language = 'unknown';
    if (extensions['java'] > 0) language = 'java';
    else if (extensions['ts'] > 0 || extensions['tsx'] > 0) language = 'typescript';
    else if (extensions['js'] > 0) language = 'javascript';

    // Detect framework hints
    let framework: string | undefined;
    const allContent = files.map(f => f.content || '').join('\n');
    
    if (allContent.includes('@SpringBootApplication')) framework = 'Spring Boot';
    else if (allContent.includes('express()')) framework = 'Express';
    else if (allContent.includes('createApp') && allContent.includes('vue')) framework = 'Vue';
    else if (allContent.includes('React') || allContent.includes('jsx')) framework = 'React';
    else if (allContent.includes('next/')) framework = 'Next.js';

    res.json({
      success: true,
      analysis: {
        language,
        framework,
        totalFiles: files.length,
        sourceFiles: sourceFiles.length,
        testFiles: testFiles.length,
        configFiles: configFiles.length,
        dependencies: [...new Set(dependencies)].slice(0, 20),
        extensions,
      },
    });
  } catch (error) {
    console.error('Error in quick analysis:', error);
    res.status(500).json({ error: 'Failed to analyze' });
  }
});

// Analyze for test generation recommendations
analyzeRouter.post('/for-testing', async (req: Request, res: Response) => {
  try {
    const { files, targetFile } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const context = await analyzeCode({ files });
    
    // Generate testing recommendations
    const recommendations = generateTestingRecommendations(context, targetFile);

    res.json({
      success: true,
      context: summarizeContext(context),
      recommendations,
    });
  } catch (error) {
    console.error('Error analyzing for testing:', error);
    res.status(500).json({ error: 'Failed to analyze for testing' });
  }
});

// Analyze for Hermetic onboarding
analyzeRouter.post('/for-hermetic', async (req: Request, res: Response) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const context = await analyzeCode({ files });
    
    // Generate Hermetic recommendations
    const hermeticAnalysis = analyzeForHermetic(context);

    res.json({
      success: true,
      context: summarizeContext(context),
      hermetic: hermeticAnalysis,
    });
  } catch (error) {
    console.error('Error analyzing for hermetic:', error);
    res.status(500).json({ error: 'Failed to analyze for hermetic' });
  }
});

function generateTestingRecommendations(context: CodeContext, targetFile?: string): any {
  const recommendations: any = {
    suggestedFramework: 'jest',
    suggestedTestTypes: ['unit'],
    coverageGaps: [],
    priorityTargets: [],
  };

  // Suggest framework based on language
  if (context.language === 'java') {
    recommendations.suggestedFramework = 'junit';
  } else if (context.framework === 'React' || context.framework === 'Next.js') {
    recommendations.suggestedFramework = 'jest';
    recommendations.suggestedTestTypes.push('component');
  }

  // Identify coverage gaps
  if (context.endpoints.length > 0 && context.existingTests.filter(t => t.type === 'integration').length === 0) {
    recommendations.coverageGaps.push('No integration tests for API endpoints');
    recommendations.suggestedTestTypes.push('integration');
  }

  // Priority targets
  if (context.interfaces.length > 0) {
    recommendations.priorityTargets.push(...context.interfaces.slice(0, 3).map(i => ({
      name: i.name,
      reason: 'Core interface with multiple methods',
      suggestedTests: i.methods.length,
    })));
  }

  if (context.endpoints.length > 0) {
    recommendations.priorityTargets.push(...context.endpoints.slice(0, 5).map(e => ({
      name: `${e.method} ${e.path}`,
      reason: 'API endpoint needs coverage',
      suggestedTests: 3, // happy path, error, edge case
    })));
  }

  return recommendations;
}

function analyzeForHermetic(context: CodeContext): any {
  const analysis: any = {
    readinessScore: 0,
    blockers: [],
    recommendations: [],
    detectedExternalDeps: [],
    suggestedFakes: [],
    entities: context.entities.map(e => e.name),
  };

  // Check for DI patterns
  const hasDI = context.patterns.some(p => 
    p.toLowerCase().includes('injection') || p.toLowerCase().includes('ioc')
  );
  
  if (hasDI) {
    analysis.readinessScore += 30;
  } else {
    analysis.blockers.push('No dependency injection detected - harder to swap implementations');
    analysis.recommendations.push('Add constructor-based dependency injection');
  }

  // Check for interface abstractions
  if (context.interfaces.length > 0) {
    analysis.readinessScore += 20;
  } else {
    analysis.blockers.push('No interface abstractions found');
    analysis.recommendations.push('Create interfaces for external service clients');
  }

  // Detect external dependencies that need faking
  const externalPatterns = ['http', 'client', 'gateway', 'service', 'repository', 'api'];
  for (const iface of context.interfaces) {
    if (externalPatterns.some(p => iface.name.toLowerCase().includes(p))) {
      analysis.detectedExternalDeps.push(iface.name);
      analysis.suggestedFakes.push(`Fake${iface.name}`);
    }
  }

  // Check dependencies for external services
  const externalDeps = ['axios', 'http', 'fetch', 'redis', 'kafka', 'rabbitmq', 'aws-sdk'];
  for (const dep of context.dependencies) {
    if (externalDeps.some(e => dep.toLowerCase().includes(e))) {
      analysis.detectedExternalDeps.push(dep);
      analysis.readinessScore -= 5; // External deps reduce readiness
    }
  }

  // Check existing tests
  if (context.existingTests.length > 0) {
    analysis.readinessScore += 10;
  }

  // Cap score
  analysis.readinessScore = Math.max(0, Math.min(100, analysis.readinessScore + 40)); // Base score of 40

  return analysis;
}
