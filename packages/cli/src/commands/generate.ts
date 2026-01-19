import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { collectFiles, FileInfo } from './analyze';

const API_URL = process.env.TARS_API_URL || 'http://localhost:3001';

export const generateCommand = new Command('generate')
  .description('Generate test cases from approved scenarios')
  .requiredOption('--prd <prdId>', 'PRD ID to generate tests from')
  .option('--framework <framework>', 'Test framework (jest, junit, testng, cypress, playwright)', 'jest')
  .option('--type <type>', 'Test type (unit, integration, e2e)', 'unit')
  .option('--output <path>', 'Output directory', './generated-tests')
  .option('--repo <path>', 'Repository path to analyze for context', '.')
  .option('--use-ai', 'Use Ollama AI for intelligent test generation (default: true)', true)
  .option('--no-ai', 'Use template-based generation instead of AI')
  .option('--analyze', 'Analyze repository before generating (improves quality)', true)
  .option('--no-analyze', 'Skip repository analysis')
  .action(async (options) => {
    console.log('\n🧪 TARS Test Generator\n');
    console.log(`   PRD ID:     ${options.prd}`);
    console.log(`   Framework:  ${options.framework}`);
    console.log(`   Type:       ${options.type}`);
    console.log(`   Output:     ${options.output}`);
    console.log(`   AI Mode:    ${options.ai ? '🤖 Ollama' : '📝 Template'}`);
    console.log(`   Analysis:   ${options.analyze ? '✅ Enabled' : '⏭️ Skipped'}`);
    console.log('');

    try {
      // Step 1: Analyze repository for context (if enabled)
      let codeContext: string | undefined;
      
      if (options.analyze && options.ai) {
        console.log('🔍 Analyzing repository for context...');
        const repoPath = path.resolve(options.repo);
        const files = collectFiles(repoPath, 30);
        
        if (files.length > 0) {
          try {
            const analysisResponse = await fetch(`${API_URL}/api/analyze/for-testing`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files }),
            });
            
            if (analysisResponse.ok) {
              const analysis = await analysisResponse.json() as any;
              codeContext = analysis.context;
              console.log(`   ✅ Analyzed ${files.length} files`);
              
              // Show recommendations
              if (analysis.recommendations) {
                console.log(`   📋 Suggested framework: ${analysis.recommendations.suggestedFramework}`);
                if (analysis.recommendations.coverageGaps?.length > 0) {
                  console.log(`   ⚠️  Coverage gaps detected`);
                }
              }
            }
          } catch (e) {
            console.log('   ⚠️  Analysis skipped (API unavailable)');
          }
        }
        console.log('');
      }

      // Step 2: Fetch scenarios from API
      console.log('📡 Fetching approved scenarios...');
      const response = await fetch(`${API_URL}/api/scenarios?prdId=${options.prd}&status=approved`);
      
      if (!response.ok) {
        console.log('⚠️  API not available, using demo scenarios...');
        const scenarios = getMockScenarios();
        await generateTests(scenarios, options, codeContext);
        return;
      }

      const scenarios = await response.json() as any[];
      
      if (!scenarios || scenarios.length === 0) {
        console.log('⚠️  No approved scenarios found for this PRD');
        console.log('   Tip: Approve scenarios in the web portal first');
        return;
      }

      await generateTests(scenarios, options, codeContext);
    } catch (error) {
      console.log('⚠️  API connection failed, using demo scenarios...');
      const scenarios = getMockScenarios();
      await generateTests(scenarios, options);
    }
  });

