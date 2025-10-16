import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { createContract, coordinatesToU256, u256ToCoordinates, calculateDistance, formatDistance } from '@/lib/contract';

export function GameResults({ gameId, wallet, onBackToLobby }) {
  const [game, setGame] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [actualLocation, setActualLocation] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    loadGame();
    loadApiKey();
    const interval = setInterval(loadGame, 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  const loadApiKey = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/config`);
      const data = await response.json();
      setApiKey(data.apiKey);
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const loadGame = async () => {
    try {
      const contract = createContract(wallet.account);
      const gameData = await contract.get_game(gameId);
      setGame(gameData);
      setLoading(false);

      // Check if we already revealed
      const normalizeAddress = (addr) => {
        if (!addr.startsWith('0x')) {
          return '0x' + BigInt(addr).toString(16).toLowerCase();
        }
        return addr.toLowerCase();
      };

      const playerAddr = normalizeAddress(wallet.selectedAddress);
      const player1Addr = normalizeAddress(gameData.player1.toString());
      const player2Addr = normalizeAddress(gameData.player2.toString());

      if (playerAddr === player1Addr && gameData.player1_guess?.has_revealed) {
        setRevealed(true);
      } else if (playerAddr === player2Addr && gameData.player2_guess?.has_revealed) {
        setRevealed(true);
      }

      // If both revealed, load actual location from backend
      if (gameData.player1_guess?.has_revealed && gameData.player2_guess?.has_revealed) {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/game/${gameId}`, {
          headers: {
            'X-Wallet-Address': wallet.selectedAddress
          }
        });

        if (!response.ok) {
          console.error('Failed to load revealed location:', await response.text());
          return;
        }

        const backendData = await response.json();

        if (backendData.revealed && backendData.location) {
          setActualLocation(backendData.location);
        }
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey && !mapsLoaded) {
      loadGoogleMaps();
    }
  }, [apiKey, mapsLoaded]);

  useEffect(() => {
    if (mapsLoaded && actualLocation && game && mapRef.current && !window.resultsMap) {
      initializeMap();
    }
  }, [mapsLoaded, actualLocation, game]);

  const loadGoogleMaps = () => {
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded');
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMapsResults`;
    script.async = true;
    script.defer = true;

    window.initGoogleMapsResults = () => {
      console.log('Google Maps loaded successfully for results');
      setMapsLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps');
    };

    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded yet');
      return;
    }

    if (!actualLocation || !game) {
      console.error('Actual location or game data not available');
      return;
    }

    // Parse player guesses from contract data
    const player1Guess = game.player1_guess?.guess;
    const player2Guess = game.player2_guess?.guess;

    if (!player1Guess || !player2Guess) {
      console.error('Player guesses not available');
      return;
    }

    // Convert u256 coordinates back to lat/lng
    const p1Location = u256ToCoordinates(player1Guess.lat || player1Guess[0], player1Guess.lng || player1Guess[1]);
    const p2Location = u256ToCoordinates(player2Guess.lat || player2Guess[0], player2Guess.lng || player2Guess[1]);

    // Calculate center point for map
    const centerLat = (actualLocation.lat + p1Location.lat + p2Location.lat) / 3;
    const centerLng = (actualLocation.lng + p1Location.lng + p2Location.lng) / 3;

    // Create map
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 2,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
      zoomControl: true
    });

    // Add marker for actual location (green star)
    new window.google.maps.Marker({
      position: { lat: actualLocation.lat, lng: actualLocation.lng },
      map: map,
      title: 'Actual Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#16a34a',
        strokeWeight: 2,
        scale: 12
      },
      label: {
        text: '★',
        color: 'white',
        fontSize: '16px',
        fontWeight: 'bold'
      }
    });

    // Add marker for player 1 guess (blue)
    new window.google.maps.Marker({
      position: { lat: p1Location.lat, lng: p1Location.lng },
      map: map,
      title: 'Player 1 Guess',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#3b82f6',
        fillOpacity: 0.8,
        strokeColor: '#1d4ed8',
        strokeWeight: 2,
        scale: 10
      },
      label: {
        text: '1',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold'
      }
    });

    // Add marker for player 2 guess (red)
    new window.google.maps.Marker({
      position: { lat: p2Location.lat, lng: p2Location.lng },
      map: map,
      title: 'Player 2 Guess',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#ef4444',
        fillOpacity: 0.8,
        strokeColor: '#dc2626',
        strokeWeight: 2,
        scale: 10
      },
      label: {
        text: '2',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold'
      }
    });

    // Draw line from player 1 guess to actual location
    new window.google.maps.Polyline({
      path: [
        { lat: p1Location.lat, lng: p1Location.lng },
        { lat: actualLocation.lat, lng: actualLocation.lng }
      ],
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.6,
      strokeWeight: 2,
      map: map
    });

    // Draw line from player 2 guess to actual location
    new window.google.maps.Polyline({
      path: [
        { lat: p2Location.lat, lng: p2Location.lng },
        { lat: actualLocation.lat, lng: actualLocation.lng }
      ],
      geodesic: true,
      strokeColor: '#ef4444',
      strokeOpacity: 0.6,
      strokeWeight: 2,
      map: map
    });

    // Fit bounds to show all markers
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: actualLocation.lat, lng: actualLocation.lng });
    bounds.extend({ lat: p1Location.lat, lng: p1Location.lng });
    bounds.extend({ lat: p2Location.lat, lng: p2Location.lng });
    map.fitBounds(bounds);

    window.resultsMap = map;
    console.log('Results map initialized with all markers');
  };

  const revealGuess = async () => {
    setRevealing(true);
    try {
      // Get guess and salt from localStorage
      const storedGuess = localStorage.getItem(`game_${gameId}_guess`);
      if (!storedGuess) {
        alert('Could not find your guess. Please refresh and try again.');
        setRevealing(false);
        return;
      }

      const guessData = JSON.parse(storedGuess);
      console.log('Revealing guess:', guessData);

      // Call contract to reveal
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      const tx = await wallet.account.execute({
        contractAddress,
        entrypoint: 'reveal_guess',
        calldata: [
          gameId, '0', // gameId as u64
          guessData.latU256,
          guessData.lngU256,
          guessData.salt
        ]
      });

      console.log('Reveal submitted, tx:', tx.transaction_hash);
      await wallet.account.waitForTransaction(tx.transaction_hash);

      setRevealed(true);

      // Clear localStorage
      localStorage.removeItem(`game_${gameId}_guess`);

      // Reload game
      await loadGame();
    } catch (error) {
      console.error('Failed to reveal guess:', error);
      alert('Failed to reveal guess. Please try again.');
    } finally {
      setRevealing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading results...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Game not found</div>
      </div>
    );
  }

  // Convert game state to number if it's a variant
  const getGameStateNumber = (state) => {
    if (typeof state === 'number') return state;
    if (state?.variant) {
      if (state.variant.AwaitingPlayer !== undefined) return 0;
      if (state.variant.Active !== undefined) return 1;
      if (state.variant.Revealing !== undefined) return 2;
      if (state.variant.Finished !== undefined) return 3;
    }
    return 0;
  };

  const gameState = getGameStateNumber(game.game_state);
  const isFinished = gameState === 3;
  const bothRevealed = game.player1_guess?.has_revealed && game.player2_guess?.has_revealed;

  const normalizeAddress = (addr) => {
    if (!addr) return '';
    const addrStr = addr.toString();
    if (!addrStr.startsWith('0x')) {
      return '0x' + BigInt(addrStr).toString(16).toLowerCase();
    }
    return addrStr.toLowerCase();
  };

  const isWinner = isFinished && normalizeAddress(game.winner) === normalizeAddress(wallet.selectedAddress);

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Game #{gameId} - Results</CardTitle>
          </CardHeader>
          <CardContent>
            {!revealed && (
              <div className="mb-8 p-6 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Reveal Your Guess</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Time's up! Click the button below to reveal your guess and see the results.
                </p>
                <Button onClick={revealGuess} disabled={revealing} size="lg">
                  {revealing ? 'Revealing...' : 'Reveal My Guess'}
                </Button>
              </div>
            )}

            {revealed && !bothRevealed && (
              <div className="mb-8 p-6 bg-muted rounded-lg text-center">
                <p>Waiting for other player to reveal their guess...</p>
              </div>
            )}

            {bothRevealed && (
              <>
                {/* Map Visualization */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Map Visualization</h3>
                  <div className="relative w-full h-96 bg-muted rounded-lg overflow-hidden">
                    <div ref={mapRef} className="w-full h-full" />
                    {!actualLocation && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <div className="text-center">
                          <p className="text-sm">Loading map data...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">★</div>
                      <span>Actual Location</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">1</div>
                      <span>Player 1 Guess</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">2</div>
                      <span>Player 2 Guess</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Scores</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Player 1</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm mb-2">
                          {normalizeAddress(game.player1).slice(0, 10)}...{normalizeAddress(game.player1).slice(-4)}
                        </div>
                        <div className="text-2xl font-bold">
                          {game.player1_guess?.score ? formatDistance(parseInt(game.player1_guess.score)) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Distance from actual location
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Player 2</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm mb-2">
                          {normalizeAddress(game.player2).slice(0, 10)}...{normalizeAddress(game.player2).slice(-4)}
                        </div>
                        <div className="text-2xl font-bold">
                          {game.player2_guess?.score ? formatDistance(parseInt(game.player2_guess.score)) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Distance from actual location
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {isFinished && (
                  <div className={`p-6 rounded-lg text-center mb-6 ${
                    isWinner ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'
                  }`}>
                    <h3 className="text-2xl font-bold mb-2">
                      {isWinner ? '🎉 You Won! 🎉' : 'You Lost'}
                    </h3>
                    <p className="text-muted-foreground">
                      Winner: {normalizeAddress(game.winner).slice(0, 10)}...{normalizeAddress(game.winner).slice(-4)}
                    </p>
                    <p className="text-lg font-semibold mt-2">
                      Prize: {(parseInt(game.prize_pool) / 1_000_000).toFixed(2)} USDC
                    </p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button onClick={onBackToLobby} size="lg">
                    Back to Lobby
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
