import { DojoProvider } from "@dojoengine/core";
import { RpcProvider } from "starknet";
import manifest from "../manifest.json";

// Configuration from .env
export const WORLD_ADDRESS = import.meta.env.VITE_WORLD_ADDRESS;
export const TORII_URL = import.meta.env.VITE_TORII_URL || "http://localhost:8080";
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://localhost:5050";

console.log("Dojo Config:", { WORLD_ADDRESS, TORII_URL, RPC_URL });

// Initialize Dojo provider
export async function setupDojoProvider() {
  const provider = new RpcProvider({
    nodeUrl: RPC_URL,
  });

  const dojoProvider = new DojoProvider(manifest, WORLD_ADDRESS);

  return { provider, dojoProvider };
}

// Simple Torii client wrapper for GraphQL queries
export async function setupToriiClient() {
  return {
    url: TORII_URL,
    async query(query, variables = {}) {
      const response = await fetch(`${TORII_URL}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      return response.json();
    },
  };
}

// Get the actions contract (system) from manifest
export function getActionsContract() {
  const actionsContract = manifest.contracts.find(
    (c) => c.tag === "starkguessr-actions"
  );

  if (!actionsContract) {
    throw new Error("Actions contract not found in manifest");
  }

  return actionsContract;
}

// Helper to create burner wallet for testing
export async function createBurner(provider) {
  const { createBurner } = await import("@dojoengine/create-burner");

  const burnerManager = createBurner({
    masterAccount: {
      privateKey: "0x1234567890abcdef",
      accountAddress: "0x123",
    },
    accountClassHash: "0x123",
    rpcProvider: provider,
  });

  return burnerManager;
}
