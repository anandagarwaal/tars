import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const statusCommand = new Command('status')
  .description('Check Hermetic and Raptor onboarding status')
  .option('-p, --path <path>', 'Path to repository', '.')
  .action(async (options) => {
    console.log('\n📊 TARS Onboarding Status\n');

    const repoPath = path.resolve(options.path);

    // Check Hermetic status
    const hermeticStatus = checkHermeticStatus(repoPath);
    console.log('🔒 Hermetic Server:');
    console.log('─'.repeat(40));
    if (hermeticStatus.onboarded) {
      console.log(`   Status:     ✅ Onboarded`);
      console.log(`   Mode:       ${hermeticStatus.mode}`);
      console.log(`   Config:     ${hermeticStatus.configPath}`);
    } else {
      console.log(`   Status:     ❌ Not onboarded`);
      console.log(`   Tip:        Run 'tars onboard hermetic' to get started`);
    }
    console.log('');

    // Check Raptor status
    const raptorStatus = checkRaptorStatus(repoPath);
    console.log('🦖 Raptor:');
    console.log('─'.repeat(40));
    if (raptorStatus.onboarded) {
      console.log(`   Status:     ✅ Onboarded`);
      console.log(`   Config:     ${raptorStatus.configPath}`);
    } else {
      console.log(`   Status:     ❌ Not onboarded`);
      console.log(`   Tip:        Run 'tars onboard raptor' to get started`);
    }
    console.log('');

    // Summary
    console.log('📋 Summary:');
    console.log('─'.repeat(40));
    const total = (hermeticStatus.onboarded ? 1 : 0) + (raptorStatus.onboarded ? 1 : 0);
    console.log(`   Onboarded:  ${total}/2 services`);
    console.log('');
  });

interface OnboardingStatus {
  onboarded: boolean;
  mode?: string;
  configPath?: string;
}

function checkHermeticStatus(repoPath: string): OnboardingStatus {
  // Check for hermetic.md
  const hermeticMd = path.join(repoPath, 'hermetic.md');
  if (fs.existsSync(hermeticMd)) {
    // Check for mode
    const hermeticDir = path.join(repoPath, 'src/hermetic');
    const mockoonDir = path.join(repoPath, 'mockoon');
    
    if (fs.existsSync(hermeticDir)) {
      return {
        onboarded: true,
        mode: 'code-change',
        configPath: 'src/hermetic/',
      };
    }
    
    if (fs.existsSync(mockoonDir)) {
      return {
        onboarded: true,
        mode: 'mockoon',
        configPath: 'mockoon/',
      };
    }
  }

  // Check for docker-compose.hermetic.yml
  if (fs.existsSync(path.join(repoPath, 'docker-compose.hermetic.yml'))) {
    return {
      onboarded: true,
      mode: 'code-change',
      configPath: 'docker-compose.hermetic.yml',
    };
  }

  return { onboarded: false };
}

function checkRaptorStatus(repoPath: string): OnboardingStatus {
  // Check for raptor configuration files
  const raptorConfig = path.join(repoPath, 'raptor.yml');
  const raptorDir = path.join(repoPath, '.raptor');

  if (fs.existsSync(raptorConfig)) {
    return {
      onboarded: true,
      configPath: 'raptor.yml',
    };
  }

  if (fs.existsSync(raptorDir)) {
    return {
      onboarded: true,
      configPath: '.raptor/',
    };
  }

  return { onboarded: false };
}
