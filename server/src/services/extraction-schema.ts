import { z } from "zod";

const coerceToString = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v === null || v === undefined ? null : String(v)));

export const InsuredInfoSchema = z.object({
  companyName: z.string().nullable().describe("Name of the insured company"),
  contactName: z.string().nullable().describe("Primary contact at the insured"),
  mailingAddress: z.string().nullable().describe("Mailing address of the insured"),
  dotNumber: z.string().nullable().describe("DOT number if available"),
  mcNumber: z.string().nullable().describe("MC number if available"),
  yearsInBusiness: z.number().nullable().describe("Number of years in business"),
  state: z.string().nullable().describe("State of domicile"),
});

export const BrokerInfoSchema = z.object({
  companyName: z.string().nullable().describe("Brokerage/agency name"),
  contactName: z.string().nullable().describe("Broker contact name"),
  email: z.string().nullable().describe("Broker email address"),
  phone: z.string().nullable().describe("Broker phone number"),
});

export const LineOfBusinessSchema = z.object({
  type: z.string().describe("Line of business, e.g. Auto Liability, General Liability, Cargo, Physical Damage, etc."),
});

export const LimitRequestedSchema = z.object({
  lineOfBusiness: z.string().nullable().describe("Which line this limit applies to"),
  limitAmount: coerceToString.describe("Limit amount requested, e.g. $1,000,000"),
  deductible: coerceToString.describe("Deductible amount if specified"),
  description: z.string().nullable().describe("Additional details about the limit"),
});

export const TargetPricingSchema = z.object({
  lineOfBusiness: z.string().nullable().describe("Which line this pricing applies to"),
  targetPremium: coerceToString.describe("Target premium amount"),
  currentPremium: coerceToString.describe("Current/expiring premium if mentioned"),
  description: z.string().nullable().describe("Additional pricing context"),
});

export const ExposureInfoSchema = z.object({
  numberOfTrucks: z.number().nullable().describe("Number of trucks/power units"),
  numberOfDrivers: z.number().nullable().describe("Number of drivers"),
  numberOfTrailers: z.number().nullable().describe("Number of trailers"),
  radius: coerceToString.describe("Operating radius, e.g. local, intermediate, long-haul"),
  commodities: z.array(z.string()).nullable().transform((v) => v ?? []).describe("Types of commodities hauled"),
  annualRevenue: coerceToString.describe("Annual revenue"),
  annualMileage: coerceToString.describe("Annual mileage"),
  operatingStates: z.array(z.string()).nullable().transform((v) => v ?? []).describe("States of operation"),
  vehicleTypes: z.array(z.string()).nullable().transform((v) => v ?? []).describe("Types of vehicles in the fleet"),
});

export const LossRecordSchema = z.object({
  policyYear: z.string().nullable().describe("Policy year or period"),
  numberOfClaims: z.number().nullable().describe("Number of claims"),
  totalIncurred: coerceToString.describe("Total incurred losses"),
  totalPaid: coerceToString.describe("Total paid losses"),
  description: z.string().nullable().describe("Loss run summary or details"),
});

export const SubmissionExtractionSchema = z.object({
  insured: InsuredInfoSchema.nullable(),
  broker: BrokerInfoSchema.nullable(),
  linesOfBusiness: z.array(LineOfBusinessSchema).nullable().transform((v) => v ?? []),
  limits: z.array(LimitRequestedSchema).nullable().transform((v) => v ?? []),
  targetPricing: z.array(TargetPricingSchema).nullable().transform((v) => v ?? []),
  exposures: ExposureInfoSchema.nullable(),
  losses: z.array(LossRecordSchema).nullable().transform((v) => v ?? []),
});

export type SubmissionExtraction = z.infer<typeof SubmissionExtractionSchema>;
