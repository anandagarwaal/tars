// ============================================
// Code Analysis Service
// ============================================

import { generateWithOllama, getConfiguredModels } from './ollama';

export interface CodeContext {
  language: 'java' | 'typescript' | 'javascript' | 'unknown';
  framework?: string;
  buildTool?: string;
  structure: FileStructure;
  dependencies: string[];
  interfaces: InterfaceInfo[];
  endpoints: EndpointInfo[];
  entities: EntityInfo[];
  existingTests: TestInfo[];
  patterns: string[];
}

export interface FileStructure {
  sourceFiles: string[];
  testFiles: string[];
  configFiles: string[];
  totalFiles: number;
}

export interface InterfaceInfo {
  name: string;
  methods: string[];
  filePath: string;
}

export interface EndpointInfo {
  method: string;
  path: string;
  handler: string;
  filePath: string;
}

export interface EntityInfo {
  name: string;
  fields: string[];
  filePath: string;
}

export interface TestInfo {
  name: string;
  type: 'unit' | 'integration' | 'e2e';
  framework: string;
  filePath: string;
}

export interface AnalysisRequest {
  files: FileContent[];
  language?: string;
  focusAreas?: string[];
}

export interface FileContent {
  path: string;
  content: string;
}

/**
 * Analyze code structure and extract context for better generation
 */
export async function analyzeCode(request: AnalysisRequest): Promise<CodeContext> {
  const { files, language } = request;
  
  // Detect language if not provided
  const detectedLanguage = language || detectLanguage(files);
  
  // Extract structure
  const structure = analyzeStructure(files);
  
  // Extract dependencies
  const dependencies = extractDependencies(files, detectedLanguage);
  
  // Use LLM for deeper analysis
  const llmAnalysis = await analyzewithLLM(files, detectedLanguage);
  
  return {
    language: detectedLanguage as CodeContext['language'],
    framework: llmAnalysis.framework,
    buildTool: detectBuildTool(files),
    structure,
    dependencies,
    interfaces: llmAnalysis.interfaces,
    endpoints: llmAnalysis.endpoints,
    entities: llmAnalysis.entities,
    existingTests: analyzeExistingTests(files),
    patterns: llmAnalysis.patterns,
  };
}

/**
 * Detect programming language from file extensions
 */
function detectLanguage(files: FileContent[]): string {
  const extensions: Record<string, number> = {};
  
  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    extensions[ext] = (extensions[ext] || 0) + 1;
  }
  
  if (extensions['java'] > 0) return 'java';
  if (extensions['ts'] > 0 || extensions['tsx'] > 0) return 'typescript';
  if (extensions['js'] > 0 || extensions['jsx'] > 0) return 'javascript';
  
  return 'unknown';
}

/**
 * Detect build tool from config files
 */
function detectBuildTool(files: FileContent[]): string | undefined {
  const fileNames = files.map(f => f.path.split('/').pop());
  
  if (fileNames.includes('pom.xml')) return 'maven';
  if (fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) return 'gradle';
  if (fileNames.includes('package.json')) return 'npm';
  
  return undefined;
}

/**
 * Analyze file structure
 */
function analyzeStructure(files: FileContent[]): FileStructure {
  const sourceFiles: string[] = [];
  const testFiles: string[] = [];
  const configFiles: string[] = [];
  
  for (const file of files) {
    const path = file.path.toLowerCase();
    
    if (path.includes('test') || path.includes('spec')) {
      testFiles.push(file.path);
    } else if (path.endsWith('.yml') || path.endsWith('.yaml') || path.endsWith('.json') || path.endsWith('.xml')) {
      configFiles.push(file.path);
    } else if (path.endsWith('.java') || path.endsWith('.ts') || path.endsWith('.js')) {
      sourceFiles.push(file.path);
    }
  }
  
  return {
    sourceFiles,
    testFiles,
    configFiles,
    totalFiles: files.length,
  };
}

/**
 * Extract dependencies from package files
 */
