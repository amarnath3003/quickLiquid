#!/usr/bin/env node
/**
 * Cleans up deprecated Impeccable skill files, symlinks, and skills-lock.json
 * entries left over from previous versions.
 *
 * Safe to run repeatedly -- it is a no-op when nothing needs cleaning.
 *
 * Usage (from the project root):
 * node .codex/skills/impeccable/scripts/cleanup-deprecated.mjs
 */

import { existsSync, readFileSync, writeFileSync, rmSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEPRECATED_NAMES = [
  'frontend-design',
  'teach-impeccable',
  'arrange',
  'normalize',
  'onboard',
  'extract',
];

const HARNESS_DIRS = [
  '.claude',
  '.cursor',
  '.gemini',
  '.codex',
  '.agents',
  '.trae',
  '.trae-cn',
  '.pi',
  '.opencode',
  '.kiro',
  '.rovodev',
];

export function findProjectRoot(startDir = process.cwd()) {
  let dir = resolve(startDir);
  const { root } = { root: '/' };
  while (dir !== root) {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, '.git')) ||
      existsSync(join(dir, 'skills-lock.json'))
    ) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

export function isImpeccableSkill(skillDir) {
  const skillMd = join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return false;
  try {
    const content = readFileSync(skillMd, 'utf-8');
    return /impeccable/i.test(content);
  } catch {
    return false;
  }
}

export function buildTargetNames() {
  const names = [];
  for (const name of DEPRECATED_NAMES) {
    names.push(name);
    names.push(`i-${name}`);
  }
  return names;
}

export function findSkillsDirs(projectRoot) {
  const dirs = [];
  for (const harness of HARNESS_DIRS) {
    const candidate = join(projectRoot, harness, 'skills');
    if (existsSync(candidate)) {
      dirs.push(candidate);
    }
  }
  return dirs;
}

export function removeDeprecatedSkills(projectRoot) {
  const targets = buildTargetNames();
  const skillsDirs = findSkillsDirs(projectRoot);
  const deleted = [];

  for (const skillsDir of skillsDirs) {
    for (const name of targets) {
      const skillPath = join(skillsDir, name);
      let stat;
      try {
        stat = lstatSync(skillPath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        const targetAlive = existsSync(skillPath);
        const isMatch = targetAlive ? isImpeccableSkill(skillPath) : true;
        if (isMatch) {
          unlinkSync(skillPath);
          deleted.push(skillPath);
        }
        continue;
      }

      if (isImpeccableSkill(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        deleted.push(skillPath);
      }
    }
  }

  return deleted;
}

export function cleanSkillsLock(projectRoot) {
  const lockPath = join(projectRoot, 'skills-lock.json');
  if (!existsSync(lockPath)) return [];

  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
  } catch {
    return [];
  }

  if (!lock.skills || typeof lock.skills !== 'object') return [];

  const targets = buildTargetNames();
  const removed = [];

  for (const name of targets) {
    const entry = lock.skills[name];
    if (!entry) continue;
    if (entry.source === 'pbakaus/impeccable') {
      delete lock.skills[name];
      removed.push(name);
    }
  }

  if (removed.length > 0) {
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }

  return removed;
}

export function cleanup(projectRoot) {
  const root = projectRoot || findProjectRoot();
  const deletedPaths = removeDeprecatedSkills(root);
  const removedLockEntries = cleanSkillsLock(root);
  return { deletedPaths, removedLockEntries, projectRoot: root };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const result = cleanup();
  if (result.deletedPaths.length === 0 && result.removedLockEntries.length === 0) {
    console.log('No deprecated Impeccable skills found.\nNothing to clean up.');
  } else {
    if (result.deletedPaths.length > 0) {
      console.log(`Removed ${result.deletedPaths.length} deprecated skill(s):`);
      for (const p of result.deletedPaths) console.log(` - ${p}`);
    }
    if (result.removedLockEntries.length > 0) {
      console.log(`Cleaned ${result.removedLockEntries.length} entry/entries from skills-lock.json:`);
      for (const name of result.removedLockEntries) console.log(` - ${name}`);
    }
  }
}
