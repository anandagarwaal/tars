import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.TARS_API_URL || 'http://localhost:3001';

export const analyzeCommand = new Command('analyze')
  .description('Analyze repository structure and detect frameworks')
  .option('--path <path>', 'Path to analyze', '.')
  .option('--deep', 'Perform deep analysis with LLM', false)
  .option('--all', 'Analyze ALL files without limit (may be slow for large repos)')
  .option('--limit <number>', 'Custom file limit (default: 50 quick, 100 deep)', parseInt)
  .option('--for-testing', 'Analyze with focus on testing recommendations')
  .option('--for-hermetic', 'Analyze with focus on Hermetic readiness')
  .option('--output <format>', 'Output format (json, summary)', 'summary')
  .action(async (options) => {
    console.log('\n🔍 TARS Code Analyzer\n');
    
    const targetPath = path.resolve(options.path);
    
    // Determine file limit
    let fileLimit: number;
    if (options.all) {
      fileLimit = Infinity;
    } else if (options.limit) {
      fileLimit = options.limit;
    } else {
      fileLimit = options.deep ? 100 : 50;
    }
    
    const limitDisplay = fileLimit === Infinity ? 'unlimited' : fileLimit.toString();
    console.log(`   Path: ${targetPath}`);
    console.log(`   Mode: ${options.deep ? 'Deep (LLM)' : 'Quick'}`);
    console.log(`   Limit: ${limitDisplay} files`);
    console.log('');

    // Collect files BEFORE try block so it's accessible in catch
    console.log('📁 Scanning files...');
    const files = collectFiles(targetPath, fileLimit);
    console.log(`   Found ${files.length} relevant files\n`);
    
    // Show file type breakdown
    const extensions: Record<string, number> = {};
    for (const f of files) {
      const ext = f.path.split('.').pop() || 'other';
      extensions[ext] = (extensions[ext] || 0) + 1;
    }
    const topExts = Object.entries(extensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `${ext}(${count})`)
      .join(', ');
    console.log(`   Types: ${topExts}\n`);

    if (files.length === 0) {
      console.log('⚠️  No source files found in this directory');
      return;
    }

    try {
      // Choose analysis endpoint
      let endpoint = '/api/analyze';
      if (!options.deep) endpoint = '/api/analyze/quick';
      else if (options.forTesting) endpoint = '/api/analyze/for-testing';
      else if (options.forHermetic) endpoint = '/api/analyze/for-hermetic';

      console.log('🤖 Analyzing code...');
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json() as any;

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAnalysisSummary(result, options);
      }

    } catch (error: any) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        console.log('⚠️  API not available, performing local analysis...\n');
        // Use the already collected files for local analysis
        const localAnalysis = performLocalAnalysis(files);
        printLocalAnalysis(localAnalysis);
      } else {
        console.error('❌ Analysis failed:', error.message);
      }
    }
  });

interface FileInfo {
  path: string;
  content: string;
}

