import { callAIService } from "./callAIService";
import { AISummaryConfig } from "./config";
import { getContributorMetrics } from "./queries";
import { getTimePeriodText, IntervalType } from "@/lib/date-utils";

export type ContributorMetricsForSummary = Awaited<
  ReturnType<typeof getContributorMetrics>
>;

/**
 * Generate an AI summary of a contributor's activity
 */
export async function generateAISummaryForContributor(
  metrics: ContributorMetricsForSummary,
  config: AISummaryConfig,
  intervalType: IntervalType,
): Promise<string | null> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("No API key for AI summary generation");
  }

  // Skip summary generation if no meaningful activity
  const hasActivity =
    metrics.pullRequests.merged > 0 ||
    metrics.pullRequests.open > 0 ||
    metrics.issues.total > 0 ||
    metrics.reviews.total > 0 ||
    // metrics.comments.total > 0 ||
    metrics.codeChanges.files > 0;

  if (!hasActivity) {
    return null;
  }

  try {
    // Format the metrics data for the AI prompt
    const prompt = formatContributorPrompt(metrics, intervalType);

    // Get summary from AI model
    return await callAIService(prompt, config, {
      model: config.models[intervalType],
    });
  } catch (error) {
    console.error(`Error generating summary for ${metrics.username}:`, error);
    return null;
  }
}

/**
 * Format contributor metrics into a structured prompt
 */
function formatContributorPrompt(
  metrics: ContributorMetricsForSummary,
  intervalType: IntervalType,
): string {
  // Helper to truncate long titles
  const truncateTitle = (title: string, maxLength = 64) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + "...";
  };

  // Get time period description for the prompt
  const timePeriod = getTimePeriodText(intervalType);

  // Get the most significant directories from focus areas
  const topDirs = metrics.focusAreas
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((area) => {
      const parts = area.area.split("/");
      // If it's a package, use the package name
      if (parts.includes("packages")) {
        const pkgIndex = parts.indexOf("packages");
        return parts[pkgIndex + 1] || area.area;
      }
      // For docs, distinguish between package and markdown files
      if (parts[0] === "docs" || parts.includes("docs")) {
        return "docs-package";
      }
      if (
        area.area.endsWith(".md") ||
        area.area.endsWith(".mdx") ||
        area.area.includes("/docs/") ||
        area.area.includes("documentation")
      ) {
        return "documentation";
      }
      // Otherwise use the first meaningful directory
      return parts[0] || area.area;
    });

  // Format merged PRs
  const mergedPRDetails = metrics.pullRequests.items
    .filter((pr) => pr.merged === 1)
    .map((pr) => {
      const additions =
        pr.commits?.reduce((sum, c) => sum + (c.additions || 0), 0) || 0;
      const deletions =
        pr.commits?.reduce((sum, c) => sum + (c.deletions || 0), 0) || 0;

      return `${pr.repository}#${pr.number} "${truncateTitle(
        pr.title,
      )}" (+${additions}/-${deletions} lines)`;
    })
    .join(", ");

  // Format open PRs
  const openPRDetails = metrics.pullRequests.items
    .filter((pr) => pr.merged !== 1)
    .map((pr) => `${pr.repository}#${pr.number} "${truncateTitle(pr.title)}"`)
    .join(", ");

  // Format issues
  const issueDetails = metrics.issues.items
    .map(
      (issue) =>
        `${issue.repository}#${issue.number} "${truncateTitle(issue.title)}" (${
          issue.state
        })`,
    )
    .join(", ");

  // Work pattern analysis
  const workPatternDescription =
    metrics.activityPattern.frequency >= 0.7
      ? "very consistent work (active most days)"
      : metrics.activityPattern.frequency >= 0.4
        ? "moderately consistent work (active several days per week)"
        : metrics.activityPattern.frequency >= 0.2
          ? "occasional activity (active a few days per week)"
          : "sporadic activity (active a few days this period)";

  // Commit type analysis
  const commitTypes = metrics.codeChanges.commitTypes;
  const totalCommits = metrics.codeChanges.commitCount;

  let workFocus = "";
  if (totalCommits > 0) {
    const typePercentages = {
      feature: Math.round((commitTypes.feature / totalCommits) * 100),
      bugfix: Math.round((commitTypes.bugfix / totalCommits) * 100),
      refactor: Math.round((commitTypes.refactor / totalCommits) * 100),
      docs: Math.round((commitTypes.docs / totalCommits) * 100),
      tests: Math.round((commitTypes.tests / totalCommits) * 100),
      other: Math.round((commitTypes.other / totalCommits) * 100),
    };

    const sortedTypes = Object.entries(typePercentages)
      .filter(([_, percentage]) => percentage > 10)
      .sort(([_, a], [_2, b]) => b - a);

    if (sortedTypes.length > 0) {
      workFocus = sortedTypes
        .map(([type, percentage]) => `${type} work (${percentage}%)`)
        .join(", ");
    }
  }

  // File type analysis
  const fileTypes = metrics.pullRequests.fileTypes;
  const totalFiles = Object.values(fileTypes).reduce(
    (sum, count) => sum + count,
    0,
  );

  let fileTypesFocus = "";
  if (totalFiles > 0) {
    const filePercentages = {
      code: Math.round((fileTypes.code / totalFiles) * 100),
      tests: Math.round((fileTypes.tests / totalFiles) * 100),
      docs: Math.round((fileTypes.docs / totalFiles) * 100),
      config: Math.round((fileTypes.config / totalFiles) * 100),
    };

    const sortedFileTypes = Object.entries(filePercentages)
      .filter(([_, percentage]) => percentage > 10)
      .sort(([_, a], [__, b]) => b - a);

    if (sortedFileTypes.length > 0) {
      fileTypesFocus = sortedFileTypes
        .map(([type, percentage]) => `${type} (${percentage}%)`)
        .join(", ");
    }
  }

  // PR complexity insights
  const prMetrics = metrics.pullRequests.metrics;
  const prComplexityInsights =
    metrics.pullRequests.merged > 0
      ? `Average PR: +${prMetrics.avgAdditions}/-${prMetrics.avgDeletions} lines, ${prMetrics.avgTimeToMerge} hours to merge
Largest PR: ${prMetrics.largestPR.repository}#${prMetrics.largestPR.number} with +${prMetrics.largestPR.additions}/-${prMetrics.largestPR.deletions} lines`
      : "No merged PRs";

  return `You are an expert engineering manager writing a concise, single-paragraph performance summary for ${
    metrics.username
  } based on the data provided for the ${timePeriod.timeFrame}.
Your goal is to synthesize their activity across all repositories into a holistic narrative. Prioritize the **impact** of the work over the volume of contributions. Do not invent or assume any information beyond what is provided.

DATA:
---
PULL REQUESTS:
- Merged: ${
    metrics.pullRequests.merged > 0
      ? `${metrics.pullRequests.merged} PRs: ${mergedPRDetails}`
      : "None"
  }
- Open: ${
    metrics.pullRequests.open > 0
      ? `${metrics.pullRequests.open} PRs: ${openPRDetails}`
      : "None"
  }
- Complexity: ${prComplexityInsights}

ISSUES:
- Created: ${metrics.issues.opened > 0 ? metrics.issues.opened : "None"} ${
    issueDetails ? `(${issueDetails})` : ""
  }
- Closed: ${metrics.issues.closed > 0 ? metrics.issues.closed : "None"}
- Commented on: ${
    metrics.issues.commented > 0 ? metrics.issues.commented : "None"
  }

REVIEWS & COMMENTS:
- Reviews: ${
    metrics.reviews.total > 0
      ? `${metrics.reviews.total} total (${metrics.reviews.approved} approvals, ${metrics.reviews.changesRequested} change requests, ${metrics.reviews.commented} comments)`
      : "None"
  }
- PR Comments: ${
    metrics.comments.prComments > 0 ? metrics.comments.prComments : "None"
  }
- Issue Comments: ${
    metrics.comments.issueComments > 0 ? metrics.comments.issueComments : "None"
  }

CODE CHANGES:
${
  metrics.codeChanges.files > 0
    ? `- Modified ${metrics.codeChanges.files} files (+${
        metrics.codeChanges.additions
      }/-${metrics.codeChanges.deletions} lines)
