import type {
  DemandBid,
  DemandModelSummary,
  MarketReport,
  PricingRecommendation,
  RegressionMetrics,
  UserListingInput,
  WeatherHour,
} from '../types';
import { getTimestamp, toHourStartIso, toIsoString } from '../lib/datetime';

interface MarketStats {
  reportCount: number;
  totalSurplusKwh: number;
  averagePrice: number;
  medianPrice: number;
  lowestPrice: number;
  highestPrice: number;
}

interface DemandStats {
  bidCount: number;
  totalDemandKwh: number;
  averageBid: number;
  lowestBid: number;
  highestBid: number;
}

interface DemandObservation {
  bid: DemandBid;
  timestamp: number;
  demandKwh: number;
  pricePerKwh: number;
  hour: number;
  month: number;
  dayOfWeek: number;
  isWeekend: number;
  hourSin: number;
  hourCos: number;
  monthSin: number;
  monthCos: number;
  lagDemand1: number;
  lagDemand24: number;
  lagPrice1: number;
  lagPrice24: number;
  rollingDemand24: number;
  rollingPrice24: number;
  temperatureC: number;
  cloudCover: number;
  precipitationMm: number;
  shortwaveRadiation: number;
  directNormalIrradiance: number;
  weatherIsDay: number;
}

interface LinearRegressionModel {
  weights: number[];
}

interface TreeNode {
  value: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

interface RandomForestModel {
  trees: TreeNode[];
}

interface DemandModelBundle {
  observations: DemandObservation[];
  observationMap: Map<number, DemandObservation>;
  hourlyMeans: Map<number, { demand: number; price: number }>;
  baselineModel: LinearRegressionModel;
  randomForestModel: RandomForestModel;
  validationDemandResiduals: number[];
  summary: DemandModelSummary;
  historicalDemandMin: number;
  historicalDemandMax: number;
  weatherHourlyMeans: Map<number, WeatherFeatureSet>;
}

interface WeatherFeatureSet {
  temperatureC: number;
  cloudCover: number;
  precipitationMm: number;
  shortwaveRadiation: number;
  directNormalIrradiance: number;
  weatherIsDay: number;
}

interface ScenarioContext {
  timestamp: number;
  hour: number;
  month: number;
  dayOfWeek: number;
  isWeekend: number;
  hourSin: number;
  hourCos: number;
  monthSin: number;
  monthCos: number;
  lagDemand1: number;
  lagDemand24: number;
  lagPrice1: number;
  lagPrice24: number;
  rollingDemand24: number;
  rollingPrice24: number;
  temperatureC: number;
  cloudCover: number;
  precipitationMm: number;
  shortwaveRadiation: number;
  directNormalIrradiance: number;
  weatherIsDay: number;
}

interface SimulationOutcome {
  expectedProfit: number;
  expectedDemand: number;
  expectedShortfall: number;
  expectedOwnSupplyUsed: number;
  fillProbability: number;
  marketShare: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

const percentile = (values: number[], probability: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const weightedAveragePrice = (reports: MarketReport[]) => {
  const totalKwh = reports.reduce((sum, report) => sum + report.surplusKwh, 0);

  if (totalKwh === 0) {
    return 0;
  }

  const weightedPrice = reports.reduce((sum, report) => sum + report.surplusKwh * report.pricePerKwh, 0);
  return weightedPrice / totalKwh;
};

const weightedAverageBid = (bids: DemandBid[]) => {
  const totalKwh = bids.reduce((sum, bid) => sum + bid.demandKwh, 0);

  if (totalKwh === 0) {
    return 0;
  }

  const weightedPrice = bids.reduce((sum, bid) => sum + bid.demandKwh * bid.maxPricePerKwh, 0);
  return weightedPrice / totalKwh;
};

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

const standardDeviation = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const parseMarketTimestamp = (value: string) => {
  const normalized = value.includes('T')
    ? value.endsWith('Z')
      ? value
      : `${value}:00Z`
    : `${value.replace(' ', 'T')}Z`;
  return getTimestamp(normalized) ?? Number.NaN;
};

const buildUtcParts = (timestamp: number) => {
  const iso = new Date(timestamp).toISOString();
  const hour = Number(iso.slice(11, 13));
  const month = Number(iso.slice(5, 7));
  const dayOfWeek = new Date(timestamp).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

  return {
    hour,
    month,
    dayOfWeek,
    isWeekend,
    hourSin: Math.sin((2 * Math.PI * hour) / 24),
    hourCos: Math.cos((2 * Math.PI * hour) / 24),
    monthSin: Math.sin((2 * Math.PI * month) / 12),
    monthCos: Math.cos((2 * Math.PI * month) / 12),
  };
};

const circularDistance = (left: number, right: number, cycle: number) => {
  const distance = Math.abs(left - right);
  return Math.min(distance, cycle - distance);
};

const dotProduct = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);

const toHourKey = (timestamp: number) => {
  return toHourStartIso(timestamp, new Date(0).toISOString()) ?? new Date(0).toISOString();
};

const weatherFeatureFallback: WeatherFeatureSet = {
  temperatureC: 18,
  cloudCover: 45,
  precipitationMm: 0,
  shortwaveRadiation: 220,
  directNormalIrradiance: 320,
  weatherIsDay: 1,
};

const buildWeatherLookup = (weatherHours: WeatherHour[]) =>
  new Map(
    weatherHours.map((hour) => [
      toHourKey(parseMarketTimestamp(hour.time)),
      {
        temperatureC: hour.temperatureC,
        cloudCover: hour.cloudCover,
        precipitationMm: hour.precipitationMm,
        shortwaveRadiation: hour.shortwaveRadiation,
        directNormalIrradiance: hour.directNormalIrradiance,
        weatherIsDay: hour.isDay ? 1 : 0,
      } satisfies WeatherFeatureSet,
    ]),
  );

const resolveWeatherFeatures = (
  timestamp: number,
  weatherLookup: Map<string, WeatherFeatureSet>,
  hourlyWeatherMeans?: Map<number, WeatherFeatureSet>,
) => {
  const direct = weatherLookup.get(toHourKey(timestamp));

  if (direct) {
    return direct;
  }

  const hour = buildUtcParts(timestamp).hour;
  return hourlyWeatherMeans?.get(hour) ?? weatherFeatureFallback;
};

const summarizeWeatherContext = (weather: WeatherFeatureSet) => {
  if (weather.weatherIsDay === 0) {
    return 'This is a night-time hour, so solar supply is naturally lower.';
  }

  if (weather.shortwaveRadiation > 500 && weather.cloudCover < 30) {
    return 'High radiation and low cloud cover indicate stronger supply conditions.';
  }

  if (weather.precipitationMm > 0.8 || weather.cloudCover > 75) {
    return 'High cloud cover or rainfall indicates tighter supply conditions.';
  }

  return 'Weather conditions are relatively neutral, so the supply-demand disturbance is limited.';
};

const computeWeatherDemandMultiplier = (weather: WeatherFeatureSet) =>
  clamp(
    1 +
      weather.precipitationMm * 0.012 +
      weather.cloudCover * 0.0008 +
      Math.max(18 - weather.temperatureC, 0) * 0.008 +
      Math.max(weather.temperatureC - 28, 0) * 0.01 -
      weather.shortwaveRadiation * 0.00018,
    0.82,
    1.28,
  );

const computeWeatherSupplyAdjustment = (weather: WeatherFeatureSet, surplusKwh: number) =>
  clamp(
    (weather.shortwaveRadiation - 240) * 0.0026 +
      (weather.directNormalIrradiance - 300) * 0.0014 -
      weather.cloudCover * 0.018 -
      weather.precipitationMm * 0.55 +
      (weather.weatherIsDay === 0 ? -0.55 : 0),
    -surplusKwh * 0.75,
    surplusKwh * 0.75,
  );

const computeRegressionMetrics = (actual: number[], predicted: number[]): RegressionMetrics => {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return { rmse: 0, mae: 0, r2: 0 };
  }

