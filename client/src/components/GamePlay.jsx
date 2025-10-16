import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft } from 'lucide-react';
import { generateCommitment, generateSalt, coordinatesToU256 } from '@/lib/contract';
import { useGameQuery } from '../dojo/useGameQuery';
import { useGameActions } from '../dojo/useGameActions';

export function GamePlay({ gameId, wallet, onGameEnd }) {
  const navigate = useNavigate();

  // Dojo hooks
  const { game, loading: gameLoading } = useGameQuery(gameId);
  const { submitGuess: dojoSubmitGuess, revealLocation: dojoRevealLocation, revealGuess: dojoRevealGuess, loading: actionLoading } = useGameActions(wallet);

  const [timeLeft, setTimeLeft] = useState(null);
  const [guessLocation, setGuessLocation] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [gameState, setGameState] = useState('active');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [panoramaData, setPanoramaData] = useState(null);
  const mapRef = useRef(null);
  const panoramaRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    loadApiKey();
    loadPanorama();
  }, [gameId]);

  // Timer based on contract end_time
  useEffect(() => {
    if (!game || !game.end_time) {
      console.log('Timer not starting:', { hasGame: !!game, endTime: game?.end_time });
      return;
    }

    let hasAlerted = false;
    const updateTimer = () => {
      const currentTime = Math.floor(Date.now() / 1000);
      // Convert BigInt to number safely
      const endTime = typeof game.end_time === 'bigint'
        ? Number(game.end_time)
        : parseInt(game.end_time);
      const remaining = Math.max(0, endTime - currentTime);

      console.log('Timer update:', { currentTime, endTime, remaining });
      setTimeLeft(remaining);

      // Alert only once when time runs out
      if (remaining === 0 && !submitted && gameState === 'active' && !hasAlerted) {
        hasAlerted = true;
        alert('Time is up! Please submit your guess or you will forfeit.');
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [game, submitted, gameState]);

  useEffect(() => {
    if (apiKey && !mapsLoaded) {
      loadGoogleMaps();
    }
  }, [apiKey, mapsLoaded]);

  useEffect(() => {
    console.log('Street View useEffect:', { mapsLoaded, panoramaData: !!panoramaData, hasRef: !!panoramaRef.current, hasPanorama: !!window.panorama });
    if (mapsLoaded && panoramaData && panoramaRef.current) {
      if (!window.panorama) {
        console.log('Initializing Street View...');
        initializeStreetView();
      } else {
        console.log('Street View already exists, updating position...');
        // Update existing panorama if location changed
        window.panorama.setPosition({ lat: panoramaData.lat, lng: panoramaData.lng });
      }
    }
  }, [mapsLoaded, panoramaData]);

  useEffect(() => {
    if (mapsLoaded && mapRef.current && !window.gameMap) {
      initializeMap();
    }
  }, [mapsLoaded]);

  const loadApiKey = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/config`);
      const data = await response.json();
      setApiKey(data.apiKey);
      console.log('API Key loaded:', data.apiKey);
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  // Update game state based on Dojo query
  useEffect(() => {
    if (!game) return;

    console.log('Game state update from Dojo:', game);

    // Check game state and update local state
    const state = parseInt(game.game_state);
    if (state === 2) {
      console.log('Game entering revealing state');
      setGameState('revealing');
    } else if (state === 3) {
      console.log('Game finished');
      setGameState('finished');
      onGameEnd(gameId);
    } else if (state === 1) {
      console.log('Game is active');
      setGameState('active');
    }

    // Check if player has already submitted
    const playerAddress = wallet.selectedAddress.toLowerCase();
    const myGuess = game.guesses?.find(g =>
      g.player.toLowerCase() === playerAddress
    );

    if (myGuess && myGuess.has_submitted) {
      setSubmitted(true);
    }
  }, [game, gameId, onGameEnd, wallet.selectedAddress]);

  const loadPanorama = async (retryCount = 0) => {
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

      console.log(`Loading panorama for game ${gameId} (attempt ${retryCount + 1}/${maxRetries + 1})`);

      // Send wallet address for authentication
      const response = await fetch(`${backendUrl}/api/panorama/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': wallet.selectedAddress
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to load panorama:', errorData);

        // If game not found and we have retries left, retry after a delay
        if (errorData.error === 'Game not found in database' && retryCount < maxRetries) {
          console.log(`Game not found in database, retrying in ${retryDelay}ms...`);
          setTimeout(() => loadPanorama(retryCount + 1), retryDelay);
          return;
        }

        alert(`Access denied: ${errorData.error || 'You are not a participant in this game'}`);
        return;
      }

      const data = await response.json();
      setPanoramaData(data);
      console.log('✓ Panorama data loaded successfully for game', gameId);
    } catch (error) {
      console.error('Failed to load panorama:', error);

      // Retry on network errors
      if (retryCount < maxRetries) {
        console.log(`Network error, retrying in ${retryDelay}ms...`);
        setTimeout(() => loadPanorama(retryCount + 1), retryDelay);
        return;
      }

      alert('Failed to load game location after multiple attempts. Please refresh the page.');
    }
  };


  const loadGoogleMaps = () => {
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded');
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;

    window.initGoogleMaps = () => {
      console.log('Google Maps loaded successfully');
      setMapsLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps');
    };

    document.head.appendChild(script);
  };

  const initializeStreetView = () => {
    console.log('initializeStreetView called');
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded yet');
      return;
    }

    if (!panoramaData) {
      console.error('Panorama data not available');
      return;
    }

    console.log('Creating Street View for location:', panoramaData);

    const streetViewService = new window.google.maps.StreetViewService();
    const location = { lat: panoramaData.lat, lng: panoramaData.lng };

    console.log('Requesting panorama at:', location);

    streetViewService.getPanorama({
      location: location,
      radius: 50,
      source: window.google.maps.StreetViewSource.OUTDOOR
    }, (data, status) => {
      console.log('Street View getPanorama result:', { status, data });
      if (status === 'OK') {
        console.log('Creating StreetViewPanorama instance...');
        const panorama = new window.google.maps.StreetViewPanorama(
          panoramaRef.current,
          {
            position: data.location.latLng,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            // Enable full controls for navigation
            addressControl: false,
            linksControl: true,  // Allow movement to adjacent locations
            panControl: true,
            enableCloseButton: false,
            zoomControl: true,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
            disableDefaultUI: false
          }
        );
        window.panorama = panorama;
        console.log('✓ Street View initialized successfully for game', gameId);
      } else {
        console.error('✗ Street View not available at this location, status:', status);
        if (panoramaRef.current) {
          panoramaRef.current.innerHTML = '<div class="flex items-center justify-center h-full bg-muted text-destructive">Street View not available at this location</div>';
        }
      }
    });
  };

  const initializeMap = () => {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded yet');
      return;
    }

    if (!mapRef.current) {
      console.error('Map ref not ready');
      return;
    }

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 20, lng: 0 },
      zoom: 2,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      zoomControl: true
    });

    // Add click listener to place guess
    map.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      handleMapClick(lat, lng);

      // Remove previous marker if exists
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // Create new marker
      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: 'Your Guess'
      });
    });

    window.gameMap = map;
    console.log('Game map initialized');
  };

  const handleMapClick = (lat, lng) => {
    setGuessLocation({ lat, lng });
  };

  const submitGuess = async () => {
    if (!guessLocation) {
      alert('Please select a location on the map first');
      return;
    }

    try {
      setSubmitted(true);

      // Generate commitment and salt
      const salt = generateSalt();
      const coords = coordinatesToU256(guessLocation.lat, guessLocation.lng);
      const commitment = generateCommitment(
        guessLocation.lat,
        guessLocation.lng,
        salt
      );

      // Store guess and salt in localStorage for reveal phase
      localStorage.setItem(`game_${gameId}_guess`, JSON.stringify({
        lat: guessLocation.lat,
        lng: guessLocation.lng,
        latU256: coords.lat,
        lngU256: coords.lng,
        salt
      }));

      console.log('Submitting guess with commitment:', commitment);

      // Submit using Dojo action
      const txHash = await dojoSubmitGuess(gameId, commitment);

      console.log('Guess submitted, tx:', txHash);
      alert('Guess submitted! Waiting for other player...');
    } catch (error) {
      console.error('Failed to submit guess:', error);
      alert('Failed to submit guess. Please try again.');
      setSubmitted(false);
    }
  };

  const triggerLocationReveal = async () => {
    try {
      // Get secret location data from backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/game/${gameId}/secret`, {
        headers: {
          'X-Wallet-Address': wallet.selectedAddress
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get secret game data from backend');
      }

      const gameData = await response.json();

      if (!gameData.secret_location || !gameData.secret_salt) {
        throw new Error('No secret location data found in backend');
      }

      console.log('Revealing location for game:', gameId);

      // Call reveal_location on contract
      const txHash = await dojoRevealLocation(
        gameId,
        gameData.secret_location.lat,
        gameData.secret_location.lng,
        gameData.secret_salt
      );

      console.log('Location revealed, tx:', txHash);
      alert('Location revealed! Now players can reveal their guesses.');
    } catch (error) {
      console.error('Failed to reveal location:', error);
      alert('Failed to reveal location: ' + error.message);
    }
  };

  const revealGuess = async () => {
    try {
      // Get stored guess from localStorage
      const stored = localStorage.getItem(`game_${gameId}_guess`);
      if (!stored) {
        alert('No guess found to reveal');
        return;
      }

      const guessData = JSON.parse(stored);
      console.log('Revealing guess:', guessData);

      // Reveal using Dojo action
      const txHash = await dojoRevealGuess(
        gameId,
        guessData.lat,
        guessData.lng,
        guessData.salt
      );

      console.log('Reveal submitted, tx:', txHash);
      alert('Guess revealed! Waiting for results...');
    } catch (error) {
      console.error('Failed to reveal guess:', error);
      alert('Failed to reveal guess. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if both players have submitted (waiting for location reveal)
  const bothPlayersSubmitted = game && game.guesses &&
    game.guesses.length === 2 &&
    game.guesses.every(g => g.has_submitted);

  // Show "waiting for reveal" UI if both submitted but still in Active state
  if (gameState === 'active' && submitted && bothPlayersSubmitted && !game.location_revealed) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Both Players Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Both players have submitted their guesses.</p>
            <p>Click below to reveal the actual location and move to the reveal phase.</p>
            <Button onClick={triggerLocationReveal} size="lg" className="w-full" disabled={actionLoading}>
              {actionLoading ? 'Revealing...' : 'Reveal Location'}
            </Button>
            <p className="text-sm text-muted-foreground">
              This will transition the game to the reveal phase where players can reveal their guesses.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show reveal phase UI if game is in revealing state
  if (gameState === 'revealing') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reveal Phase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Both players have submitted their guesses!</p>
            <p>Click below to reveal your guess and see the results.</p>
            <Button onClick={revealGuess} size="lg" className="w-full">
              Reveal My Guess
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-background border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/lobby')}
              title="Return to Lobby"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Game #{gameId}</h2>
              <p className="text-sm text-muted-foreground">
                {submitted ? 'Waiting for other player...' : 'Make your guess before time runs out'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold ${timeLeft !== null && timeLeft < 30 ? 'text-destructive' : ''}`}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
            <Button
              onClick={submitGuess}
              disabled={!guessLocation || submitted}
              size="lg"
            >
              {submitted ? 'Submitted ✓' : 'Submit Guess'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-1/2 relative">
          <div ref={panoramaRef} className="w-full h-full" />
          {!panoramaData && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              Loading Street View...
            </div>
          )}
        </div>

        <div className="w-1/2 relative">
          <div ref={mapRef} className="w-full h-full" />
          {!window.gameMap && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              Loading map...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
