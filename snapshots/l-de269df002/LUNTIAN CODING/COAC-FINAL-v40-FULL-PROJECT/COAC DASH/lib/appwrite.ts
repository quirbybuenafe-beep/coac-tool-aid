import { Account, Client, ID, Query, TablesDB } from "appwrite";

export const appwriteConfig = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://sgp.cloud.appwrite.io/v1",
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6a74348a003824207a6c",
  databaseId:
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6a7435d7000f7c0e243a",
  tableId: process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID ?? "records",
};

export const appwriteClient = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

export const account = new Account(appwriteClient);
export const tables = new TablesDB(appwriteClient);
export { ID, Query };