function collectFiles(dirPath: string, maxFiles: number): FileInfo[] {
  const files: FileInfo[] = [];
  const relevantExtensions = [
    '.java', '.ts', '.tsx', '.js', '.jsx', '.kt', '.scala',  // JVM & JS
    '.py', '.go', '.rs', '.rb', '.php', '.cs',              // Other languages
    '.json', '.yml', '.yaml', '.xml', '.gradle', '.toml',   // Config
    '.md', '.txt'                                           // Docs
  ];
  const ignoreDirs = [
    'node_modules', '.git', 'dist', 'build', 'target', '.next', '__pycache__',
    'vendor', '.idea', '.vscode', 'coverage', '.gradle', 'bin', 'obj'
  ];
  
  // Priority files to always include if found
  const priorityFiles = [
    'package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts',
    'requirements.txt', 'Cargo.toml', 'go.mod', 'Gemfile',
    'tsconfig.json', 'jest.config.js', 'cypress.config.js',
    'docker-compose.yml', 'Dockerfile', '.env.example'
  ];

  // First pass: collect priority config files
  function collectPriorityFiles(dir: string) {
    let items: string[];
    try {
      items = fs.readdirSync(dir);
    } catch (e) {
      return;
    }

    for (const item of items) {
      if (ignoreDirs.includes(item)) continue;
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && priorityFiles.includes(item)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length < 100000) { // 100KB for config files
            files.push({
              path: path.relative(dirPath, fullPath),
              content,
            });
          }
        } else if (stat.isDirectory() && files.length < 5) {
          // Check one level deep for priority files
          collectPriorityFiles(fullPath);
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Second pass: collect source files
  function walk(dir: string, depth: number = 0) {
    if (files.length >= maxFiles || depth > 10) return; // Max depth of 10

    let items: string[];
    try {
      items = fs.readdirSync(dir);
    } catch (e) {
      return;
    }

    // Sort to prioritize src, lib, app directories
    const priorityDirs = ['src', 'lib', 'app', 'main', 'core', 'api', 'services', 'controllers'];
    items.sort((a, b) => {
      const aP = priorityDirs.indexOf(a.toLowerCase());
      const bP = priorityDirs.indexOf(b.toLowerCase());
      if (aP !== -1 && bP === -1) return -1;
      if (bP !== -1 && aP === -1) return 1;
      return 0;
    });

    for (const item of items) {
      if (files.length >= maxFiles) break;
      if (ignoreDirs.includes(item)) continue;
      if (item.startsWith('.')) continue; // Skip hidden files/dirs

      const fullPath = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (relevantExtensions.some(ext => item.endsWith(ext))) {
        // Skip if already added as priority file
        const relPath = path.relative(dirPath, fullPath);
        if (files.some(f => f.path === relPath)) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Skip very large files but allow up to 80KB
          if (content.length < 80000) {
            files.push({
              path: relPath,
              content,
            });
          }
        } catch (e) {
          // Skip unreadable files
        }
      }
    }
  }

  // Collect priority files first
  collectPriorityFiles(dirPath);
  
  // Then walk for source files
  walk(dirPath);
  
  return files;
}

function printAnalysisSummary(result: any, options: any) {
  console.log('\n' + '═'.repeat(50));
  console.log('📊 ANALYSIS RESULTS');
  console.log('═'.repeat(50) + '\n');

  if (result.analysis) {
    // Quick analysis result
    const a = result.analysis;
    console.log(`Language:     ${a.language}`);
    if (a.framework) console.log(`Framework:    ${a.framework}`);
    console.log(`Total Files:  ${a.totalFiles}`);
    console.log(`Source Files: ${a.sourceFiles}`);
    console.log(`Test Files:   ${a.testFiles}`);
    console.log(`Config Files: ${a.configFiles}`);
    
    if (a.dependencies?.length > 0) {
      console.log(`\n📦 Dependencies (${a.dependencies.length}):`);
      console.log('   ' + a.dependencies.slice(0, 10).join(', '));
    }
  }

  if (result.summary) {
    console.log(result.summary);
  }

  if (result.context) {
    console.log('\n📋 Context Summary:');
    console.log(result.context);
  }

  if (result.recommendations) {
    const r = result.recommendations;
    console.log('\n🎯 TESTING RECOMMENDATIONS');
    console.log('─'.repeat(40));
    console.log(`Suggested Framework: ${r.suggestedFramework}`);
    console.log(`Suggested Test Types: ${r.suggestedTestTypes.join(', ')}`);
    
    if (r.coverageGaps?.length > 0) {
      console.log('\n⚠️  Coverage Gaps:');
      r.coverageGaps.forEach((g: string) => console.log(`   • ${g}`));
    }
    
    if (r.priorityTargets?.length > 0) {
      console.log('\n🎯 Priority Targets:');
      r.priorityTargets.forEach((t: any) => {
        console.log(`   • ${t.name}`);
        console.log(`     Reason: ${t.reason}`);
      });
    }
  }

  if (result.hermetic) {
    const h = result.hermetic;
    console.log('\n🔒 HERMETIC READINESS');
    console.log('─'.repeat(40));
    console.log(`Readiness Score: ${h.readinessScore}/100`);
    
    if (h.blockers?.length > 0) {
      console.log('\n🚫 Blockers:');
      h.blockers.forEach((b: string) => console.log(`   • ${b}`));
    }
    
    if (h.recommendations?.length > 0) {
      console.log('\n💡 Recommendations:');
      h.recommendations.forEach((r: string) => console.log(`   • ${r}`));
    }
    
    if (h.detectedExternalDeps?.length > 0) {
      console.log('\n🔗 External Dependencies to Mock:');
      h.detectedExternalDeps.forEach((d: string) => console.log(`   • ${d}`));
    }
    
    if (h.suggestedFakes?.length > 0) {
      console.log('\n🎭 Suggested Fakes:');
      h.suggestedFakes.forEach((f: string) => console.log(`   • ${f}`));
    }
    
    if (h.entities?.length > 0) {
      console.log('\n📦 Detected Entities:');
      console.log('   ' + h.entities.join(', '));
    }
  }

  console.log('\n' + '═'.repeat(50) + '\n');
}