async function generateTests(scenarios: any[], options: any, codeContext?: string) {
  console.log(`\n📝 Generating ${scenarios.length} test files...\n`);

  // Create output directory
  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const generatedFiles: string[] = [];

  for (const scenario of scenarios) {
    const fileName = generateFileName(scenario.title, options.framework);
    const filePath = path.join(outputDir, fileName);

    let testCode: string;

    if (options.ai) {
      // Use Ollama AI for intelligent test generation with code context
      console.log(`   🤖 AI generating: ${scenario.title}...`);
      testCode = await generateWithOllama(scenario, options.framework, codeContext);
    } else {
      // Use template-based generation
      testCode = generateWithTemplate(scenario, options.framework);
    }

    fs.writeFileSync(filePath, testCode);
    generatedFiles.push(fileName);
    console.log(`   ✅ ${fileName}`);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✨ Generated ${generatedFiles.length} test files in ${outputDir}`);
  console.log('');
  console.log('Next steps:');
  console.log(`   1. Review generated tests in ${options.output}`);
  console.log('   2. Run tests with your test runner');
  console.log('   3. Commit changes to your repository');
  console.log('');
}

async function generateWithOllama(scenario: any, framework: string, repoContext?: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/generate/test-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        scenario, 
        framework,
        repoContext, // Pass the code analysis context
      }),
    });

    if (!response.ok) {
      console.log('   ⚠️  AI unavailable, using template...');
      return generateWithTemplate(scenario, framework);
    }

    const result = await response.json() as any;
    return result.testCode;
  } catch (error) {
    console.log('   ⚠️  AI error, using template...');
    return generateWithTemplate(scenario, framework);
  }
}

function generateWithTemplate(scenario: any, framework: string): string {
  const steps = scenario.steps || [];
  const testData = JSON.stringify(scenario.testData || scenario.test_data || {}, null, 2);

  if (framework === 'junit') {
    return `package com.example.tests;

import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * ${scenario.title}
 * ${scenario.description}
 * 
 * Generated by TARS - Test Automation and Review System
 */
@DisplayName("${scenario.title}")
class ${toClassName(scenario.title)}Test {

    @BeforeEach
    void setUp() {
        // Initialize test dependencies
    }

    @AfterEach
    void tearDown() {
        // Clean up resources
    }

${steps.map((step: any, i: number) => `
    @Test
    @DisplayName("${step.action}")
    void test${i + 1}_${toMethodName(step.action)}() {
        // Action: ${step.action}
        // Expected: ${step.expected}
        
        // TODO: Implement test logic
        assertTrue(true, "Test not implemented");
    }
`).join('\n')}
}`;
  }

  if (framework === 'cypress') {
    return `/**
 * ${scenario.title}
 * ${scenario.description}
 * 
 * Generated by TARS - Test Automation and Review System
 */

describe('${scenario.title}', () => {
  const testData = ${testData};

  beforeEach(() => {
    cy.visit('/');
  });

${steps.map((step: any) => `
  it('should ${step.action.toLowerCase()}', () => {
    // Action: ${step.action}
    // Expected: ${step.expected}
    
    // TODO: Implement Cypress commands
    cy.log('${step.action}');
  });
`).join('\n')}
});
`;
  }

  // Default: Jest/TypeScript
  return `/**
 * ${scenario.title}
 * ${scenario.description}
 * 
 * Generated by TARS - Test Automation and Review System
 */

describe('${scenario.title}', () => {
  const testData = ${testData};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
  });

${steps.map((step: any) => `
  it('should ${step.action.toLowerCase()}', async () => {
    // Action: ${step.action}
    // Expected: ${step.expected}
    
    // TODO: Implement test logic
    expect(true).toBe(true);
  });
`).join('\n')}
});
`;
}

function getMockScenarios() {
  return [
    {
      id: 'demo-1',
      title: 'User Authentication Flow',
      description: 'Test user login with valid credentials',
      type: 'integration',
      steps: [
        { action: 'Navigate to login page', expected: 'Login form is displayed' },
        { action: 'Enter valid credentials', expected: 'Credentials accepted' },
        { action: 'Submit login form', expected: 'Redirect to dashboard' },
      ],
      testData: { email: 'test@example.com', password: 'password123' },
    },
    {
      id: 'demo-2',
      title: 'User Registration',
      description: 'Test new user registration',
      type: 'integration',
      steps: [
        { action: 'Navigate to registration', expected: 'Form displayed' },
        { action: 'Fill registration form', expected: 'Form accepts input' },
        { action: 'Submit registration', expected: 'Account created' },
      ],
      testData: { email: 'new@example.com', name: 'Test User' },
    },
  ];
}

function generateFileName(title: string, framework: string): string {
  const baseName = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  switch (framework) {
    case 'jest':
      return `${baseName}.test.ts`;
    case 'junit':
    case 'testng':
      return `${toClassName(title)}Test.java`;
    case 'cypress':
      return `${baseName}.cy.ts`;
    case 'playwright':
      return `${baseName}.spec.ts`;
    default:
      return `${baseName}.test.ts`;
  }
}

function toClassName(title: string): string {
  return title
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function toMethodName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
