// ============================================
// Git Integration Service
// Auto-commit generated tests and configurations
// ============================================

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createGitCommitRecord, updateGitCommitRecord, getGitCommits, GitCommit } from '../db/database';

// Git configuration
interface GitConfig {
  repoPath: string;
  branch?: string;
  commitMessage?: string;
  author?: {
    name: string;
    email: string;
  };
}

interface CommitResult {
  id: string;
  success: boolean;
  commitHash?: string;
  branch: string;
  filesAdded: string[];
  message: string;
  error?: string;
}

interface BranchResult {
  success: boolean;
  branch: string;
  previousBranch?: string;
  error?: string;
}

/**
 * Initialize git instance for a repository
 */
function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const git = getGit(repoPath);
    await git.status();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get repository status
 */
export async function getRepoStatus(repoPath: string): Promise<StatusResult> {
  const git = getGit(repoPath);
  return git.status();
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = getGit(repoPath);
  const status = await git.status();
  return status.current || 'unknown';
}

/**
 * Create a new branch for generated tests
 */
export async function createTestBranch(
  repoPath: string,
  branchName?: string
): Promise<BranchResult> {
  const git = getGit(repoPath);
  
  try {
    const status = await git.status();
    const previousBranch = status.current || 'main';
    
    // Generate branch name if not provided
    const newBranch = branchName || `tars/tests-${Date.now()}`;
    
    // Create and checkout new branch
    await git.checkoutLocalBranch(newBranch);
    
    console.log(`🌿 Created branch: ${newBranch}`);
    
    return {
      success: true,
      branch: newBranch,
      previousBranch,
    };
  } catch (error: any) {
    console.error('Branch creation error:', error);
    return {
      success: false,
      branch: '',
      error: error.message,
    };
  }
}

/**
 * Stage files for commit
 */
export async function stageFiles(
  repoPath: string,
  files: string[]
): Promise<{ success: boolean; staged: string[]; error?: string }> {
  const git = getGit(repoPath);
  
  try {
    // Filter to existing files only
    const existingFiles = files.filter(f => {
      const fullPath = path.isAbsolute(f) ? f : path.join(repoPath, f);
      return fs.existsSync(fullPath);
    });

    if (existingFiles.length === 0) {
      return { success: false, staged: [], error: 'No valid files to stage' };
    }

    await git.add(existingFiles);
    
    console.log(`📦 Staged ${existingFiles.length} files`);
    
    return { success: true, staged: existingFiles };
  } catch (error: any) {
    return { success: false, staged: [], error: error.message };
  }
}

/**
 * Commit staged changes
 */
