/**
 * setup — Interactive first-run wizard
 */

import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { writeFileSync, existsSync, copyFileSync } from 'fs';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { hasConfig, saveConfig, type TalosConfig } from '../lib/config.js';
import { ensureDir } from '../lib/vault.js';
import { installDefaultTemplates } from '../lib/templates.js';
import { initRepo, addRemote, isRepo } from '../lib/git.js';
import { updateIndex, embedPending, registerCleanup } from '../lib/qmd.js';

function ask(rl: ReturnType<typeof createInterface>, question: string, defaultVal?: string): Promise<string> {
  const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function checkPrereq(_label: string, cmd: string): { ok: boolean; version: string } {
  try {
    const version = execSync(cmd, { encoding: 'utf-8' }).trim();
    return { ok: true, version };
  } catch {
    return { ok: false, version: '' };
  }
}

const SCHEMAS_YAML = `fact:
  required: [type, topic, confidence]
  optional: [source, origin, last_verified, importance, aliases]
episode:
  required: [type, date]
  optional: [people, context, importance, aliases, origin]
preference:
  required: [type, domain, rule]
  optional: [strength, importance, origin]
reference:
  required: [type, title, source]
  optional: [topic, confidence, importance, aliases, origin]
contact:
  required: [type, name]
  optional: [company, role, met, followup, importance, aliases, folder, origin]
project:
  required: [type, tags, status]
  optional: [created, updated, repo, confidence, source, aliases, origin]
plan:
  required: [type, project, status]
  optional: [created, goal, origin]
idea:
  required: [type, topic]
  optional: [source, confidence, feasibility, impact, aliases, origin]
course:
  required: [type, name]
  optional: [institution, term, status, proficiency, aliases, origin]
application:
  required: [type, company, role]
  optional: [status, applied_date, followup_date, fit_score, folder, origin]
tag:
  required: [type, name, category]
  optional: [aliases, description]
`;

export async function execute(): Promise<void> {
  console.log(chalk.bold('\nLOCI Setup Wizard\n'));

  // Step 1: Check prerequisites
  console.log(chalk.bold('Checking prerequisites...\n'));

  const nodeCheck = checkPrereq('Node.js', 'node --version');
  console.log(`  ${nodeCheck.ok ? chalk.green('\u2713') : chalk.red('\u2717')} Node.js ${nodeCheck.version || 'not found'}`);

  const gitCheck = checkPrereq('Git', 'git --version');
  console.log(`  ${gitCheck.ok ? chalk.green('\u2713') : chalk.red('\u2717')} ${gitCheck.version || 'Git not found'}`);

  if (!nodeCheck.ok) {
    console.error(chalk.red('\nNode.js is required. Install it first.'));
    process.exitCode = 1;
    return;
  }

  if (!gitCheck.ok) {
    console.log(chalk.yellow('\nGit not found. Vault sync will not work.'));
  }

  console.log('');

  // Step 2: Interactive questions
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const defaultVaultPath = join(homedir(), 'obsidian-vault', 'loci');
    console.log(chalk.dim('LOCI creates a subfolder inside your Obsidian vault.'));
    console.log(chalk.dim('If you already have a vault, enter: /path/to/your-vault/loci'));
    console.log(chalk.dim('If starting fresh, use the default.\n'));
    const vaultPath = await ask(rl, 'LOCI path (inside your vault)', defaultVaultPath);
    const userName = await ask(rl, 'Your name');
    const userDescription = await ask(rl, 'Brief description (who you are, what you do)');
    const currentFocus = await ask(rl, 'Current focus / top priority');

    // Step 3: Check existing config
    if (hasConfig()) {
      const overwrite = await ask(rl, 'Config already exists. Overwrite? (y/n)', 'n');
      if (overwrite.toLowerCase() !== 'y') {
        console.log(chalk.dim('Keeping existing config.'));
        rl.close();
        return;
      }
    }

    console.log(chalk.dim('\nSetting up vault...\n'));

    // Step 4: Create vault directories
    ensureDir(vaultPath);
    ensureDir(join(vaultPath, '_brain'));
    ensureDir(join(vaultPath, '_brain', 'pinned'));
    ensureDir(join(vaultPath, '_templates'));
    ensureDir(join(vaultPath, 'journal'));

    // Step 5: Write _brain/ files
    const profileContent = `# Profile\n\n**Name:** ${userName}\n**Description:** ${userDescription}\n\n## Preferences\n\n- Concise, scannable writing\n- Tables for structured data\n- Wikilinks for connections\n`;
    writeFileSync(join(vaultPath, '_brain', 'profile.md'), profileContent, 'utf-8');

    const prioritiesContent = `# Priorities\n\n## Current Focus\n\n${currentFocus || 'Not set'}\n\n## Active Projects\n\n- (none yet)\n\n## Backlog\n\n- (none yet)\n`;
    writeFileSync(join(vaultPath, '_brain', 'priorities.md'), prioritiesContent, 'utf-8');

    writeFileSync(join(vaultPath, '_brain', 'schemas.yaml'), SCHEMAS_YAML, 'utf-8');

    writeFileSync(join(vaultPath, '_brain', 'crash-buffer.md'), '# Crash Buffer\n\nOpen threads from interrupted sessions.\n', 'utf-8');

    // Create tracking files (skills expect these to exist)
    const touchFiles = ['gaps.txt', 'conflicts.md'];
    for (const f of touchFiles) {
      const p = join(vaultPath, '_brain', f);
      if (!existsSync(p)) writeFileSync(p, '', 'utf-8');
    }

    // Create content directories
    ensureDir(join(vaultPath, 'projects'));
    ensureDir(join(vaultPath, 'references'));
    ensureDir(join(vaultPath, 'references', 'dashboards'));
    ensureDir(join(vaultPath, 'references', 'courses'));
    ensureDir(join(vaultPath, 'ideas'));
    ensureDir(join(vaultPath, 'career', 'contacts'));
    ensureDir(join(vaultPath, 'career', 'applications'));
    ensureDir(join(vaultPath, 'tags', 'languages'));
    ensureDir(join(vaultPath, 'tags', 'frameworks'));
    ensureDir(join(vaultPath, 'tags', 'tools'));
    ensureDir(join(vaultPath, 'tags', 'platforms'));
    ensureDir(join(vaultPath, 'tags', 'domains'));
    ensureDir(join(vaultPath, 'tags', 'methods'));
    ensureDir(join(vaultPath, 'tags', 'topics'));

    // Create .gitignore if missing
    const gitignorePath = join(vaultPath, '.gitignore');
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, `.obsidian/workspace.json\n.obsidian/workspace-mobile.json\n.trash/\n*.sqlite\n*.sqlite-journal\n.DS_Store\nThumbs.db\n`, 'utf-8');
    }

    console.log(chalk.green('  Created _brain/ files'));

    // Step 6: Save config
    const machineId = `${homedir().split(/[/\\]/).pop()}-${Date.now().toString(36)}`;
    const config: TalosConfig = {
      vault_path: vaultPath,
      machine_id: machineId,
      default_mode: 'default',
      git: { vault_remote: '', auto_pull: true, auto_push: true },
      projects: {},
    };
    saveConfig(config);
    console.log(chalk.green('  Created ~/.loci/config.yaml (bootstrap)'));
    console.log(chalk.green('  Created _brain/config.yaml (full config)'));

    // Step 7: Install default templates + index.yaml
    const templatesInstalled = installDefaultTemplates(vaultPath);
    // Copy index.yaml from vault-init (template registry)
    const indexSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'vault-init', '_templates', 'index.yaml');
    const indexDest = join(vaultPath, '_templates', 'index.yaml');
    if (existsSync(indexSrc) && !existsSync(indexDest)) {
      copyFileSync(indexSrc, indexDest);
    }
    console.log(chalk.green(`  Installed ${templatesInstalled} template(s)`));

    // Step 7b: Obsidian config (QuickAdd, graph, Bases)
    const obsDir = join(vaultPath, '.obsidian');
    ensureDir(obsDir);

    // Graph config with color groups
    const graphPath = join(obsDir, 'graph.json');
    if (!existsSync(graphPath)) {
      writeFileSync(graphPath, JSON.stringify({
        search: '-path:_brain -path:_templates',
        showTags: false, showAttachments: false, hideUnresolved: true, showOrphans: false,
        colorGroups: [
          { query: 'path:tags', color: { a: 1, rgb: 4886754 } },
          { query: 'path:projects', color: { a: 1, rgb: 3329330 } },
          { query: 'path:ideas', color: { a: 1, rgb: 16761095 } },
          { query: 'path:career', color: { a: 1, rgb: 16744448 } },
          { query: 'path:journal', color: { a: 1, rgb: 8421504 } },
          { query: 'path:references', color: { a: 1, rgb: 10066329 } },
        ],
        showArrow: true, nodeSizeMultiplier: 1.2, lineSizeMultiplier: 0.8,
      }, null, 2), 'utf-8');
      console.log(chalk.green('  Created .obsidian/graph.json'));
    }

    // QuickAdd config with 4 capture macros
    const qaDir = join(obsDir, 'plugins', 'quickadd');
    ensureDir(qaDir);
    const qaPath = join(qaDir, 'data.json');
    if (!existsSync(qaPath)) {
      const qaChoices = [
        { id: 'quick-fact', name: 'Quick Fact', type: 'Template', command: true, templatePath: '_templates/quick-fact.md', fileNameFormat: { enabled: true, format: 'references/{{VALUE:Topic}}' }, folder: { enabled: true, folders: ['references'] }, openFile: true },
        { id: 'quick-reference', name: 'Quick Reference', type: 'Template', command: true, templatePath: '_templates/quick-reference.md', fileNameFormat: { enabled: true, format: 'references/{{VALUE:Title}}' }, folder: { enabled: true, folders: ['references'] }, openFile: true },
        { id: 'quick-contact', name: 'Quick Contact', type: 'Template', command: true, templatePath: '_templates/quick-contact.md', fileNameFormat: { enabled: true, format: 'career/contacts/{{VALUE:Full Name}}' }, folder: { enabled: true, folders: ['career/contacts'] }, openFile: true },
        { id: 'quick-application', name: 'Quick Application', type: 'Template', command: true, templatePath: '_templates/quick-application.md', fileNameFormat: { enabled: true, format: 'career/applications/{{VALUE:Company}}-{{VALUE:Role/Position}}' }, folder: { enabled: true, folders: ['career/applications'] }, openFile: true },
      ];
      writeFileSync(qaPath, JSON.stringify({ choices: qaChoices, inputPrompt: 'single-line', version: '2.12.0' }, null, 2), 'utf-8');
      console.log(chalk.green('  Created QuickAdd config (4 capture macros)'));
    }

    // Obsidian Bases (database views)
    const dashDir = join(vaultPath, 'references', 'dashboards');
    const basesFiles: Record<string, object> = {
      'applications-pipeline.base': {
        headerConfig: { company: { type: 'text' }, role: { type: 'text' }, status: { type: 'text' }, fit_score: { type: 'number' }, applied_date: { type: 'date' } },
        filter: { conjunction: 'and', conditions: [{ field: 'type', operator: 'is', value: 'application' }] },
        sort: [{ field: 'fit_score', direction: 'desc' }],
        sources: { type: 'folder', folder: 'career/applications' },
      },
      'contacts-crm.base': {
        headerConfig: { name: { type: 'text' }, company: { type: 'text' }, role: { type: 'text' }, met: { type: 'text' } },
        filter: { conjunction: 'and', conditions: [{ field: 'type', operator: 'is', value: 'contact' }] },
        sort: [{ field: 'name', direction: 'asc' }],
        sources: { type: 'folder', folder: 'career/contacts' },
      },
      'projects-overview.base': {
        headerConfig: { 'file.name': { type: 'text' }, status: { type: 'text' }, tags: { type: 'tags' } },
        filter: { conjunction: 'and', conditions: [{ field: 'type', operator: 'is', value: 'project' }] },
        sort: [{ field: 'file.mtime', direction: 'desc' }],
        sources: { type: 'folder', folder: 'projects' },
      },
    };
    for (const [filename, content] of Object.entries(basesFiles)) {
      const p = join(dashDir, filename);
      if (!existsSync(p)) {
        writeFileSync(p, JSON.stringify(content, null, 2), 'utf-8');
      }
    }
    console.log(chalk.green('  Created Obsidian Bases (3 database views)'));

    // Step 8: Git init + optional remote
    if (gitCheck.ok) {
      if (!isRepo(vaultPath)) {
        await initRepo(vaultPath);
        // Make initial commit so sync works
        const { commit } = await import('../lib/git.js');
        await commit(vaultPath, 'Initial vault setup', true);
        console.log(chalk.green('  Initialized git repository with initial commit'));
      } else {
        console.log(chalk.dim('  Git repo already initialized'));
      }

      const remote = await ask(rl, 'Git remote URL (leave empty to skip)');
      if (remote) {
        await addRemote(vaultPath, remote);
        config.git.vault_remote = remote;
        saveConfig(config);
        console.log(chalk.green(`  Added remote: ${remote}`));
      }
    }

    // Step 9: QMD setup
    console.log(chalk.dim('\nInitializing search index...'));
    registerCleanup();
    try {
      await updateIndex();
      console.log(chalk.green('  QMD collection registered and indexed'));
      await embedPending((progress) => {
        process.stdout.write(chalk.dim(`\r  Embedding: ${progress.chunksEmbedded ?? 0} chunks`));
      });
      console.log(chalk.green('\n  Embeddings complete'));
    } catch (err) {
      console.log(chalk.yellow(`  QMD setup: ${(err as Error).message}`));
      console.log(chalk.dim('  You can run "loci update" later to set up search.'));
    }

    // Step 10: Next steps
    console.log(chalk.bold('\n\nSetup complete!\n'));
    console.log('Next steps:');
    console.log(chalk.dim('  1. Add notes to your vault'));
    console.log(chalk.dim('  2. Run "loci update" to build indexes'));
    console.log(chalk.dim('  3. Run "loci health" to verify everything'));
    console.log(chalk.dim('  4. Start a session with Claude using LOCI mode'));
    console.log('');
  } finally {
    rl.close();
  }
}
