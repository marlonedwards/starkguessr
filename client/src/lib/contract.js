import { hash, CallData, selector } from 'starknet';

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

// NEW APPROACH: Skip Contract class entirely, use direct calls
export function createContract(account) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address not configured');
  }
  if (!account) {
    throw new Error('Account is required');
  }

  console.log('Creating contract wrapper for address:', CONTRACT_ADDRESS);

  // Return a wrapper object with methods that call the contract directly
  return {
    // Read method: get_game
    get_game: async (gameId) => {
      console.log('Calling get_game with gameId:', gameId);

      const result = await account.callContract({
        contractAddress: CONTRACT_ADDRESS,
        entrypoint: 'get_game',
        calldata: CallData.compile([gameId, '0']) // u256 as (low, high)
      });

      console.log('Raw result from get_game:', result);

      // Parse the result manually
      // Field mapping:
      // 0-1: game_id (u256: low, high)
      // 2: player1
      // 3: player2
      // 4-5: prize_pool (u256: low, high)
      // 6: game_state
      // 7: end_time
      // 8: location_commitment
      // 9-12: actual_location (lat_low, lat_high, lng_low, lng_high)
      // 13: location_revealed
      // 14-22: player1_guess (9 felts)
      // 23-31: player2_guess (9 felts)
      // 32: winner

      return {
        game_id: BigInt(result[0]), // low part of u256
        player1: BigInt(result[2]),
        player2: BigInt(result[3]),
        prize_pool: BigInt(result[4]), // low part of u256
        game_state: {
          variant: {
            AwaitingPlayer: result[6] === '0x0' ? {} : undefined,
            Active: result[6] === '0x1' ? {} : undefined,
            Revealing: result[6] === '0x2' ? {} : undefined,
            Finished: result[6] === '0x3' ? {} : undefined,
          }
        },
        end_time: BigInt(result[7]),
        location_commitment: BigInt(result[8]),
        actual_location: {
          lat: BigInt(result[9]), // low part of u256
          lng: BigInt(result[11]) // low part of u256
        },
        location_revealed: result[13] === '0x1',
        player1_guess: {
          commitment: BigInt(result[14]),
          revealed_guess: {
            lat: BigInt(result[15]), // low part of u256
            lng: BigInt(result[17])  // low part of u256
          },
          has_submitted: result[19] === '0x1',
          has_revealed: result[20] === '0x1',
          score: BigInt(result[21]) // low part of u256
        },
        player2_guess: {
          commitment: BigInt(result[23]),
          revealed_guess: {
            lat: BigInt(result[24]), // low part of u256
            lng: BigInt(result[26])  // low part of u256
          },
          has_submitted: result[28] === '0x1',
          has_revealed: result[29] === '0x1',
          score: BigInt(result[30]) // low part of u256
        },
        winner: BigInt(result[32])
      };
    }
  };
}

// Convert lat/lng to u256 format (matching backend)
export function coordinatesToU256(lat, lng) {
  const latOffset = (lat + 90) * 1_000_000;
  const lngOffset = (lng + 180) * 1_000_000;

  return {
    lat: Math.floor(latOffset).toString(),
    lng: Math.floor(lngOffset).toString()
  };
}

export function u256ToCoordinates(latU256, lngU256) {
  const lat = (parseInt(latU256) / 1_000_000) - 90;
  const lng = (parseInt(lngU256) / 1_000_000) - 180;

  return { lat, lng };
}

// Generate commitment hash for guess
// Must match the contract's format: [lat.low, lat.high, lng.low, lng.high, salt]
export function generateCommitment(lat, lng, salt) {
  const coords = coordinatesToU256(lat, lng);

  // For values that fit in felt252, high part is 0
  // Split into low/high to match contract's u256 handling
  const latBigInt = BigInt(coords.lat);
  const lngBigInt = BigInt(coords.lng);

  const data = [
    (latBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(), // lat.low
    (latBigInt >> BigInt(128)).toString(), // lat.high
    (lngBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toString(), // lng.low
    (lngBigInt >> BigInt(128)).toString(), // lng.high
    salt
  ];

  return hash.computePoseidonHashOnElements(data);
}

// Generate random salt
export function generateSalt() {
  return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Format distance for display
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else if (meters < 100000) {
    return `${(meters / 1000).toFixed(1)}km`;
  } else {
    return `${Math.round(meters / 1000)}km`;
  }
}
