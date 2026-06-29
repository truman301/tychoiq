import type { ICPDefinition } from "@prisma/client";
import type { GeographyDef, IcpData, ScoringWeights, SizeSignals } from "@/lib/types";
import { parseJson, parseStringArray, stringifyJson } from "@/lib/json";
import { GENERAL_WEIGHTS } from "@/lib/scoring/weights";

// Convert a DB ICPDefinition (JSON-as-string columns) into the typed IcpData.
export function icpFromRow(row: ICPDefinition | null | undefined, mode = "general"): IcpData {
  return {
    targetDescription: row?.targetDescription ?? "",
    geography: parseJson<GeographyDef>(row?.geography, { states: [], counties: [], cities: [], zips: [] }),
    organizationTypesInclude: parseStringArray(row?.organizationTypesInclude),
    organizationTypesExclude: parseStringArray(row?.organizationTypesExclude),
    optionalCategories: parseStringArray(row?.optionalCategories),
    sizeSignals: parseJson<SizeSignals>(row?.sizeSignals, {}),
    buyerPersonaTitles: parseStringArray(row?.buyerPersonaTitles),
    painSignals: parseStringArray(row?.painSignals),
    triggerEvents: parseStringArray(row?.triggerEvents),
    qualitySignals: parseStringArray(row?.qualitySignals),
    riskSignals: parseStringArray(row?.riskSignals),
    sourcePreferences: parseStringArray(row?.sourcePreferences),
    requiredEvidenceFields: parseStringArray(row?.requiredEvidenceFields),
    scoringWeights: parseJson<ScoringWeights>(row?.scoringWeights, GENERAL_WEIGHTS),
  };
}

// Convert typed IcpData into the column payload for create/update.
export function icpToRow(icp: IcpData): Record<string, string> {
  return {
    targetDescription: icp.targetDescription ?? "",
    geography: stringifyJson(icp.geography),
    organizationTypesInclude: stringifyJson(icp.organizationTypesInclude),
    organizationTypesExclude: stringifyJson(icp.organizationTypesExclude),
    optionalCategories: stringifyJson(icp.optionalCategories),
    sizeSignals: stringifyJson(icp.sizeSignals),
    buyerPersonaTitles: stringifyJson(icp.buyerPersonaTitles),
    painSignals: stringifyJson(icp.painSignals),
    triggerEvents: stringifyJson(icp.triggerEvents),
    qualitySignals: stringifyJson(icp.qualitySignals),
    riskSignals: stringifyJson(icp.riskSignals),
    sourcePreferences: stringifyJson(icp.sourcePreferences),
    requiredEvidenceFields: stringifyJson(icp.requiredEvidenceFields),
    scoringWeights: stringifyJson(icp.scoringWeights),
  };
}
