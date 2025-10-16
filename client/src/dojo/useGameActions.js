import { useState } from "react";
import { Account, hash, CallData } from "starknet";
import { useDojo } from "./DojoContext";
import { getActionsContract } from "./setup";
import {
  coordinatesToU256,
  generateCommitment,
  generateSalt,
} from "../lib/contract";

export function useGameActions(wallet) {
  const dojo = useDojo();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get the actions contract address
  const actionsContract = getActionsContract();

  // Create game
  async function createGame(locationCommitment) {
    setLoading(true);
    setError(null);

    try {
      console.log("Creating game with commitment:", locationCommitment);

      const account = wallet?.account;
      if (!account) {
        throw new Error("No wallet connected");
      }

      // Call create_game on the actions system
      const tx = await account.execute({
        contractAddress: actionsContract.address,
        entrypoint: "create_game",
        calldata: CallData.compile({
          location_commitment: locationCommitment,
        }),
      });

      console.log("Create game tx:", tx.transaction_hash);

      // Wait for transaction
      await dojo.provider.waitForTransaction(tx.transaction_hash);

      // TODO: Get game_id from events
      // For now, we'll query the GameCounter to get the latest game ID

      setLoading(false);
      return tx.transaction_hash;
    } catch (err) {
      console.error("Failed to create game:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  // Join game
  async function joinGame(gameId) {
    setLoading(true);
    setError(null);

    try {
      console.log("Joining game:", gameId);

      const account = wallet?.account;
      if (!account) {
        throw new Error("No wallet connected");
      }

      const tx = await account.execute({
        contractAddress: actionsContract.address,
        entrypoint: "join_game",
        calldata: CallData.compile({
          game_id: { low: gameId, high: 0 },
        }),
      });

      console.log("Join game tx:", tx.transaction_hash);
      await dojo.provider.waitForTransaction(tx.transaction_hash);

      setLoading(false);
      return tx.transaction_hash;
    } catch (err) {
      console.error("Failed to join game:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  // Submit guess
  async function submitGuess(gameId, guessCommitment) {
    setLoading(true);
    setError(null);

    try {
      console.log("Submitting guess for game:", gameId);

      const account = wallet?.account;
      if (!account) {
        throw new Error("No wallet connected");
      }

      const tx = await account.execute({
        contractAddress: actionsContract.address,
        entrypoint: "submit_guess",
        calldata: CallData.compile({
          game_id: { low: gameId, high: 0 },
          guess_commitment: guessCommitment,
        }),
      });

      console.log("Submit guess tx:", tx.transaction_hash);
      await dojo.provider.waitForTransaction(tx.transaction_hash);

      setLoading(false);
      return tx.transaction_hash;
    } catch (err) {
      console.error("Failed to submit guess:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  // Reveal location (called by backend or game creator when both players submitted)
  async function revealLocation(gameId, lat, lng, salt) {
    setLoading(true);
    setError(null);

    try {
      console.log("Revealing location for game:", gameId);

      const account = wallet?.account;
      if (!account) {
        throw new Error("No wallet connected");
      }

      const coords = coordinatesToU256(lat, lng);

      const tx = await account.execute({
        contractAddress: actionsContract.address,
        entrypoint: "reveal_location",
        calldata: CallData.compile({
          game_id: { low: gameId, high: 0 },
          location: {
            lat: { low: coords.lat, high: 0 },
            lng: { low: coords.lng, high: 0 },
          },
          salt,
        }),
      });

      console.log("Reveal location tx:", tx.transaction_hash);
      await dojo.provider.waitForTransaction(tx.transaction_hash);

      setLoading(false);
      return tx.transaction_hash;
    } catch (err) {
      console.error("Failed to reveal location:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  // Reveal guess
  async function revealGuess(gameId, lat, lng, salt) {
    setLoading(true);
    setError(null);

    try {
      console.log("Revealing guess for game:", gameId);

      const account = wallet?.account;
      if (!account) {
        throw new Error("No wallet connected");
      }

      const coords = coordinatesToU256(lat, lng);

      const tx = await account.execute({
        contractAddress: actionsContract.address,
        entrypoint: "reveal_guess",
        calldata: CallData.compile({
          game_id: { low: gameId, high: 0 },
          guess: {
            lat: { low: coords.lat, high: 0 },
            lng: { low: coords.lng, high: 0 },
          },
          salt,
        }),
      });

      console.log("Reveal guess tx:", tx.transaction_hash);
      await dojo.provider.waitForTransaction(tx.transaction_hash);

      setLoading(false);
      return tx.transaction_hash;
    } catch (err) {
      console.error("Failed to reveal guess:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createGame,
    joinGame,
    submitGuess,
    revealLocation,
    revealGuess,
    loading,
    error,
  };
}
