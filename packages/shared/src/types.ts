// ============================================
// TARS - Shared Types
// ============================================

// PRD Types
export interface PRD {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'processing' | 'completed';
}

// Test Scenario Types
export interface TestScenario {
  id: string;
  prdId: string;
  title: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected';
  steps: TestStep[];
  testData: Record<string, unknown>;
  codeMapping?: CodeMapping;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestStep {
  action: string;
  expected: string;
}

export interface CodeMapping {
  targetComponents: string[];
  targetEndpoints: string[];
  dependencies: string[];
}

// Repository Types
export interface Repository {
  id: string;
  name: string;
  path: string;
  type: 'java-backend' | 'react-frontend' | 'unknown';
  detectedFrameworks: string[];
  buildTool?: 'maven' | 'gradle' | 'npm' | 'yarn' | 'pnpm';
  hermeticStatus: OnboardingStatus;
  raptorStatus: OnboardingStatus;
}

export interface OnboardingStatus {
  onboarded: boolean;
  mode?: 'code-change' | 'mockoon';
  lastUpdated?: Date;
}

// API Request/Response Types
export interface CreatePRDRequest {
  title: string;
  content: string;
}

export interface CreatePRDResponse {
  prd: PRD;
  scenarios: TestScenario[];
}

export interface GenerateTestsRequest {
  prdId: string;
  scenarioIds: string[];
  framework: 'jest' | 'junit' | 'testng' | 'cypress' | 'playwright';
  type: 'unit' | 'integration' | 'e2e';
}

export interface GenerateTestsResponse {
  generatedFiles: GeneratedFile[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  framework: string;
}

// Hermetic Types
export interface HermeticConfig {
  serviceName: string;
  mode: 'code-change' | 'mockoon';
  seedEntities: SeedEntity[];
  sampleData: SampleDataConfig;
}

export interface SeedEntity {
  entityId: string;
  entityType: string;
  entityValue: unknown;
}

export interface SampleDataConfig {
  entities: string[];
  format: 'json' | 'yaml';
}

// LLM Types
export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

// CLI Types
export interface CLIConfig {
  apiUrl: string;
  outputDir: string;
  defaultFramework: string;
}
