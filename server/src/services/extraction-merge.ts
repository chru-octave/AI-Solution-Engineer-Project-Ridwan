import type { SubmissionExtraction } from "./extraction-schema";

type InsuredInfo = NonNullable<SubmissionExtraction["insured"]>;
type BrokerInfo = NonNullable<SubmissionExtraction["broker"]>;
type ExposureInfo = NonNullable<SubmissionExtraction["exposures"]>;

function mergeObject<T extends Record<string, unknown>>(
  objects: (T | null)[]
): T | null {
  const nonNull = objects.filter((o): o is T => o !== null);
  if (nonNull.length === 0) return null;

  const merged = { ...nonNull[0] };
  for (const obj of nonNull.slice(1)) {
    for (const key of Object.keys(obj)) {
      const k = key as keyof T;
      if (merged[k] === null || merged[k] === undefined) {
        merged[k] = obj[k];
      }
    }
  }
  return merged;
}

function mergeExposures(
  exposures: (ExposureInfo | null)[]
): ExposureInfo | null {
  const nonNull = exposures.filter((e): e is ExposureInfo => e !== null);
  if (nonNull.length === 0) return null;

  const merged: ExposureInfo = {
    numberOfTrucks: null,
    numberOfDrivers: null,
    numberOfTrailers: null,
    radius: null,
    commodities: [],
    annualRevenue: null,
    annualMileage: null,
    operatingStates: [],
    vehicleTypes: [],
  };

  for (const exp of nonNull) {
    merged.numberOfTrucks ??= exp.numberOfTrucks;
    merged.numberOfDrivers ??= exp.numberOfDrivers;
    merged.numberOfTrailers ??= exp.numberOfTrailers;
    merged.radius ??= exp.radius;
    merged.annualRevenue ??= exp.annualRevenue;
    merged.annualMileage ??= exp.annualMileage;

    for (const c of exp.commodities) {
      if (!merged.commodities.includes(c)) merged.commodities.push(c);
    }
    for (const s of exp.operatingStates) {
      if (!merged.operatingStates.includes(s)) merged.operatingStates.push(s);
    }
    for (const v of exp.vehicleTypes) {
      if (!merged.vehicleTypes.includes(v)) merged.vehicleTypes.push(v);
    }
  }

  return merged;
}

function dedupeByJson<T>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeExtractions(
  partials: SubmissionExtraction[]
): SubmissionExtraction {
  if (partials.length === 0) {
    return {
      insured: null,
      broker: null,
      linesOfBusiness: [],
      limits: [],
      targetPricing: [],
      exposures: null,
      losses: [],
    };
  }

  if (partials.length === 1) return partials[0];

  return {
    insured: mergeObject<InsuredInfo>(partials.map((p) => p.insured)),
    broker: mergeObject<BrokerInfo>(partials.map((p) => p.broker)),
    exposures: mergeExposures(partials.map((p) => p.exposures)),
    linesOfBusiness: dedupeByJson(partials.flatMap((p) => p.linesOfBusiness)),
    limits: dedupeByJson(partials.flatMap((p) => p.limits)),
    targetPricing: dedupeByJson(partials.flatMap((p) => p.targetPricing)),
    losses: dedupeByJson(partials.flatMap((p) => p.losses)),
  };
}
