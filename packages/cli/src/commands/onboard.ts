import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { collectFiles, FileInfo } from './analyze';

const API_URL = process.env.TARS_API_URL || 'http://localhost:3001';

export const onboardCommand = new Command('onboard')
  .description('Onboard service to Hermetic or Raptor')
  .argument('<service>', 'Service to onboard (hermetic, raptor)')
  .option('--service-name <name>', 'Name of the service', 'my-service')
  .option('--mode <mode>', 'Onboarding mode (code-change, mockoon)', 'code-change')
  .option('--output <path>', 'Output directory', '.')
  .option('--repo <path>', 'Repository path to analyze', '.')
  .option('--entities <entities>', 'Comma-separated list of entities (auto-detected if not provided)', '')
  .option('--dependencies <deps>', 'Comma-separated list of dependencies to fake (auto-detected if not provided)', '')
  .option('--use-ai', 'Use Ollama AI for intelligent code generation (default: true)', true)
  .option('--no-ai', 'Use template-based generation instead of AI')
  .option('--analyze', 'Analyze repository before onboarding (improves quality)', true)
  .option('--no-analyze', 'Skip repository analysis')
  .action(async (service, options) => {
    console.log('\n🚀 TARS Onboarding\n');

    if (service === 'hermetic') {
      await onboardHermetic(options);
    } else if (service === 'raptor') {
      await onboardRaptor(options);
    } else {
      console.error(`❌ Unknown service: ${service}`);
      console.log('   Available: hermetic, raptor');
      process.exit(1);
    }
  });

