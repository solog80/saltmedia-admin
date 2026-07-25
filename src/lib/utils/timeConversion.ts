// Convert UTC HH:MM to local HH:MM
export function utcToLocal(utcTime: string): string {
  if (!utcTime) return '';

  const [hours, minutes] = utcTime.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);

  const localHours = String(date.getHours()).padStart(2, '0');
  const localMinutes = String(date.getMinutes()).padStart(2, '0');

  return `${localHours}:${localMinutes}`;
}

// Convert local HH:MM to UTC HH:MM
export function localToUtc(localTime: string): string {
  if (!localTime) return '';

  // Handle datetime-local format (YYYY-MM-DDTHH:mm)
  if (localTime.includes('T')) {
    return localDatetimeToUtc(localTime);
  }

  // Handle time-only format (HH:mm)
  const [hours, minutes] = localTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  const utcHours = String(date.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${utcHours}:${utcMinutes}`;
}

// Convert local datetime (YYYY-MM-DDTHH:mm) to UTC ISO string
export function localDatetimeToUtc(localDatetime: string): string {
  if (!localDatetime) return '';

  // Parse the local datetime string (YYYY-MM-DDTHH:mm)
  const [datePart, timePart] = localDatetime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Create a date assuming the input is local time
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Convert to UTC ISO string
  return localDate.toISOString();
}

// Convert UTC ISO string to local datetime (YYYY-MM-DDTHH:mm)
export function utcDatetimeToLocal(utcDatetime: string): string {
  if (!utcDatetime) return '';

  // Handle datetime-local format request (YYYY-MM-DDTHH:mm)
  if (utcDatetime.includes('T')) {
    const date = new Date(utcDatetime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  return utcToLocal(utcDatetime);
}