  const average = mean(actual);
  let squaredError = 0;
  let absoluteError = 0;
  let totalVariance = 0;

  for (let index = 0; index < actual.length; index += 1) {
    const error = predicted[index] - actual[index];
    squaredError += error ** 2;
    absoluteError += Math.abs(error);
    totalVariance += (actual[index] - average) ** 2;
  }

  return {
    rmse: round(Math.sqrt(squaredError / actual.length), 4),
    mae: round(absoluteError / actual.length, 4),
    r2: round(totalVariance === 0 ? 0 : 1 - squaredError / totalVariance, 4),
  };
};

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length;
  const augmented = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (maxRow !== pivot) {
      [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    }

    const pivotValue = augmented[pivot][pivot] || 1e-9;
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }

      const factor = augmented[row][pivot];
      if (factor === 0) {
        continue;
      }

      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size]);
};

const trainLinearRegression = (features: number[][], targets: number[]) => {
  const featureCount = features[0]?.length ?? 0;
  const xtx = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const xty = Array(featureCount).fill(0);

  for (let row = 0; row < features.length; row += 1) {
    const featureRow = features[row];
    const target = targets[row];

    for (let left = 0; left < featureCount; left += 1) {
      xty[left] += featureRow[left] * target;
      for (let right = 0; right < featureCount; right += 1) {
        xtx[left][right] += featureRow[left] * featureRow[right];
      }
    }
  }

  for (let index = 0; index < featureCount; index += 1) {
    xtx[index][index] += 1e-6;
  }

  return {
    weights: solveLinearSystem(xtx, xty),
  };
};

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const sampleWithoutReplacement = (max: number, count: number, random: () => number) => {
  const pool = Array.from({ length: max }, (_, index) => index);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
};

const buildBaselineFeatureVector = (context: ScenarioContext, pricePerKwh: number) => {
  const features = [
    1,
    Math.log(Math.max(pricePerKwh, 0.005)),
    context.isWeekend,
    context.lagDemand1,
    context.lagDemand24,
    context.lagPrice1,
    context.lagPrice24,
    context.temperatureC / 40,
    context.cloudCover / 100,
    context.precipitationMm / 10,
    context.shortwaveRadiation / 1000,
    context.directNormalIrradiance / 1000,
    context.weatherIsDay,
  ];

  for (let hour = 1; hour < 24; hour += 1) {
    features.push(context.hour === hour ? 1 : 0);
  }

  for (let month = 2; month <= 12; month += 1) {
    features.push(context.month === month ? 1 : 0);
  }

  return features;
};

const buildForestFeatureVector = (context: ScenarioContext, pricePerKwh: number) => {
  const logPrice = Math.log(Math.max(pricePerKwh, 0.005));

  return [
    pricePerKwh,
    logPrice,
    context.hour,
    context.month,
    context.dayOfWeek,
    context.isWeekend,
    context.hourSin,
    context.hourCos,
    context.monthSin,
    context.monthCos,
    context.lagDemand1,
    context.lagDemand24,
    context.lagPrice1,
    context.lagPrice24,
    context.rollingDemand24,
    context.rollingPrice24,
    context.temperatureC,
    context.cloudCover,
    context.precipitationMm,
    context.shortwaveRadiation,
    context.directNormalIrradiance,
    context.weatherIsDay,
    logPrice * context.isWeekend,
    logPrice * context.hourSin,
    logPrice * context.hourCos,
    logPrice * (context.cloudCover / 100),
    logPrice * (context.shortwaveRadiation / 1000),
    context.lagDemand1 - context.lagDemand24,
    context.lagPrice1 - context.lagPrice24,
    context.rollingDemand24 - context.lagDemand24,
  ];
};

const computeNodeMean = (rows: number[], targets: number[]) =>
  rows.reduce((sum, rowIndex) => sum + targets[rowIndex], 0) / Math.max(rows.length, 1);

const computeNodeSse = (rows: number[], targets: number[], meanValue: number) =>
  rows.reduce((sum, rowIndex) => sum + (targets[rowIndex] - meanValue) ** 2, 0);

const candidateThresholds = (values: number[]) => {
  if (values.length === 0) {
    return [];
  }

  const thresholds = new Set<number>();
  for (let step = 1; step <= 6; step += 1) {
    thresholds.add(percentile(values, step / 7));
  }

  const sorted = [...thresholds].filter(Number.isFinite).sort((left, right) => left - right);
  const lower = sorted[0];
  const upper = sorted[sorted.length - 1];

  return sorted.filter((value) => value > lower && value < upper);
};

