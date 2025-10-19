import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/data/db";
import {
  QueryParams,
  buildCommonWhereConditions,
} from "@/lib/pipelines/queryHelpers";
import {
  issueComments,
  rawCommits,
  rawIssues,
  rawPullRequestFiles,
  rawPullRequests,
  userSummaries,
} from "@/lib/data/schema";
import { buildAreaMap } from "@/lib/pipelines/codeAreaHelpers";
import { categorizeWorkItem } from "@/lib/pipelines/codeAreaHelpers";
import { getActiveContributors } from "../getActiveContributors";
import { getTopUsersByScore } from "@/lib/scoring/queries";
import { getIntervalTypeFromDateRange } from "@/lib/date-utils";

/**
 * Get top pull requests for a repository in a time period
 */

export async function getTopPullRequests(params: QueryParams = {}, limit = 5) {
  const whereConditions = buildCommonWhereConditions(params, rawPullRequests, [
    "createdAt",
    "mergedAt",
    "closedAt",
  ]);

  const prs = await db
    .select({
      id: rawPullRequests.id,
      title: rawPullRequests.title,
      author: rawPullRequests.author,
      number: rawPullRequests.number,
      body: rawPullRequests.body,
      repository: rawPullRequests.repository,
      createdAt: rawPullRequests.createdAt,
      mergedAt: rawPullRequests.mergedAt,
      additions: rawPullRequests.additions,
      deletions: rawPullRequests.deletions,
    })
    .from(rawPullRequests)
    .where(and(...whereConditions))
    .orderBy(desc(rawPullRequests.additions))
    .limit(limit)
    .all();

  return prs;
} /**
 * Get top issues for a repository in a time period
 */

export async function getTopIssues(params: QueryParams = {}, limit = 5) {
  const whereConditions = [
    // Include issues that are either:
    // 1. Currently open, or
    // 2. Were closed after the end date (meaning they were open during the period)
    // params.dateRange
    //   ? sql`(${rawIssues.state} = 'OPEN' OR ${rawIssues.closedAt} > ${params.dateRange.endDate})`
    //   : sql`${rawIssues.state} = 'OPEN'`,
    ...buildCommonWhereConditions(params, rawIssues, [
      "createdAt",
      // "updatedAt",
      "closedAt",
    ]),
  ];

  // Create a comment count subquery
  const commentCountQuery = db.$with("comment_counts").as(
    db
      .select({
        issueId: issueComments.issueId,
        count: sql<number>`COUNT(*)`.as("comment_count"),
      })
      .from(issueComments)
      .where(
        params.dateRange
          ? sql`${issueComments.createdAt} >= ${params.dateRange.startDate} AND ${issueComments.createdAt} <= ${params.dateRange.endDate}`
          : undefined,
      )
      .groupBy(issueComments.issueId),
  );

  // Get all issues with their comment counts
  const issuesWithComments = await db
    .with(commentCountQuery)
    .select({
      id: rawIssues.id,
      title: rawIssues.title,
      author: rawIssues.author,
      number: rawIssues.number,
      repository: rawIssues.repository,
      body: rawIssues.body,
      createdAt: rawIssues.createdAt,
      closedAt: rawIssues.closedAt,
      state: rawIssues.state,
      commentCount: sql<number>`COALESCE(comment_counts.comment_count, 0)`,
    })
    .from(rawIssues)
    .leftJoin(commentCountQuery, eq(commentCountQuery.issueId, rawIssues.id))
    .where(and(...whereConditions))
    .orderBy(desc(sql`COALESCE(comment_counts.comment_count, 0)`))
    .limit(limit)
    .all();

  return issuesWithComments;
} /**
 * Get top contributors ranked by activity score
 */

