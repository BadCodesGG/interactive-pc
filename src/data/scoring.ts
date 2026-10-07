export interface ScoreInput {
  /** Elapsed seconds, with any tier time penalty already added. */
  seconds: number;
  /** Mistakes that count against the player (rejected placements, rewinds). */
  mistakes: number;
  /** Set both budgetUsd and spentUsd in Brief mode; leave both out elsewhere. */
  budgetUsd?: number;
  spentUsd?: number;
  parSeconds: number;
}

export interface ScoreResult {
  stars: 0 | 1 | 2 | 3;
  breakdown: string[];
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * One star each for: no mistakes, finishing at or under par time, and staying within budget.
 * Where there is no budget (every mode but Brief) the budget star is not in play and is
 * awarded, so a clean, quick build still reaches three stars.
 */
export function scoreBuild(input: ScoreInput): ScoreResult {
  const { seconds, mistakes, budgetUsd, spentUsd, parSeconds } = input;
  const breakdown: string[] = [];
  let stars = 0;

  if (mistakes === 0) {
    stars += 1;
    breakdown.push("No mistakes: 1 star.");
  } else {
    breakdown.push(`${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}: no star for a clean build.`);
  }

  if (seconds <= parSeconds) {
    stars += 1;
    breakdown.push(`Finished in ${formatTime(seconds)}, at or under par (${formatTime(parSeconds)}): 1 star.`);
  } else {
    breakdown.push(`Finished in ${formatTime(seconds)}, over par (${formatTime(parSeconds)}): no star for speed.`);
  }

  if (budgetUsd === undefined || spentUsd === undefined) {
    stars += 1;
    breakdown.push("No budget to keep to: 1 star.");
  } else if (spentUsd <= budgetUsd) {
    stars += 1;
    breakdown.push(`Spent $${spentUsd} of a $${budgetUsd} budget: 1 star.`);
  } else {
    breakdown.push(`Spent $${spentUsd}, $${spentUsd - budgetUsd} over the $${budgetUsd} budget: no star for budget.`);
  }

  return { stars: stars as 0 | 1 | 2 | 3, breakdown };
}