function performLocalAnalysis(files: FileInfo[]): any {
  const extensions: Record<string, number> = {};
  let language = 'unknown';
  let framework: string | undefined;
  let buildTool: string | undefined;
  const dependencies: string[] = [];

  for (const file of files) {
    const ext = file.path.split('.').pop() || '';
    const fileName = file.path.split('/').pop() || '';
    extensions[ext] = (extensions[ext] || 0) + 1;

    // Detect framework from content
    if (file.content.includes('@SpringBootApplication')) framework = 'Spring Boot';
    else if (file.content.includes('@SpringBootTest')) framework = 'Spring Boot';
    else if (file.content.includes('express()')) framework = 'Express';
    else if (file.content.includes('next/')) framework = 'Next.js';
    else if (file.content.includes('React')) framework = 'React';
    else if (file.content.includes('dropwizard')) framework = 'Dropwizard';
    else if (file.content.includes('@Inject') || file.content.includes('Guice')) framework = 'Guice';

    // Extract package.json deps (Node.js)
    if (fileName === 'package.json') {
      buildTool = 'npm';
      try {
        const pkg = JSON.parse(file.content);
        dependencies.push(...Object.keys(pkg.dependencies || {}));
        dependencies.push(...Object.keys(pkg.devDependencies || {}));
      } catch (e) {}
    }

    // Extract pom.xml deps (Maven/Java)
    if (fileName === 'pom.xml') {
      buildTool = 'maven';
      const artifactMatches = file.content.match(/<artifactId>([^<]+)<\/artifactId>/g) || [];
      for (const match of artifactMatches) {
        const id = match.replace(/<\/?artifactId>/g, '');
        if (!id.includes('${') && id.length > 0) dependencies.push(id);
      }
    }

    // Extract build.gradle deps (Gradle/Java)
    if (fileName.includes('build.gradle')) {
      buildTool = 'gradle';
      const implMatches = file.content.match(/implementation\s*\(?['"]([^'"]+)['"]\)?/g) || [];
      const testMatches = file.content.match(/testImplementation\s*\(?['"]([^'"]+)['"]\)?/g) || [];
      for (const match of [...implMatches, ...testMatches]) {
        const dep = match.replace(/\w+\s*\(?['"]/, '').replace(/['"]\)?/, '');
        const name = dep.split(':')[1] || dep;
        if (name.length > 0) dependencies.push(name);
      }
    }

    // Extract requirements.txt deps (Python)
    if (fileName === 'requirements.txt') {
      buildTool = 'pip';
      const lines = file.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          const pkgName = trimmed.split(/[=<>!~\[]/)[0].trim();
          if (pkgName.length > 0) dependencies.push(pkgName);
        }
      }
    }

    // Extract go.mod deps (Go)
    if (fileName === 'go.mod') {
      buildTool = 'go';
      const requireMatches = file.content.match(/require\s+\([\s\S]*?\)|require\s+\S+/g) || [];
      for (const match of requireMatches) {
        const lines = match.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0] && !parts[0].includes('require') && !parts[0].includes('(') && !parts[0].includes(')')) {
            dependencies.push(parts[0].split('/').pop() || parts[0]);
          }
        }
      }
    }
  }

  // Detect language
  if (extensions['java'] > 0) language = 'java';
  else if (extensions['kt'] > 0) language = 'kotlin';
  else if (extensions['py'] > 0) language = 'python';
  else if (extensions['go'] > 0) language = 'go';
  else if (extensions['ts'] > 0 || extensions['tsx'] > 0) language = 'typescript';
  else if (extensions['js'] > 0) language = 'javascript';

  // Dedupe and filter dependencies
  const uniqueDeps = [...new Set(dependencies)].filter(d => d && d.length > 1 && !d.includes('${'));

  return {
    language,
    framework,
    buildTool,
    totalFiles: files.length,
    sourceFiles: Object.entries(extensions)
      .filter(([ext]) => ['java', 'kt', 'ts', 'tsx', 'js', 'jsx', 'py', 'go'].includes(ext))
      .reduce((sum, [, count]) => sum + count, 0),
    testFiles: files.filter(f => f.path.toLowerCase().includes('test') || f.path.includes('spec')).length,
    configFiles: files.filter(f => ['xml', 'json', 'yml', 'yaml', 'toml'].includes(f.path.split('.').pop() || '')).length,
    dependencies: uniqueDeps,
    extensions,
  };
}