export async function getTopContributors(params: QueryParams = {}, limit = 5) {
  const { dateRange } = params;

  try {
    const topUsers = await getTopUsersByScore(
      dateRange?.startDate,
      dateRange?.endDate,
      limit,
    );

    if (!topUsers || topUsers.length === 0) {
      return [];
    }

    // If no dateRange or its properties are not defined, return users without summaries
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      return topUsers.map((user) => ({ ...user, summary: null }));
    }

    // Now we know dateRange, dateRange.startDate and dateRange.endDate are defined
    const intervalType = getIntervalTypeFromDateRange({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    const summaryDate = dateRange.startDate;

    const resultsWithSummaries = await Promise.all(
      topUsers.map(async (user) => {
        const summaryRecord = await db
          .select({ summary: userSummaries.summary })
          .from(userSummaries)
          .where(
            and(
              eq(userSummaries.username, user.username),
              eq(userSummaries.intervalType, intervalType),
              eq(userSummaries.date, summaryDate),
            ),
          )
          .limit(1);

        return {
          ...user,
          summary: summaryRecord.length > 0 ? summaryRecord[0].summary : null,
        };
      }),
    );

    return resultsWithSummaries;
  } catch (error) {
    console.error(`Error in getTopContributors:`, error);
    return [];
  }
} /**
 * Get project metrics for a specific time interval
 */

export async function getRepoMetrics(params: QueryParams = {}) {
  const { repository, dateRange } = params;
  const prCreatedConditions = buildCommonWhereConditions(
    params,
    rawPullRequests,
    ["createdAt"],
  );
  const prMergedConditions = buildCommonWhereConditions(
    params,
    rawPullRequests,
    ["mergedAt"],
  );
  // Get PRs created in this period
  const createdPRs = await db.query.rawPullRequests.findMany({
    where: and(...prCreatedConditions),
    with: {
      files: true,
    },
  });

  // Get PRs merged in this period
  const mergedPRsThisPeriod = await db.query.rawPullRequests.findMany({
    where: and(...prMergedConditions),
    with: {
      files: true,
    },
  });

  const pullRequests = {
    newPRs: createdPRs,
    mergedPRs: mergedPRsThisPeriod,
  };

  // --- Refactored Issue Fetching Logic ---

  // 1. Get IDs of all relevant issues
  const newIssuesIds = await db
    .select({ id: rawIssues.id })
    .from(rawIssues)
    .where(
      and(...buildCommonWhereConditions(params, rawIssues, ["createdAt"])),
    );

  const closedIssuesIds = await db
    .select({ id: rawIssues.id })
    .from(rawIssues)
    .where(and(...buildCommonWhereConditions(params, rawIssues, ["closedAt"])));

  const updatedIssuesIds = await db
    .selectDistinct({ id: issueComments.issueId })
    .from(issueComments)
    .where(
      and(...buildCommonWhereConditions(params, issueComments, ["createdAt"])),
    );

  const newIdsSet = new Set(newIssuesIds.map((i) => i.id));
  const closedIdsSet = new Set(closedIssuesIds.map((i) => i.id));
  const updatedIdsSet = new Set(updatedIssuesIds.map((i) => i.id!));

  const allIssueIds = [
    ...new Set([...newIdsSet, ...closedIdsSet, ...updatedIdsSet]),
  ];

  const allIssues =
    allIssueIds.length > 0
      ? await db.query.rawIssues.findMany({
          where: inArray(rawIssues.id, allIssueIds),
          with: {
            comments: {
              orderBy: (comments, { desc }) => [desc(comments.createdAt)],
            },
          },
        })
      : [];

  // 3. Categorize issues
  const newIssues: typeof allIssues = [];
  const closedIssues: typeof allIssues = [];
  const updatedIssues: typeof allIssues = [];

  for (const issue of allIssues) {
    const isNew = newIdsSet.has(issue.id);
    const isClosed = closedIdsSet.has(issue.id);
    const isUpdated = updatedIdsSet.has(issue.id);

    if (isNew) {
      newIssues.push(issue);
    }
    if (isClosed) {
      closedIssues.push(issue);
    }
    if (isUpdated && !isNew && !isClosed) {
      updatedIssues.push(issue);
    }
  }

  const issues = {
    newIssues,
    closedIssues,
    updatedIssues,
  };

  // Get active contributors
  const activeContributors = await getActiveContributors({
    repository,
    dateRange: dateRange || { startDate: "1970-01-01", endDate: "2100-01-01" },
  });

  const uniqueContributors = activeContributors.length;

  const commitConditions = buildCommonWhereConditions(params, rawCommits, [
    "committedDate",
  ]);
  // Get all commits in the time period
  const commits = await db.query.rawCommits.findMany({
    where: and(...commitConditions),
  });

  const filesChangedThisPeriod = await db
    .selectDistinct({ path: rawPullRequestFiles.path })
    .from(rawPullRequestFiles)
    .where(
      inArray(
        rawPullRequestFiles.prId,
        mergedPRsThisPeriod.map((pr) => pr.id),
      ),
    );

  const topContributors = await getTopContributors(
    {
      repository,
      dateRange,
    },
    100,
  );

  // Get PR files for merged PRs in this period
  const prFiles = await db.query.rawPullRequestFiles.findMany({
    where: inArray(
      rawPullRequestFiles.prId,
      mergedPRsThisPeriod.map((pr) => pr.id),
    ),
  });

  // Calculate code changes
  const additions = prFiles.reduce(
    (sum, file) => sum + (file.additions || 0),
    0,
  );
  const deletions = prFiles.reduce(
    (sum, file) => sum + (file.deletions || 0),
    0,
  );

  const codeChanges = {
    additions,
    deletions,
    files: filesChangedThisPeriod.length,
    commitCount: commits.length,
  };

  // Get focus areas from PR files
  const areaMap = buildAreaMap(prFiles);

  const focusAreas = Array.from(areaMap.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get completed items (PRs merged in this period)
  const completedItems = mergedPRsThisPeriod.map((pr) => ({
    title: pr.title,
    prNumber: pr.number,
    type: categorizeWorkItem(pr.title),
    body: pr.body?.slice(0, 240),
    files: pr.files.map((f) => f.path),
  }));

  return {
    repository,
    pullRequests,
    issues,
    uniqueContributors,
    topContributors,
    codeChanges,
    focusAreas,
    completedItems,
  };
}
export type RepositoryMetrics = Awaited<ReturnType<typeof getRepoMetrics>>;
