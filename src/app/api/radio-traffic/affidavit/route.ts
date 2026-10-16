import { NextRequest, NextResponse } from 'next/server';
import {
  resolveRadioEPGDetails,
  type RadioEPGProgram,
} from '@/lib/utils/epgMatcher';

const API_BASE = process.env.API_BASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || '';

function csvEscape(val: unknown): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Proxies to the cluster Go service /api/v1/getTrafficAffidavit (TimescaleDB)
 * and enriches each spot's program_name and presenter with the authoritative
 * Radio EPG lineup from /api/v1/getAdminEPGData.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const client = searchParams.get('client') || '';
    const format = searchParams.get('format') || '';
    const station = searchParams.get('station') || '307';

    const params = new URLSearchParams({ days, station });
    if (startDate) {
      params.set(
        'start',
        startDate.includes('T') ? startDate : `${startDate}T00:00:00+03:00`
      );
    }
    if (endDate) {
      params.set(
        'end',
        endDate.includes('T') ? endDate : `${endDate}T23:59:59+03:00`
      );
    }
    if (client && client !== 'ALL') {
      params.set('client', client);
    }

    const authHeaders = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    };

    const [affidavitRes, epgRes] = await Promise.all([
      fetch(`${API_BASE}/getTrafficAffidavit?${params.toString()}`, {
        method: 'GET',
        headers: authHeaders,
        cache: 'no-store',
      }),
      fetch(`${API_BASE}/getAdminEPGData`, {
        method: 'GET',
        headers: authHeaders,
        cache: 'no-store',
      }).catch(() => null),
    ]);

    if (!affidavitRes.ok) {
      throw new Error(`Traffic affidavit API returned ${affidavitRes.status}`);
    }

    let radioPrograms: RadioEPGProgram[] = [];
    if (epgRes && epgRes.ok) {
      try {
        const epgJson = await epgRes.json();
        radioPrograms = epgJson?.data?.radio?.programs || [];
      } catch {
        // Ignore EPG parse error and fall back gracefully
      }
    }

    const data = await affidavitRes.json();
    const spots = Array.isArray(data?.spots)
      ? data.spots.map((s: any) => {
          const epgMatch = resolveRadioEPGDetails(
            s.played_at,
            s.played_at_local,
            radioPrograms,
            s.program_name,
            s.user_dj
          );
          return {
            ...s,
            program_name: epgMatch.programName,
            user_dj: epgMatch.presenter,
          };
        })
      : [];

    const enrichedData = {
      ...data,
      spots,
    };

    if (format.toLowerCase() === 'csv') {
      const lines: string[] = [
        'Date & Time (EAT),Client,Spot Title,Duration (MM:SS),Duration (Sec),Radio Program / Show,Program Presenter,Category,Source File',
      ];
      for (const s of spots) {
        lines.push(
          [
            csvEscape(s.played_at_local || s.played_at),
            csvEscape(s.client),
            csvEscape(s.title),
            csvEscape(s.duration_formatted || `${s.duration_seconds}s`),
            csvEscape(s.duration_seconds),
            csvEscape(s.program_name),
            csvEscape(s.user_dj),
            csvEscape(s.category),
            csvEscape(s.filename),
          ].join(',')
        );
      }

      const safeClient = (client || 'all_clients')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      const filename = `saltfm_affidavit_${safeClient}.csv`;

      return new NextResponse(lines.join('\n') + '\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(enrichedData);
  } catch (error) {
    console.error('Radio traffic affidavit API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traffic affidavit logs' },
      { status: 500 }
    );
  }
}