async function onboardHermetic(options: any) {
  console.log(`📦 Onboarding to Hermetic Server`);
  console.log(`   Service Name: ${options.serviceName}`);
  console.log(`   Mode:         ${options.mode}`);
  console.log(`   AI Mode:      ${options.ai ? '🤖 Ollama' : '📝 Template'}`);
  console.log(`   Analysis:     ${options.analyze ? '✅ Enabled' : '⏭️ Skipped'}`);
  console.log('');

  const outputDir = path.resolve(options.output);
  let entities = options.entities ? options.entities.split(',').map((e: string) => e.trim()) : [];
  let dependencies = options.dependencies ? options.dependencies.split(',').map((d: string) => d.trim()) : [];
  let repoContext: string | undefined;

  // Analyze repository if enabled
  if (options.analyze && options.ai) {
    console.log('🔍 Analyzing repository for Hermetic readiness...');
    const repoPath = path.resolve(options.repo);
    const files = collectFiles(repoPath, 40);

    if (files.length > 0) {
      try {
        const analysisResponse = await fetch(`${API_URL}/api/analyze/for-hermetic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files }),
        });

        if (analysisResponse.ok) {
          const analysis = await analysisResponse.json() as any;
          repoContext = analysis.context;
          
          console.log(`   ✅ Analyzed ${files.length} files`);
          console.log(`   📊 Hermetic Readiness: ${analysis.hermetic?.readinessScore || 'N/A'}/100`);
          
          // Auto-detect entities and dependencies if not provided
          if (entities.length === 0 && analysis.hermetic?.entities) {
            entities = analysis.hermetic.entities;
            console.log(`   📦 Auto-detected entities: ${entities.join(', ')}`);
          }
          
          if (dependencies.length === 0 && analysis.hermetic?.detectedExternalDeps) {
            dependencies = analysis.hermetic.detectedExternalDeps;
            console.log(`   🔗 Auto-detected dependencies: ${dependencies.join(', ')}`);
          }
          
          // Show blockers
          if (analysis.hermetic?.blockers?.length > 0) {
            console.log(`   ⚠️  Blockers detected:`);
            analysis.hermetic.blockers.slice(0, 3).forEach((b: string) => console.log(`      • ${b}`));
          }
        }
      } catch (e) {
        console.log('   ⚠️  Analysis skipped (API unavailable)');
      }
    }
    console.log('');
  }

  if (options.mode === 'code-change') {
    await generateCodeChangeHermetic(outputDir, options.serviceName, entities, dependencies, options.ai, repoContext);
  } else {
    await generateMockoonHermetic(outputDir, options.serviceName, entities);
  }
}

async function generateCodeChangeHermetic(
  outputDir: string,
  serviceName: string,
  entities: string[],
  dependencies: string[],
  useAI: boolean,
  repoContext?: string
) {
  console.log('📝 Generating Hermetic configuration (Code Change mode)...\n');

  const hermeticDir = path.join(outputDir, 'src/hermetic');
  const configDir = path.join(hermeticDir, 'config');
  const fakesDir = path.join(hermeticDir, 'fakes');
  const filterDir = path.join(hermeticDir, 'filter');

  // Create directories
  [hermeticDir, configDir, fakesDir, filterDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Generate core hermetic files
  const files = [
    { type: 'seed', path: path.join(hermeticDir, 'SeedEntitiesController.java') },
    { type: 'reset', path: path.join(hermeticDir, 'ResetDataController.java') },
    { type: 'sample', path: path.join(hermeticDir, 'SampleDataController.java') },
    { type: 'tracing', path: path.join(filterDir, 'RequestTracingFilter.java') },
    { type: 'config', path: path.join(configDir, 'application-hermetic.yml') },
    { type: 'docker', path: path.join(outputDir, 'Dockerfile.hermetic') },
    { type: 'docs', path: path.join(outputDir, 'hermetic.md') },
  ];

  for (const file of files) {
    let code: string;
    
    if (useAI) {
      console.log(`   🤖 AI generating: ${path.basename(file.path)}...`);
      code = await generateWithOllama(serviceName, file.type, entities, dependencies, repoContext);
    } else {
      code = generateWithTemplate(serviceName, file.type, entities, dependencies);
    }
    
    fs.writeFileSync(file.path, code);
    console.log(`   ✅ ${path.relative(outputDir, file.path)}`);
  }

  // Generate docker-compose
  const dockerCompose = generateDockerCompose(serviceName);
  fs.writeFileSync(path.join(outputDir, 'docker-compose.hermetic.yml'), dockerCompose);
  console.log('   ✅ docker-compose.hermetic.yml');

  // Generate GitHub Actions workflow
  const workflowDir = path.join(outputDir, '.github/workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  const workflow = generateCICDWorkflow(serviceName);
  fs.writeFileSync(path.join(workflowDir, 'hermetic-publish.yml'), workflow);
  console.log('   ✅ .github/workflows/hermetic-publish.yml');

  // Generate Maven hermetic profile
  console.log(`   ${useAI ? '🤖 AI generating' : '📝 Generating'}: pom-hermetic-profile.xml...`);
  const mavenProfile = useAI 
    ? await generateWithOllama(serviceName, 'maven', entities, dependencies, repoContext)
    : generateMavenProfileTemplate(serviceName);
  fs.writeFileSync(path.join(outputDir, 'pom-hermetic-profile.xml'), mavenProfile);
  console.log('   ✅ pom-hermetic-profile.xml');

  // Generate Gradle hermetic build config
  console.log(`   ${useAI ? '🤖 AI generating' : '📝 Generating'}: hermetic-build.gradle.kts...`);
  const gradleConfig = useAI 
    ? await generateWithOllama(serviceName, 'gradle', entities, dependencies, repoContext)
    : generateGradleProfileTemplate(serviceName);
  fs.writeFileSync(path.join(outputDir, 'hermetic-build.gradle.kts'), gradleConfig);
  console.log('   ✅ hermetic-build.gradle.kts');

  // Generate fake implementations if dependencies specified
  if (dependencies.length > 0 && useAI) {
    console.log(`   🤖 AI generating: Fake implementations...`);
    const fakes = await generateWithOllama(serviceName, 'fake', entities, dependencies, repoContext);
    fs.writeFileSync(path.join(fakesDir, 'FakeImplementations.java'), fakes);
    console.log('   ✅ src/hermetic/fakes/FakeImplementations.java');
  }

  console.log('\n' + '─'.repeat(50));
  console.log('✨ Hermetic onboarding complete!\n');
  console.log('Generated files:');
  console.log('   📁 src/hermetic/           - Controllers and fakes');
  console.log('   📁 src/hermetic/filter/    - Request tracing filter');
  console.log('   📄 pom-hermetic-profile.xml - Maven profile (add to pom.xml)');
  console.log('   📄 hermetic-build.gradle.kts - Gradle config (add to build.gradle.kts)');
  console.log('');
  console.log('Next steps:');
  console.log('   1. Review generated files');
  console.log('   2. Add Maven profile from pom-hermetic-profile.xml to your pom.xml');
  console.log('   3. Or append hermetic-build.gradle.kts to your build.gradle.kts');
  console.log('   4. Build with: mvn clean package -Pharmetic');
  console.log('   5. Or: ./gradlew bootHermeticJar');
  console.log('   6. Run with: docker-compose -f docker-compose.hermetic.yml up');
  console.log('');
}

async function generateWithOllama(
  serviceName: string,
  controllerType: string,
  entities: string[],
  dependencies: string[],
  repoContext?: string
): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/hermetic/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceName,
        controllerType,
        entities,
        dependencies,
        repoContext, // Pass the code analysis context
      }),
    });

    if (!response.ok) {
      console.log('   ⚠️  AI unavailable, using template...');
      return generateWithTemplate(serviceName, controllerType, entities, dependencies);
    }

    const result = await response.json() as any;
    return result.code;
  } catch (error) {
    console.log('   ⚠️  AI error, using template...');
    return generateWithTemplate(serviceName, controllerType, entities, dependencies);
  }
}

function generateWithTemplate(
  serviceName: string,
  controllerType: string,
  entities: string[],
  dependencies: string[]
): string {
  const packageName = `com.example.${serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')}.hermetic`;
  
  switch (controllerType) {
    case 'seed':
      return generateSeedControllerTemplate(packageName, serviceName);
    case 'reset':
      return generateResetControllerTemplate(packageName, serviceName);
    case 'sample':
      return generateSampleControllerTemplate(packageName, serviceName, entities);
    case 'tracing':
      return generateTracingFilterTemplate(packageName, serviceName);
    case 'config':
      return generateHermeticConfig(serviceName);
    case 'docker':
      return generateDockerfile(serviceName);
    case 'docs':
      return generateHermeticDocs(serviceName, entities, dependencies);
    case 'fake':
      return generateFakeTemplate(packageName, dependencies);
    case 'maven':
      return generateMavenProfileTemplate(serviceName);
    case 'gradle':
      return generateGradleProfileTemplate(serviceName);
    default:
      return `// ${controllerType} for ${serviceName}`;
  }
}

function generateSeedControllerTemplate(packageName: string, serviceName: string): string {
  return `package ${packageName};

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Hermetic Server - Seed Entities Controller
 * Service: ${serviceName}
 * 
 * Use this API to seed test data before running tests.
 * Generated by TARS - Test Automation and Review System
 */
@RestController
@RequestMapping("/hermetic")
@Profile("hermetic")
public class SeedEntitiesController {
    
    private static final Logger log = LoggerFactory.getLogger(SeedEntitiesController.class);
    private final Map<String, List<Map<String, Object>>> seededData = new ConcurrentHashMap<>();

    /**
     * Seed entities for testing
     * 
     * Example:
     * POST /hermetic/seedEntities
     * {
     *   "entities": [
     *     {"entityId": "user-1", "entityType": "User", "entityValue": {"name": "Test"}}
     *   ]
     * }
     */
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
    
    @GetMapping("/seeded")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getAllSeeded() {
        return ResponseEntity.ok(seededData);
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

function generateResetControllerTemplate(packageName: string, serviceName: string): string {
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
 * Use this API to reset the hermetic server to its base state.
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
        
        // TODO: Inject repositories and clear data
        // userRepository.deleteAll();
        // orderRepository.deleteAll();
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Server reset to base state"
        ));
    }
    
    @PostMapping("/reset/{entityType}")
    public ResponseEntity<Map<String, Object>> resetEntity(@PathVariable String entityType) {
        log.info("Resetting entity type: {}", entityType);
        
        // TODO: Clear specific entity type
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "entityType", entityType,
            "message", "Entity type reset"
        ));
    }
}`;
}

function generateSampleControllerTemplate(packageName: string, serviceName: string, entities: string[]): string {
  const entityExamples = entities.length > 0 ? entities : ['User', 'Order', 'Product'];
  
  return `package ${packageName};

import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/**
 * Hermetic Server - Sample Data Controller
 * Service: ${serviceName}
 * 
 * Get sample payloads for testing.
 * Generated by TARS
 */
@RestController
@RequestMapping("/hermetic")
@Profile("hermetic")
public class SampleDataController {

    private static final Map<String, Object> SAMPLES = Map.of(
        ${entityExamples.map(e => `"${e}", Map.of("id", "sample-${e.toLowerCase()}-1", "name", "Sample ${e}")`).join(',\n        ')}
    );

    @GetMapping("/sample-data")
    public ResponseEntity<Map<String, Object>> listSamples() {
        return ResponseEntity.ok(Map.of(
            "availableTypes", SAMPLES.keySet(),
            "count", SAMPLES.size()
        ));
    }

    @GetMapping("/sample-data/{entityType}")
    public ResponseEntity<Object> getSampleData(@PathVariable String entityType) {
        Object sample = SAMPLES.get(entityType);
        if (sample == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(sample);
    }
}`;
}

function generateFakeTemplate(packageName: string, dependencies: string[]): string {
  const deps = dependencies.length > 0 ? dependencies : ['ExternalService'];
  
  return `package ${packageName}.fakes;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Fake Implementations for Hermetic Testing
 * 
 * Generated by TARS
 */

${deps.map(dep => `
// ============================================
// Fake ${dep}
// ============================================

interface ${dep} {
    Object call(String method, Object... args);
}

@Service
@Profile("hermetic")
class Fake${dep} implements ${dep} {
    private static final Logger log = LoggerFactory.getLogger(Fake${dep}.class);
    
    @Override
    public Object call(String method, Object... args) {
        log.info("Fake${dep}.{} called with {} args", method, args.length);
        // Return deterministic fake response
        return Map.of("fake", true, "method", method);
    }
}
`).join('\n')}`;
}

function generateTracingFilterTemplate(packageName: string, serviceName: string): string {
  return `package ${packageName}.filter;

import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Request/Response Tracing Filter for Hermetic Server
 * Service: ${serviceName}
 * 
 * This filter logs all HTTP requests and responses for debugging hermetic tests.
 * Only active when spring.profiles.active=hermetic
 * 
 * Features:
 * - Unique trace ID per request (available in MDC)
 * - Full request logging: method, URI, headers, body
 * - Full response logging: status, headers, body
 * - Request duration calculation
 * - Sensitive header masking
 * - Configurable body truncation
 * 
 * Generated by TARS - Test Automation and Review System
 */
@Component
@Profile("hermetic")
@Order(1)
public class RequestTracingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestTracingFilter.class);
    
    private static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final String TRACE_ID_MDC_KEY = "traceId";
    private static final int MAX_BODY_LENGTH = 10000;
    private static final Set<String> SENSITIVE_HEADERS = Set.of(
        "authorization", "cookie", "x-api-key", "x-auth-token", "password"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        
        // Generate or extract trace ID
        String traceId = request.getHeader(TRACE_ID_HEADER);
        if (traceId == null || traceId.isEmpty()) {
            traceId = UUID.randomUUID().toString().substring(0, 8);
        }
        
        // Set trace ID in MDC for log correlation
        MDC.put(TRACE_ID_MDC_KEY, traceId);
        response.setHeader(TRACE_ID_HEADER, traceId);
        
        // Wrap request/response for body reading
        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Log request
            logRequest(traceId, wrappedRequest);
            
            // Execute the request
            filterChain.doFilter(wrappedRequest, wrappedResponse);
            
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            
            // Log response
            logResponse(traceId, wrappedResponse, duration);
            
            // Copy body to response (required for ContentCachingResponseWrapper)
            wrappedResponse.copyBodyToResponse();
            
            // Clear MDC
            MDC.remove(TRACE_ID_MDC_KEY);
        }
    }

    private void logRequest(String traceId, ContentCachingRequestWrapper request) {
        StringBuilder sb = new StringBuilder();
        sb.append("\\n╔══════════════════════════════════════════════════════════════\\n");
        sb.append("║ 📥 HERMETIC REQUEST [").append(traceId).append("]\\n");
        sb.append("╠══════════════════════════════════════════════════════════════\\n");
        sb.append("║ Method: ").append(request.getMethod()).append("\\n");
        sb.append("║ URI: ").append(request.getRequestURI());
        
        if (request.getQueryString() != null) {
            sb.append("?").append(request.getQueryString());
        }
        sb.append("\\n");
        
        // Log headers
        sb.append("║ Headers:\\n");
        Collections.list(request.getHeaderNames()).forEach(headerName -> {
            String value = SENSITIVE_HEADERS.contains(headerName.toLowerCase())
                ? "[MASKED]"
                : request.getHeader(headerName);
            sb.append("║   ").append(headerName).append(": ").append(value).append("\\n");
        });
        
        sb.append("╚══════════════════════════════════════════════════════════════");
        
        log.info(sb.toString());
        
        // Log body separately at DEBUG level (after filter chain for cached content)
    }

    private void logResponse(String traceId, ContentCachingResponseWrapper response, long duration) {
        StringBuilder sb = new StringBuilder();
        sb.append("\\n╔══════════════════════════════════════════════════════════════\\n");
        sb.append("║ 📤 HERMETIC RESPONSE [").append(traceId).append("]\\n");
        sb.append("╠══════════════════════════════════════════════════════════════\\n");
        sb.append("║ Status: ").append(response.getStatus()).append("\\n");
        sb.append("║ Duration: ").append(duration).append("ms\\n");
        
        // Log response headers
        sb.append("║ Headers:\\n");
        response.getHeaderNames().forEach(headerName -> {
            String value = response.getHeader(headerName);
            sb.append("║   ").append(headerName).append(": ").append(value).append("\\n");
        });
        
        // Log response body
        byte[] body = response.getContentAsByteArray();
        if (body.length > 0) {
            String bodyStr = new String(body, StandardCharsets.UTF_8);
            if (bodyStr.length() > MAX_BODY_LENGTH) {
                bodyStr = bodyStr.substring(0, MAX_BODY_LENGTH) + "... [TRUNCATED]";
            }
            sb.append("║ Body:\\n");
            sb.append("║   ").append(bodyStr.replace("\\n", "\\n║   ")).append("\\n");
        }
        
        sb.append("╚══════════════════════════════════════════════════════════════");
        
        log.info(sb.toString());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Skip actuator endpoints to reduce noise
        String path = request.getRequestURI();
        return path.startsWith("/actuator") || path.equals("/favicon.ico");
    }
}`;
}

function generateMavenProfileTemplate(serviceName: string): string {
  return `<!-- 
  Hermetic Server Maven Profile
  Service: ${serviceName}
  Generated by TARS - Test Automation and Review System
  
  Add this profile to your pom.xml inside the <profiles> section.
  Build with: mvn clean package -Pharmetic
-->

<profile>
    <id>hermetic</id>
    
    <!-- Activation: Use -Pharmetic to activate -->
    <activation>
        <property>
            <name>hermetic</name>
        </property>
    </activation>
    
    <properties>
        <!-- Set Spring profile to hermetic -->
        <spring.profiles.active>hermetic</spring.profiles.active>
        <!-- Custom JAR name for hermetic build -->
        <jar.finalName>\${project.artifactId}-hermetic</jar.finalName>
    </properties>
    
    <dependencies>
        <!-- H2 Database for in-memory testing -->
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
        
        <!-- Include test utilities in hermetic build -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>compile</scope>
        </dependency>
    </dependencies>
    
    <build>
        <finalName>\${jar.finalName}</finalName>
        
        <resources>
            <!-- Include hermetic-specific config -->
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
            <resource>
                <directory>src/hermetic/config</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
        
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <!-- Add hermetic classifier to differentiate from production JAR -->
                    <classifier>hermetic</classifier>
                    <!-- Include build info for traceability -->
                    <additionalProperties>
                        <build.type>hermetic</build.type>
                        <build.timestamp>\${maven.build.timestamp}</build.timestamp>
                    </additionalProperties>
                </configuration>
                <executions>
                    <execution>
                        <goals>
                            <goal>build-info</goal>
                            <goal>repackage</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
            
            <!-- Compile hermetic source directory -->
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>build-helper-maven-plugin</artifactId>
                <version>3.4.0</version>
                <executions>
                    <execution>
                        <id>add-hermetic-sources</id>
                        <phase>generate-sources</phase>
                        <goals>
                            <goal>add-source</goal>
                        </goals>
                        <configuration>
                            <sources>
                                <source>src/hermetic</source>
                            </sources>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</profile>

<!--
  IMPORTANT: Add this to your pom.xml exclusions to prevent hermetic 
  code from being included in production builds.
  
  Add to your default build plugins:
  
  <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <configuration>
          <excludes>
              <exclude>**/hermetic/**</exclude>
          </excludes>
      </configuration>
  </plugin>
-->`;
}

function generateGradleProfileTemplate(serviceName: string): string {
  return `// Hermetic Server Gradle Configuration
// Service: ${serviceName}
// Generated by TARS - Test Automation and Review System
//
// Append this to your build.gradle.kts (Kotlin DSL)
// Or convert to Groovy syntax for build.gradle

// ============================================
// Hermetic Source Set Configuration
// ============================================

sourceSets {
    create("hermetic") {
        java {
            srcDir("src/hermetic")
        }
        resources {
            srcDir("src/hermetic/config")
        }
        // Hermetic can access main source classes
        compileClasspath += sourceSets["main"].output
        runtimeClasspath += sourceSets["main"].output
    }
}

// ============================================
// Hermetic Dependencies
// ============================================

val hermeticImplementation by configurations.getting {
    extendsFrom(configurations.implementation.get())
}

val hermeticRuntimeOnly by configurations.getting {
    extendsFrom(configurations.runtimeOnly.get())
}

dependencies {
    // H2 for in-memory database
    "hermeticRuntimeOnly"("com.h2database:h2")
    
    // Include test utilities in hermetic build
    "hermeticImplementation"("org.springframework.boot:spring-boot-starter-test") {
        exclude(group = "org.junit.vintage", module = "junit-vintage-engine")
    }
}

// ============================================
// Hermetic JAR Task
// ============================================

tasks.register<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootHermeticJar") {
    group = "build"
    description = "Builds a hermetic server JAR for testing"
    
    archiveClassifier.set("hermetic")
    archiveBaseName.set("${serviceName}")
    
    // Include main classes
    mainClass.set(tasks.getByName<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar").mainClass)
    
    // Include hermetic classes
    from(sourceSets["main"].output)
    from(sourceSets["hermetic"].output)
    
    // Use hermetic classpath
    classpath = sourceSets["hermetic"].runtimeClasspath
    
    // Add manifest attributes
    manifest {
        attributes(
            "Build-Type" to "hermetic",
            "Build-Timestamp" to java.time.Instant.now().toString(),
            "Spring-Profiles-Active" to "hermetic"
        )
    }
    
    // Exclude production-only configs
    exclude("application-prod.yml", "application-production.yml")
    
    doLast {
        println("✅ Hermetic JAR built: \${archiveFile.get().asFile.absolutePath}")
    }
}

// ============================================
// Run Hermetic Server Locally
// ============================================

tasks.register<JavaExec>("runHermetic") {
    group = "application"
    description = "Runs the hermetic server locally"
    
    mainClass.set(tasks.getByName<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar").mainClass)
    classpath = sourceSets["hermetic"].runtimeClasspath
    
    // Set hermetic profile
    environment("SPRING_PROFILES_ACTIVE", "hermetic")
    
    // JVM options for hermetic mode
    jvmArgs = listOf(
        "-Xmx512m",
        "-Xms256m",
        "-Dserver.port=8080"
    )
    
    doFirst {
        println("🚀 Starting hermetic server on http://localhost:8080")
        println("   Profile: hermetic")
        println("   Database: H2 (in-memory)")
    }
}

// ============================================
// Docker Build for Hermetic Server  
// ============================================

tasks.register<Exec>("buildHermeticDocker") {
    group = "docker"
    description = "Builds the hermetic Docker image"
    dependsOn("bootHermeticJar")
    
    commandLine(
        "docker", "build",
        "-f", "Dockerfile.hermetic",
        "-t", "hermetic-${serviceName}:latest",
        "."
    )
}

// ============================================
// Exclude hermetic from production builds
// ============================================

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    // Exclude hermetic code from production JAR
    exclude("**/hermetic/**")
}

tasks.named<Jar>("jar") {
    // Exclude hermetic code from library JAR
    exclude("**/hermetic/**")
}

// ============================================
// Clean task for hermetic builds
// ============================================

tasks.register<Delete>("cleanHermetic") {
    group = "build"
    description = "Cleans hermetic build artifacts"
    delete(fileTree("build") { include("**/hermetic/**", "**/*-hermetic.jar") })
}

/*
 * Usage:
 * 
 * Build hermetic JAR:
 *   ./gradlew bootHermeticJar
 * 
 * Run locally:
 *   ./gradlew runHermetic
 * 
 * Build Docker image:
 *   ./gradlew buildHermeticDocker
 * 
 * Clean hermetic artifacts:
 *   ./gradlew cleanHermetic
 */`;
}

function generateHermeticConfig(serviceName: string): string {
  return `# Hermetic Server Configuration
# Service: ${serviceName}
# Generated by TARS

spring:
  profiles: hermetic
  
  # H2 in-memory database for isolation
  datasource:
    url: jdbc:h2:mem:${serviceName}_hermetic;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
    driver-class-name: org.h2.Driver
    username: sa
    password: 
    
  h2:
    console:
      enabled: true
      path: /h2-console
      
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: true
    properties:
      hibernate:
        format_sql: true

# Disable external service calls
external:
  services:
    enabled: false
    
# Fast startup
spring.main:
  lazy-initialization: true

# Detailed logging for debugging  
logging:
  level:
    root: INFO
    org.springframework.web: DEBUG
    com.example.${serviceName}: DEBUG
    org.hibernate.SQL: DEBUG
`;
}

function generateDockerCompose(serviceName: string): string {
  return `# Hermetic Server Docker Compose
# Service: ${serviceName}
# Generated by TARS

version: '3.8'

services:
  ${serviceName}-hermetic:
    build:
      context: .
      dockerfile: Dockerfile.hermetic
    image: hermetic-${serviceName}:latest
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=hermetic
      - JAVA_OPTS=-Xmx512m -Xms256m
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
`;
}

function generateDockerfile(serviceName: string): string {
  return `# Hermetic Server Dockerfile
# Service: ${serviceName}
# Generated by TARS
#
# ⚠️ WARNING: This image is for TESTING ONLY
# DO NOT promote to production or Edge environments

FROM eclipse-temurin:17-jre-alpine

LABEL maintainer="TARS"
LABEL service="${serviceName}"
LABEL type="hermetic"
LABEL warning="Testing only - do not deploy to production"

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY target/${serviceName}-hermetic.jar app.jar

EXPOSE 8080

ENV SPRING_PROFILES_ACTIVE=hermetic
ENV JAVA_OPTS="-Xmx512m -Xms256m"

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \\
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
`;
}

function generateHermeticDocs(serviceName: string, entities: string[], dependencies: string[]): string {
  const entityList = entities.length > 0 ? entities : ['User', 'Order', 'Product'];
  const depList = dependencies.length > 0 ? dependencies : ['Database', 'ExternalAPI'];
  
  return `# Hermetic Server: ${serviceName}

## Overview

This is the hermetic server configuration for \`${serviceName}\`. A hermetic server is an isolated, deterministic environment that mimics production but operates without external dependencies.

### Key Properties
- ✅ **Isolation**: No external network calls
- ✅ **Deterministic**: Same input = same output
- ✅ **Fast**: In-memory database, quick startup
- ✅ **Debuggable**: Full request/response tracing

## Quick Start

\`\`\`bash
# Build hermetic server
mvn clean package -Pharmetic

# Run with Docker Compose
docker-compose -f docker-compose.hermetic.yml up

# Or run directly
java -jar target/${serviceName}-hermetic.jar --spring.profiles.active=hermetic
\`\`\`

## API Endpoints

### Health Check
\`\`\`bash
curl http://localhost:8080/actuator/health
\`\`\`

### Seed Entities
\`\`\`bash
curl -X POST http://localhost:8080/hermetic/seedEntities \\
  -H "Content-Type: application/json" \\
  -d '{
    "entities": [
      {
        "entityId": "user-1",
        "entityType": "User",
        "entityValue": {"name": "Test User", "email": "test@example.com"}
      }
    ]
  }'
\`\`\`

### Reset Data
\`\`\`bash
# Reset all data
curl -X POST http://localhost:8080/hermetic/reset

# Reset specific entity type
curl -X POST http://localhost:8080/hermetic/reset/User
\`\`\`

### Get Sample Data
\`\`\`bash
# List available samples
curl http://localhost:8080/hermetic/sample-data

# Get specific sample
curl http://localhost:8080/hermetic/sample-data/User
\`\`\`

## Supported Entities
${entityList.map(e => `- ${e}`).join('\n')}

## Mocked Dependencies
${depList.map(d => `- ${d}`).join('\n')}

## Configuration

The hermetic server uses:
- **Database**: H2 in-memory (PostgreSQL mode)
- **Profile**: \`hermetic\`
- **External calls**: Disabled/mocked

## Best Practices

1. **Seed data before tests**: Use \`/hermetic/seedEntities\` API
2. **Reset between tests**: Call \`/hermetic/reset\` after each test suite
3. **Use deterministic data**: Avoid random values in tests
4. **Check logs**: Enable DEBUG logging for troubleshooting

## Generated by TARS
Test Automation and Review System
`;
}

function generateCICDWorkflow(serviceName: string): string {
  return `# Hermetic Server CI/CD Pipeline
# Service: ${serviceName}
# Generated by TARS

name: Publish Hermetic Server

on:
  push:
    branches: [main, develop]
    paths:
      - 'src/hermetic/**'
      - 'Dockerfile.hermetic'
  pull_request:
    branches: [main]

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: maven
          
      - name: Build with Maven
        run: mvn clean package -Pharmetic -DskipTests
        
      - name: Build Docker image
        run: |
          docker build -f Dockerfile.hermetic \\
            -t hermetic-${serviceName}:\${{ github.sha }} \\
            -t hermetic-${serviceName}:latest .
          
      - name: Run hermetic tests
        run: |
          docker-compose -f docker-compose.hermetic.yml up -d
          sleep 30
          curl -f http://localhost:8080/actuator/health
          docker-compose -f docker-compose.hermetic.yml down
          
      - name: Push to Registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo "Pushing hermetic-${serviceName}:latest to registry"
          # ⚠️ NOTE: Hermetic images should NOT be promoted to Edge/Production
`;
}

async function generateMockoonHermetic(outputDir: string, serviceName: string, entities: string[] = []) {
  console.log('📝 Generating Hermetic configuration (Mockoon mode)...\n');

  const mockoonDir = path.join(outputDir, 'mockoon');
  if (!fs.existsSync(mockoonDir)) {
    fs.mkdirSync(mockoonDir, { recursive: true });
  }

  // Default entities if none provided
  const entityList = entities.length > 0 ? entities : ['User', 'Order', 'Product'];

  // Generate data buckets for each entity
  const dataBuckets = generateDataBuckets(entityList);
  fs.writeFileSync(path.join(mockoonDir, 'data-buckets.json'), JSON.stringify(dataBuckets, null, 2));
  console.log('   ✅ mockoon/data-buckets.json');

  // Generate comprehensive Mockoon environment spec
  const mockoonEnv = generateMockoonEnvironment(serviceName, entityList);
  fs.writeFileSync(path.join(mockoonDir, 'environment.json'), JSON.stringify(mockoonEnv, null, 2));
  console.log('   ✅ mockoon/environment.json');

  // Generate individual route files for organization
  const routesDir = path.join(mockoonDir, 'routes');
  if (!fs.existsSync(routesDir)) {
    fs.mkdirSync(routesDir, { recursive: true });
  }

  // Generate entity-specific routes
  for (const entity of entityList) {
    const entityRoutes = generateEntityRoutes(entity);
    fs.writeFileSync(
      path.join(routesDir, `${entity.toLowerCase()}-routes.json`),
      JSON.stringify(entityRoutes, null, 2)
    );
    console.log(`   ✅ mockoon/routes/${entity.toLowerCase()}-routes.json`);
  }

  // Generate hermetic control routes
  const hermeticRoutes = generateHermeticControlRoutes(entityList);
  fs.writeFileSync(path.join(routesDir, 'hermetic-routes.json'), JSON.stringify(hermeticRoutes, null, 2));
  console.log('   ✅ mockoon/routes/hermetic-routes.json');

  // Generate docker-compose with proper volume mounts
  const dockerCompose = generateMockoonDockerCompose(serviceName);
  fs.writeFileSync(path.join(outputDir, 'docker-compose.mockoon.yml'), dockerCompose);
  console.log('   ✅ docker-compose.mockoon.yml');

  // Generate Mockoon documentation
  const docs = generateMockoonDocs(serviceName, entityList);
  fs.writeFileSync(path.join(outputDir, 'hermetic-mockoon.md'), docs);
  console.log('   ✅ hermetic-mockoon.md');

  console.log('\n' + '─'.repeat(50));
  console.log('✨ Mockoon hermetic onboarding complete!\n');
  console.log('Generated files:');
  console.log('   📁 mockoon/                    - Mockoon configuration');
  console.log('   📁 mockoon/routes/             - Route definitions per entity');
  console.log('   📄 mockoon/data-buckets.json   - Initial test data');
  console.log('   📄 mockoon/environment.json    - Full Mockoon environment');
  console.log('');
  console.log('Next steps:');
  console.log('   1. Review and customize data in mockoon/data-buckets.json');
  console.log('   2. Import environment.json into Mockoon desktop app');
  console.log('   3. Or run with: docker-compose -f docker-compose.mockoon.yml up');
  console.log('   4. Access mock API at http://localhost:8080');
  console.log('');
}

function generateDataBuckets(entities: string[]): any {
  const buckets: any = {
    _meta: {
      description: 'Mockoon Data Buckets for Hermetic Testing',
      generatedBy: 'TARS - Test Automation and Review System',
      usage: 'These data buckets provide initial test data for hermetic testing'
    }
  };

  for (const entity of entities) {
    const lowerEntity = entity.toLowerCase();
    buckets[lowerEntity + 's'] = generateSampleData(entity);
  }

  // Add hermetic state bucket
  buckets._hermeticState = {
    initialized: true,
    seedCount: 0,
    resetCount: 0,
    lastReset: null
  };

  return buckets;
}

function generateSampleData(entity: string): any[] {
  const lowerEntity = entity.toLowerCase();
  
  // Generate entity-specific sample data
  switch (lowerEntity) {
    case 'user':
      return [
        { id: 'user-001', name: 'John Doe', email: 'john@example.com', role: 'admin', active: true, createdAt: '2024-01-15T10:00:00Z' },
        { id: 'user-002', name: 'Jane Smith', email: 'jane@example.com', role: 'user', active: true, createdAt: '2024-01-16T11:00:00Z' },
        { id: 'user-003', name: 'Bob Wilson', email: 'bob@example.com', role: 'user', active: false, createdAt: '2024-01-17T12:00:00Z' }
      ];
    case 'order':
      return [
        { id: 'order-001', userId: 'user-001', status: 'completed', total: 99.99, items: 3, createdAt: '2024-01-20T09:00:00Z' },
        { id: 'order-002', userId: 'user-002', status: 'pending', total: 149.50, items: 2, createdAt: '2024-01-21T10:00:00Z' },
        { id: 'order-003', userId: 'user-001', status: 'processing', total: 75.00, items: 1, createdAt: '2024-01-22T11:00:00Z' }
      ];
    case 'product':
      return [
        { id: 'product-001', name: 'Widget Pro', price: 29.99, stock: 100, category: 'electronics', active: true },
        { id: 'product-002', name: 'Gadget Plus', price: 49.99, stock: 50, category: 'electronics', active: true },
        { id: 'product-003', name: 'Tool Basic', price: 19.99, stock: 200, category: 'tools', active: true }
      ];
    default:
      return [
        { id: `${lowerEntity}-001`, name: `Sample ${entity} 1`, description: `Test ${entity} record 1`, active: true, createdAt: '2024-01-15T10:00:00Z' },
        { id: `${lowerEntity}-002`, name: `Sample ${entity} 2`, description: `Test ${entity} record 2`, active: true, createdAt: '2024-01-16T11:00:00Z' },
        { id: `${lowerEntity}-003`, name: `Sample ${entity} 3`, description: `Test ${entity} record 3`, active: false, createdAt: '2024-01-17T12:00:00Z' }
      ];
  }
}

function generateMockoonEnvironment(serviceName: string, entities: string[]): any {
  const routes: any[] = [];
  
  // Health check route
  routes.push({
    uuid: generateUUID(),
    type: 'http',
    documentation: 'Health check endpoint',
    method: 'get',
    endpoint: 'health',
    responses: [{
      uuid: generateUUID(),
      body: '{"status": "ok", "service": "' + serviceName + '-hermetic", "mode": "mockoon"}',
      latency: 0,
      statusCode: 200,
      headers: [{ key: 'Content-Type', value: 'application/json' }]
    }]
  });

  // Generate CRUD routes for each entity
  for (const entity of entities) {
    const lowerEntity = entity.toLowerCase();
    const pluralEntity = lowerEntity + 's';

    // GET all
    routes.push({
      uuid: generateUUID(),
      type: 'http',
      documentation: `Get all ${pluralEntity}`,
      method: 'get',
      endpoint: `api/${pluralEntity}`,
      responses: [{
        uuid: generateUUID(),
        body: `{{data '${pluralEntity}'}}`,
        latency: 50,
        statusCode: 200,
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        databucket: pluralEntity
      }]
    });

    // GET by ID
    routes.push({
      uuid: generateUUID(),
      type: 'http',
      documentation: `Get ${entity} by ID`,
      method: 'get',
      endpoint: `api/${pluralEntity}/:id`,
      responses: [{
        uuid: generateUUID(),
        body: `{{#data '${pluralEntity}' 'id' (urlParam 'id')}}{{stringify (object this)}}{{/data}}`,
        latency: 30,
        statusCode: 200,
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      }]
    });

    // POST create
    routes.push({
      uuid: generateUUID(),
      type: 'http',
      documentation: `Create ${entity}`,
      method: 'post',
      endpoint: `api/${pluralEntity}`,
      responses: [{
        uuid: generateUUID(),
        body: `{"id": "{{faker 'string.uuid'}}", "message": "${entity} created", "data": {{body}}}`,
        latency: 100,
        statusCode: 201,
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      }]
    });

    // PUT update
    routes.push({
      uuid: generateUUID(),
      type: 'http',
      documentation: `Update ${entity}`,
      method: 'put',
      endpoint: `api/${pluralEntity}/:id`,
      responses: [{
        uuid: generateUUID(),
        body: `{"id": "{{urlParam 'id'}}", "message": "${entity} updated", "data": {{body}}}`,
        latency: 80,
        statusCode: 200,
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      }]
    });

    // DELETE
    routes.push({
      uuid: generateUUID(),
      type: 'http',
      documentation: `Delete ${entity}`,
      method: 'delete',
      endpoint: `api/${pluralEntity}/:id`,
      responses: [{
        uuid: generateUUID(),
        body: `{"id": "{{urlParam 'id'}}", "message": "${entity} deleted", "success": true}`,
        latency: 50,
        statusCode: 200,
        headers: [{ key: 'Content-Type', value: 'application/json' }]
      }]
    });
  }

  // Hermetic control routes
  routes.push({
    uuid: generateUUID(),
    type: 'http',
    documentation: 'Seed entities for testing',
    method: 'post',
    endpoint: 'hermetic/seedEntities',
    responses: [{
      uuid: generateUUID(),
      body: '{"success": true, "message": "Entities seeded", "timestamp": "{{now}}"}',
      latency: 100,
      statusCode: 200,
      headers: [{ key: 'Content-Type', value: 'application/json' }]
    }]
  });

  routes.push({
    uuid: generateUUID(),
    type: 'http',
    documentation: 'Reset hermetic server to base state',
    method: 'post',
    endpoint: 'hermetic/reset',
    responses: [{
      uuid: generateUUID(),
      body: '{"success": true, "message": "Server reset to base state", "timestamp": "{{now}}"}',
      latency: 50,
      statusCode: 200,
      headers: [{ key: 'Content-Type', value: 'application/json' }]
    }]
  });

  routes.push({
    uuid: generateUUID(),
    type: 'http',
    documentation: 'Get sample data for entity type',
    method: 'get',
    endpoint: 'hermetic/sample-data/:entityType',
    responses: [{
      uuid: generateUUID(),
      body: `{{#switch (urlParam 'entityType')}}
{{#case 'User'}}${JSON.stringify(generateSampleData('User')[0])}{{/case}}
{{#case 'Order'}}${JSON.stringify(generateSampleData('Order')[0])}{{/case}}
{{#case 'Product'}}${JSON.stringify(generateSampleData('Product')[0])}{{/case}}
{{#default}}{"error": "Unknown entity type"}{{/default}}
{{/switch}}`,
      latency: 30,
      statusCode: 200,
      headers: [{ key: 'Content-Type', value: 'application/json' }]
    }]
  });

  // Generate data buckets for the environment
  const dataBuckets = entities.map(entity => ({
    uuid: generateUUID(),
    id: entity.toLowerCase() + 's',
    name: entity + 's Data',
    value: JSON.stringify(generateSampleData(entity))
  }));

  return {
    uuid: generateUUID(),
    lastMigration: 28,
    name: `${serviceName}-hermetic`,
    endpointPrefix: '',
    latency: 0,
    port: 8080,
    hostname: '0.0.0.0',
    routes,
    proxyMode: false,
    proxyHost: '',
    proxyRemovePrefix: false,
    tlsOptions: {
      enabled: false,
      type: 'CERT',
      pfxPath: '',
      certPath: '',
      keyPath: '',
      caPath: '',
      passphrase: ''
    },
    cors: true,
    headers: [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
    ],
    data: dataBuckets
  };
}

function generateEntityRoutes(entity: string): any {
  const lowerEntity = entity.toLowerCase();
  const pluralEntity = lowerEntity + 's';
  
  return {
    entity,
    basePath: `/api/${pluralEntity}`,
    routes: [
      { method: 'GET', path: `/${pluralEntity}`, description: `List all ${pluralEntity}`, databucket: pluralEntity },
      { method: 'GET', path: `/${pluralEntity}/:id`, description: `Get ${entity} by ID` },
      { method: 'POST', path: `/${pluralEntity}`, description: `Create new ${entity}` },
      { method: 'PUT', path: `/${pluralEntity}/:id`, description: `Update ${entity}` },
      { method: 'DELETE', path: `/${pluralEntity}/:id`, description: `Delete ${entity}` }
    ],
    sampleData: generateSampleData(entity)
  };
}

function generateHermeticControlRoutes(entities: string[]): any {
  return {
    description: 'Hermetic Server Control Routes',
    routes: [
      {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint',
        response: { status: 'ok' }
      },
      {
        method: 'POST',
        path: '/hermetic/seedEntities',
        description: 'Seed test entities',
        requestBody: {
          entities: [
            { entityId: 'string', entityType: 'string', entityValue: 'object' }
          ]
        },
        response: { success: true, seededCount: 0, seededIds: [] }
      },
      {
        method: 'POST',
        path: '/hermetic/reset',
        description: 'Reset to base state',
        response: { success: true, message: 'Server reset' }
      },
      {
        method: 'GET',
        path: '/hermetic/sample-data',
        description: 'List available sample data types',
        response: { availableTypes: entities }
      },
      {
        method: 'GET',
        path: '/hermetic/sample-data/:entityType',
        description: 'Get sample data for entity type',
        response: { id: 'sample-id', name: 'Sample Name' }
      }
    ]
  };
}

function generateMockoonDockerCompose(serviceName: string): string {
  return `# Mockoon Hermetic Server Docker Compose
# Service: ${serviceName}
# Generated by TARS - Test Automation and Review System

version: '3.8'

services:
  ${serviceName}-mockoon:
    image: mockoon/cli:latest
    container_name: ${serviceName}-hermetic-mockoon
    ports:
      - "8080:8080"
    volumes:
      - ./mockoon/environment.json:/data/environment.json:ro
    command: --data /data/environment.json --port 8080
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    labels:
      - "hermetic.service=${serviceName}"
      - "hermetic.type=mockoon"
      - "hermetic.warning=Testing only - do not deploy to production"

  # Optional: Mockoon with live reload for development
  ${serviceName}-mockoon-dev:
    image: mockoon/cli:latest
    container_name: ${serviceName}-hermetic-mockoon-dev
    profiles:
      - dev
    ports:
      - "8081:8080"
    volumes:
      - ./mockoon:/data:ro
    command: --data /data/environment.json --port 8080 --log-transaction
    environment:
      - MOCKOON_LOG_LEVEL=debug
`;
}

function generateMockoonDocs(serviceName: string, entities: string[]): string {
  const entityList = entities.map(e => `- ${e}`).join('\\n');
  const entityEndpoints = entities.map(e => {
    const plural = e.toLowerCase() + 's';
    return `
### ${e} Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/${plural} | List all ${plural} |
| GET | /api/${plural}/:id | Get ${e} by ID |
| POST | /api/${plural} | Create new ${e} |
| PUT | /api/${plural}/:id | Update ${e} |
| DELETE | /api/${plural}/:id | Delete ${e} |`;
  }).join('\\n');

  return `# Hermetic Server (Mockoon Mode): ${serviceName}

## Overview

This hermetic server uses [Mockoon](https://mockoon.com/) to provide a lightweight, configurable mock API for testing. Mockoon allows you to define mock responses with data buckets for stateful testing.

### Key Features
- ✅ **No Code Required**: Configure via JSON files
- ✅ **Data Buckets**: Persistent test data within session
- ✅ **Templating**: Dynamic responses with Handlebars
- ✅ **Fast Startup**: Milliseconds to ready
- ✅ **Portable**: Run anywhere with Docker

## Quick Start

\`\`\`bash
# Start with Docker Compose
docker-compose -f docker-compose.mockoon.yml up

# Or run Mockoon CLI directly
mockoon-cli start --data mockoon/environment.json --port 8080
\`\`\`

## Available Entities
${entityList}

## API Endpoints

### Health Check
\`\`\`bash
curl http://localhost:8080/health
\`\`\`
${entityEndpoints}

### Hermetic Control Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /hermetic/seedEntities | Seed test data |
| POST | /hermetic/reset | Reset to base state |
| GET | /hermetic/sample-data | List sample data types |
| GET | /hermetic/sample-data/:type | Get sample for entity type |

## Data Buckets

Data buckets in \`mockoon/data-buckets.json\` provide initial test data. Customize these to match your test scenarios:

\`\`\`json
{
  "users": [
    { "id": "user-001", "name": "John Doe", "email": "john@example.com" }
  ],
  "orders": [
    { "id": "order-001", "userId": "user-001", "status": "pending" }
  ]
}
\`\`\`

## Customization

### Adding New Routes

1. Edit \`mockoon/environment.json\`
2. Add new route object to the \`routes\` array
3. Restart the container

### Modifying Data

1. Edit \`mockoon/data-buckets.json\`
2. Update the data in \`mockoon/environment.json\` data array
3. Restart the container

### Using Mockoon Desktop

1. Download [Mockoon](https://mockoon.com/download/)
2. Import \`mockoon/environment.json\`
3. Edit routes and data visually
4. Export updated environment

## Testing Examples

\`\`\`bash
# Get all users
curl http://localhost:8080/api/users

# Get user by ID
curl http://localhost:8080/api/users/user-001

# Create new order
curl -X POST http://localhost:8080/api/orders \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "user-001", "items": [{"productId": "product-001", "qty": 2}]}'

# Seed test data
curl -X POST http://localhost:8080/hermetic/seedEntities \\
  -H "Content-Type: application/json" \\
  -d '{"entities": [{"entityId": "test-1", "entityType": "User", "entityValue": {"name": "Test"}}]}'

# Reset server
curl -X POST http://localhost:8080/hermetic/reset
\`\`\`

## Comparison: Code Change vs Mockoon

| Feature | Code Change | Mockoon |
|---------|-------------|---------|
| Setup Complexity | Medium | Low |
| Customization | Full | Limited |
| Performance | Fast | Very Fast |
| State Management | Full | Session-based |
| Best For | Complex services | Simple APIs |

## Generated by TARS
Test Automation and Review System
`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function onboardRaptor(options: any) {
  console.log(`📦 Onboarding to Raptor (Traffic Recording/Replay)`);
  console.log(`   Service Name: ${options.serviceName}`);
  console.log(`   Output:       ${options.output}`);
  console.log('');

  const outputDir = path.resolve(options.output);
  const serviceName = options.serviceName;

  // Create raptor directory structure
  const raptorDir = path.join(outputDir, 'raptor');
  const recordingsDir = path.join(raptorDir, 'recordings');
  const filtersDir = path.join(raptorDir, 'filters');

  [raptorDir, recordingsDir, filtersDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log('📝 Generating Raptor configuration...\n');

  // Generate main Raptor config
  const raptorConfig = generateRaptorConfig(serviceName);
  fs.writeFileSync(path.join(raptorDir, 'raptor.yml'), raptorConfig);
  console.log('   ✅ raptor/raptor.yml');

  // Generate recording filter config
  const filterConfig = generateRaptorFilters(serviceName);
  fs.writeFileSync(path.join(filtersDir, 'default-filters.yml'), filterConfig);
  console.log('   ✅ raptor/filters/default-filters.yml');

  // Generate sensitive data filters
  const sensitiveFilters = generateSensitiveDataFilters();
  fs.writeFileSync(path.join(filtersDir, 'sensitive-data.yml'), sensitiveFilters);
  console.log('   ✅ raptor/filters/sensitive-data.yml');

  // Generate replay configuration
  const replayConfig = generateReplayConfig(serviceName);
  fs.writeFileSync(path.join(raptorDir, 'replay.yml'), replayConfig);
  console.log('   ✅ raptor/replay.yml');

  // Generate Docker compose for Raptor
  const dockerCompose = generateRaptorDockerCompose(serviceName);
  fs.writeFileSync(path.join(outputDir, 'docker-compose.raptor.yml'), dockerCompose);
  console.log('   ✅ docker-compose.raptor.yml');

  // Generate CI/CD workflow for Raptor tests
  const workflowDir = path.join(outputDir, '.github/workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  const workflow = generateRaptorWorkflow(serviceName);
  fs.writeFileSync(path.join(workflowDir, 'raptor-tests.yml'), workflow);
  console.log('   ✅ .github/workflows/raptor-tests.yml');

  // Generate recording script
  const recordScript = generateRecordingScript(serviceName);
  fs.writeFileSync(path.join(raptorDir, 'record.sh'), recordScript);
  console.log('   ✅ raptor/record.sh');

  // Generate replay script
  const replayScript = generateReplayScript(serviceName);
  fs.writeFileSync(path.join(raptorDir, 'replay.sh'), replayScript);
  console.log('   ✅ raptor/replay.sh');

  // Generate sample recording (placeholder)
  const sampleRecording = generateSampleRecording(serviceName);
  fs.writeFileSync(path.join(recordingsDir, 'sample-recording.json'), JSON.stringify(sampleRecording, null, 2));
  console.log('   ✅ raptor/recordings/sample-recording.json');

  // Generate documentation
  const docs = generateRaptorDocs(serviceName);
  fs.writeFileSync(path.join(outputDir, 'raptor.md'), docs);
  console.log('   ✅ raptor.md');

  console.log('\n' + '─'.repeat(50));
  console.log('✨ Raptor onboarding complete!\n');
  console.log('Generated files:');
  console.log('   📁 raptor/                    - Raptor configuration');
  console.log('   📁 raptor/recordings/         - Traffic recordings');
  console.log('   📁 raptor/filters/            - Recording filters');
  console.log('   📄 raptor/raptor.yml          - Main configuration');
  console.log('   📄 raptor/replay.yml          - Replay configuration');
  console.log('');
  console.log('Next steps:');
  console.log('   1. Review raptor/raptor.yml and adjust endpoints');
  console.log('   2. Configure filters in raptor/filters/');
  console.log('   3. Record traffic: ./raptor/record.sh');
  console.log('   4. Replay tests: ./raptor/replay.sh');
  console.log('   5. Or use: docker-compose -f docker-compose.raptor.yml up');
  console.log('');
}

function generateRaptorConfig(serviceName: string): string {
  return `# Raptor Traffic Recording Configuration
# Service: ${serviceName}
# Generated by TARS - Test Automation and Review System

# Service configuration
service:
  name: ${serviceName}
  version: "1.0.0"
  
# Recording settings
recording:
  # Enable/disable recording
  enabled: true
  
  # Recording mode: proxy | sidecar | agent
  mode: proxy
  
  # Target service endpoint
  target:
    host: localhost
    port: 8080
    protocol: http
    
  # Proxy configuration (when mode: proxy)
  proxy:
    listenPort: 9080
    
  # What to record
  capture:
    requests: true
    responses: true
    headers: true
    body: true
    timing: true
    
  # Request matching
  match:
    # Include patterns (regex)
    include:
      - "^/api/.*"
      - "^/v[0-9]+/.*"
    # Exclude patterns (regex)
    exclude:
      - "^/health.*"
      - "^/metrics.*"
      - "^/actuator.*"
      - "^/swagger.*"
      - "^/favicon.ico"
      
  # Body size limits
  limits:
    maxBodySize: 1048576  # 1MB
    maxRecordingSize: 104857600  # 100MB
    
# Storage configuration
storage:
  # Storage type: file | s3 | gcs
  type: file
  
  # File storage settings
  file:
    directory: ./raptor/recordings
    format: json  # json | har
    compression: gzip
    
  # S3 storage settings (optional)
  # s3:
  #   bucket: raptor-recordings
  #   prefix: ${serviceName}/
  #   region: us-east-1
    
# Filters configuration
filters:
  # Filter config files
  files:
    - ./raptor/filters/default-filters.yml
    - ./raptor/filters/sensitive-data.yml
    
# Metadata to include in recordings
metadata:
  environment: \${ENVIRONMENT:-local}
  buildNumber: \${BUILD_NUMBER:-dev}
  gitCommit: \${GIT_COMMIT:-unknown}
  
# Logging
logging:
  level: info
  format: json
`;
}

function generateRaptorFilters(serviceName: string): string {
  return `# Raptor Default Filters
# Service: ${serviceName}
# Generated by TARS

# Header filters - what headers to include/exclude
headers:
  # Headers to always include
  include:
    - Content-Type
    - Accept
    - Authorization
    - X-Request-Id
    - X-Correlation-Id
    - X-Trace-Id
    
  # Headers to exclude from recording
  exclude:
    - Cookie
    - Set-Cookie
    - X-Forwarded-For
    - X-Real-IP
    
  # Headers to mask (replace value with ***)
  mask:
    - Authorization
    - X-API-Key
    - X-Auth-Token

# Query parameter filters
queryParams:
  # Parameters to exclude
  exclude:
    - token
    - api_key
    - apiKey
    - password
    
  # Parameters to mask
  mask:
    - access_token
    - refresh_token

# Request body filters
requestBody:
  # JSON paths to mask (JSONPath syntax)
  mask:
    - "$.password"
    - "$.credentials.password"
    - "$.user.password"
    - "$.apiKey"
    - "$.secret"
    - "$.token"
    - "$.creditCard"
    - "$.cvv"
    - "$.ssn"
    
  # JSON paths to exclude entirely
  exclude:
    - "$.internalMetadata"

# Response body filters
responseBody:
  # JSON paths to mask
  mask:
    - "$.accessToken"
    - "$.refreshToken"
    - "$.jwt"
    - "$.sessionId"
    
# URL path filters
paths:
  # Paths to never record
  exclude:
    - "/internal/.*"
    - "/debug/.*"
    - "/admin/.*"
`;
}

function generateSensitiveDataFilters(): string {
  return `# Sensitive Data Filters for Raptor
# Generated by TARS
#
# This file contains patterns for identifying and masking
# sensitive data in recordings. Customize based on your
# compliance requirements (PCI-DSS, HIPAA, GDPR, etc.)

# PII (Personally Identifiable Information)
pii:
  patterns:
    # Email addresses
    - pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
      replacement: "***@***.***"
      
    # Phone numbers (various formats)
    - pattern: "\\+?[0-9]{1,3}[-.\\s]?\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}"
      replacement: "***-***-****"
      
    # Social Security Numbers
    - pattern: "[0-9]{3}-[0-9]{2}-[0-9]{4}"
      replacement: "***-**-****"
      
    # IP Addresses
    - pattern: "\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b"
      replacement: "***.***.***.***"

# Financial data
financial:
  patterns:
    # Credit card numbers (basic pattern)
    - pattern: "\\b[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\\b"
      replacement: "****-****-****-****"
      
    # CVV
    - pattern: '"cvv"\\s*:\\s*"[0-9]{3,4}"'
      replacement: '"cvv": "***"'

# Authentication tokens
auth:
  patterns:
    # JWT tokens
    - pattern: "eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*"
      replacement: "[JWT_MASKED]"
      
    # Bearer tokens
    - pattern: "Bearer\\s+[a-zA-Z0-9_-]+"
      replacement: "Bearer [TOKEN_MASKED]"
      
    # API keys (common patterns)
    - pattern: "[a-zA-Z0-9]{32,}"
      replacement: "[API_KEY_MASKED]"
`;
}

function generateReplayConfig(serviceName: string): string {
  return `# Raptor Replay Configuration
# Service: ${serviceName}
# Generated by TARS

# Replay settings
replay:
  # Replay mode: sequential | parallel | stress
  mode: sequential
  
  # Target for replay
  target:
    host: localhost
    port: 8080
    protocol: http
    
  # Timing options
  timing:
    # Use original timing between requests
    preserveTiming: false
    # Fixed delay between requests (ms)
    delayMs: 100
    # Timeout for each request (ms)
    timeoutMs: 30000
    
  # Retry configuration
  retry:
    enabled: true
    maxRetries: 3
    backoffMs: 1000
    
  # Validation settings
  validation:
    # What to validate
    validateStatus: true
    validateHeaders: false
    validateBody: true
    
    # Status code matching
    statusMatch:
      # Exact match or range
      mode: range  # exact | range
      # Allow these status code differences
      allowedDifference: 0
      
    # Body validation
    bodyMatch:
      # Comparison mode: exact | semantic | schema
      mode: semantic
      # Ignore these JSON paths in comparison
      ignorePaths:
        - "$.timestamp"
        - "$.requestId"
        - "$.correlationId"
        - "$.createdAt"
        - "$.updatedAt"
        - "$.id"  # Often auto-generated
        
  # Variable substitution
  variables:
    # Extract from responses and use in subsequent requests
    extract:
      - name: authToken
        source: response
        path: "$.accessToken"
        
    # Replace in requests
    substitute:
      - pattern: "\\{\\{authToken\\}\\}"
        variable: authToken
        
# Assertions
assertions:
  # Built-in assertions
  builtin:
    - name: responseTime
      condition: "< 2000"  # ms
    - name: statusCode
      condition: "in [200, 201, 204]"
      
  # Custom assertions (JavaScript)
  custom:
    - name: validateUserResponse
      script: |
        (response) => {
          if (response.body.users) {
            return response.body.users.length > 0;
          }
          return true;
        }

# Reporting
reporting:
  # Output format: json | html | junit
  format: junit
  outputPath: ./raptor/reports/
  
  # Include in report
  include:
    summary: true
    failures: true
    timing: true
    diff: true
`;
}

function generateRaptorDockerCompose(serviceName: string): string {
  return `# Raptor Traffic Recording/Replay Docker Compose
# Service: ${serviceName}
# Generated by TARS - Test Automation and Review System

version: '3.8'

services:
  # Raptor proxy for recording traffic
  raptor-proxy:
    image: raptor/proxy:latest
    container_name: ${serviceName}-raptor-proxy
    ports:
      - "9080:9080"   # Proxy port (send traffic here)
      - "9081:9081"   # Admin/API port
    environment:
      - RAPTOR_TARGET_HOST=\${TARGET_HOST:-host.docker.internal}
      - RAPTOR_TARGET_PORT=\${TARGET_PORT:-8080}
      - RAPTOR_RECORDING_ENABLED=true
      - RAPTOR_STORAGE_PATH=/recordings
    volumes:
      - ./raptor/raptor.yml:/config/raptor.yml:ro
      - ./raptor/filters:/config/filters:ro
      - ./raptor/recordings:/recordings
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9081/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Raptor replay service
  raptor-replay:
    image: raptor/replay:latest
    container_name: ${serviceName}-raptor-replay
    profiles:
      - replay
    ports:
      - "9082:9082"   # Replay control port
    environment:
      - RAPTOR_TARGET_HOST=\${TARGET_HOST:-host.docker.internal}
      - RAPTOR_TARGET_PORT=\${TARGET_PORT:-8080}
      - RAPTOR_RECORDINGS_PATH=/recordings
      - RAPTOR_REPORTS_PATH=/reports
    volumes:
      - ./raptor/replay.yml:/config/replay.yml:ro
      - ./raptor/recordings:/recordings:ro
      - ./raptor/reports:/reports
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      - raptor-proxy

  # Optional: Target service (your application)
  ${serviceName}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${serviceName}-app
    profiles:
      - with-app
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=\${PROFILE:-default}

# Networks
networks:
  default:
    name: raptor-network

# Volumes for persistence
volumes:
  raptor-recordings:
  raptor-reports:
`;
}

function generateRaptorWorkflow(serviceName: string): string {
  return `# Raptor Traffic Replay Tests
# Service: ${serviceName}
# Generated by TARS - Test Automation and Review System

name: Raptor Replay Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'raptor/**'
  pull_request:
    branches: [main]
  schedule:
    # Run nightly at 2 AM
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      recording:
        description: 'Recording file to replay'
        required: false
        default: 'latest'

jobs:
  raptor-replay:
    runs-on: ubuntu-latest
    
    services:
      # Start your service
      app:
        image: \${{ github.repository }}:latest
        ports:
          - 8080:8080
        env:
          SPRING_PROFILES_ACTIVE: test
          
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Raptor
        run: |
          mkdir -p raptor/reports
          chmod +x raptor/*.sh
          
      - name: Download recordings
        uses: actions/download-artifact@v4
        with:
          name: raptor-recordings
          path: raptor/recordings
        continue-on-error: true
        
      - name: Wait for service
        run: |
          timeout 60 bash -c 'until curl -sf http://localhost:8080/health; do sleep 2; done'
          
      - name: Run Raptor replay
        run: |
          docker run --rm \\
            --network host \\
            -v \$PWD/raptor:/raptor \\
            raptor/replay:latest \\
            --config /raptor/replay.yml \\
            --recordings /raptor/recordings \\
            --output /raptor/reports \\
            --format junit
            
      - name: Publish test results
        uses: EnricoMi/publish-unit-test-result-action@v2
        if: always()
        with:
          files: raptor/reports/*.xml
          
      - name: Upload reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: raptor-reports
          path: raptor/reports/
          
      - name: Check for failures
        run: |
          if grep -q 'failures="[1-9]' raptor/reports/*.xml 2>/dev/null; then
            echo "❌ Raptor replay tests failed!"
            exit 1
          fi
          echo "✅ All Raptor replay tests passed!"

  record-traffic:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.recording == 'new'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Start recording proxy
        run: |
          docker-compose -f docker-compose.raptor.yml up -d raptor-proxy
          sleep 5
          
      - name: Run traffic generation
        run: |
          # Add your traffic generation script here
          echo "Generate traffic against http://localhost:9080"
          # Example: run your E2E tests against the proxy
          
      - name: Stop and save recording
        run: |
          curl -X POST http://localhost:9081/recording/stop
          docker-compose -f docker-compose.raptor.yml down
          
      - name: Upload recording
        uses: actions/upload-artifact@v4
        with:
          name: raptor-recordings
          path: raptor/recordings/
`;
}

function generateRecordingScript(serviceName: string): string {
  return `#!/bin/bash
# Raptor Recording Script
# Service: ${serviceName}
# Generated by TARS

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🎬 Starting Raptor Recording for ${serviceName}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Set defaults
TARGET_HOST=\${TARGET_HOST:-localhost}
TARGET_PORT=\${TARGET_PORT:-8080}
RECORDING_NAME=\${RECORDING_NAME:-recording-$(date +%Y%m%d-%H%M%S)}

echo "📋 Configuration:"
echo "   Target: http://$TARGET_HOST:$TARGET_PORT"
echo "   Recording: $RECORDING_NAME"
echo ""

# Start the recording proxy
echo "🚀 Starting Raptor proxy..."
docker-compose -f docker-compose.raptor.yml up -d raptor-proxy

# Wait for proxy to be ready
echo "⏳ Waiting for proxy to be ready..."
timeout 30 bash -c 'until curl -sf http://localhost:9081/health > /dev/null 2>&1; do sleep 1; done'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Raptor proxy is running!"
echo ""
echo "📝 Send your traffic to: http://localhost:9080"
echo "   (Proxy will forward to http://$TARGET_HOST:$TARGET_PORT)"
echo ""
echo "📊 View recording status: http://localhost:9081/status"
echo ""
echo "🛑 To stop recording, run: ./raptor/stop-recording.sh"
echo "   Or press Ctrl+C"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Handle Ctrl+C
trap 'echo ""; echo "🛑 Stopping recording..."; docker-compose -f docker-compose.raptor.yml down; exit 0' INT

# Keep running
while true; do
    sleep 1
done
`;
}

function generateReplayScript(serviceName: string): string {
  return `#!/bin/bash
# Raptor Replay Script
# Service: ${serviceName}
# Generated by TARS

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "▶️  Starting Raptor Replay for ${serviceName}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check for recordings
if [ ! -d "raptor/recordings" ] || [ -z "$(ls -A raptor/recordings 2>/dev/null)" ]; then
    echo "❌ No recordings found in raptor/recordings/"
    echo "   Run ./raptor/record.sh first to create recordings."
    exit 1
fi

# Set defaults
TARGET_HOST=\${TARGET_HOST:-localhost}
TARGET_PORT=\${TARGET_PORT:-8080}
RECORDING_FILE=\${1:-$(ls -t raptor/recordings/*.json 2>/dev/null | head -1)}

if [ -z "$RECORDING_FILE" ]; then
    echo "❌ No recording file specified and none found."
    exit 1
fi

echo "📋 Configuration:"
echo "   Target: http://$TARGET_HOST:$TARGET_PORT"
echo "   Recording: $RECORDING_FILE"
echo ""

# Create reports directory
mkdir -p raptor/reports

# Run replay
echo "🚀 Running replay..."
docker run --rm \\
    --network host \\
    -v "$PWD/raptor:/raptor" \\
    -e RAPTOR_TARGET_HOST=$TARGET_HOST \\
    -e RAPTOR_TARGET_PORT=$TARGET_PORT \\
    raptor/replay:latest \\
    --config /raptor/replay.yml \\
    --recording "/raptor/recordings/$(basename $RECORDING_FILE)" \\
    --output /raptor/reports \\
    --format junit

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Replay complete!"
echo ""
echo "📊 Reports available in: raptor/reports/"
echo "═══════════════════════════════════════════════════════════"
`;
}

function generateSampleRecording(serviceName: string): any {
  return {
    _meta: {
      version: "1.0",
      service: serviceName,
      recordedAt: new Date().toISOString(),
      environment: "local",
      generatedBy: "TARS - Test Automation and Review System"
    },
    requests: [
      {
        id: "req-001",
        timestamp: "2024-01-15T10:00:00.000Z",
        method: "GET",
        path: "/api/health",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Raptor/1.0"
        },
        response: {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          },
          body: { status: "ok" },
          latencyMs: 15
        }
      },
      {
        id: "req-002",
        timestamp: "2024-01-15T10:00:01.000Z",
        method: "GET",
        path: "/api/users",
        headers: {
          "Accept": "application/json",
          "Authorization": "[MASKED]"
        },
        response: {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          },
          body: {
            users: [
              { id: "user-001", name: "John Doe" },
              { id: "user-002", name: "Jane Smith" }
            ]
          },
          latencyMs: 45
        }
      },
      {
        id: "req-003",
        timestamp: "2024-01-15T10:00:02.000Z",
        method: "POST",
        path: "/api/orders",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "[MASKED]"
        },
        body: {
          userId: "user-001",
          items: [
            { productId: "prod-001", quantity: 2 }
          ]
        },
        response: {
          status: 201,
          headers: {
            "Content-Type": "application/json"
          },
          body: {
            id: "order-001",
            status: "created",
            total: 59.98
          },
          latencyMs: 120
        }
      }
    ]
  };
}

function generateRaptorDocs(serviceName: string): string {
  return `# Raptor Traffic Recording/Replay: ${serviceName}

## Overview

Raptor enables traffic recording and replay for ${serviceName}. This allows you to:
- 📹 Record real production/staging traffic
- ▶️ Replay traffic against test environments
- 🔍 Detect API regressions automatically
- 📊 Generate test reports

## Quick Start

### Recording Traffic

\`\`\`bash
# Start the recording proxy
./raptor/record.sh

# Send traffic to http://localhost:9080
# Proxy forwards to your service at http://localhost:8080

# Stop recording
Ctrl+C or ./raptor/stop-recording.sh
\`\`\`

### Replaying Traffic

\`\`\`bash
# Replay the latest recording
./raptor/replay.sh

# Replay a specific recording
./raptor/replay.sh raptor/recordings/my-recording.json
\`\`\`

## Configuration Files

| File | Purpose |
|------|---------|
| \`raptor/raptor.yml\` | Main recording configuration |
| \`raptor/replay.yml\` | Replay and validation settings |
| \`raptor/filters/default-filters.yml\` | Header/body filters |
| \`raptor/filters/sensitive-data.yml\` | PII/sensitive data masking |

## Directory Structure

\`\`\`
raptor/
├── raptor.yml              # Recording config
├── replay.yml              # Replay config
├── record.sh               # Start recording script
├── replay.sh               # Run replay script
├── recordings/             # Recorded traffic files
│   └── sample-recording.json
├── filters/                # Filter configurations
│   ├── default-filters.yml
│   └── sensitive-data.yml
└── reports/                # Test reports (generated)
\`\`\`

## Recording Configuration

### What Gets Recorded

- ✅ HTTP method, path, query params
- ✅ Request/response headers
- ✅ Request/response bodies
- ✅ Response status codes
- ✅ Timing information

### What Gets Filtered

- 🔒 Authorization headers (masked)
- 🔒 Cookies (excluded)
- 🔒 Passwords in body (masked)
- 🔒 Credit card numbers (masked)
- 🔒 JWT tokens (masked)

## Replay Validation

Raptor validates replayed responses against recorded responses:

| Check | Mode | Description |
|-------|------|-------------|
| Status Code | Exact/Range | HTTP status must match |
| Response Body | Semantic | JSON structure comparison |
| Response Time | Threshold | Must be under limit |

### Ignored Fields

These fields are ignored during comparison (configurable):
- \`timestamp\`
- \`requestId\`
- \`createdAt\`
- \`updatedAt\`

## Docker Usage

\`\`\`bash
# Start recording proxy
docker-compose -f docker-compose.raptor.yml up raptor-proxy

# Run replay
docker-compose -f docker-compose.raptor.yml --profile replay up raptor-replay

# Full stack (with your app)
docker-compose -f docker-compose.raptor.yml --profile with-app up
\`\`\`

## CI/CD Integration

The generated GitHub Actions workflow (\`.github/workflows/raptor-tests.yml\`) will:

1. Start your service
2. Replay recorded traffic
3. Validate responses
4. Generate JUnit reports
5. Fail build on regressions

### Manual Trigger

\`\`\`bash
gh workflow run raptor-tests.yml
\`\`\`

## Best Practices

### Recording

1. **Record in staging** - Use realistic data
2. **Filter sensitive data** - Never record passwords/tokens
3. **Name recordings** - Use descriptive names
4. **Version recordings** - Track with git or artifacts

### Replay

1. **Reset state first** - Ensure clean environment
2. **Use hermetic server** - Predictable responses
3. **Ignore dynamic fields** - timestamps, IDs
4. **Set reasonable thresholds** - Account for variance

## Troubleshooting

### Recording not capturing traffic

1. Ensure traffic goes through proxy port (9080)
2. Check filter patterns in \`raptor.yml\`
3. Verify target service is reachable

### Replay failures

1. Check response body differences in report
2. Verify target service state
3. Review ignored paths in \`replay.yml\`

## Integration with Hermetic

Raptor works best with Hermetic servers:

\`\`\`bash
# 1. Start hermetic server
docker-compose -f docker-compose.hermetic.yml up -d

# 2. Record against hermetic
TARGET_PORT=8080 ./raptor/record.sh

# 3. Replay against hermetic
TARGET_PORT=8080 ./raptor/replay.sh
\`\`\`

## Generated by TARS
Test Automation and Review System
`;
}
