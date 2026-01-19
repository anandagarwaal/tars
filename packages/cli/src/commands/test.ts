import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

const API_URL = process.env.TARS_API_URL || 'http://localhost:3001';

export const testCommand = new Command('test')
  .description('Run generated tests')
  .option('--dir <directory>', 'Directory containing tests', './generated-tests')
  .option('--framework <framework>', 'Test framework (jest, junit, testng, cypress, playwright)', 'jest')
  .option('--pattern <pattern>', 'File pattern to match (regex)')
  .option('--file <file>', 'Run a specific test file')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
  .action(async (options) => {
    console.log('\n🧪 TARS Test Runner\n');
    
    const directory = path.resolve(options.dir);
    const framework = options.framework;
    
    console.log(`   Directory:  ${directory}`);
    console.log(`   Framework:  ${framework}`);
    console.log(`   Timeout:    ${options.timeout}ms`);
    console.log('');

    // Check if directory exists
    if (!fs.existsSync(directory)) {
      console.log(`❌ Directory not found: ${directory}`);
      console.log('   Generate tests first with: tars generate --prd <id>');
      process.exit(1);
    }

    // Run single file or all tests
    if (options.file) {
      await runSingleTest(options.file, framework, directory, parseInt(options.timeout));
    } else {
      await runAllTests(directory, framework, options.pattern, parseInt(options.timeout));
    }
  });

async function runSingleTest(file: string, framework: string, workingDir: string, timeout: number) {
  console.log(`📝 Running test: ${file}\n`);

  try {
    const response = await fetch(`${API_URL}/api/tests/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testFile: file,
        framework,
        workingDir,
        timeout,
      }),
    });

    if (!response.ok) {
      const errData = await response.json() as any;
      console.log(`❌ API Error: ${errData.error}`);
      process.exit(1);
    }

    const data = await response.json() as any;
    printResult(data.result);
    
    process.exit(data.success ? 0 : 1);
  } catch (err) {
    console.log(`❌ Failed to connect to TARS API: ${(err as Error).message}`);
    console.log('   Make sure the API is running: cd packages/api && npm run dev');
    
    // Fallback to local execution
    console.log('\n📋 Attempting local execution...\n');
    await runTestLocally(file, framework, workingDir, timeout);
  }
}

async function runAllTests(directory: string, framework: string, pattern: string | undefined, timeout: number) {
  console.log(`📁 Running all ${framework} tests in: ${directory}\n`);

  try {
    const response = await fetch(`${API_URL}/api/tests/run-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directory,
        framework,
        pattern,
      }),
    });

    if (!response.ok) {
      const errData = await response.json() as any;
      console.log(`❌ API Error: ${errData.error}`);
      process.exit(1);
    }

    const data = await response.json() as any;
    
    // Print summary
    console.log('─'.repeat(50));
    console.log('📊 Test Summary\n');
    console.log(`   Total:    ${data.summary.total}`);
    console.log(`   ✅ Passed: ${data.summary.passed}`);
    console.log(`   ❌ Failed: ${data.summary.failed}`);
    if (data.summary.errors > 0) console.log(`   ⚠️ Errors: ${data.summary.errors}`);
    if (data.summary.timeouts > 0) console.log(`   ⏱️ Timeouts: ${data.summary.timeouts}`);
    console.log(`   ⏱️ Duration: ${data.summary.totalDurationMs}ms`);
    console.log('');

    // Print individual results
    if (data.results.length > 0) {
      console.log('─'.repeat(50));
      console.log('📋 Results\n');
      for (const result of data.results) {
        const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
        console.log(`   ${icon} ${result.id.substring(0, 8)}... (${result.durationMs}ms)`);
        if (result.summary) {
          console.log(`      ${result.summary.passed}/${result.summary.total} tests passed`);
        }
      }
      console.log('');
    }

    process.exit(data.success ? 0 : 1);
  } catch (err) {
    console.log(`❌ Failed to connect to TARS API: ${(err as Error).message}`);
    console.log('   Make sure the API is running: cd packages/api && npm run dev');
    
    // Fallback to local execution
    console.log('\n📋 Attempting local execution...\n');
    await runTestsLocally(directory, framework);
  }
}

async function runTestLocally(file: string, framework: string, workingDir: string, timeout: number) {
  const { spawn } = await import('child_process');
  
  const commands: Record<string, { cmd: string; args: string[] }> = {
    jest: { cmd: 'npx', args: ['jest', file, '--colors'] },
    mocha: { cmd: 'npx', args: ['mocha', file] },
    cypress: { cmd: 'npx', args: ['cypress', 'run', '--spec', file] },
    playwright: { cmd: 'npx', args: ['playwright', 'test', file] },
    junit: { cmd: 'mvn', args: ['test', `-Dtest=${path.basename(file, '.java')}`] },
  };

  const cmdConfig = commands[framework];
  if (!cmdConfig) {
    console.log(`❌ Unsupported framework for local execution: ${framework}`);
    process.exit(1);
  }

  console.log(`$ ${cmdConfig.cmd} ${cmdConfig.args.join(' ')}\n`);

  const proc = spawn(cmdConfig.cmd, cmdConfig.args, {
    cwd: workingDir,
    stdio: 'inherit',
    shell: true,
  });

  proc.on('close', (code) => {
    process.exit(code || 0);
  });
}

async function runTestsLocally(directory: string, framework: string) {
  const { spawn } = await import('child_process');
  
  const commands: Record<string, { cmd: string; args: string[] }> = {
    jest: { cmd: 'npx', args: ['jest', '--colors'] },
    mocha: { cmd: 'npx', args: ['mocha', '**/*.test.js', '**/*.test.ts'] },
    cypress: { cmd: 'npx', args: ['cypress', 'run'] },
    playwright: { cmd: 'npx', args: ['playwright', 'test'] },
    junit: { cmd: 'mvn', args: ['test'] },
  };

  const cmdConfig = commands[framework];
  if (!cmdConfig) {
    console.log(`❌ Unsupported framework for local execution: ${framework}`);
    process.exit(1);
  }

  console.log(`$ ${cmdConfig.cmd} ${cmdConfig.args.join(' ')}\n`);

  const proc = spawn(cmdConfig.cmd, cmdConfig.args, {
    cwd: directory,
    stdio: 'inherit',
    shell: true,
  });

  proc.on('close', (code) => {
    process.exit(code || 0);
  });
}

function printResult(result: any) {
  const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
  
  console.log('─'.repeat(50));
  console.log(`${icon} ${result.status.toUpperCase()}`);
  console.log('');
  console.log(`   Run ID:    ${result.id}`);
  console.log(`   Duration:  ${result.durationMs}ms`);
  console.log(`   Exit Code: ${result.exitCode}`);
  
  if (result.summary) {
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total:   ${result.summary.total}`);
    console.log(`   Passed:  ${result.summary.passed}`);
    console.log(`   Failed:  ${result.summary.failed}`);
    console.log(`   Skipped: ${result.summary.skipped}`);
  }

  if (result.output && result.status !== 'passed') {
    console.log('');
    console.log('📋 Output:');
    console.log('─'.repeat(50));
    console.log(result.output.substring(0, 2000));
    if (result.output.length > 2000) {
      console.log('\n... (truncated)');
    }
  }
  
  console.log('');
}
