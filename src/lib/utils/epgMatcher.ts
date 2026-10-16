export interface RadioEPGProgram {
  programName: string;
  presenter?: string;
  startTime: string; // UTC "HH:MM"
  endTime: string;   // UTC "HH:MM"
  days?: string;     // e.g. "Monday, Tuesday, Wednesday"
}

export interface MatchedEPGInfo {
  programName: string;
  presenter: string;
}

function parseUtcHHMMToEatMinutes(hhmm: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [hStr, mStr] = hhmm.trim().split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  // Africa/Kampala (EAT) is UTC+3 (+180 minutes)
  return (h * 60 + m + 180) % 1440;
}

export function formatUtcHHMMToEat(hhmm: string): string {
  const eatMin = parseUtcHHMMToEatMinutes(hhmm);
  if (eatMin === null) return hhmm;
  const h = Math.floor(eatMin / 60);
  const m = eatMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getEatDayAndMinutes(
  playedAtIso?: string,
  playedAtLocal?: string
): { eatDay: string; prevEatDay: string; eatMinutes: number } | null {
  let dt: Date | null = null;

  if (playedAtIso) {
    const parsed = new Date(playedAtIso);
    if (!Number.isNaN(parsed.getTime())) {
      dt = parsed;
    }
  }

  if (!dt && playedAtLocal) {
    // playedAtLocal is "YYYY-MM-DD HH:MM:SS" in EAT (+03:00)
    const isoEat = playedAtLocal.trim().replace(' ', 'T') + '+03:00';
    const parsed = new Date(isoEat);
    if (!Number.isNaN(parsed.getTime())) {
      dt = parsed;
    }
  }

  if (!dt) return null;

  const eatDay = dt
    .toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'Africa/Kampala',
    })
    .toLowerCase();

  const prevDt = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
  const prevEatDay = prevDt
    .toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'Africa/Kampala',
    })
    .toLowerCase();

  const parts = dt
    .toLocaleTimeString('en-GB', {
      timeZone: 'Africa/Kampala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .split(':');

  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return {
    eatDay,
    prevEatDay,
    eatMinutes: (h % 24) * 60 + m,
  };
}

function programHasDay(daysStr: string | undefined, targetDayLower: string): boolean {
  if (!daysStr || !daysStr.trim()) return true; // If no days restriction, treat as daily
  const list = daysStr
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.some(
    (d) =>
      d === targetDayLower ||
      targetDayLower.startsWith(d) ||
      d === 'daily' ||
      d === 'everyday' ||
      d === 'all'
  );
}

/**
 * Matches a spot's timestamp against the station's Radio EPG schedule and
 * returns both the matched Program Name and Program Presenter.
 */
export function resolveRadioEPGDetails(
  playedAtIso: string | undefined,
  playedAtLocal: string | undefined,
  programs: RadioEPGProgram[] | undefined | null,
  fallbackProgramName?: string,
  fallbackPresenter?: string
): MatchedEPGInfo {
  const cleanFallbackProgram =
    fallbackProgramName &&
    fallbackProgramName.trim() !== '' &&
    fallbackProgramName.trim().toLowerCase() !== 'live playout'
      ? fallbackProgramName
      : 'Automated Playout';

  const cleanFallbackPresenter =
    fallbackPresenter &&
    fallbackPresenter.trim() !== '' &&
    fallbackPresenter.trim().toLowerCase() !== 'radio'
      ? fallbackPresenter
      : '-';

  if (!programs || programs.length === 0) {
    return {
      programName: cleanFallbackProgram,
      presenter: cleanFallbackPresenter,
    };
  }

  const info = getEatDayAndMinutes(playedAtIso, playedAtLocal);
  if (!info) {
    return {
      programName: cleanFallbackProgram,
      presenter: cleanFallbackPresenter,
    };
  }

  const { eatDay, prevEatDay, eatMinutes } = info;

  for (const p of programs) {
    const startMin = parseUtcHHMMToEatMinutes(p.startTime);
    let endMin = parseUtcHHMMToEatMinutes(p.endTime);
    if (startMin === null || endMin === null) continue;

    // A show ending at 00:00 EAT (21:00 UTC) or 23:59 EAT ends at the end of the day (1440)
    if (endMin === 0 && startMin > 0) {
      endMin = 1440;
    } else if (endMin === 1439) {
      endMin = 1440;
    }

    let matched = false;
    if (startMin < endMin) {
      if (
        eatMinutes >= startMin &&
        eatMinutes < endMin &&
        programHasDay(p.days, eatDay)
      ) {
        matched = true;
      }
    } else if (startMin > endMin) {
      // Crosses EAT midnight (e.g. 22:00 to 02:00 EAT)
      if (eatMinutes >= startMin && programHasDay(p.days, eatDay)) {
        matched = true;
      } else if (
        eatMinutes < endMin &&
        (programHasDay(p.days, prevEatDay) || programHasDay(p.days, eatDay))
      ) {
        matched = true;
      }
    }

    if (matched) {
      return {
        programName: p.programName || cleanFallbackProgram,
        presenter:
          p.presenter && p.presenter.trim() !== ''
            ? p.presenter.trim()
            : cleanFallbackPresenter,
      };
    }
  }

  return {
    programName: cleanFallbackProgram,
    presenter: cleanFallbackPresenter,
  };
}

export function resolveRadioShowFromEPG(
  playedAtIso: string | undefined,
  playedAtLocal: string | undefined,
  programs: RadioEPGProgram[] | undefined | null,
  fallbackProgramName?: string
): string {
  return resolveRadioEPGDetails(
    playedAtIso,
    playedAtLocal,
    programs,
    fallbackProgramName
  ).programName;
}