export async function commitChanges(config: GitConfig): Promise<CommitResult> {
  const git = getGit(config.repoPath);
  const commitId = uuidv4();
  
  try {
    const status = await git.status();
    const branch = status.current || 'unknown';
    
    if (status.staged.length === 0) {
      return {
        id: commitId,
        success: false,
        branch,
        filesAdded: [],
        message: config.commitMessage || '',
        error: 'No staged changes to commit',
      };
    }

    // Create commit record in database
    createGitCommitRecord({
      id: commitId,
      branch,
      files_added: JSON.stringify(status.staged),
      message: config.commitMessage,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    // Prepare commit options
    const commitOptions: any = {};
    if (config.author) {
      commitOptions['--author'] = `${config.author.name} <${config.author.email}>`;
    }

    // Perform commit
    const message = config.commitMessage || `🤖 TARS: Auto-generated test code\n\nGenerated at ${new Date().toISOString()}`;
    const result = await git.commit(message, undefined, commitOptions);

    // Update database record
    updateGitCommitRecord(commitId, result.commit, 'committed');

    console.log(`✅ Committed: ${result.commit}`);
    console.log(`   Message: ${message.split('\n')[0]}`);
    console.log(`   Files: ${status.staged.length}`);

    return {
      id: commitId,
      success: true,
      commitHash: result.commit,
      branch,
      filesAdded: status.staged,
      message,
    };
  } catch (error: any) {
    console.error('Commit error:', error);
    updateGitCommitRecord(commitId, '', 'failed');
    
    return {
      id: commitId,
      success: false,
      branch: config.branch || 'unknown',
      filesAdded: [],
      message: config.commitMessage || '',
      error: error.message,
    };
  }
}

/**
 * Stage and commit files in one operation
 */
export async function stageAndCommit(
  repoPath: string,
  files: string[],
  message?: string,
  options: {
    createBranch?: boolean;
    branchName?: string;
    author?: { name: string; email: string };
  } = {}
): Promise<CommitResult> {
  const { createBranch, branchName, author } = options;

  // Optionally create a new branch
  if (createBranch) {
    const branchResult = await createTestBranch(repoPath, branchName);
    if (!branchResult.success) {
      return {
        id: uuidv4(),
        success: false,
        branch: '',
        filesAdded: [],
        message: '',
        error: `Failed to create branch: ${branchResult.error}`,
      };
    }
  }

  // Stage files
  const stageResult = await stageFiles(repoPath, files);
  if (!stageResult.success) {
    return {
      id: uuidv4(),
      success: false,
      branch: await getCurrentBranch(repoPath),
      filesAdded: [],
      message: '',
      error: `Failed to stage files: ${stageResult.error}`,
    };
  }

  // Commit
  const commitMessage = message || generateCommitMessage(files);
  return commitChanges({
    repoPath,
    commitMessage,
    author,
  });
}

/**
 * Generate a commit message based on files
 */
function generateCommitMessage(files: string[]): string {
  const testFiles = files.filter(f => /\.(test|spec)\./i.test(f) || /Test\.java$/i.test(f));
  const configFiles = files.filter(f => /hermetic|config/i.test(f));
  
  let type = '🧪 tests';
  if (configFiles.length > testFiles.length) {
    type = '⚙️ config';
  }

  const summary = testFiles.length > 0 
    ? `Add ${testFiles.length} generated test file(s)`
    : `Add ${files.length} generated file(s)`;

  return `${type}: ${summary}

Generated by TARS (Test Automation and Review System)

Files:
${files.map(f => `  - ${path.basename(f)}`).join('\n')}
`;
}

/**
 * Push changes to remote
 */
export async function pushChanges(
  repoPath: string,
  remote: string = 'origin',
  options: { setUpstream?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const git = getGit(repoPath);
  
  try {
    const status = await git.status();
    const branch = status.current || 'main';
    
    console.log(`📤 Pushing to ${remote}/${branch}...`);
    
    if (options.setUpstream) {
      await git.push(remote, branch, ['--set-upstream']);
    } else {
      await git.push(remote, branch);
    }
    
    console.log(`✅ Pushed successfully`);
    
    return { success: true };
  } catch (error: any) {
    console.error('Push error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get commit history
 */
export async function getCommitHistory(
  repoPath: string,
  limit: number = 10
): Promise<any[]> {
  const git = getGit(repoPath);
  
  try {
    const log = await git.log({ maxCount: limit });
    return log.all;
  } catch {
    return [];
  }
}

/**
 * Check for uncommitted changes
 */
export async function hasUncommittedChanges(repoPath: string): Promise<boolean> {
  const status = await getRepoStatus(repoPath);
  return !status.isClean();
}

/**
 * Get TARS commit records from database
 */
export function getTarsCommits(): GitCommit[] {
  return getGitCommits();
}

/**
 * Checkout to a specific branch
 */
export async function checkoutBranch(
  repoPath: string,
  branch: string
): Promise<{ success: boolean; error?: string }> {
  const git = getGit(repoPath);
  
  try {
    await git.checkout(branch);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Initialize a git repository if not exists
 */
export async function initRepo(repoPath: string): Promise<{ success: boolean; initialized: boolean; error?: string }> {
  const git = getGit(repoPath);
  
  try {
    const isRepo = await isGitRepo(repoPath);
    if (isRepo) {
      return { success: true, initialized: false };
    }

    await git.init();
    console.log(`📁 Initialized git repository at ${repoPath}`);
    
    return { success: true, initialized: true };
  } catch (error: any) {
    return { success: false, initialized: false, error: error.message };
  }
}

// Export types
export type { GitConfig, CommitResult, BranchResult };
