import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useGamesQuery } from '../dojo/useGameQuery';
import { useGameActions } from '../dojo/useGameActions';
import { generateCommitment, coordinatesToU256 } from '../lib/contract';

export function GameLobby({ wallet, onGameStart }) {
  const { games, loading: gamesLoading } = useGamesQuery();
  const { createGame: dojoCreateGame, joinGame: dojoJoinGame, loading: actionLoading } = useGameActions(wallet);
  const [joining, setJoining] = useState(null);

  const createGame = async () => {
    try {
      // Get random location from backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/random-location`);

      if (!response.ok) {
        throw new Error('Failed to get random location');
      }

      const { lat, lng, salt } = await response.json();

      // Generate commitment using Poseidon hash
      const commitment = generateCommitment(lat, lng, salt);

      console.log('Creating game with:', { lat, lng, salt, commitment });

      // Create game on Dojo contracts
      const txHash = await dojoCreateGame(commitment);

      console.log('Game created! Transaction:', txHash);

      // Wait for Torii to index the game
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get the latest game from Torii (should be the one we just created)
      // Query games ordered by ID descending, filter by our address as player1
      const playerAddress = wallet.selectedAddress.toLowerCase();
      const latestGame = games.find(g => {
        const p1 = normalizeAddress(g.player1);
        return p1 === playerAddress;
      });

      if (latestGame) {
        const gameId = latestGame.game_id;
        console.log(`Saving location for game ${gameId} to backend...`);

        // Save location to backend for later reveal
        try {
          await fetch(`${backendUrl}/api/save-game-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId,
              lat,
              lng,
              salt,
              commitment
            })
          });
          console.log(`✓ Location saved for game ${gameId}`);
        } catch (saveError) {
          console.error('Failed to save location to backend:', saveError);
          alert('Warning: Game created but location data not saved to backend. You may need to manually reveal later.');
        }
      } else {
        console.warn('Could not find newly created game to save location');
      }

      alert('Game created! Waiting for an opponent to join...');

    } catch (error) {
      console.error('Failed to create game:', error);
      alert('Failed to create game: ' + error.message);
    }
  };

  const joinGame = async (gameId) => {
    setJoining(gameId);
    try {
      await dojoJoinGame(gameId);

      // Navigate to game after joining
      onGameStart(gameId);
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to join game: ' + error.message);
    } finally {
      setJoining(null);
    }
  };

  const enterGame = (gameId) => {
    onGameStart(gameId);
  };

  const getGameStatus = (gameState) => {
    // Game states from Torii are strings: AwaitingPlayer, Active, Revealing, Finished
    if (typeof gameState === 'string') {
      switch (gameState) {
        case 'AwaitingPlayer':
          return 'Waiting for opponent';
        case 'Active':
          return 'Active - Playing';
        case 'Revealing':
          return 'Revealing guesses';
        case 'Finished':
          return 'Finished';
        default:
          return 'Unknown';
      }
    }
    // Fallback for numeric states
    switch (parseInt(gameState)) {
      case 0:
        return 'Waiting for opponent';
      case 1:
        return 'Active - Playing';
      case 2:
        return 'Revealing guesses';
      case 3:
        return 'Finished';
      default:
        return 'Unknown';
    }
  };

  const normalizeAddress = (address) => {
    if (!address) return '';
    const addrStr = address.toString();
    if (!addrStr.startsWith('0x')) {
      return '0x' + BigInt(addrStr).toString(16).toLowerCase();
    }
    return addrStr.toLowerCase();
  };

  const isPlayerInGame = (game) => {
    const playerAddress = normalizeAddress(wallet.selectedAddress);
    const player1 = normalizeAddress(game.player1);
    const player2 = normalizeAddress(game.player2);

    return player1 === playerAddress || player2 === playerAddress;
  };

  if (gamesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading games...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">StarkGuessr</h1>
        <p className="text-muted-foreground mb-8">
          Guess the location, win the game!
        </p>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Create a Game</h2>
          <Button
            onClick={createGame}
            disabled={actionLoading}
            size="lg"
            className="w-full md:w-auto"
          >
            {actionLoading ? 'Creating...' : 'Create New Game'}
          </Button>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Active Games</h2>
          {!games || games.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No active games. Create one to get started!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => {
                const gameState = game.game_state;
                const isAwaitingPlayer = gameState === 'AwaitingPlayer' || parseInt(gameState) === 0;
                const isActive = gameState === 'Active' || parseInt(gameState) === 1;
                const isRevealing = gameState === 'Revealing' || parseInt(gameState) === 2;
                const isFinished = gameState === 'Finished' || parseInt(gameState) === 3;

                const player1 = normalizeAddress(game.player1);
                const player2 = normalizeAddress(game.player2);
                const myAddress = normalizeAddress(wallet.selectedAddress);
                const isMyGame = isPlayerInGame(game);
                const canJoin = isAwaitingPlayer && player1 !== myAddress && !isMyGame;
                const isCreator = player1 === myAddress;

                return (
                  <Card key={game.game_id}>
                    <CardHeader>
                      <CardTitle>Game #{game.game_id}</CardTitle>
                      <CardDescription>
                        <div className="text-xs mt-1 font-mono">
                          P1: {player1.slice(0, 10)}...
                          {player2 && player2 !== '0x0' && ` | P2: ${player2.slice(0, 10)}...`}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            Status: {getGameStatus(gameState)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {isCreator ? (
                              <span>You vs {player2 && player2 !== '0x0' ? `${player2.slice(0, 6)}...${player2.slice(-4)}` : 'Waiting...'}</span>
                            ) : player2 === myAddress ? (
                              <span>You vs {player1.slice(0, 6)}...{player1.slice(-4)}</span>
                            ) : (
                              <span>Creator: {player1.slice(0, 6)}...{player1.slice(-4)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {/* Join button for non-players */}
                          {canJoin && (
                            <Button
                              onClick={() => joinGame(game.game_id)}
                              disabled={joining === game.game_id}
                            >
                              {joining === game.game_id ? 'Joining...' : 'Join Game'}
                            </Button>
                          )}

                          {/* Creator waiting */}
                          {isAwaitingPlayer && isCreator && (
                            <Button disabled variant="outline">
                              Waiting for opponent...
                            </Button>
                          )}

                          {/* Enter active game */}
                          {isActive && isMyGame && (
                            <Button onClick={() => enterGame(game.game_id)}>
                              Enter Game
                            </Button>
                          )}

                          {/* View results */}
                          {(isRevealing || isFinished) && isMyGame && (
                            <Button onClick={() => enterGame(game.game_id)} variant="outline">
                              View Results
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