const buildDecisionTree = (
  rows: number[],
  features: number[][],
  targets: number[],
  random: () => number,
  depth = 0,
): TreeNode => {
  const maxDepth = 6;
  const minLeaf = 24;
  const currentMean = computeNodeMean(rows, targets);

  if (depth >= maxDepth || rows.length <= minLeaf * 2) {
    return { value: currentMean };
  }

  const featureCount = features[0]?.length ?? 0;
  const sampledFeatures = sampleWithoutReplacement(featureCount, Math.max(3, Math.floor(Math.sqrt(featureCount))), random);
  const parentSse = computeNodeSse(rows, targets, currentMean);

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];

  for (const featureIndex of sampledFeatures) {
    const values = rows.map((rowIndex) => features[rowIndex][featureIndex]);
    const thresholds = candidateThresholds(values);

    for (const threshold of thresholds) {
      const leftRows: number[] = [];
      const rightRows: number[] = [];

      for (const rowIndex of rows) {
        if (features[rowIndex][featureIndex] <= threshold) {
          leftRows.push(rowIndex);
        } else {
          rightRows.push(rowIndex);
        }
      }

      if (leftRows.length < minLeaf || rightRows.length < minLeaf) {
        continue;
      }

      const leftMean = computeNodeMean(leftRows, targets);
      const rightMean = computeNodeMean(rightRows, targets);
      const splitSse = computeNodeSse(leftRows, targets, leftMean) + computeNodeSse(rightRows, targets, rightMean);
      const gain = parentSse - splitSse;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = featureIndex;
        bestThreshold = threshold;
        bestLeft = leftRows;
        bestRight = rightRows;
      }
    }
  }

  if (bestFeature === -1 || bestLeft.length === 0 || bestRight.length === 0) {
    return { value: currentMean };
  }

  return {
    value: currentMean,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildDecisionTree(bestLeft, features, targets, random, depth + 1),
    right: buildDecisionTree(bestRight, features, targets, random, depth + 1),
  };
};

const trainRandomForest = (features: number[][], targets: number[]) => {
  const random = createSeededRandom(20260427);
  const treeCount = 18;
  const sampleSize = Math.min(features.length, 1800);
  const trees: TreeNode[] = [];

  for (let treeIndex = 0; treeIndex < treeCount; treeIndex += 1) {
    const sampledRows = Array.from({ length: sampleSize }, () => Math.floor(random() * features.length));
    trees.push(buildDecisionTree(sampledRows, features, targets, random));
  }

  return { trees };
};

const predictTree = (node: TreeNode, features: number[]): number => {
  if (node.featureIndex === undefined || node.threshold === undefined || !node.left || !node.right) {
    return node.value;
  }

  return features[node.featureIndex] <= node.threshold ? predictTree(node.left, features) : predictTree(node.right, features);
};

const predictRandomForest = (model: RandomForestModel, features: number[]) =>
  mean(model.trees.map((tree) => predictTree(tree, features)));

const predictLinearDemand = (model: LinearRegressionModel, context: ScenarioContext, pricePerKwh: number) =>
  Math.max(0, Math.exp(dotProduct(model.weights, buildBaselineFeatureVector(context, pricePerKwh))));

const predictForestDemand = (model: RandomForestModel, context: ScenarioContext, pricePerKwh: number) =>
  Math.max(0, predictRandomForest(model, buildForestFeatureVector(context, pricePerKwh)));

const buildDemandObservations = (bids: DemandBid[], weatherLookup: Map<string, WeatherFeatureSet>) => {
  const latestByTimestamp = new Map<number, DemandBid>();

  for (const bid of bids) {
    const timestamp = parseMarketTimestamp(bid.requestedAt);
    if (!Number.isFinite(timestamp) || bid.demandKwh <= 0 || bid.maxPricePerKwh <= 0) {
      continue;
    }

    latestByTimestamp.set(timestamp, bid);
  }

  const baseRows = [...latestByTimestamp.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([timestamp, bid]) => ({
      bid,
      timestamp,
      demandKwh: bid.demandKwh,
      pricePerKwh: bid.maxPricePerKwh,
    }));

  const baseMap = new Map(baseRows.map((row) => [row.timestamp, row]));
  const hourAccumulator = new Map<number, { demandSum: number; priceSum: number; count: number }>();
  const demandWindow: number[] = [];
  const priceWindow: number[] = [];
  const observations: DemandObservation[] = [];
  const weatherAccumulator = new Map<number, { temperature: number; cloud: number; precipitation: number; radiation: number; dni: number; isDay: number; count: number }>();

  for (let index = 0; index < baseRows.length; index += 1) {
    const row = baseRows[index];
    const previousRow = index > 0 ? baseRows[index - 1] : row;
    const previousHour = baseMap.get(row.timestamp - HOUR_MS) ?? previousRow;
    const previousDay = baseMap.get(row.timestamp - DAY_MS) ?? baseRows[Math.max(0, index - 24)] ?? previousHour;
    const timeParts = buildUtcParts(row.timestamp);
    const rollingDemand24 = demandWindow.length > 0 ? mean(demandWindow) : row.demandKwh;
    const rollingPrice24 = priceWindow.length > 0 ? mean(priceWindow) : row.pricePerKwh;
    const weather = resolveWeatherFeatures(row.timestamp, weatherLookup);

    observations.push({
      bid: row.bid,
      timestamp: row.timestamp,
      demandKwh: row.demandKwh,
      pricePerKwh: row.pricePerKwh,
      ...timeParts,
      lagDemand1: previousHour.demandKwh,
      lagDemand24: previousDay.demandKwh,
      lagPrice1: previousHour.pricePerKwh,
      lagPrice24: previousDay.pricePerKwh,
      rollingDemand24,
      rollingPrice24,
      temperatureC: weather.temperatureC,
      cloudCover: weather.cloudCover,
      precipitationMm: weather.precipitationMm,
      shortwaveRadiation: weather.shortwaveRadiation,
      directNormalIrradiance: weather.directNormalIrradiance,
      weatherIsDay: weather.weatherIsDay,
    });

    const currentBucket = hourAccumulator.get(timeParts.hour) ?? { demandSum: 0, priceSum: 0, count: 0 };
    currentBucket.demandSum += row.demandKwh;
    currentBucket.priceSum += row.pricePerKwh;
    currentBucket.count += 1;
    hourAccumulator.set(timeParts.hour, currentBucket);

    const weatherBucket = weatherAccumulator.get(timeParts.hour) ?? {
      temperature: 0,
      cloud: 0,
      precipitation: 0,
      radiation: 0,
      dni: 0,
      isDay: 0,
      count: 0,
    };
    weatherBucket.temperature += weather.temperatureC;
    weatherBucket.cloud += weather.cloudCover;
    weatherBucket.precipitation += weather.precipitationMm;
    weatherBucket.radiation += weather.shortwaveRadiation;
    weatherBucket.dni += weather.directNormalIrradiance;
    weatherBucket.isDay += weather.weatherIsDay;
    weatherBucket.count += 1;
    weatherAccumulator.set(timeParts.hour, weatherBucket);

    demandWindow.push(row.demandKwh);
    priceWindow.push(row.pricePerKwh);
    if (demandWindow.length > 24) {
      demandWindow.shift();
      priceWindow.shift();
    }
  }

  const hourlyMeans = new Map<number, { demand: number; price: number }>();
  for (const [hour, bucket] of hourAccumulator.entries()) {
    hourlyMeans.set(hour, {
      demand: bucket.demandSum / bucket.count,
      price: bucket.priceSum / bucket.count,
    });
  }

  const weatherHourlyMeans = new Map<number, WeatherFeatureSet>();
  for (const [hour, bucket] of weatherAccumulator.entries()) {
    weatherHourlyMeans.set(hour, {
      temperatureC: bucket.temperature / bucket.count,
      cloudCover: bucket.cloud / bucket.count,
      precipitationMm: bucket.precipitation / bucket.count,
      shortwaveRadiation: bucket.radiation / bucket.count,
      directNormalIrradiance: bucket.dni / bucket.count,
      weatherIsDay: bucket.isDay / bucket.count >= 0.5 ? 1 : 0,
    });
  }

  return {
    observations,
    hourlyMeans,
    weatherHourlyMeans,
  };
};

