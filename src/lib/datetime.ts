export const getValidDate = (value: Date | string | number | null | undefined) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getTimestamp = (value: Date | string | number | null | undefined) => getValidDate(value)?.getTime() ?? null;

export const toIsoString = (value: Date | string | number | null | undefined, fallback?: string) => {
  const parsed = getValidDate(value);
  return parsed ? parsed.toISOString() : fallback ?? null;
};

export const toHourStartIso = (value: Date | string | number | null | undefined, fallback?: string) => {
  const parsed = getValidDate(value);

  if (!parsed) {
    return fallback ?? null;
  }

  const hourStart = new Date(parsed);
  hourStart.setUTCMinutes(0, 0, 0);
  return hourStart.toISOString();
};

export const parseDateTimeLocalToUtcIso = (value: string, fallback?: string) => {
  if (!value) {
    return fallback ?? null;
  }

  return toIsoString(`${value}:00Z`, fallback);
};

export const formatDateTime = (
  value: Date | string | number | null | undefined,
  formatter: Intl.DateTimeFormat,
  fallback = '--',
) => {
  const parsed = getValidDate(value);
  return parsed ? formatter.format(parsed) : fallback;
};
