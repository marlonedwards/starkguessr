import { createContext, useContext, useState, useEffect } from "react";
import { setupDojoProvider, setupToriiClient, WORLD_ADDRESS } from "./setup";

const DojoContext = createContext(null);

export function DojoProvider({ children }) {
  const [dojo, setDojo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        console.log("Initializing Dojo...");

        const { provider, dojoProvider } = await setupDojoProvider();
        const toriiClient = await setupToriiClient();

        setDojo({
          provider,
          dojoProvider,
          toriiClient,
          worldAddress: WORLD_ADDRESS,
        });

        console.log("Dojo initialized successfully");
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize Dojo:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Initializing Dojo...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-500">
          <div className="text-lg font-bold">Failed to initialize Dojo</div>
          <div className="text-sm mt-2">{error}</div>
        </div>
      </div>
    );
  }

  return <DojoContext.Provider value={dojo}>{children}</DojoContext.Provider>;
}

export function useDojo() {
  const context = useContext(DojoContext);
  if (!context) {
    throw new Error("useDojo must be used within a DojoProvider");
  }
  return context;
}
