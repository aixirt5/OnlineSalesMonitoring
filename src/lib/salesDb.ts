import { createClient, SupabaseClient } from "@supabase/supabase-js";

let salesDbClient: SupabaseClient | null = null;
let currentProjectUrl: string | null = null;

export const getSalesDb = () => {
  const projectUrl = localStorage.getItem("projectUrl");
  const projectKey = localStorage.getItem("projectKey");

  if (!projectUrl || !projectKey) {
    throw new Error("Sales database credentials not found");
  }

  if (salesDbClient && currentProjectUrl === projectUrl) {
    return salesDbClient;
  }

  salesDbClient = createClient(projectUrl, projectKey, {
    auth: {
      storageKey: "sales-db-auth",
      storage: window.localStorage,
    },
  });
  currentProjectUrl = projectUrl;
  return salesDbClient;
};
