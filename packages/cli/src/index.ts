#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { onboardCommand } from './commands/onboard';
import { analyzeCommand } from './commands/analyze';
import { statusCommand } from './commands/status';
import { testCommand } from './commands/test';
import { gitCommand, gitHistoryCommand } from './commands/git';

const program = new Command();

program
  .name('tars')
  .description('🤖 TARS - Test Automation and Review System')
  .version('1.0.0');

// Add commands
program.addCommand(generateCommand);
program.addCommand(onboardCommand);
program.addCommand(analyzeCommand);
program.addCommand(statusCommand);
program.addCommand(testCommand);
program.addCommand(gitCommand);
program.addCommand(gitHistoryCommand);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   🤖 TARS - Test Automation and Review System              ║
  ║                                                            ║
  ║   Generate tests from PRDs and automate Hermetic           ║
  ║   onboarding for your services.                            ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝

  Quick Start:
  
  $ tars analyze              # Analyze your repository
  $ tars generate --prd <id>  # Generate tests from PRD
  $ tars test --dir ./tests   # Run generated tests
  $ tars commit --dir ./tests # Commit tests to git
  $ tars onboard hermetic     # Onboard to Hermetic
  $ tars status               # Check onboarding status

  For more info, run: tars --help
  `);
}
