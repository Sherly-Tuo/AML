export interface MarketReport {
  id: string;
  reporterName: string;
  surplusKwh: number;
  pricePerKwh: number;
  reportedAt: string;
}

export interface DemandBid {
  id: string;
  buyerName: string;
  demandKwh: number;
  maxPricePerKwh: number;
  requestedAt: string;
}

export interface WeatherHour {
  time: string;
  temperatureC: number;
  relativeHumidity: number;
  precipitationMm: number;
  cloudCover: number;
  shortwaveRadiation: number;
  directNormalIrradiance: number;
  windSpeed10m: number;
  weatherCode: number;
  isDay: boolean;
}

export interface UserListingInput {
  surplusKwh: number;
  targetPrice: number;
  listingTime?: string;
  weatherContext?: WeatherHour;
}

export interface RegressionMetrics {
  rmse: number;
  mae: number;
  r2: number;
}

export interface DemandModelSummary {
  trainCount: number;
  validationCount: number;
  testCount: number;
  baseline: RegressionMetrics;
  randomForest: RegressionMetrics;
}

export interface PricingRecommendation {
  optimizedPrice: number;
  expectedRevenue: number;
  currentRevenue: number;
  revenueDelta: number;
  marketAveragePrice: number;
  marketMedianPrice: number;
  marketLowPrice: number;
  marketHighPrice: number;
  comparableAveragePrice: number;
  comparableCount: number;
  competitiveness: 'aggressive' | 'balanced' | 'premium';
  fillExpectation: 'fast' | 'normal' | 'slow';
  matchedReports: MarketReport[];
  matchedDemandBids: DemandBid[];
  demandWeightedBid: number;
  demandClearingPrice: number;
  demandCoverageKwh: number;
  demandCoverageRatio: number;
  usedDemandSide: boolean;
  fitPrice: number;
  retailTariff: number;
  expectedShortfallKwh: number;
  expectedOwnSupplyUsedKwh: number;
  listingTime: string;
  optimizationGridSize: number;
  supplyUncertaintyStd: number;
  demandModelSummary: DemandModelSummary;
  weatherSummary: string;
  weatherAdjustedDemandMultiplier: number;
  weatherAdjustedSupplyAdjustment: number;
  explanation: string[];
}

export interface OptimizationRun {
  id: string;
  surplusKwh: number;
  inputPrice: number;
  optimizedPrice: number;
  expectedRevenue: number;
  createdAt: string;
}
