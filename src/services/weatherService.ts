import type { DemandBid, MarketReport, WeatherHour } from '../types';

export const defaultWeatherLocation = {
  label: 'Melbourne, VIC',
  latitude: -37.8136,
  longitude: 144.9631,
  timezone: 'GMT',
} as const;

export interface HistoricalWeatherWindow {
  startDate: string;
  endDate: string;
}

export interface HistoricalAlignedHour {
  time: string;
  weather: WeatherHour;
  supplyReports: MarketReport[];
  demandBids: DemandBid[];
  totalSupplyKwh: number;
  averageSupplyPrice: number;
  totalDemandKwh: number;
  weightedDemandBid: number;
}

interface OpenMeteoHourlyResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    precipitation?: number[];
    cloud_cover?: number[];
    shortwave_radiation?: number[];
    direct_normal_irradiance?: number[];
    wind_speed_10m?: number[];
    weather_code?: number[];
    is_day?: number[];
  };
}

const hourlyFields = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'cloud_cover',
  'shortwave_radiation',
  'direct_normal_irradiance',
  'wind_speed_10m',
  'weather_code',
  'is_day',
].join(',');

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toUtcIso = (value: string) => new Date(`${value}:00Z`).toISOString();

const hourKey = (value: string) => {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
};

const toApiDate = (value: string) => value.slice(0, 10);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const weightedAverage = (values: { weight: number; price: number }[]) => {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return values.reduce((total, item) => total + item.weight * item.price, 0) / totalWeight;
};

export const estimateSolarSurplusFromWeather = (hour: WeatherHour) => {
  if (!hour.isDay) {
    return 0.2;
  }

  const solarScore =
    hour.shortwaveRadiation * 0.0072 +
    hour.directNormalIrradiance * 0.0038 -
    hour.cloudCover * 0.026 -
    hour.precipitationMm * 0.9 -
    hour.windSpeed10m * 0.03 +
    Math.max(hour.temperatureC - 10, 0) * 0.05;

  return clamp(Number((0.45 + solarScore).toFixed(2)), 0.2, 9.5);
};

export const estimateListingPriceFromWeather = (hour: WeatherHour) => {
  const supply = estimateSolarSurplusFromWeather(hour);
  const premium =
    0.168 +
    hour.cloudCover * 0.00028 +
    hour.precipitationMm * 0.01 -
    hour.shortwaveRadiation * 0.000035 +
    (hour.isDay ? 0 : 0.012);

  return clamp(Number((premium - supply * 0.0035).toFixed(3)), 0.105, 0.235);
};

export const describeWeatherSignal = (hour: WeatherHour) => {
  if (!hour.isDay) {
    return 'This is a night-time hour, so solar supply is naturally limited and buyer willingness to pay matters more.';
  }

  if (hour.shortwaveRadiation > 550 && hour.cloudCover < 30) {
    return 'High radiation and low cloud cover suggest stronger solar surplus in this hour.';
  }

  if (hour.precipitationMm > 0.8 || hour.cloudCover > 75) {
    return 'High cloud cover or rainfall helps explain tighter supply and higher prices in this hour.';
  }

  return 'This is a relatively neutral weather hour, which is useful for observing the baseline supply-demand relationship.';
};

export const getHistoricalWeatherWindow = (marketReports: MarketReport[], demandBids: DemandBid[]): HistoricalWeatherWindow | null => {
  if (marketReports.length === 0 || demandBids.length === 0) {
    return null;
  }

  const marketTimes = marketReports.map((report) => Date.parse(report.reportedAt)).filter(Number.isFinite);
  const demandTimes = demandBids.map((bid) => Date.parse(bid.requestedAt)).filter(Number.isFinite);

  if (marketTimes.length === 0 || demandTimes.length === 0) {
    return null;
  }

  const start = Math.max(Math.min(...marketTimes), Math.min(...demandTimes));
  const end = Math.min(Math.max(...marketTimes), Math.max(...demandTimes));

  if (start > end) {
    return null;
  }

  return {
    startDate: new Date(start).toISOString(),
    endDate: new Date(end).toISOString(),
  };
};

