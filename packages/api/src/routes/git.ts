// ============================================
// Git Integration Routes
// ============================================

import { Router, Request, Response } from 'express';
import * as path from 'path';
import {
  isGitRepo,
  getRepoStatus,
  getCurrentBranch,
  createTestBranch,
  stageFiles,
  commitChanges,
  stageAndCommit,
  pushChanges,
  getCommitHistory,
  hasUncommittedChanges,
  getTarsCommits,
  checkoutBranch,
  initRepo,
} from '../services/gitService';

export const gitRouter = Router();

/**
 * Check if directory is a git repo
 * POST /api/git/check
 */
gitRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const { repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const isRepo = await isGitRepo(resolvedPath);

    if (isRepo) {
      const status = await getRepoStatus(resolvedPath);
      const branch = await getCurrentBranch(resolvedPath);
      
      res.json({
        isGitRepo: true,
        path: resolvedPath,
        branch,
        isClean: status.isClean(),
        modified: status.modified.length,
        staged: status.staged.length,
        untracked: status.not_added.length,
      });
    } else {
      res.json({
        isGitRepo: false,
        path: resolvedPath,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get repository status
 * POST /api/git/status
 */
gitRouter.post('/status', async (req: Request, res: Response) => {
  try {
    const { repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const status = await getRepoStatus(resolvedPath);

    res.json({
      current: status.current,
      tracking: status.tracking,
      isClean: status.isClean(),
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      deleted: status.deleted,
      renamed: status.renamed,
      untracked: status.not_added,
      conflicted: status.conflicted,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new branch for tests
 * POST /api/git/branch
 */
gitRouter.post('/branch', async (req: Request, res: Response) => {
  try {
    const { repoPath, branchName } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await createTestBranch(resolvedPath, branchName);

    if (result.success) {
      res.json({
        success: true,
        branch: result.branch,
        previousBranch: result.previousBranch,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stage files for commit
 * POST /api/git/stage
 */
gitRouter.post('/stage', async (req: Request, res: Response) => {
  try {
    const { repoPath, files } = req.body;

    if (!repoPath || !files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'repoPath and files array are required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await stageFiles(resolvedPath, files);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Commit staged changes
 * POST /api/git/commit
 */
gitRouter.post('/commit', async (req: Request, res: Response) => {
  try {
    const { repoPath, message, author } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await commitChanges({
      repoPath: resolvedPath,
      commitMessage: message,
      author,
    });

    if (result.success) {
      res.json({
        success: true,
        commitHash: result.commitHash,
        branch: result.branch,
        filesAdded: result.filesAdded,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stage and commit files in one operation
 * POST /api/git/commit-files
 */
gitRouter.post('/commit-files', async (req: Request, res: Response) => {
  try {
    const { repoPath, files, message, createBranch, branchName, author } = req.body;

    if (!repoPath || !files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'repoPath and files array are required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await stageAndCommit(resolvedPath, files, message, {
      createBranch,
      branchName,
      author,
    });

    if (result.success) {
      res.json({
        success: true,
        id: result.id,
        commitHash: result.commitHash,
        branch: result.branch,
        filesAdded: result.filesAdded,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Push changes to remote
 * POST /api/git/push
 */
gitRouter.post('/push', async (req: Request, res: Response) => {
  try {
    const { repoPath, remote, setUpstream } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await pushChanges(resolvedPath, remote || 'origin', { setUpstream });

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get commit history
 * POST /api/git/history
 */
gitRouter.post('/history', async (req: Request, res: Response) => {
  try {
    const { repoPath, limit } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const history = await getCommitHistory(resolvedPath, limit || 10);

    res.json({ commits: history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get TARS commit records
 * GET /api/git/tars-commits
 */
gitRouter.get('/tars-commits', (req: Request, res: Response) => {
  try {
    const commits = getTarsCommits();
    res.json(commits);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Checkout to a branch
 * POST /api/git/checkout
 */
gitRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { repoPath, branch } = req.body;

    if (!repoPath || !branch) {
      return res.status(400).json({ error: 'repoPath and branch are required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await checkoutBranch(resolvedPath, branch);

    if (result.success) {
      res.json({ success: true, branch });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initialize git repository
 * POST /api/git/init
 */
gitRouter.post('/init', async (req: Request, res: Response) => {
  try {
    const { repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const resolvedPath = path.resolve(repoPath);
    const result = await initRepo(resolvedPath);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