const buildDemandModelBundle = (bids: DemandBid[], weatherHours: WeatherHour[] = []) => {
  const weatherLookup = buildWeatherLookup(weatherHours);
  const { observations, hourlyMeans, weatherHourlyMeans } = buildDemandObservations(bids, weatherLookup);
  if (observations.length === 0) {
    const emptyBundle: DemandModelBundle = {
      observations: [],
      observationMap: new Map(),
      hourlyMeans: new Map(),
      baselineModel: { weights: [] },
      randomForestModel: { trees: [{ value: 0 }] },
      validationDemandResiduals: [0],
      summary: {
        trainCount: 0,
        validationCount: 0,
        testCount: 0,
        baseline: { rmse: 0, mae: 0, r2: 0 },
        randomForest: { rmse: 0, mae: 0, r2: 0 },
      },
      historicalDemandMin: 0,
      historicalDemandMax: 0,
      weatherHourlyMeans: new Map(),
    };
    return emptyBundle;
  }

  const trainEnd = Math.max(72, Math.floor(observations.length * 0.7));
  const validationEnd = Math.max(trainEnd + 24, Math.floor(observations.length * 0.8));

  const trainRows = observations.slice(0, trainEnd);
  const validationRows = observations.slice(trainEnd, validationEnd);
  const testRows = observations.slice(validationEnd);
  const rfTrainRows = trainRows.slice(Math.max(0, trainRows.length - 3200));

  const linearFeatures = trainRows.map((observation) => buildBaselineFeatureVector(observation, observation.pricePerKwh));
  const linearTargets = trainRows.map((observation) => Math.log(Math.max(observation.demandKwh, 0.01)));
  const baselineModel = trainLinearRegression(linearFeatures, linearTargets);

  const forestFeatures = rfTrainRows.map((observation) => buildForestFeatureVector(observation, observation.pricePerKwh));
  const forestTargets = rfTrainRows.map((observation) => observation.demandKwh);
  const randomForestModel = trainRandomForest(forestFeatures, forestTargets);

  const predictBaselineForRows = (rows: DemandObservation[]) =>
    rows.map((observation) => predictLinearDemand(baselineModel, observation, observation.pricePerKwh));
  const predictForestForRows = (rows: DemandObservation[]) =>
    rows.map((observation) => predictForestDemand(randomForestModel, observation, observation.pricePerKwh));

  const testActual = testRows.map((observation) => observation.demandKwh);
  const baselineTest = predictBaselineForRows(testRows);
  const forestValidation = predictForestForRows(validationRows);
  const forestTest = predictForestForRows(testRows);
  const validationResiduals =
    forestValidation.length > 0 ? validationRows.map((observation, index) => observation.demandKwh - forestValidation[index]) : [0];

  const bundle: DemandModelBundle = {
    observations,
    observationMap: new Map(observations.map((observation) => [observation.timestamp, observation])),
    hourlyMeans,
    baselineModel,
    randomForestModel,
    validationDemandResiduals: validationResiduals,
    summary: {
      trainCount: trainRows.length,
      validationCount: validationRows.length,
      testCount: testRows.length,
      baseline: computeRegressionMetrics(testActual, baselineTest),
      randomForest: computeRegressionMetrics(testActual, forestTest),
    },
    historicalDemandMin: Math.min(...observations.map((observation) => observation.demandKwh)),
    historicalDemandMax: Math.max(...observations.map((observation) => observation.demandKwh)),
    weatherHourlyMeans,
  };
  return bundle;
};

const findObservationAtOrBefore = (observations: DemandObservation[], timestamp: number) => {
  let low = 0;
  let high = observations.length - 1;
  let best: DemandObservation | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = observations[mid];

    if (candidate.timestamp <= timestamp) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best ?? observations[observations.length - 1] ?? null;
};