- Commits: ${metrics.codeChanges.commitCount}
- Primary focus: ${workFocus || "Mixed work"}
- File types: ${fileTypesFocus || "Various file types"}`
    : "No code changes"
}

PRIMARY AREAS: ${topDirs.join(", ") || "N/A"}
---

INSTRUCTIONS:
- Write a single, flowing paragraph of no more than ${
    timePeriod.sentenceCount
  } sentences, starting with "${metrics.username}: ".
- Begin with a high-level summary of their main focus and area of impact (e.g., "focused on improving API performance").
- Weave in their most impactful contributions, such as fixing critical bugs, implementing key features, or making significant refactors. Use the PR/issue number for reference (e.g., "resolved a critical performance issue in JejuNetwork/Jeju via PR #45").
- Use quantitative data like line counts or review numbers only when they signal significant complexity or effort on an important task.
- Conclude with a summary of their primary focus areas based on the code they touched.
- If there is no activity, output only: "${metrics.username}: No activity ${
    timePeriod.timeFrameShort
  }."

Example Summaries:
- "${metrics.username}: No activity ${timePeriod.timeFrameShort}."
- "${
    metrics.username
  }: Focused heavily on UI improvements across the project, merging 3 PRs in JejuNetwork/Jeju (+2k/-500 lines) that rebuilt the dashboard, and also reviewed 5 PRs in the same repository."
- "${
    metrics.username
  }: Drove a major backend refactor, landing a significant PR in JejuNetwork/Jeju (#45) with +1.5k lines of changes. They also triaged and fixed 2 critical bugs (#99, #101), showing a focus on consensus stability."
`;
}
