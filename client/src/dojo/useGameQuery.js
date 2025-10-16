import { useState, useEffect } from "react";
import { useDojo } from "./DojoContext";

// Query game state from Torii
export function useGameQuery(gameId) {
  const dojo = useDojo();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId || !dojo?.toriiClient) {
      setLoading(false);
      return;
    }

    async function fetchGame() {
      try {
        setLoading(true);

        // Query the Game model from Torii using GraphQL
        const query = `
          query GetGame($gameId: String!) {
            starkguessrGameModels(where: { game_id: $gameId }) {
              edges {
                node {
                  game_id
                  player1
                  player2
                  game_state
                  end_time
                  location_commitment
                  actual_location {
                    lat
                    lng
                  }
                  location_revealed
                  winner
                }
              }
            }
            starkguessrPlayerGuessModels(where: { game_id: $gameId }) {
              edges {
                node {
                  game_id
                  player
                  commitment
                  revealed_guess {
                    lat
                    lng
                  }
                  has_submitted
                  has_revealed
                  score
                }
              }
            }
          }
        `;

        const response = await fetch(`${dojo.toriiClient.url}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: { gameId: gameId.toString() },
          }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        const gameData =
          result.data?.starkguessrGameModels?.edges?.[0]?.node;
        const guesses = result.data?.starkguessrPlayerGuessModels?.edges?.map(
          (e) => e.node
        );

        if (gameData) {
          setGame({
            ...gameData,
            guesses: guesses || [],
          });
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch game:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchGame();

    // Subscribe to real-time updates
    // TODO: Implement Torii subscription when available
    const interval = setInterval(fetchGame, 5000); // Poll every 5s for now

    return () => clearInterval(interval);
  }, [gameId, dojo?.toriiClient]);

  return { game, loading, error };
}

// Query all games
export function useGamesQuery() {
  const dojo = useDojo();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dojo?.toriiClient) {
      setLoading(false);
      return;
    }

    async function fetchGames() {
      try {
        setLoading(true);

        const query = `
          query {
            starkguessrGameModels(limit: 20, order: { direction: DESC, field: GAME_ID }) {
              edges {
                node {
                  game_id
                  player1
                  player2
                  game_state
                  end_time
                  location_revealed
                  winner
                }
              }
            }
          }
        `;

        const response = await fetch(`${dojo.toriiClient.url}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        const result = await response.json();

        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        const gamesData = result.data?.starkguessrGameModels?.edges?.map(
          (e) => e.node
        );

        setGames(gamesData || []);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch games:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchGames();

    // Poll for updates
    const interval = setInterval(fetchGames, 10000); // Every 10s

    return () => clearInterval(interval);
  }, [dojo?.toriiClient]);

  return { games, loading, error };
}