const buildScenarioContext = (bundle: DemandModelBundle, listingTime?: string, weatherHours: WeatherHour[] = [], explicitWeather?: WeatherHour) => {
  const fallbackTimestamp =
    bundle.observations.length > 0 ? bundle.observations[bundle.observations.length - 1].timestamp + HOUR_MS : Date.now();
  const parsedTimestamp = listingTime ? parseMarketTimestamp(listingTime) : Number.NaN;
  const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : fallbackTimestamp;
  const timeParts = buildUtcParts(timestamp);
  const hourDefaults = bundle.hourlyMeans.get(timeParts.hour) ?? { demand: mean(bundle.observations.map((item) => item.demandKwh)), price: 0.12 };
  const weatherLookup = buildWeatherLookup(weatherHours);
  const anchor = findObservationAtOrBefore(bundle.observations, timestamp) ?? bundle.observations[bundle.observations.length - 1];
  const previousHour = bundle.observationMap.get(timestamp - HOUR_MS) ?? anchor;
  const previousDay = bundle.observationMap.get(timestamp - DAY_MS) ?? previousHour;
  const weather =
    explicitWeather
      ? {
          temperatureC: explicitWeather.temperatureC,
          cloudCover: explicitWeather.cloudCover,
          precipitationMm: explicitWeather.precipitationMm,
          shortwaveRadiation: explicitWeather.shortwaveRadiation,
          directNormalIrradiance: explicitWeather.directNormalIrradiance,
          weatherIsDay: explicitWeather.isDay ? 1 : 0,
        }
      : resolveWeatherFeatures(timestamp, weatherLookup, bundle.weatherHourlyMeans);

  return {
    timestamp,
    ...timeParts,
    lagDemand1: previousHour?.demandKwh ?? hourDefaults.demand,
    lagDemand24: previousDay?.demandKwh ?? previousHour?.demandKwh ?? hourDefaults.demand,
    lagPrice1: previousHour?.pricePerKwh ?? hourDefaults.price,
    lagPrice24: previousDay?.pricePerKwh ?? previousHour?.pricePerKwh ?? hourDefaults.price,
    rollingDemand24: anchor?.rollingDemand24 ?? hourDefaults.demand,
    rollingPrice24: anchor?.rollingPrice24 ?? hourDefaults.price,
    temperatureC: weather.temperatureC,
    cloudCover: weather.cloudCover,
    precipitationMm: weather.precipitationMm,
    shortwaveRadiation: weather.shortwaveRadiation,
    directNormalIrradiance: weather.directNormalIrradiance,
    weatherIsDay: weather.weatherIsDay,
  };
};

const compressSamples = (values: number[], maxCount: number) => {
  if (values.length <= maxCount) {
    return values;
  }

  const compressed: number[] = [];
  const lastIndex = values.length - 1;
  for (let index = 0; index < maxCount; index += 1) {
    const sourceIndex = Math.floor((lastIndex * index) / Math.max(maxCount - 1, 1));
    compressed.push(values[sourceIndex]);
  }
  return compressed;
};

const selectRelevantSupplyReports = (
  reports: MarketReport[],
  listingTimestamp: number,
  weatherLookup: Map<string, WeatherFeatureSet>,
  listingWeather: WeatherFeatureSet,
  maxCount = 120,
) => {
  if (reports.length <= maxCount) {
    return reports;
  }

  const listingParts = buildUtcParts(listingTimestamp);

  return [...reports]
    .sort((left, right) => {
      const leftParts = buildUtcParts(parseMarketTimestamp(left.reportedAt));
      const rightParts = buildUtcParts(parseMarketTimestamp(right.reportedAt));
      const leftHourGap = circularDistance(leftParts.hour, listingParts.hour, 24);
      const rightHourGap = circularDistance(rightParts.hour, listingParts.hour, 24);
      const leftMonthGap = circularDistance(leftParts.month, listingParts.month, 12);
      const rightMonthGap = circularDistance(rightParts.month, listingParts.month, 12);
      const leftWeather = resolveWeatherFeatures(parseMarketTimestamp(left.reportedAt), weatherLookup);
      const rightWeather = resolveWeatherFeatures(parseMarketTimestamp(right.reportedAt), weatherLookup);
      const leftWeatherGap =
        Math.abs(leftWeather.cloudCover - listingWeather.cloudCover) * 0.03 +
        Math.abs(leftWeather.shortwaveRadiation - listingWeather.shortwaveRadiation) * 0.002 +
        Math.abs(leftWeather.precipitationMm - listingWeather.precipitationMm) * 0.8;
      const rightWeatherGap =
        Math.abs(rightWeather.cloudCover - listingWeather.cloudCover) * 0.03 +
        Math.abs(rightWeather.shortwaveRadiation - listingWeather.shortwaveRadiation) * 0.002 +
        Math.abs(rightWeather.precipitationMm - listingWeather.precipitationMm) * 0.8;

      return leftHourGap * 4 + leftMonthGap + leftWeatherGap - (rightHourGap * 4 + rightMonthGap + rightWeatherGap);
    })
    .slice(0, maxCount);
};

const deriveSupplyResiduals = (input: UserListingInput, reports: MarketReport[]) => {
  if (reports.length < 4) {
    return [-0.3, -0.15, -0.05, 0, 0.05, 0.15, 0.3].map((ratio) => ratio * input.surplusKwh);
  }

  const comparable = reports.map((report) => report.surplusKwh);
  const medianSurplus = percentile(comparable, 0.5);
  const scale = input.surplusKwh / Math.max(medianSurplus, 0.5);
  const centered = comparable.map((value) => (value - medianSurplus) * scale);
  const centeredMean = mean(centered);

  return compressSamples(
    centered.map((value) => clamp(value - centeredMean, -input.surplusKwh * 0.85, input.surplusKwh * 0.85)).sort((a, b) => a - b),
    40,
  );
};

