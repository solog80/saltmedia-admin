const { onRequest } = require('firebase-functions/v2/https');
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'salt-media-app1',
});

const options = {
  region: 'europe-west1',
  memory: '512MB',
  timeoutSeconds: 60,
  cors: true,
};

/**
 * Cloud Function: Get comprehensive analytics metrics
 * GET /getAnalyticsMetrics
 * Returns: All dashboard analytics data from BigQuery
 */
const getAnalyticsMetrics = onRequest(options, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 [getAnalyticsMetrics] Starting analytics query...');

    // 1. Total views and unique users
    console.log('  🔍 Querying views and users...');
    const viewsQuery = await bigquery.query({
      query: `
        SELECT
          COUNT(*) as total_views,
          COUNT(DISTINCT user_id) as unique_users
        FROM \`salt-media-app1.analytics.content_views\`
      `,
    });
    const viewsData = viewsQuery[0][0];
    const totalViews = viewsData?.total_views || 0;
    const uniqueUsers = viewsData?.unique_users || 0;
    console.log(`  ✅ Views: ${totalViews}, Users: ${uniqueUsers}`);

    // 2. Total watch time and sessions
    console.log('  🔍 Querying watch time and sessions...');
    const watchTimeQuery = await bigquery.query({
      query: `
        SELECT
          SUM(total_watch_time_seconds) as total_watch_time,
          COUNT(*) as total_sessions,
          AVG(total_watch_time_seconds) as average_watch_time
        FROM \`salt-media-app1.analytics.content_sessions\`
      `,
    });
    const watchTimeData = watchTimeQuery[0][0];
    const totalWatchTimeSeconds = watchTimeData?.total_watch_time || 0;
    const totalSessions = watchTimeData?.total_sessions || 0;
    const averageWatchTimeSeconds = watchTimeData?.average_watch_time || 0;
    console.log(`  ✅ Watch time: ${totalWatchTimeSeconds}s, Sessions: ${totalSessions}`);

    // 3. Total progress events
    console.log('  🔍 Querying progress events...');
    const progressQuery = await bigquery.query({
      query: `
        SELECT COUNT(*) as total_progress
        FROM \`salt-media-app1.analytics.watch_progress\`
      `,
    });
    const progressData = progressQuery[0][0];
    const totalProgressEvents = progressData?.total_progress || 0;
    console.log(`  ✅ Progress events: ${totalProgressEvents}`);

    // 4. Top content by views with watch time JOIN
    console.log('  🔍 Querying top content...');
    const topContentQuery = await bigquery.query({
      query: `
        SELECT
          cv.content_id,
          cv.content_name,
          cv.content_type,
          COUNT(DISTINCT cv.user_id) as unique_viewers,
          COUNT(cv.user_id) as views,
          COALESCE(SUM(cs.total_watch_time_seconds), 0) as total_watch_time
        FROM \`salt-media-app1.analytics.content_views\` cv
        LEFT JOIN \`salt-media-app1.analytics.content_sessions\` cs
          ON cv.content_id = cs.content_id
        GROUP BY cv.content_id, cv.content_name, cv.content_type
        ORDER BY views DESC
        LIMIT 10
      `,
    });
    const topContent = topContentQuery[0].map((row) => ({
      contentId: row.content_id,
      contentName: row.content_name || 'Unknown',
      contentType: row.content_type || 'unknown',
      views: row.views || 0,
      uniqueViewers: row.unique_viewers || 0,
      totalWatchTime: row.total_watch_time || 0,
    }));
    console.log(`  ✅ Top ${topContent.length} content items fetched`);

    // 5. Session end reasons breakdown
    console.log('  🔍 Querying session end reasons...');
    const endReasonsQuery = await bigquery.query({
      query: `
        SELECT
          end_reason,
          COUNT(*) as count,
          AVG(total_watch_time_seconds) as avg_watch_time
        FROM \`salt-media-app1.analytics.content_sessions\`
        WHERE end_reason IS NOT NULL
        GROUP BY end_reason
      `,
    });
    const sessionEndReasons = {};
    const sessionEndReasonsDetailed = [];
    endReasonsQuery[0].forEach((row) => {
      sessionEndReasons[row.end_reason] = row.count;
      sessionEndReasonsDetailed.push({
        reason: row.end_reason,
        count: row.count,
        avgWatchTime: row.avg_watch_time || 0,
      });
    });
    console.log(`  ✅ ${Object.keys(sessionEndReasons).length} session end reasons found`);

    // 6. Recent activity with JOINs
    console.log('  🔍 Querying recent activity...');
    const activityQuery = await bigquery.query({
      query: `
        SELECT
          s.user_id,
          cv.content_name,
          cv.content_type,
          s.total_watch_time_seconds,
          s.end_reason,
          s.timestamp,
          wp.position as last_position,
          wp.duration as content_duration
        FROM \`salt-media-app1.analytics.content_sessions\` s
        LEFT JOIN \`salt-media-app1.analytics.content_views\` cv
          ON s.content_id = cv.content_id AND s.user_id = cv.user_id
        LEFT JOIN \`salt-media-app1.analytics.watch_progress\` wp
          ON s.content_id = wp.content_id AND s.user_id = wp.user_id
        WHERE wp.timestamp = (
          SELECT MAX(timestamp)
          FROM \`salt-media-app1.analytics.watch_progress\`
          WHERE content_id = s.content_id AND user_id = s.user_id
        )
        ORDER BY s.timestamp DESC
        LIMIT 20
      `,
    });
    const recentActivity = activityQuery[0].map((row) => ({
      userId: row.user_id?.substring(0, 8) + '...' || 'Unknown',
      contentName: row.content_name || 'Unknown',
      contentType: row.content_type || 'unknown',
      watchTime: Math.round(row.total_watch_time_seconds || 0),
      endReason: row.end_reason || 'unknown',
      lastPosition: row.last_position || 0,
      contentDuration: row.content_duration || 0,
      timestamp: new Date(row.timestamp).toLocaleTimeString(),
    }));
    console.log(`  ✅ Recent activity: ${recentActivity.length} sessions`);

    // 7. Watch time distribution
    console.log('  🔍 Querying watch time distribution...');
    const distributionQuery = await bigquery.query({
      query: `
        SELECT
          CASE
            WHEN total_watch_time_seconds < 60 THEN '< 1 min'
            WHEN total_watch_time_seconds < 300 THEN '1-5 min'
            WHEN total_watch_time_seconds < 900 THEN '5-15 min'
            WHEN total_watch_time_seconds < 1800 THEN '15-30 min'
            ELSE '> 30 min'
          END as range,
          COUNT(*) as count
        FROM \`salt-media-app1.analytics.content_sessions\`
        GROUP BY range
      `,
    });

    const totalSessionsForDistribution = distributionQuery[0].reduce(
      (sum, row) => sum + (row.count || 0),
      0
    );

    const watchTimeDistribution = distributionQuery[0].map((row) => ({
      range: row.range,
      count: row.count || 0,
      percentage:
        totalSessionsForDistribution > 0
          ? Math.round((row.count / totalSessionsForDistribution) * 100)
          : 0,
    }));
    console.log(`  ✅ Watch time distribution: ${watchTimeDistribution.length} brackets`);

    // 8. Content type breakdown
    console.log('  🔍 Querying content type breakdown...');
    const contentTypeQuery = await bigquery.query({
      query: `
        SELECT
          content_type,
          COUNT(*) as views,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(COALESCE(cs.total_watch_time_seconds, 0)) as total_watch_time
        FROM \`salt-media-app1.analytics.content_views\` cv
        LEFT JOIN \`salt-media-app1.analytics.content_sessions\` cs
          ON cv.content_id = cs.content_id
        WHERE content_type IS NOT NULL
        GROUP BY content_type
      `,
    });
    const contentTypeBreakdown = contentTypeQuery[0].map((row) => ({
      type: row.content_type || 'unknown',
      views: row.views || 0,
      uniqueUsers: row.unique_users || 0,
      totalWatchTime: row.total_watch_time || 0,
    }));
    console.log(`  ✅ Content types: ${contentTypeBreakdown.length} types`);

    const response = {
      totalViews,
      uniqueUsers,
      totalWatchTimeSeconds,
      averageWatchTimeSeconds,
      totalProgressEvents,
      totalSessions,
      topContent,
      sessionEndReasons,
      sessionEndReasonsDetailed,
      recentActivity,
      watchTimeDistribution,
      contentTypeBreakdown,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ [getAnalyticsMetrics] Query completed successfully');
    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error in getAnalyticsMetrics:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics metrics',
      message: error.message,
    });
  }
});

module.exports = {
  getAnalyticsMetrics,
};