import { WorkspaceType } from "@/context/WorkspaceContext";

// Both TaskCategory and ProjectCategory share the same values in ALFRED
export type Category = "DSA" | "Data Science" | "College" | "Hackathon" | "Personal";

export const getCategoryForFocus = (focus: WorkspaceType | null): Category | null => {
  if (!focus) return null;
  
  switch (focus) {
    case "dsa":
      return "DSA";
    case "datascience":
      return "Data Science";
    case "hackathon":
      return "Hackathon";
    case "machinelearning":
      return "Data Science"; // ML maps to Data Science category
    case "college":
      return "College";
    case "personal":
      return "Personal";
    default:
      return null;
  }
};

export const getFocusName = (focus: string | null): string => {
  if (!focus) return "None";
  switch (focus) {
    case "dsa": return "DSA";
    case "datascience": return "Data Science";
    case "hackathon": return "Hackathon";
    case "machinelearning": return "Machine Learning";
    case "college": return "College";
    case "personal": return "Personal";
    case "custom": return "Custom Focus";
    default: return focus.toUpperCase();
  }
};

export const getFocusDescription = (focus: string | null): string => {
  if (!focus) return "Select a focus to align your dashboard.";
  switch (focus) {
    case "dsa": return "Daily Data Structures & Algorithms practice.";
    case "datascience": return "Analytics and dashboard building.";
    case "hackathon": return "Hackathon development and fast prototyping.";
    case "machinelearning": return "Machine Learning Specialization study.";
    case "college": return "College coursework and assignments.";
    case "personal": return "Personal tasks and self-improvement.";
    default: return `Focused work on ${focus} missions.`;
  }
};