const buildComparableSupplyReports = (
  reports: MarketReport[],
  listingTimestamp: number,
  surplusKwh: number,
  weatherLookup: Map<string, WeatherFeatureSet>,
  listingWeather: WeatherFeatureSet,
) => {
  const listingParts = buildUtcParts(listingTimestamp);

  return [...reports]
    .sort((left, right) => {
      const leftParts = buildUtcParts(parseMarketTimestamp(left.reportedAt));
      const rightParts = buildUtcParts(parseMarketTimestamp(right.reportedAt));
      const leftHourGap = circularDistance(leftParts.hour, listingParts.hour, 24);
      const rightHourGap = circularDistance(rightParts.hour, listingParts.hour, 24);
      const leftMonthGap = circularDistance(leftParts.month, listingParts.month, 12);
      const rightMonthGap = circularDistance(rightParts.month, listingParts.month, 12);
      const leftKwhGap = Math.abs(left.surplusKwh - surplusKwh);
      const rightKwhGap = Math.abs(right.surplusKwh - surplusKwh);
      const leftWeather = resolveWeatherFeatures(parseMarketTimestamp(left.reportedAt), weatherLookup);
      const rightWeather = resolveWeatherFeatures(parseMarketTimestamp(right.reportedAt), weatherLookup);
      const leftWeatherGap =
        Math.abs(leftWeather.cloudCover - listingWeather.cloudCover) * 0.025 +
        Math.abs(leftWeather.shortwaveRadiation - listingWeather.shortwaveRadiation) * 0.002;
      const rightWeatherGap =
        Math.abs(rightWeather.cloudCover - listingWeather.cloudCover) * 0.025 +
        Math.abs(rightWeather.shortwaveRadiation - listingWeather.shortwaveRadiation) * 0.002;

      return (
        leftHourGap * 5 +
        leftMonthGap * 0.5 +
        leftKwhGap +
        leftWeatherGap -
        (rightHourGap * 5 + rightMonthGap * 0.5 + rightKwhGap + rightWeatherGap)
      );
    })
    .slice(0, Math.min(reports.length, 5));
};

const buildComparableDemandBids = (bids: DemandBid[], listingTimestamp: number, optimizedPrice: number) =>
  [...bids]
    .sort((left, right) => {
      const leftTimeGap = Math.abs(parseMarketTimestamp(left.requestedAt) - listingTimestamp) / DAY_MS;
      const rightTimeGap = Math.abs(parseMarketTimestamp(right.requestedAt) - listingTimestamp) / DAY_MS;
      const leftPriceGap = Math.abs(left.maxPricePerKwh - optimizedPrice) * 100;
      const rightPriceGap = Math.abs(right.maxPricePerKwh - optimizedPrice) * 100;

      return leftTimeGap + leftPriceGap - (rightTimeGap + rightPriceGap);
    })
    .slice(0, 5);

const priceResponsiveShare = (candidatePrice: number, fitPrice: number, retailTariff: number) => {
  if (retailTariff <= fitPrice) {
    return candidatePrice <= fitPrice ? 0.95 : 0.05;
  }

  const midpoint = (fitPrice + retailTariff) / 2;
  const steepness = 8 / (retailTariff - fitPrice);
  const logisticShare = 1 / (1 + Math.exp(steepness * (candidatePrice - midpoint)));

  if (candidatePrice >= retailTariff) {
    return 0;
  }

  return clamp(logisticShare, 0, 0.995);
};

const simulatePriceOutcome = ({
  candidatePrice,
  context,
  bundle,
  historicalDemandRange,
  demandResiduals,
  supplyResiduals,
  input,
  fitPrice,
  retailTariff,
  weatherDemandMultiplier,
  weatherSupplyAdjustment,
}: {
  candidatePrice: number;
  context: ScenarioContext;
  bundle: DemandModelBundle;
  historicalDemandRange: [number, number];
  demandResiduals: number[];
  supplyResiduals: number[];
  input: UserListingInput;
  fitPrice: number;
  retailTariff: number;
  weatherDemandMultiplier: number;
  weatherSupplyAdjustment: number;
}) => {
  const grossPredictedDemand = clamp(
    predictForestDemand(bundle.randomForestModel, context, candidatePrice) * weatherDemandMultiplier,
    historicalDemandRange[0] * 0.5,
    historicalDemandRange[1] * 1.4,
  );
  const marketShare = priceResponsiveShare(candidatePrice, fitPrice, retailTariff);

  let totalProfit = 0;
  let totalDemand = 0;
  let totalShortfall = 0;
  let totalOwnSupplyUsed = 0;
  let sellThroughHits = 0;
  let scenarioCount = 0;

  for (const demandResidual of demandResiduals) {
    const simulatedGrossDemand = Math.max(0, grossPredictedDemand + demandResidual);
    const simulatedDemand = simulatedGrossDemand * marketShare;

    for (const supplyResidual of supplyResiduals) {
      const availableSupply = Math.max(0, input.surplusKwh + weatherSupplyAdjustment + supplyResidual);
      const ownSupplyUsed = Math.min(simulatedDemand, availableSupply);
      const shortfall = Math.max(0, simulatedDemand - availableSupply);
      const profit = ownSupplyUsed * (candidatePrice - fitPrice) - shortfall * Math.max(retailTariff - candidatePrice, 0);

      totalProfit += profit;
      totalDemand += simulatedDemand;
      totalShortfall += shortfall;
      totalOwnSupplyUsed += ownSupplyUsed;
      sellThroughHits += simulatedDemand >= input.surplusKwh ? 1 : 0;
      scenarioCount += 1;
    }
  }

  return {
    expectedProfit: totalProfit / Math.max(scenarioCount, 1),
    expectedDemand: totalDemand / Math.max(scenarioCount, 1),
    expectedShortfall: totalShortfall / Math.max(scenarioCount, 1),
    expectedOwnSupplyUsed: totalOwnSupplyUsed / Math.max(scenarioCount, 1),
    fillProbability: sellThroughHits / Math.max(scenarioCount, 1),
    marketShare,
  } satisfies SimulationOutcome;
};

const pricePercentiles = (values: number[]) => ({
  p10: percentile(values, 0.1),
  p35: percentile(values, 0.35),
  p70: percentile(values, 0.7),
  p85: percentile(values, 0.85),
  p95: percentile(values, 0.95),
});

export function getMarketStats(reports: MarketReport[]): MarketStats {
  if (reports.length === 0) {
    return {
      reportCount: 0,
      totalSurplusKwh: 0,
      averagePrice: 0,
      medianPrice: 0,
      lowestPrice: 0,
      highestPrice: 0,
    };
  }

  const prices = reports.map((report) => report.pricePerKwh);
  const totalSurplusKwh = reports.reduce((sum, report) => sum + report.surplusKwh, 0);

  return {
    reportCount: reports.length,
    totalSurplusKwh: round(totalSurplusKwh, 2),
    averagePrice: round(weightedAveragePrice(reports)),
    medianPrice: round(percentile(prices, 0.5)),
    lowestPrice: round(Math.min(...prices)),
    highestPrice: round(Math.max(...prices)),
  };
}

