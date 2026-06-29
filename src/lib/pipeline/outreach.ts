import type { IcpData, Signal } from "@/lib/types";

// Suggested decision-maker titles + outreach angle (spec 4.8 / 12).
// Derived deterministically from mode + ICP + detected signals (evidence-first).

const QUINABLE_TITLES = [
  "Administrator",
  "Executive Director",
  "Director of Nursing (DON)",
  "Staffing Coordinator / Scheduler",
  "VP of Operations",
  "Regional Director",
];

export function recommendedTitles(mode: string, icp: IcpData): string[] {
  if (mode === "quinable" || mode === "healthcare") return QUINABLE_TITLES;
  return icp.buyerPersonaTitles.length ? icp.buyerPersonaTitles : ["VP", "Director", "Owner"];
}

export function buildOutreachAngle(input: {
  mode: string;
  name: string;
  organizationType?: string | null;
  painSignals?: Signal[] | null;
  qualitySignals?: Signal[] | null;
  multiSite: boolean;
}): string {
  const { mode, name } = input;
  const hasStaffing = (input.painSignals ?? []).length > 0;
  const scale = input.multiSite ? "appears to have enough operational scale" : "may have recurring needs";

  if (mode === "quinable" || mode === "healthcare") {
    return (
      `${name} appears to be a potential fit because it operates in a target care category` +
      `${hasStaffing ? ", shows recurring hiring/staffing signals," : ""} and ${scale} to benefit from a ` +
      `repeat bench of credentialed local caregivers. Position the platform as a flexible workforce ` +
      `reliability layer rather than a commodity staffing marketplace: call-off coverage, reduced agency ` +
      `dependence, repeat worker bench, and cleaner compliance documentation.`
    );
  }

  return (
    `${name} fits the ideal customer profile based on category and geography` +
    `${hasStaffing ? " plus active pain/trigger signals" : ""}. Lead with the specific evidence found ` +
    `(category match, signals, and scale) and a concrete, low-friction first value proposition.`
  );
}

export const QUINABLE_OUTREACH_OPTIONS = [
  "Reduce uncontrolled agency spend",
  "Cover call-offs faster",
  "Build a repeat bench of credentialed local workers",
  "Improve visibility across facilities",
  "Use flexible labor without losing compliance documentation",
  "Prioritize provider reliability and repeat matches",
];
