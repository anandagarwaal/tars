// ============================================
// Ollama LLM Service with Caching
// ============================================

import { getCached, setCache, generatePrdCacheKey, getStatistics } from './cache';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ============================================
// Model Configuration by Task Type
// ============================================
// Each task type can use a different model optimized for that purpose
//
// SCENARIO_MODEL: For PRD analysis and test scenario generation
//   - Needs good reasoning, understanding of requirements
//   - Recommended: llama3.2:3b, llama3.1:8b, mistral:7b
//
// CODE_MODEL: For test code and hermetic code generation  
//   - Needs accurate syntax, code patterns
//   - Recommended: deepseek-coder:6.7b, codellama:7b, qwen2.5-coder:7b
//
// ANALYSIS_MODEL: For code analysis and pattern detection
//   - Needs understanding of code structure
//   - Recommended: deepseek-coder:6.7b, codellama:7b

const MODELS = {
  // Model for generating test scenarios from PRDs
  scenario: process.env.OLLAMA_SCENARIO_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:3b',
  
  // Model for generating test code (Jest, JUnit, etc.)
  code: process.env.OLLAMA_CODE_MODEL || process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b',
  
  // Model for generating hermetic setup code
  hermetic: process.env.OLLAMA_HERMETIC_MODEL || process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b',
  
  // Model for code analysis
  analysis: process.env.OLLAMA_ANALYSIS_MODEL || process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b',
};

// Default model (fallback)
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b';

// Export for status/health checks
export function getConfiguredModels() {
  return { ...MODELS, default: DEFAULT_MODEL };
}

// Cache TTL configuration (in hours)
const CACHE_TTL = {
  scenarios: 24 * 7,  // 7 days for PRD scenarios
  testCode: 24 * 3,   // 3 days for test code
  hermetic: 24 * 7,   // 7 days for hermetic configs
};

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

/**
 * Core Ollama API call (without caching)
 */
async function callOllama(
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_ctx: 8192,
      },
    } as OllamaGenerateRequest),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  return data.response;
}

/**
 * Generate with Ollama - with optional caching
 */
export async function generateWithOllama(
  prompt: string,
  model: string = DEFAULT_MODEL,
  options: { skipCache?: boolean; cacheKey?: string; ttlHours?: number } = {}
): Promise<string> {
  const { skipCache = false, cacheKey, ttlHours = 24 } = options;
  
  // Check cache first
  if (!skipCache) {
    const cached = getCached(cacheKey || prompt, model);
    if (cached) {
      return cached;
    }
  }
  
  // Generate new response
  try {
    const response = await callOllama(prompt, model);
    
    // Cache the response
    if (!skipCache) {
      setCache(cacheKey || prompt, model, response, ttlHours);
    }
    
    return response;
  } catch (error) {
    console.error('Ollama error:', error);
    throw error;
  }
}

/**
 * Generate test scenarios from PRD with caching
 */
