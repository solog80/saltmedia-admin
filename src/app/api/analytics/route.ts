import { NextRequest, NextResponse } from 'next/server';

const ANALYTICS_FUNCTION_URL =
  process.env.API_BASE_URL + '/getAnalyticsMetrics';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const params = new URLSearchParams({ days });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const radioReportsUrl = `https://getradioreports-exc3nuhqfq-ew.a.run.app?${params.toString()}`;
    const radioShowsUrl = `https://getradioshowanalytics-exc3nuhqfq-ew.a.run.app?${params.toString()}`;
    const radioSnapshotsUrl = `https://getradioshowsnapshots-exc3nuhqfq-ew.a.run.app?${params.toString()}`;

    const [appResult, radioResult, showsResult, snapshotsResult] = await Promise.allSettled([
      fetch(`${ANALYTICS_FUNCTION_URL}?days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        cache: 'no-store',
      }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(radioReportsUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(radioShowsUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(radioSnapshotsUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const appData = appResult.status === 'fulfilled' ? appResult.value : {};
    const radioData = radioResult.status === 'fulfilled' ? radioResult.value : null;
    const showsData = showsResult.status === 'fulfilled' ? showsResult.value : null;
    const snapshotsData = snapshotsResult.status === 'fulfilled' ? snapshotsResult.value : null;

    const merged: Record<string, any> = { ...appData, days: Number(days) };

    // Replace radio listening time with AzuraCast data
    if (radioData?.hourly) {
      const totalListenerSeconds = radioData.hourly.reduce(
        (sum: number, h: any) => sum + (h.avg_listeners || 0), 0
      ) * 3600 / 24;
      merged.totalListeningTimeSeconds = Math.round(totalListenerSeconds);
      merged.averageListeningTimeSeconds = Math.round(
        (radioData.hourly.reduce((s: number, h: any) => s + (h.avg_listeners || 0), 0) /
          Math.max(radioData.hourly.length, 1)) * 60
      );
    }
    if (!merged.averageListeningTimeSeconds && radioData?.byStream) {
      const totalConnected = radioData.byStream.reduce((s: number, st: any) => s + (st.connected_seconds || 0), 0);
      const totalListeners = radioData.byStream.reduce((s: number, st: any) => s + (st.listeners || 0), 0);
      merged.averageListeningTimeSeconds = totalListeners > 0 ? Math.round(totalConnected / totalListeners) : 0;
      merged.totalListeningTimeSeconds = totalConnected;
    }

    if (radioData?.current) {
      merged.currentRadioListeners = radioData.current.listeners_total || 0;
      merged.currentRadioSong = radioData.current.song_title || radioData.current.song_text || '';
      merged.currentRadioArtist = radioData.current.song_artist || '';
    }

    if (radioData?.daily && Array.isArray(merged.stationPerformance)) {
      const totalRadioListeners = radioData.daily.reduce((s: number, d: any) => s + (d.listeners || 0), 0);
      const fmIndex = merged.stationPerformance.findIndex((s: any) => s.name === 'Salt FM');
      if (fmIndex >= 0) {
        merged.stationPerformance[fmIndex].views = totalRadioListeners || merged.stationPerformance[fmIndex].views;
      }
    }

    const IGNORED_SONGS = ['live broadcast', 'salt fm luganda sfx chimes'];
    if (radioData?.topSongs || showsData?.shows || snapshotsData?.shows) {
      const radioItems: any[] = [];

      // Use listener snapshots for show data (most accurate)
      if (snapshotsData?.shows) {
        snapshotsData.shows.slice(0, 15).forEach((show: any) => {
          radioItems.push({
            contentId: `snap_show_${show.programName}`,
            contentName: show.programName || 'Untitled',
            contentType: 'radio',
            station: 'Salt FM',
            thumbnailUrl: show.thumbnail || show.image || '',
            views: show.peakListeners || show.uniqueListeners || 0,
            totalWatchTime: (show.avgConnectedSeconds || 0) * (show.uniqueListeners || 0),
            avgListeners: show.uniqueListeners || 0,
            peakListeners: show.peakListeners || 0,
            startTime: '',
            endTime: '',
            days: '',
          });
        });
      }

      // Fallback: use history-based show data (if snapshots not available)
      if (!snapshotsData?.shows?.length && showsData?.shows) {
        showsData.shows.slice(0, 15).forEach((show: any) => {
          radioItems.push({
            contentId: `azura_show_${show.programName}`,
            contentName: show.programName || 'Untitled',
            contentType: 'radio',
            station: 'Salt FM',
            thumbnailUrl: show.thumbnail || show.image || '',
            views: show.totalSongs || 0,
            totalWatchTime: show.totalAirtimeSeconds || 0,
            avgListeners: show.avgListeners || 0,
            peakListeners: show.peakListeners || 0,
            startTime: show.startTime,
            endTime: show.endTime,
            days: show.days,
          });
        });
      }

      // Also add top songs (filtered stream noise)
      if (radioData?.topSongs) {
        radioData.topSongs
          .filter((song: any) => {
            const title = (song.song_title || '').toLowerCase().trim();
            return title && !IGNORED_SONGS.some(ignore => title.includes(ignore));
          })
          .slice(0, 5)
          .forEach((song: any) => {
            radioItems.push({
              contentId: `azura_song_${song.song_title}`,
              contentName: song.song_title || 'Untitled',
              contentType: 'radio',
              station: 'Salt FM',
              thumbnailUrl: '',
              views: song.plays || 0,
              totalWatchTime: song.total_airtime_seconds || 0,
              avgListeners: null,
            });
          });
      }

      if (Array.isArray(merged.topContent)) {
        const nonRadio = merged.topContent.filter((c: any) => c.contentType?.toLowerCase() !== 'radio');
        merged.topContent = [...nonRadio, ...radioItems].sort(
          (a: any, b: any) => (b.views || 0) - (a.views || 0)
        ).slice(0, 20);
      }

      merged.contentTypeBreakdown = merged.contentTypeBreakdown || [];
      const radioViews = radioItems.reduce((s: number, i: any) => s + (i.views || 0), 0);
      const radioTime = radioItems.reduce((s: number, i: any) => s + (i.totalWatchTime || 0), 0);
      const existingRadio = merged.contentTypeBreakdown.find((c: any) => c.type === 'radio');
      if (existingRadio) {
        existingRadio.views = radioViews || existingRadio.views;
        existingRadio.totalWatchTime = radioTime || existingRadio.totalWatchTime;
      } else {
        merged.contentTypeBreakdown.push({
          type: 'radio',
          views: radioViews,
          uniqueUsers: radioData?.current?.listeners_unique || 0,
          totalWatchTime: radioTime,
        });
      }
    }

    if (radioData?.hourly) {
      merged.radioPeakHours = radioData.hourly.map((h: any) => ({
        hour: h.hour,
        views: h.avg_listeners || 0,
      }));
    }

    if (radioData?.byListeningTime) {
      merged.watchTimeDistribution = [
        ...(merged.watchTimeDistribution || []).filter((d: any) => d.category !== 'listen'),
        ...radioData.byListeningTime.map((t: any) => ({
          category: 'listen',
          range: t.label,
          count: t.value,
        })),
      ];
    }

    if (radioData?.byCountry) merged.radioByCountry = radioData.byCountry;
    if (radioData?.byBrowser) merged.radioByBrowser = radioData.byBrowser;
    if (radioData?.byStream) merged.radioByStream = radioData.byStream;
    if (radioData?.best) merged.radioBestMoments = radioData.best.slice(0, 5);
    if (radioData?.worst) merged.radioWorstMoments = radioData.worst.slice(0, 5);

    merged.radioSource = 'azuraCast';
    merged.timestamp = new Date().toISOString();
    merged.is_crash_resilient = true;

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