export const fetchHistoricalWeather = async (window: HistoricalWeatherWindow) => {
  const weatherUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
  weatherUrl.searchParams.set('latitude', String(defaultWeatherLocation.latitude));
  weatherUrl.searchParams.set('longitude', String(defaultWeatherLocation.longitude));
  weatherUrl.searchParams.set('start_date', toApiDate(window.startDate));
  weatherUrl.searchParams.set('end_date', toApiDate(window.endDate));
  weatherUrl.searchParams.set('hourly', hourlyFields);
  weatherUrl.searchParams.set('timezone', defaultWeatherLocation.timezone);

  const response = await fetch(weatherUrl.toString());

  if (!response.ok) {
    throw new Error(`Historical weather API returned ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoHourlyResponse;
  const hourly = payload.hourly;

  if (!hourly?.time?.length) {
    throw new Error('Historical weather API returned no hourly data.');
  }

  return hourly.time.map<WeatherHour>((time, index) => ({
    time: toUtcIso(time),
    temperatureC: hourly.temperature_2m?.[index] ?? 0,
    relativeHumidity: hourly.relative_humidity_2m?.[index] ?? 0,
    precipitationMm: hourly.precipitation?.[index] ?? 0,
    cloudCover: hourly.cloud_cover?.[index] ?? 0,
    shortwaveRadiation: hourly.shortwave_radiation?.[index] ?? 0,
    directNormalIrradiance: hourly.direct_normal_irradiance?.[index] ?? 0,
    windSpeed10m: hourly.wind_speed_10m?.[index] ?? 0,
    weatherCode: hourly.weather_code?.[index] ?? 0,
    isDay: (hourly.is_day?.[index] ?? 0) === 1,
  }));
};

export const alignHistoricalWeatherWithMarket = (
  weatherHours: WeatherHour[],
  marketReports: MarketReport[],
  demandBids: DemandBid[],
) => {
  const supplyByHour = new Map<string, MarketReport[]>();
  const demandByHour = new Map<string, DemandBid[]>();

  marketReports.forEach((report) => {
    const key = hourKey(report.reportedAt);
    const current = supplyByHour.get(key) ?? [];
    current.push(report);
    supplyByHour.set(key, current);
  });

  demandBids.forEach((bid) => {
    const key = hourKey(bid.requestedAt);
    const current = demandByHour.get(key) ?? [];
    current.push(bid);
    demandByHour.set(key, current);
  });

  return weatherHours
    .map<HistoricalAlignedHour | null>((weather) => {
      const key = hourKey(weather.time);
      const supplyReports = supplyByHour.get(key) ?? [];
      const hourDemandBids = demandByHour.get(key) ?? [];

      if (supplyReports.length === 0 && hourDemandBids.length === 0) {
        return null;
      }

      const totalSupplyKwh = sum(supplyReports.map((report) => report.surplusKwh));
      const totalDemandKwh = sum(hourDemandBids.map((bid) => bid.demandKwh));

      return {
        time: key,
        weather,
        supplyReports,
        demandBids: hourDemandBids,
        totalSupplyKwh: Number(totalSupplyKwh.toFixed(2)),
        averageSupplyPrice: Number(
          weightedAverage(supplyReports.map((report) => ({ weight: report.surplusKwh, price: report.pricePerKwh }))).toFixed(3),
        ),
        totalDemandKwh: Number(totalDemandKwh.toFixed(2)),
        weightedDemandBid: Number(
          weightedAverage(hourDemandBids.map((bid) => ({ weight: bid.demandKwh, price: bid.maxPricePerKwh }))).toFixed(3),
        ),
      };
    })
    .filter((item): item is HistoricalAlignedHour => item !== null)
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
};