function printLocalAnalysis(analysis: any) {
  console.log('\n' + '═'.repeat(50));
  console.log('📊 LOCAL ANALYSIS (API unavailable)');
  console.log('═'.repeat(50) + '\n');
  
  console.log(`Language:     ${analysis.language}`);
  if (analysis.framework) console.log(`Framework:    ${analysis.framework}`);
  if (analysis.buildTool) console.log(`Build Tool:   ${analysis.buildTool}`);
  console.log(`Total Files:  ${analysis.totalFiles}`);
  console.log(`Source Files: ${analysis.sourceFiles}`);
  console.log(`Test Files:   ${analysis.testFiles}`);
  console.log(`Config Files: ${analysis.configFiles}`);
  
  if (analysis.dependencies && analysis.dependencies.length > 0) {
    console.log(`\n📦 Dependencies (${analysis.dependencies.length}):`);
    // Show first 20 dependencies
    const deps = analysis.dependencies.slice(0, 20);
    console.log('   ' + deps.join(', '));
    if (analysis.dependencies.length > 20) {
      console.log(`   ... and ${analysis.dependencies.length - 20} more`);
    }
  }

  // Show file extension breakdown
  if (analysis.extensions) {
    const extEntries = Object.entries(analysis.extensions)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 8);
    if (extEntries.length > 0) {
      console.log('\n📁 File Types:');
      for (const [ext, count] of extEntries) {
        const bar = '█'.repeat(Math.min(20, Math.ceil((count as number) / analysis.totalFiles * 40)));
        console.log(`   .${ext.padEnd(6)} ${String(count).padStart(3)} ${bar}`);
      }
    }
  }

  console.log('\n💡 Tip: Start the TARS API for deeper analysis with LLM');
  console.log('   Run: cd tars/packages/api && npm run dev');
  
  console.log('\n' + '═'.repeat(50) + '\n');
}

// Export for use in other commands
export { collectFiles, FileInfo };
