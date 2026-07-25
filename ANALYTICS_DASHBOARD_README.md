# Analytics Dashboard README

This document outlines the recent enhancements to the analytics dashboard, focusing on new metrics and how to interpret them.

## 1. TV Analytics Data Flow Fix

- **Objective**: The initial problem was that TV analytics (heartbeats, show changes) were not being captured in BigQuery.
- **Solution**:
    1.  **Fixed Metadata**: The mobile app's video player was not passing the correct Program ID and duration when a TV station started playing. This has been corrected in `lib/utils/station_logic.dart`.
    2.  **Stabilized Heartbeats**: The core `VideoPlayerNotifier` was modified to prevent duplicate timers and to correctly handle transitions between shows on the same live stream. This ensures a session for "Show A" is closed and a new one for "Show B" is opened automatically.
- **Verification**: We confirmed data is now flowing by directly querying the `analytics.watch_progress` and `analytics.content_sessions` tables in BigQuery.

## 2. Session Analytics Dashboard

The sessions dashboard at `/analytics/sessions` provides insights into user viewing patterns.

### Key Metrics Added:

#### a. Session End Reasons
- **What it is**: A breakdown of why viewing sessions end.
- **Values**: `program_changed`, `app_closed`, `normal_end`, `error`.
- **Insight**: Helps understand if users are actively switching content or simply closing the app.

#### b. Engagement Quality (Completion Rate)
- **What it is**: A "Quality Score" for your content, showing the average percentage of a show that users watch before stopping.
- **Calculation**: It's the `average(total_watch_time / program_duration)`.
- **Insight**: A show with a high completion rate is "sticky" and holds audience attention, even if it has fewer total views. This is arguably more important than raw view count for measuring content success.
- **Query Snippet**:
  ```sql
  -- Simplified for clarity
  SELECT
    content_id,
    AVG(SAFE_DIVIDE(total_watch_time_seconds, program_duration_seconds)) * 100 as completion_rate
  FROM `salt-media-app1.analytics.content_sessions`
  WHERE program_duration_seconds > 0 AND session_count > 1
  GROUP BY content_id
  ORDER BY completion_rate DESC
  ```

## 3. Deployment Steps

To see these changes live, two components need to be deployed:

1.  **Cloud Function (`saltmedia` project)**:
    - The `getAnalyticsMetrics` function contains the BigQuery queries for the dashboard.
    - **Command**: From the `/functions` directory in the `saltmedia` project, run:
      ```bash
      firebase deploy --only functions:getAnalyticsMetrics
      ```

2.  **Admin Dashboard (`saltmedia-admin-app` project)**:
    - This is the Next.js frontend application.
    - **Command**: Deploy this project using your standard Vercel, Docker, or other deployment process.

## 4. How to Verify

1.  Open the Salt Media app and watch a few different TV shows for several minutes each.
2.  Navigate between different live TV channels.
3.  After about 5-10 minutes, open the [Admin Dashboard](http/localhost:3001/analytics/sessions).
4.  The "Engagement Quality" and "Session End Reasons" sections should be populated with the new data. You will see the shows you just watched appear in the list, with their corresponding completion rates.