function extractDependencies(files: FileContent[], language: string): string[] {
  const deps: string[] = [];
  
  for (const file of files) {
    const fileName = file.path.split('/').pop() || '';
    
    // package.json (Node.js)
    if (fileName === 'package.json') {
      try {
        const pkg = JSON.parse(file.content);
        deps.push(...Object.keys(pkg.dependencies || {}));
        deps.push(...Object.keys(pkg.devDependencies || {}));
        deps.push(...Object.keys(pkg.peerDependencies || {}));
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // pom.xml (Maven/Java)
    if (fileName === 'pom.xml') {
      const artifactMatches = file.content.match(/<artifactId>([^<]+)<\/artifactId>/g) || [];
      for (const match of artifactMatches) {
        const id = match.replace(/<\/?artifactId>/g, '');
        if (!id.includes('${')) deps.push(id);
      }
    }
    
    // build.gradle / build.gradle.kts (Gradle/Java/Kotlin)
    if (fileName.includes('build.gradle')) {
      const implMatches = file.content.match(/implementation\s*\(?['"]([^'"]+)['"]\)?/g) || [];
      const apiMatches = file.content.match(/api\s*\(?['"]([^'"]+)['"]\)?/g) || [];
      const testMatches = file.content.match(/testImplementation\s*\(?['"]([^'"]+)['"]\)?/g) || [];
      
      for (const match of [...implMatches, ...apiMatches, ...testMatches]) {
        const dep = match.replace(/\w+\s*\(?['"]/, '').replace(/['"]\)?/, '');
        deps.push(dep.split(':')[1] || dep);
      }
    }
    
    // requirements.txt (Python)
    if (fileName === 'requirements.txt' || fileName.endsWith('requirements.txt')) {
      const lines = file.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          // Extract package name (before ==, >=, etc.)
          const pkgName = trimmed.split(/[=<>!~\[]/)[0].trim();
          if (pkgName) deps.push(pkgName);
        }
      }
    }
    
    // pyproject.toml (Python)
    if (fileName === 'pyproject.toml') {
      const depMatches = file.content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depMatches) {
        const depsStr = depMatches[1];
        const pkgMatches = depsStr.match(/["']([^"']+)["']/g) || [];
        for (const match of pkgMatches) {
          const pkg = match.replace(/["']/g, '').split(/[=<>!~\[]/)[0].trim();
          if (pkg) deps.push(pkg);
        }
      }
    }
    
    // go.mod (Go)
    if (fileName === 'go.mod') {
      const requireMatches = file.content.match(/require\s+\([\s\S]*?\)|require\s+\S+/g) || [];
      for (const match of requireMatches) {
        const lines = match.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0] && !parts[0].includes('require') && !parts[0].includes('(') && !parts[0].includes(')')) {
            deps.push(parts[0].split('/').pop() || parts[0]);
          }
        }
      }
    }
    
    // Cargo.toml (Rust)
    if (fileName === 'Cargo.toml') {
      const depSection = file.content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depSection) {
        const lines = depSection[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^(\w+)\s*=/);
          if (match) deps.push(match[1]);
        }
      }
    }
    
    // Gemfile (Ruby)
    if (fileName === 'Gemfile') {
      const gemMatches = file.content.match(/gem\s+['"]([^'"]+)['"]/g) || [];
      for (const match of gemMatches) {
        const gem = match.replace(/gem\s+['"]/, '').replace(/['"]/, '');
        deps.push(gem);
      }
    }
    
    // composer.json (PHP)
    if (fileName === 'composer.json') {
      try {
        const composer = JSON.parse(file.content);
        deps.push(...Object.keys(composer.require || {}));
        deps.push(...Object.keys(composer['require-dev'] || {}));
      } catch (e) {}
    }
  }
  
  return [...new Set(deps)].filter(d => d && d.length > 0);
}

/**
 * Analyze existing tests
 */
function analyzeExistingTests(files: FileContent[]): TestInfo[] {
  const tests: TestInfo[] = [];
  
  for (const file of files) {
    const path = file.path.toLowerCase();
    
    if (!path.includes('test') && !path.includes('spec')) continue;
    
    let framework = 'unknown';
    let type: TestInfo['type'] = 'unit';
    
    // Detect test framework
    if (file.content.includes('@Test') || file.content.includes('junit')) {
      framework = 'junit';
    } else if (file.content.includes('describe(') && file.content.includes('it(')) {
      framework = file.content.includes('cy.') ? 'cypress' : 'jest';
    } else if (file.content.includes('test.describe')) {
      framework = 'playwright';
    }
    
    // Detect test type
    if (path.includes('integration') || path.includes('e2e')) {
      type = path.includes('e2e') ? 'e2e' : 'integration';
    }
    
    tests.push({
      name: file.path.split('/').pop() || file.path,
      type,
      framework,
      filePath: file.path,
    });
  }
  
  return tests;
}

/**
 * Use LLM to extract deeper code insights
 */
async function analyzewithLLM(files: FileContent[], language: string): Promise<{
  framework?: string;
  interfaces: InterfaceInfo[];
  endpoints: EndpointInfo[];
  entities: EntityInfo[];
  patterns: string[];
}> {
  // Only analyze relevant source files
  const sourceFiles = files.filter(f => {
    const ext = f.path.split('.').pop()?.toLowerCase();
    return ['java', 'ts', 'tsx', 'js', 'jsx'].includes(ext || '');
  }).slice(0, 10); // Limit to 10 files for context window
  
  if (sourceFiles.length === 0) {
    return { interfaces: [], endpoints: [], entities: [], patterns: [] };
  }
  
  const codeSnippets = sourceFiles.map(f => 
    `// File: ${f.path}\n${f.content.slice(0, 2000)}` // Truncate large files
  ).join('\n\n---\n\n');
  
  const prompt = `Analyze this ${language} codebase and extract information in JSON format.

Code:
${codeSnippets}

Extract and return ONLY a JSON object with:
{
  "framework": "detected framework name (e.g., Spring Boot, Express, React, Next.js)",
  "interfaces": [{"name": "InterfaceName", "methods": ["method1", "method2"], "filePath": "path"}],
  "endpoints": [{"method": "GET/POST", "path": "/api/xxx", "handler": "functionName", "filePath": "path"}],
  "entities": [{"name": "EntityName", "fields": ["field1", "field2"], "filePath": "path"}],
  "patterns": ["pattern1", "pattern2"] // e.g., "Repository pattern", "Dependency injection"
}

Return ONLY valid JSON, no explanation.`;

  try {
    // Use analysis model (optimized for understanding code structure)
    const models = getConfiguredModels();
    const response = await generateWithOllama(prompt, models.analysis);
    console.log(`🔍 Code analysis using model: ${models.analysis}`);
    
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('LLM analysis failed:', error);
  }
  
  return { interfaces: [], endpoints: [], entities: [], patterns: [] };
}

/**
 * Generate a summary of the code context for prompts
 */
export function summarizeContext(context: CodeContext): string {
  const lines: string[] = [];
  
  lines.push(`## Code Analysis Summary`);
  lines.push(`- Language: ${context.language}`);
  if (context.framework) lines.push(`- Framework: ${context.framework}`);
  if (context.buildTool) lines.push(`- Build Tool: ${context.buildTool}`);
  lines.push(`- Source Files: ${context.structure.sourceFiles.length}`);
  lines.push(`- Existing Tests: ${context.structure.testFiles.length}`);
  
  if (context.dependencies.length > 0) {
    lines.push(`\n### Key Dependencies`);
    lines.push(context.dependencies.slice(0, 15).map(d => `- ${d}`).join('\n'));
  }
  
  if (context.interfaces.length > 0) {
    lines.push(`\n### Interfaces/Services`);
    for (const iface of context.interfaces.slice(0, 5)) {
      lines.push(`- ${iface.name}: ${iface.methods.slice(0, 3).join(', ')}`);
    }
  }
  
  if (context.endpoints.length > 0) {
    lines.push(`\n### API Endpoints`);
    for (const ep of context.endpoints.slice(0, 10)) {
      lines.push(`- ${ep.method} ${ep.path}`);
    }
  }
  
  if (context.entities.length > 0) {
    lines.push(`\n### Entities/Models`);
    for (const entity of context.entities.slice(0, 5)) {
      lines.push(`- ${entity.name}: ${entity.fields.slice(0, 5).join(', ')}`);
    }
  }
  
  if (context.patterns.length > 0) {
    lines.push(`\n### Detected Patterns`);
    lines.push(context.patterns.map(p => `- ${p}`).join('\n'));
  }
  
  if (context.existingTests.length > 0) {
    lines.push(`\n### Existing Tests`);
    const byFramework = context.existingTests.reduce((acc, t) => {
      acc[t.framework] = (acc[t.framework] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    for (const [fw, count] of Object.entries(byFramework)) {
      lines.push(`- ${fw}: ${count} test files`);
    }
  }
  
  return lines.join('\n');
}