export function getDemandStats(bids: DemandBid[]): DemandStats {
  if (bids.length === 0) {
    return {
      bidCount: 0,
      totalDemandKwh: 0,
      averageBid: 0,
      lowestBid: 0,
      highestBid: 0,
    };
  }

  const prices = bids.map((bid) => bid.maxPricePerKwh);
  const totalDemandKwh = bids.reduce((sum, bid) => sum + bid.demandKwh, 0);

  return {
    bidCount: bids.length,
    totalDemandKwh: round(totalDemandKwh, 2),
    averageBid: round(weightedAverageBid(bids)),
    lowestBid: round(Math.min(...prices)),
    highestBid: round(Math.max(...prices)),
  };
}

export function calculateOptimizedPricing(
  input: UserListingInput,
  reports: MarketReport[],
  demandBids: DemandBid[] = [],
  historicalWeatherHours: WeatherHour[] = [],
): PricingRecommendation {
  const cleanedReports = reports
    .filter((report) => report.surplusKwh > 0 && report.pricePerKwh > 0)
    .sort((a, b) => (getTimestamp(b.reportedAt) ?? 0) - (getTimestamp(a.reportedAt) ?? 0));
  const cleanedDemandBids = demandBids
    .filter((bid) => bid.demandKwh > 0 && bid.maxPricePerKwh > 0)
    .sort((a, b) => parseMarketTimestamp(a.requestedAt) - parseMarketTimestamp(b.requestedAt));

  if (cleanedDemandBids.length === 0) {
    return {
      optimizedPrice: round(input.targetPrice),
      expectedRevenue: round(input.targetPrice * input.surplusKwh, 2),
      currentRevenue: round(input.targetPrice * input.surplusKwh, 2),
      revenueDelta: 0,
      marketAveragePrice: 0,
      marketMedianPrice: 0,
      marketLowPrice: 0,
      marketHighPrice: 0,
      comparableAveragePrice: round(input.targetPrice),
      comparableCount: 0,
      competitiveness: 'balanced',
      fillExpectation: 'normal',
      matchedReports: [],
      matchedDemandBids: [],
      demandWeightedBid: 0,
      demandClearingPrice: 0,
      demandCoverageKwh: 0,
      demandCoverageRatio: 0,
      usedDemandSide: false,
      fitPrice: 0,
      retailTariff: 0,
      expectedShortfallKwh: 0,
      expectedOwnSupplyUsedKwh: round(input.surplusKwh, 2),
      listingTime: input.listingTime ?? '',
      optimizationGridSize: 0,
      supplyUncertaintyStd: 0,
      demandModelSummary: {
        trainCount: 0,
        validationCount: 0,
        testCount: 0,
        baseline: { rmse: 0, mae: 0, r2: 0 },
        randomForest: { rmse: 0, mae: 0, r2: 0 },
      },
      weatherSummary: 'No weather context is currently available.',
      weatherAdjustedDemandMultiplier: 1,
      weatherAdjustedSupplyAdjustment: 0,
      explanation: [
        'There is currently no demand-side history available to train the OLS or Random Forest demand model.',
        'The system therefore falls back to your input price. To enable machine-learning-based pricing, keep or import demand-side data.',
      ],
    };
  }

  const marketStats = getMarketStats(cleanedReports);
  const demandStats = getDemandStats(cleanedDemandBids);
  const weatherLookup = buildWeatherLookup(historicalWeatherHours);
  const demandModelBundle = buildDemandModelBundle(demandBids, historicalWeatherHours);
  const listingContext = buildScenarioContext(demandModelBundle, input.listingTime, historicalWeatherHours, input.weatherContext);
  const listingWeather: WeatherFeatureSet = {
    temperatureC: listingContext.temperatureC,
    cloudCover: listingContext.cloudCover,
    precipitationMm: listingContext.precipitationMm,
    shortwaveRadiation: listingContext.shortwaveRadiation,
    directNormalIrradiance: listingContext.directNormalIrradiance,
    weatherIsDay: listingContext.weatherIsDay,
  };
  const weatherDemandMultiplier = computeWeatherDemandMultiplier(listingWeather);
  const weatherSupplyAdjustment = computeWeatherSupplyAdjustment(listingWeather, input.surplusKwh);
  const relevantSupplyReports = selectRelevantSupplyReports(cleanedReports, listingContext.timestamp, weatherLookup, listingWeather);
  const supplyReferenceReports = relevantSupplyReports.length > 0 ? relevantSupplyReports : cleanedReports;
  const supplyResiduals = deriveSupplyResiduals(input, supplyReferenceReports);
  const demandResiduals = compressSamples(
    demandModelBundle.validationDemandResiduals.length > 0 ? demandModelBundle.validationDemandResiduals : [0],
    160,
  );

  const supplyPrices = supplyReferenceReports.map((report) => report.pricePerKwh);
  const demandPrices = cleanedDemandBids.map((bid) => bid.maxPricePerKwh);
  const demandPriceStats = pricePercentiles(demandPrices);
  const fitPrice = round(
    supplyReferenceReports.length > 0
      ? clamp(percentile(supplyPrices, 0.15), 0.02, 0.3)
      : clamp(demandPriceStats.p10 * 0.55, 0.02, 0.18),
  );
  const retailTariff = round(clamp(Math.max(demandPriceStats.p85, fitPrice + 0.03), fitPrice + 0.03, 0.45));
  const priceFloor = round(clamp(Math.max(fitPrice + 0.005, demandPriceStats.p10 * 0.8), fitPrice + 0.005, retailTariff));
  const priceCeiling = round(clamp(Math.max(priceFloor + 0.02, demandPriceStats.p95 * 1.02), priceFloor + 0.02, retailTariff));
  const candidatePrices = Array.from({ length: 48 }, (_, index) =>
    round(priceFloor + ((priceCeiling - priceFloor) * index) / 47),
  );
  candidatePrices.push(round(clamp(input.targetPrice, priceFloor, priceCeiling)));

  const priceGrid = [...new Set(candidatePrices)].sort((left, right) => left - right);
  const historicalDemandRange: [number, number] = [
    Math.max(0.01, demandModelBundle.historicalDemandMin),
    Math.max(0.05, demandModelBundle.historicalDemandMax),
  ];

  const currentOutcome = simulatePriceOutcome({
    candidatePrice: input.targetPrice,
    context: listingContext,
    bundle: demandModelBundle,
    historicalDemandRange,
    demandResiduals,
    supplyResiduals,
    input,
    fitPrice,
    retailTariff,
    weatherDemandMultiplier,
    weatherSupplyAdjustment,
  });

  let bestPrice = input.targetPrice;
  let bestOutcome = currentOutcome;

  for (const candidatePrice of priceGrid) {
    const outcome = simulatePriceOutcome({
      candidatePrice,
      context: listingContext,
      bundle: demandModelBundle,
      historicalDemandRange,
      demandResiduals,
      supplyResiduals,
      input,
      fitPrice,
      retailTariff,
      weatherDemandMultiplier,
      weatherSupplyAdjustment,
    });

    if (outcome.expectedProfit > bestOutcome.expectedProfit) {
      bestPrice = candidatePrice;
      bestOutcome = outcome;
    }
  }

  const optimizedPrice = round(bestPrice);
  const expectedRevenue = round(bestOutcome.expectedProfit, 2);
  const currentRevenue = round(currentOutcome.expectedProfit, 2);
  const revenueDelta = round(expectedRevenue - currentRevenue, 2);
  const comparableReports = buildComparableSupplyReports(
    supplyReferenceReports,
    listingContext.timestamp,
    input.surplusKwh,
    weatherLookup,
    listingWeather,
  );
  const comparableAveragePrice = comparableReports.length > 0 ? round(weightedAveragePrice(comparableReports)) : round(fitPrice);
  const matchedDemandBids = buildComparableDemandBids(cleanedDemandBids, listingContext.timestamp, optimizedPrice);
  const competitiveness =
    optimizedPrice <= demandPriceStats.p35 ? 'aggressive' : optimizedPrice <= demandPriceStats.p70 ? 'balanced' : 'premium';
  const fillExpectation =
    bestOutcome.fillProbability >= 0.75 ? 'fast' : bestOutcome.fillProbability >= 0.45 ? 'normal' : 'slow';
  const listingIso = toIsoString(listingContext.timestamp, input.listingTime ?? '') ?? (input.listingTime ?? '');
  const supplyUncertaintyStd = round(standardDeviation(supplyResiduals), 3);
  const baselinePrediction = predictLinearDemand(demandModelBundle.baselineModel, listingContext, optimizedPrice);
  const randomForestPrediction = predictForestDemand(demandModelBundle.randomForestModel, listingContext, optimizedPrice);
  const direction =
    optimizedPrice > input.targetPrice
      ? `Grid search recommends increasing the listing price from ${input.targetPrice.toFixed(3)} to ${optimizedPrice.toFixed(3)}.`
      : optimizedPrice < input.targetPrice
        ? `Grid search recommends lowering the listing price from ${input.targetPrice.toFixed(3)} to ${optimizedPrice.toFixed(3)}.`
        : 'The current listing price is already close to the model-selected optimum range.';

  return {
    optimizedPrice,
    expectedRevenue,
    currentRevenue,
    revenueDelta,
    marketAveragePrice: marketStats.averagePrice,
    marketMedianPrice: marketStats.medianPrice,
    marketLowPrice: marketStats.lowestPrice,
    marketHighPrice: marketStats.highestPrice,
    comparableAveragePrice,
    comparableCount: comparableReports.length,
    competitiveness,
    fillExpectation,
    matchedReports: comparableReports,
    matchedDemandBids,
    demandWeightedBid: demandStats.averageBid,
    demandClearingPrice: round(retailTariff),
    demandCoverageKwh: round(bestOutcome.expectedDemand, 2),
    demandCoverageRatio: round(bestOutcome.expectedDemand / Math.max(input.surplusKwh, 0.01), 2),
    usedDemandSide: true,
    fitPrice,
    retailTariff,
    expectedShortfallKwh: round(bestOutcome.expectedShortfall, 2),
    expectedOwnSupplyUsedKwh: round(bestOutcome.expectedOwnSupplyUsed, 2),
    listingTime: listingIso,
    optimizationGridSize: priceGrid.length,
    supplyUncertaintyStd,
    demandModelSummary: demandModelBundle.summary,
    weatherSummary: summarizeWeatherContext(listingWeather),
    weatherAdjustedDemandMultiplier: round(weatherDemandMultiplier, 3),
    weatherAdjustedSupplyAdjustment: round(weatherSupplyAdjustment, 2),
    explanation: [
      `The pricing context uses the hourly scenario at ${listingIso.slice(0, 13)}:00 and trains the demand model with a forward-chaining split.`,
      `OLS test RMSE ${demandModelBundle.summary.baseline.rmse.toFixed(3)}, Random Forest test RMSE ${demandModelBundle.summary.randomForest.rmse.toFixed(3)}, RF R2 ${demandModelBundle.summary.randomForest.r2.toFixed(3)}.`,
      `At the optimized price of ${optimizedPrice.toFixed(3)} /kWh, the Baseline model predicts demand of about ${baselinePrediction.toFixed(2)} kWh and the Random Forest predicts about ${randomForestPrediction.toFixed(2)} kWh.`,
      `Weather features are included in both the demand model and the supply scenario: demand multiplier ${weatherDemandMultiplier.toFixed(3)}x, supply adjustment ${weatherSupplyAdjustment >= 0 ? '+' : ''}${weatherSupplyAdjustment.toFixed(2)} kWh.`,
      `The FiT opportunity cost proxy is ${fitPrice.toFixed(3)} /kWh, and the shortfall replacement cost proxy is ${retailTariff.toFixed(3)} /kWh.`,
      `The buyer outside option is active: when the listing price approaches the retail tariff, the P2P market share contracts to about ${Math.round(bestOutcome.marketShare * 100)}%; above the retail tariff, demand is treated as zero.`,
      `The system runs grid search over ${priceGrid.length} candidate prices to maximize expected net revenue after FiT opportunity cost and shortfall penalty.`,
      `Supply-side uncertainty is estimated from historical same-hour solar surplus samples. There are currently ${supplyReferenceReports.length} effective references, with a residual standard deviation of about ${supplyUncertaintyStd.toFixed(3)} kWh.`,
      direction,
    ],
  };
}
