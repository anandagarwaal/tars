import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

const API_URL = process.env.TARS_API_URL || 'http://localhost:3001';

export const gitCommand = new Command('commit')
  .description('Commit generated tests to git')
  .option('--dir <directory>', 'Directory containing generated tests', './generated-tests')
  .option('--message <message>', 'Commit message')
  .option('--branch <branch>', 'Create and switch to a new branch')
  .option('--push', 'Push changes after committing', false)
  .option('--repo <path>', 'Repository path', '.')
  .action(async (options) => {
    console.log('\n📦 TARS Git Integration\n');

    const directory = path.resolve(options.dir);
    const repoPath = path.resolve(options.repo);

    console.log(`   Repository: ${repoPath}`);
    console.log(`   Tests Dir:  ${directory}`);
    if (options.branch) console.log(`   Branch:     ${options.branch}`);
    console.log('');

    // Check if directory exists
    if (!fs.existsSync(directory)) {
      console.log(`❌ Tests directory not found: ${directory}`);
      console.log('   Generate tests first with: tars generate --prd <id>');
      process.exit(1);
    }

    // Check git status
    console.log('🔍 Checking repository status...');
    
    try {
      const statusResponse = await fetch(`${API_URL}/api/git/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath }),
      });

      if (!statusResponse.ok) {
        throw new Error('API error');
      }

      const status = await statusResponse.json() as any;

      if (!status.isGitRepo) {
        console.log('❌ Not a git repository');
        console.log('   Initialize with: git init');
        process.exit(1);
      }

      console.log(`   ✅ Git repository found`);
      console.log(`   Branch: ${status.branch}`);
      console.log(`   Modified: ${status.modified}, Staged: ${status.staged}, Untracked: ${status.untracked}`);
      console.log('');

      // Find test files to commit
      const files = findTestFiles(directory);
      
      if (files.length === 0) {
        console.log('⚠️  No test files found to commit');
        process.exit(0);
      }

      console.log(`📝 Found ${files.length} files to commit:`);
      files.slice(0, 5).forEach(f => console.log(`   - ${path.relative(repoPath, f)}`));
      if (files.length > 5) console.log(`   ... and ${files.length - 5} more`);
      console.log('');

      // Commit files
      console.log('📦 Committing files...');
      
      const commitResponse = await fetch(`${API_URL}/api/git/commit-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath,
          files: files.map(f => path.relative(repoPath, f)),
          message: options.message,
          createBranch: !!options.branch,
          branchName: options.branch,
        }),
      });

      const commitResult = await commitResponse.json() as any;

      if (!commitResult.success) {
        console.log(`❌ Commit failed: ${commitResult.error}`);
        process.exit(1);
      }

      console.log(`   ✅ Committed: ${commitResult.commitHash?.substring(0, 8)}`);
      console.log(`   Branch: ${commitResult.branch}`);
      console.log(`   Files: ${commitResult.filesAdded.length}`);
      console.log('');

      // Push if requested
      if (options.push) {
        console.log('📤 Pushing to remote...');
        
        const pushResponse = await fetch(`${API_URL}/api/git/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoPath,
            setUpstream: !!options.branch,
          }),
        });

        const pushResult = await pushResponse.json() as any;

        if (pushResult.success) {
          console.log('   ✅ Pushed successfully');
        } else {
          console.log(`   ⚠️  Push failed: ${pushResult.error}`);
        }
      }

      console.log('');
      console.log('─'.repeat(50));
      console.log('✨ Git operations complete!');
      console.log('');
      
      if (!options.push) {
        console.log('Next steps:');
        console.log(`   git push origin ${commitResult.branch}`);
        console.log('   # Or create a pull request');
      }
      console.log('');

    } catch (error: any) {
      console.log(`❌ Failed to connect to TARS API: ${error.message}`);
      console.log('   Make sure the API is running: cd packages/api && npm run dev');
      console.log('');
      console.log('📋 You can commit manually:');
      console.log(`   git add ${directory}`);
      console.log(`   git commit -m "Add generated tests"`);
      process.exit(1);
    }
  });

function findTestFiles(directory: string): string[] {
  const files: string[] = [];
  const testPatterns = [
    /\.(test|spec)\.(ts|js|tsx|jsx)$/,
    /\.cy\.(ts|js)$/,
    /Test\.java$/,
  ];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
        scan(fullPath);
      } else if (entry.isFile()) {
        const isTest = testPatterns.some(p => p.test(entry.name));
        if (isTest) {
          files.push(fullPath);
        }
      }
    }
  }

  scan(directory);
  return files;
}

// History subcommand
export const gitHistoryCommand = new Command('history')
  .description('Show TARS commit history')
  .option('--repo <path>', 'Repository path', '.')
  .option('--limit <n>', 'Number of commits to show', '10')
  .action(async (options) => {
    console.log('\n📜 TARS Git History\n');

    try {
      // Get TARS commits from database
      const tarsResponse = await fetch(`${API_URL}/api/git/tars-commits`);
      const tarsCommits = await tarsResponse.json() as any[];

      if (tarsCommits.length === 0) {
        console.log('No TARS commits found.');
        console.log('Generate and commit tests first.');
        return;
      }

      console.log(`Found ${tarsCommits.length} TARS commit(s):\n`);

      for (const commit of tarsCommits.slice(0, parseInt(options.limit))) {
        const files = JSON.parse(commit.files_added || '[]');
        const date = new Date(commit.created_at).toLocaleString();
        
        console.log(`📦 ${commit.commit_hash?.substring(0, 8) || 'pending'}...`);
        console.log(`   Branch: ${commit.branch}`);
        console.log(`   Status: ${commit.status}`);
        console.log(`   Files:  ${files.length}`);
        console.log(`   Date:   ${date}`);
        console.log('');
      }

    } catch (error: any) {
      console.log(`❌ Failed to fetch history: ${error.message}`);
    }
  });
