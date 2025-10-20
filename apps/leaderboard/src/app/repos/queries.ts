import { db } from "@/lib/data/db";
import {
  users,
  repositories,
  rawPullRequests,
  userDailyScores,
  rawIssues,
  rawCommits,
} from "@/lib/data/schema";
import { and, eq, gte, sql, desc, inArray } from "drizzle-orm";
import { UTCDate } from "@date-fns/utc";
import { subDays } from "date-fns";
import { toDateString } from "@/lib/date-utils";

export type Repository = {
  id: string;
  name: string;
  owner: string;
  description?: string;
  stars: number;
  openIssues: number;
  openPullRequests: number;
  mergedPullRequests: number;
  totalContributors: number;
  topContributors: {
    username: string;
    avatarUrl: string | null;
  }[];
  weeklyCommitCounts: {
    week: string;
    commitCount: number;
  }[];
  lastUpdated: string;
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
};

export async function getRepositories(): Promise<Repository[]> {
  const ninetyDaysAgo = toDateString(subDays(new UTCDate(), 90));

  const allRepos = await db.select().from(repositories);

  const reposWithData = await Promise.all(
    allRepos.map(async (repo) => {
      // Get all contributors in the last 90 days
      const prAuthors = await db
        .selectDistinct({ author: rawPullRequests.author })
        .from(rawPullRequests)
        .where(
          and(
            eq(rawPullRequests.repository, repo.repoId),
            gte(rawPullRequests.createdAt, ninetyDaysAgo),
          ),
        );

      const issueAuthors = await db
        .selectDistinct({ author: rawIssues.author })
        .from(rawIssues)
        .where(
          and(
            eq(rawIssues.repository, repo.repoId),
            gte(rawIssues.createdAt, ninetyDaysAgo),
          ),
        );

      const contributorUsernames = [
        ...new Set([
          ...prAuthors.map((p) => p.author),
          ...issueAuthors.map((i) => i.author),
        ]),
      ];

      let topContributors: { username: string; avatarUrl: string | null }[] =
        [];
      if (contributorUsernames.length > 0) {
        const topContributorsData = await db
          .select({
            username: users.username,
            avatarUrl: users.avatarUrl,
            score: sql<number>`sum(${userDailyScores.score})`.as("totalScore"),
          })
          .from(userDailyScores)
          .leftJoin(users, eq(userDailyScores.username, users.username))
          .where(
            and(
              inArray(userDailyScores.username, contributorUsernames),
              sql`${users.username} IS NOT NULL`,
            ),
          )
          .groupBy(users.username, users.avatarUrl)
          .orderBy(desc(sql`totalScore`))
          .limit(3);

        topContributors = topContributorsData.map((c) => ({
          username: c.username!,
          avatarUrl: c.avatarUrl,
        }));
      }

      // Get weekly commit counts
      const weeklyCommits = await db
        .select({
          week: sql<string>`strftime('%Y-%W', ${rawCommits.committedDate})`.as(
            "week",
          ),
          commitCount: sql<number>`count(${rawCommits.oid})`.as("commitCount"),
        })
        .from(rawCommits)
        .where(
          and(
            eq(rawCommits.repository, repo.repoId),
            gte(rawCommits.committedDate, ninetyDaysAgo),
          ),
        )
        .groupBy(sql`week`)
        .orderBy(sql`week`);

      // Get total counts for PRs and issues
      const totalPRsResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawPullRequests)
        .where(eq(rawPullRequests.repository, repo.repoId));

      const totalIssuesResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawIssues)
        .where(eq(rawIssues.repository, repo.repoId));

      const openPRsResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawPullRequests)
        .where(
          and(
            eq(rawPullRequests.repository, repo.repoId),
            eq(rawPullRequests.state, "OPEN"),
          ),
        );

      const mergedPRsResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawPullRequests)
        .where(
          and(
            eq(rawPullRequests.repository, repo.repoId),
            eq(rawPullRequests.merged, 1),
          ),
        );

      const openIssuesResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawIssues)
        .where(
          and(
            eq(rawIssues.repository, repo.repoId),
            eq(rawIssues.state, "OPEN"),
          ),
        );

      // Get recent commits for activity indication
      const recentCommitsResult = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(rawCommits)
        .where(
          and(
            eq(rawCommits.repository, repo.repoId),
            gte(rawCommits.committedDate, ninetyDaysAgo),
          ),
        );

      // Get the most recent commit date for lastUpdated
      const mostRecentCommitResult = await db
        .select({ committedDate: rawCommits.committedDate })
        .from(rawCommits)
        .where(eq(rawCommits.repository, repo.repoId))
        .orderBy(desc(rawCommits.committedDate))
        .limit(1);

      const mostRecentCommitDate =
        mostRecentCommitResult[0]?.committedDate ||
        repo.lastUpdated ||
        new Date().toISOString();

      return {
        id: repo.repoId,
        name: repo.name,
        owner: repo.owner,
        description: repo.description || undefined,
        stars: repo.stars || 0,
        openIssues: openIssuesResult[0]?.count || 0,
        openPullRequests: openPRsResult[0]?.count || 0,
        mergedPullRequests: mergedPRsResult[0]?.count || 0,
        totalContributors: contributorUsernames.length,
        topContributors,
        weeklyCommitCounts: weeklyCommits,
        lastUpdated: mostRecentCommitDate,
        totalCommits: recentCommitsResult[0]?.count || 0,
        totalPullRequests: totalPRsResult[0]?.count || 0,
        totalIssues: totalIssuesResult[0]?.count || 0,
      };
    }),
  );

  return reposWithData.sort(
    (a, b) => b.totalContributors - a.totalContributors,
  );
}