export async function generateTestScenarios(
  prdContent: string,
  options: { skipCache?: boolean } = {}
): Promise<string> {
  const prompt = `You are a QA expert. Analyze the following Product Requirements Document (PRD) and generate comprehensive test scenarios.

For each requirement, generate test scenarios in the following JSON format:
[
  {
    "title": "Test scenario title",
    "description": "What this test validates",
    "type": "unit|integration|e2e",
    "priority": "high|medium|low",
    "steps": [
      {"action": "What action to take", "expected": "Expected result"}
    ],
    "testData": {"key": "sample test data"},
    "tags": ["relevant", "tags"]
  }
]

PRD Content:
${prdContent}

Generate test scenarios covering:
1. Happy path scenarios (positive tests)
2. Edge cases and boundary conditions
3. Error handling scenarios (negative tests)
4. Integration points

Return ONLY the JSON array, no additional text.`;

  // Generate semantic cache key for better hit rates on similar PRDs
  const cacheKey = `scenarios:${generatePrdCacheKey(prdContent)}`;

  try {
    // Use scenario model (optimized for reasoning/understanding)
    const response = await generateWithOllama(prompt, MODELS.scenario, {
      skipCache: options.skipCache,
      cacheKey,
      ttlHours: CACHE_TTL.scenarios,
    });
    console.log(`📋 Generated scenarios using model: ${MODELS.scenario}`);
    return response;
  } catch (error) {
    // Return mock response for demo if Ollama is not available
    console.log('⚠️ Ollama not available, using mock scenarios');
    return generateMockScenarios();
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStatistics() {
  return getStatistics();
}

function generateMockScenarios(): string {
  return JSON.stringify([
    {
      title: 'User Authentication Flow',
      description: 'Test user login with valid credentials',
      type: 'integration',
      priority: 'high',
      steps: [
        { action: 'Navigate to login page', expected: 'Login form is displayed' },
        { action: 'Enter valid email and password', expected: 'Credentials are accepted' },
        { action: 'Click login button', expected: 'User is redirected to dashboard' },
      ],
      testData: {
        validUser: { email: 'test@example.com', password: 'password123' },
      },
      tags: ['auth', 'critical-path'],
    },
    {
      title: 'Invalid Login Attempt',
      description: 'Test login with invalid credentials',
      type: 'unit',
      priority: 'medium',
      steps: [
        { action: 'Navigate to login page', expected: 'Login form is displayed' },
        { action: 'Enter invalid credentials', expected: 'Error message is displayed' },
      ],
      testData: {
        invalidUser: { email: 'wrong@example.com', password: 'wrongpass' },
      },
      tags: ['auth', 'negative-test'],
    },
  ]);
}

export async function generateTestCode(
  scenario: any,
  framework: string,
  repoContext?: string,
  options: { skipCache?: boolean } = {}
): Promise<string> {
  const frameworkGuide = getFrameworkGuide(framework);
  
  const prompt = `You are an expert test engineer. Generate production-ready ${framework} test code for this test scenario.

## Test Scenario
Title: ${scenario.title}
Description: ${scenario.description}
Type: ${scenario.type}
Priority: ${scenario.priority}

## Test Steps
${scenario.steps?.map((s: any, i: number) => `${i + 1}. Action: ${s.action}\n   Expected: ${s.expected}`).join('\n') || 'No steps defined'}

## Test Data
${JSON.stringify(scenario.testData || {}, null, 2)}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Framework Requirements (${framework})
${frameworkGuide}

## Instructions
1. Generate complete, runnable test code
2. Include proper imports at the top
3. Use descriptive test names
4. Implement actual assertions (not just assertTrue(true))
5. Use the provided test data
6. Add setup/teardown if needed
7. Include comments explaining the test logic
8. Handle async operations properly
9. Follow ${framework} best practices

Generate ONLY the complete test code file, no explanations before or after.`;

  // Generate cache key based on scenario content and framework
  const scenarioHash = JSON.stringify({
    title: scenario.title,
    description: scenario.description,
    steps: scenario.steps,
    framework,
  });
  const cacheKey = `testcode:${framework}:${Buffer.from(scenarioHash).toString('base64').substring(0, 32)}`;

  try {
    // Use code model (optimized for syntax accuracy)
    const response = await generateWithOllama(prompt, MODELS.code, {
      skipCache: options.skipCache,
      cacheKey,
      ttlHours: CACHE_TTL.testCode,
    });
    console.log(`🧪 Generated test code using model: ${MODELS.code}`);
    return cleanCodeResponse(response, framework);
  } catch (error) {
    console.log('⚠️ Ollama not available, using template fallback');
    return generateFallbackTestCode(scenario, framework);
  }
}

function getFrameworkGuide(framework: string): string {
  const guides: Record<string, string> = {
    jest: `
- Use describe() for test suites, it() or test() for individual tests
- Use beforeEach/afterEach for setup/teardown
- Use expect() with matchers like toBe(), toEqual(), toHaveBeenCalled()
- For async tests, use async/await or return promises
- Mock functions with jest.fn() and jest.mock()
- Use TypeScript syntax (.test.ts file)`,

    junit: `
- Use @Test annotation for test methods
- Use @BeforeEach/@AfterEach for setup/teardown
- Use @DisplayName for readable test names
- Use assertions from org.junit.jupiter.api.Assertions
- Use @Nested for grouping related tests
- Use @ParameterizedTest for data-driven tests
- Package: com.example.tests`,

    testng: `
- Use @Test annotation for test methods
- Use @BeforeMethod/@AfterMethod for setup/teardown
- Use assertions from org.testng.Assert
- Use @DataProvider for parameterized tests
- Use groups for test categorization
- Package: com.example.tests`,

    cypress: `
- Use describe() and it() for test structure
- Use cy.visit() to navigate to pages
- Use cy.get() with selectors to find elements
- Use .click(), .type(), .should() for interactions
- Use cy.intercept() for API mocking
- Use beforeEach() for common setup`,

    playwright: `
- Use test.describe() and test() for structure
- Use page.goto() for navigation
- Use page.locator() to find elements
- Use await for all async operations
- Use expect() with locator assertions
- Use test.beforeEach() for setup`,

    mocha: `
- Use describe() and it() for test structure
- Use before/after/beforeEach/afterEach hooks
- Use chai expect() or assert for assertions
- Return promises or use done() for async
- Use TypeScript syntax`,
  };

  return guides[framework] || guides.jest;
}

function cleanCodeResponse(response: string, framework: string): string {
  // Remove markdown code blocks if present
  let code = response
    .replace(/^```(?:typescript|javascript|java|ts|js)?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();

  // If the response doesn't look like code, return a fallback
  if (!code.includes('test') && !code.includes('it(') && !code.includes('@Test')) {
    return code;
  }

  return code;
}

function generateFallbackTestCode(scenario: any, framework: string): string {
  const steps = scenario.steps || [];
  const testData = JSON.stringify(scenario.testData || {}, null, 2);

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

    // Test data
    private static final String TEST_DATA = """
        ${testData}
        """;

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
    void test${toClassName(step.action)}() {
        // Action: ${step.action}
        // Expected: ${step.expected}
        
        // TODO: Implement with actual service calls
        // Example:
        // var result = service.performAction();
        // assertEquals(expected, result);
        
        fail("Test not implemented yet");
    }
`).join('\n')}
}`;
  }

  // Default to Jest/TypeScript
  return `/**
 * ${scenario.title}
 * ${scenario.description}
 * 
 * Generated by TARS - Test Automation and Review System
 */

describe('${scenario.title}', () => {
  // Test data
  const testData = ${testData};

  beforeEach(() => {
    // Setup test environment
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
  });

${steps.map((step: any) => `
  it('should ${step.action.toLowerCase()}', async () => {
    // Action: ${step.action}
    // Expected: ${step.expected}
    
    // TODO: Implement with actual service/component calls
    // Example:
    // const result = await service.performAction(testData);
    // expect(result).toEqual(expectedValue);
    
    throw new Error('Test not implemented yet');
  });
`).join('\n')}
});
`;
}

function toClassName(title: string): string {
  return title
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '');
}

// ============================================
// Hermetic Server Code Generation
// ============================================

interface HermeticCodeRequest {
  serviceName: string;
  controllerType: 'seed' | 'reset' | 'sample' | 'config' | 'docker' | 'docs' | 'fake' | 'tracing' | 'maven' | 'gradle';
  entities?: string[];
  dependencies?: string[];
  repoContext?: string;
}

export async function generateHermeticCode(
  request: HermeticCodeRequest & { skipCache?: boolean }
): Promise<string> {
  const { serviceName, controllerType, entities, dependencies, repoContext, skipCache } = request;

  const prompts: Record<string, string> = {
    seed: getSeedControllerPrompt(serviceName, entities || [], repoContext),
    reset: getResetControllerPrompt(serviceName, entities || [], repoContext),
    sample: getSampleDataPrompt(serviceName, entities || [], repoContext),
    config: getConfigPrompt(serviceName, dependencies || []),
    docker: getDockerPrompt(serviceName),
    docs: getDocsPrompt(serviceName, entities || [], dependencies || []),
    fake: getFakeImplementationPrompt(serviceName, dependencies || [], repoContext),
    tracing: getTracingFilterPrompt(serviceName, repoContext),
    maven: getMavenProfilePrompt(serviceName),
    gradle: getGradleProfilePrompt(serviceName),
  };

  const prompt = prompts[controllerType] || prompts.seed;

  // Generate cache key based on service config
  const cacheKey = `hermetic:${serviceName}:${controllerType}:${(entities || []).join(',')}:${(dependencies || []).join(',')}`;

  try {
    // Use hermetic model (optimized for code generation)
    const response = await generateWithOllama(prompt, MODELS.hermetic, {
      skipCache,
      cacheKey,
      ttlHours: CACHE_TTL.hermetic,
    });
    console.log(`🔒 Generated hermetic code using model: ${MODELS.hermetic}`);
    return cleanCodeResponse(response, 'java');
  } catch (error) {
    console.log('⚠️ Ollama not available, using template fallback for Hermetic');
    return generateHermeticFallback(serviceName, controllerType, entities || [], dependencies || []);
  }
}

function getSeedControllerPrompt(serviceName: string, entities: string[], repoContext?: string): string {
  return `You are an expert Java/Spring Boot developer specializing in hermetic testing environments.

Generate a production-ready SeedEntitiesController for a hermetic server.

## Service Details
- Service Name: ${serviceName}
- Entities to support: ${entities.length > 0 ? entities.join(', ') : 'User, Order, Product (default)'}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Requirements
1. Create a Spring REST controller with @Profile("hermetic")
2. POST /hermetic/seedEntities endpoint that accepts a list of entities
3. Support different entity types dynamically
4. Include proper validation and error handling
5. Use dependency injection for repositories/services
6. Add Javadoc comments explaining usage
7. Include example request/response in comments
8. Handle concurrent seeding safely
9. Return detailed response with seeded entity IDs

## Code Style
- Use Java 17+ features
- Follow Spring Boot best practices
- Include proper logging
- Use ResponseEntity for responses
- Handle exceptions gracefully

Generate ONLY the complete Java file, no explanations.`;
}

function getResetControllerPrompt(serviceName: string, entities: string[], repoContext?: string): string {
  return `You are an expert Java/Spring Boot developer specializing in hermetic testing environments.

Generate a production-ready ResetDataController for a hermetic server.

## Service Details
- Service Name: ${serviceName}
- Entities to reset: ${entities.length > 0 ? entities.join(', ') : 'all entities'}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Requirements
1. Create a Spring REST controller with @Profile("hermetic")
2. POST /hermetic/reset endpoint to reset all data
3. POST /hermetic/reset/{entityType} to reset specific entity type
4. Clear all seeded/modified data
5. Optionally restore base test data
6. Use transactions for data integrity
7. Add proper logging for debugging
8. Return status of reset operation

## Code Style
- Use Java 17+ features
- Follow Spring Boot best practices
- Include @Transactional where needed
- Handle exceptions gracefully

Generate ONLY the complete Java file, no explanations.`;
}

function getSampleDataPrompt(serviceName: string, entities: string[], repoContext?: string): string {
  return `You are an expert Java/Spring Boot developer.

Generate a SampleDataController that provides sample/fixture data for testing.

## Service Details
- Service Name: ${serviceName}
- Entities: ${entities.length > 0 ? entities.join(', ') : 'User, Order, Product'}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Requirements
1. GET /hermetic/sample-data endpoint listing all available samples
2. GET /hermetic/sample-data/{entityType} for specific entity samples
3. Return realistic but deterministic test data
4. Support pagination for large datasets
5. Include data variations (valid, edge cases)
6. Add proper Javadoc documentation

Generate ONLY the complete Java file, no explanations.`;
}

function getConfigPrompt(serviceName: string, dependencies: string[]): string {
  return `Generate a Spring Boot application-hermetic.yml configuration file.

## Service: ${serviceName}
## Dependencies to mock/replace: ${dependencies.length > 0 ? dependencies.join(', ') : 'database, cache, external-apis'}

## Requirements
1. Configure H2 in-memory database
2. Disable/mock external service calls
3. Enable detailed logging for debugging
4. Configure fast startup
5. Enable H2 console for inspection
6. Set appropriate timeouts
7. Include comments explaining each section

Generate ONLY the YAML file, no explanations.`;
}

function getDockerPrompt(serviceName: string): string {
  return `Generate a Dockerfile.hermetic for building a hermetic server image.

## Service: ${serviceName}

## Requirements
1. Use multi-stage build for smaller image
2. Use eclipse-temurin:17-jre-alpine base
3. Add proper labels (maintainer, service, type=hermetic)
4. Include health check
5. Set appropriate JVM flags for testing
6. Add WARNING comment that this should NOT be promoted to production
7. Configure for fast startup

Generate ONLY the Dockerfile, no explanations.`;
}

function getDocsPrompt(serviceName: string, entities: string[], dependencies: string[]): string {
  return `Generate comprehensive hermetic server documentation in Markdown.

## Service: ${serviceName}
## Entities: ${entities.join(', ') || 'User, Order, Product'}
## Dependencies: ${dependencies.join(', ') || 'database, cache, external-api'}

## Include
1. Overview of hermetic testing concept
2. Quick start guide with commands
3. API documentation with curl examples
4. Entity seeding examples
5. Reset operations
6. Troubleshooting section
7. Best practices for hermetic testing

Generate ONLY the Markdown documentation, no additional text.`;
}

function getFakeImplementationPrompt(serviceName: string, dependencies: string[], repoContext?: string): string {
  return `You are an expert Java developer creating fake implementations for hermetic testing.

## Service: ${serviceName}
## Dependencies to fake: ${dependencies.length > 0 ? dependencies.join(', ') : 'PaymentGateway, EmailService, ExternalAPI'}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Requirements
1. Create interface + fake implementation for each dependency
2. Fake should be deterministic and fast
3. Support configurable responses for different test scenarios
4. Include in-memory state management
5. Add @Profile("hermetic") annotation
6. Implement all interface methods
7. Add logging for debugging
8. Support failure injection for negative testing

Generate ONLY the Java code with all fake implementations, no explanations.`;
}

function getTracingFilterPrompt(serviceName: string, repoContext?: string): string {
  return `You are an expert Java/Spring Boot developer creating a request/response tracing filter for hermetic testing environments.

## Service: ${serviceName}

${repoContext ? `## Repository Context\n${repoContext}` : ''}

## Requirements
Create a production-ready RequestTracingFilter that:
1. Implements javax.servlet.Filter (or Spring OncePerRequestFilter)
2. Logs full request details: method, URI, headers, body
3. Logs full response details: status, headers, body
4. Uses @Profile("hermetic") so it only activates in hermetic mode
5. Assigns unique trace ID to each request (MDC)
6. Calculates and logs request duration
7. Wraps request/response to enable body reading (ContentCachingRequestWrapper)
8. Truncates large bodies (configurable max length)
9. Masks sensitive headers (Authorization, Cookie, etc.)
10. Outputs structured JSON logs for easy parsing
11. Includes correlation ID support for distributed tracing
12. Has configurable log level (DEBUG for body, INFO for summary)

## Code Style
- Use Java 17+ features
- Follow Spring Boot best practices
- Include comprehensive Javadoc
- Add proper exception handling

Generate ONLY the complete Java file, no explanations.`;
}

function getMavenProfilePrompt(serviceName: string): string {
  return `You are an expert Maven/Java developer. Generate a Maven pom.xml profile section for building a hermetic server.

## Service: ${serviceName}

## Requirements
Generate a Maven profile that:
1. Profile ID: "hermetic"
2. Activates with -Pharmetic flag
3. Includes H2 database dependency for in-memory DB
4. Sets spring.profiles.active to "hermetic"
5. Configures JAR name to "${serviceName}-hermetic.jar"
6. Includes test dependencies in compile scope (for fake implementations)
7. Configures Spring Boot Maven Plugin with hermetic classifier
8. Excludes production-only dependencies
9. Sets up resource filtering for hermetic configs
10. Includes build timestamp and version info

## Output Format
Generate ONLY the <profile>...</profile> XML section that can be added to the <profiles> section of pom.xml.
Include XML comments explaining each configuration.
Do not include the outer <profiles> tag.`;
}

function getGradleProfilePrompt(serviceName: string): string {
  return `You are an expert Gradle/Java developer. Generate Gradle build configuration for a hermetic server build.

## Service: ${serviceName}

## Requirements
Generate Gradle (Kotlin DSL preferred, Groovy also acceptable) that:
1. Creates a "hermetic" source set
2. Creates a "bootHermeticJar" task
3. Includes H2 database dependency for hermetic configuration
4. Sets spring.profiles.active to "hermetic" in manifest
5. Configures JAR name to "${serviceName}-hermetic.jar"
6. Includes test dependencies in hermetic configuration
7. Creates a "runHermetic" task for local testing
8. Excludes production-only dependencies from hermetic build
9. Adds hermetic-specific resource processing
10. Supports both Kotlin DSL (build.gradle.kts) and Groovy (build.gradle)

## Output Format
Generate the complete Gradle configuration block that can be appended to build.gradle.kts.
Include comments explaining each configuration.
Use Kotlin DSL syntax.`;
}

function generateHermeticFallback(
  serviceName: string,
  controllerType: string,
  entities: string[],
  dependencies: string[]
): string {
  const packageName = `com.example.${serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')}.hermetic`;
  
  if (controllerType === 'seed') {
    return `package ${packageName};

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;

/**
 * Hermetic Server - Seed Entities Controller
 * Service: ${serviceName}
 * 
 * Endpoints:
 * - POST /hermetic/seedEntities - Seed test data
 * 
 * Generated by TARS - Test Automation and Review System
 */
@RestController
@RequestMapping("/hermetic")
@Profile("hermetic")
public class SeedEntitiesController {
    
    private static final Logger log = LoggerFactory.getLogger(SeedEntitiesController.class);
    
    // In-memory storage for seeded entities
    private final Map<String, List<Map<String, Object>>> seededData = new ConcurrentHashMap<>();

    @PostMapping("/seedEntities")
    public ResponseEntity<Map<String, Object>> seedEntities(@RequestBody SeedRequest request) {
        log.info("Seeding {} entities", request.getEntities().size());
        
        List<String> seededIds = new ArrayList<>();
        
        for (EntityData entity : request.getEntities()) {
            String type = entity.getEntityType();
            seededData.computeIfAbsent(type, k -> new ArrayList<>());
            seededData.get(type).add(Map.of(
                "id", entity.getEntityId(),
                "type", type,
                "value", entity.getEntityValue()
            ));
            seededIds.add(entity.getEntityId());
            log.debug("Seeded {}: {}", type, entity.getEntityId());
        }
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "seededCount", seededIds.size(),
            "seededIds", seededIds
        ));
    }
    
    @GetMapping("/seeded/{entityType}")
    public ResponseEntity<List<Map<String, Object>>> getSeeded(@PathVariable String entityType) {
        return ResponseEntity.ok(seededData.getOrDefault(entityType, List.of()));
    }
}

record SeedRequest(List<EntityData> entities) {
    public List<EntityData> getEntities() { return entities != null ? entities : List.of(); }
}

record EntityData(String entityId, String entityType, Object entityValue) {
    public String getEntityId() { return entityId; }
    public String getEntityType() { return entityType; }
    public Object getEntityValue() { return entityValue; }
}`;
  }

  if (controllerType === 'reset') {
    return `package ${packageName};

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;

/**
 * Hermetic Server - Reset Data Controller
 * Service: ${serviceName}
 * 
 * Generated by TARS
 */
@RestController
@RequestMapping("/hermetic")
@Profile("hermetic")
public class ResetDataController {
    
    private static final Logger log = LoggerFactory.getLogger(ResetDataController.class);

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetAll() {
        log.info("Resetting hermetic server to base state");
        // TODO: Inject and clear all repositories
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Server reset to base state"
        ));
    }
    
    @PostMapping("/reset/{entityType}")
    public ResponseEntity<Map<String, Object>> resetEntity(@PathVariable String entityType) {
        log.info("Resetting entity type: {}", entityType);
        // TODO: Clear specific entity repository
        return ResponseEntity.ok(Map.of(
            "success", true,
            "entityType", entityType,
            "message", "Entity type reset"
        ));
    }
}`;
  }

  // Default fallback
  return `// Hermetic code for ${serviceName} - ${controllerType}
// Generated by TARS (fallback template)
// TODO: Implement ${controllerType} logic`;
}
