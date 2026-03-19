/**
 * stats — Computed vault quality metrics (TF-IDF, hub health, origin distribution)
 */

import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { computeVaultStats } from '../lib/brain.js';

export async function execute(): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  console.log(chalk.bold('\nLOCI Vault Stats\n'));

  const stats = computeVaultStats(vaultPath);

  // Overview
  console.log(`  Notes: ${stats.totalNotes}  |  Hubs: ${stats.totalHubs}`);

  // Origin distribution
  const total = stats.originCounts.direct + stats.originCounts.inferred + stats.originCounts.generated + stats.originCounts.unset;
  const genPct = total > 0 ? Math.round(stats.originCounts.generated / total * 100) : 0;
  console.log(`  Origin: ${stats.originCounts.direct} direct, ${stats.originCounts.inferred} inferred, ${stats.originCounts.generated} generated, ${stats.originCounts.unset} unset`);
  if (genPct > 40) {
    console.log(chalk.yellow(`  ⚠ Generated content is ${genPct}% of vault — feedback loop risk`));
  }

  // Stale facts
  if (stats.staleFacts.length > 0) {
    console.log(chalk.yellow(`\n  Stale facts (${stats.staleFacts.length}):`));
    for (const f of stats.staleFacts.slice(0, 5)) {
      console.log(chalk.dim(`    - ${f}`));
    }
  }

  // Hub health (bottom 5)
  console.log(chalk.bold('\n  Hub Health (weakest first):'));
  const weakest = stats.hubHealth.slice(0, 5);
  for (const h of weakest) {
    const bar = '█'.repeat(h.score) + '░'.repeat(10 - h.score);
    console.log(`    ${bar} ${h.score}/10  ${h.name} (${h.category}, ${h.inlinks} links, ${h.typeCount} types)`);
  }

  // TF-IDF top terms
  console.log(chalk.bold('\n  Most Distinctive Terms (TF-IDF):'));
  for (const t of stats.tfidfTop.slice(0, 5)) {
    console.log(chalk.dim(`    ${t.word} (${t.tfidf.toFixed(1)})`));
  }

  console.log('');
}
