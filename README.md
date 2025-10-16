# StarkGuessr - Provable Location Guessing Game

**A fully on-chain geolocation guessing game built with Dojo Engine and Cartridge Controller for Starknet**

![Dojo Logo](./assets/cover.png)

## Overview

StarkGuessr is a competitive two-player game where players guess real-world locations based on Google Street View imagery. Built using Dojo's Entity Component System (ECS) architecture, the game leverages cryptographic commitments to ensure fair play and prevent cheating.

### Key Features

- **Provable Fairness**: Commit-reveal scheme ensures neither player can cheat
- **On-Chain Logic**: All game state managed through Dojo's ECS
- **Gasless Transactions**: Powered by Cartridge Controller session keys
- **Real-Time Updates**: Torii indexer provides instant state synchronization
- **Competitive Gameplay**: Two-player matches with automatic winner determination

## Architecture

### Dojo Models (Components)

**Game**: Main game state including players, location commitment, and game phase
```cairo
struct Game {
    game_id: u256,
    player1: ContractAddress,
    player2: ContractAddress,
    game_state: GameState,          // AwaitingPlayer, Active, Revealing, Finished
    end_time: u64,
    location_commitment: felt252,    // Hidden until reveal phase
    actual_location: Coordinates,
    location_revealed: bool,
    winner: ContractAddress,
}
```

**PlayerGuess**: Individual player guess with commitment
```cairo
struct PlayerGuess {
    game_id: u256,
    player: ContractAddress,
    commitment: felt252,             // Hash of guess + salt
    revealed_guess: Coordinates,
    has_submitted: bool,
    has_revealed: bool,
    score: u256,                     // Distance in meters
}
```

**Coordinates**: Geographic location (lat/lng * 1e6 for precision)
```cairo
struct Coordinates {
    lat: u256,  // Latitude * 1,000,000
    lng: u256,  // Longitude * 1,000,000
}
```

### Dojo Systems (Game Logic)

1. **create_game(location_commitment)**: Player 1 creates game with hidden location
2. **join_game(game_id)**: Player 2 joins, game becomes Active
3. **submit_guess(game_id, commitment)**: Players submit hashed guesses
4. **reveal_location(game_id, location, salt)**: Reveal actual location (after time expires or both submitted)
5. **reveal_guess(game_id, guess, salt)**: Players reveal their guesses
6. **finalize_on_timeout(game_id)**: Handle timeout scenarios

### Commit-Reveal Flow

```
1. Player 1: Creates game with hash(location + salt)
2. Player 2: Joins game
3. Both: Submit hash(guess + salt)
4. Time expires OR both submit
5. Backend: Reveals location with proof
6. Both: Reveal guesses with proofs
7. Smart contract: Calculates distances, determines winner
```

## Tech Stack

- **Smart Contracts**: Cairo 2.12.2 with Dojo 1.7.1
- **Frontend**: React + TypeScript + Vite
- **Wallet**: Cartridge Controller with session keys
- **State Management**: Dojo SDK + Zustand
- **Indexer**: Torii for real-time queries
- **Maps**: Google Maps API for Street View

## Getting Started

### Prerequisites

- Scarb 2.12.2+
- Sozo (Dojo CLI)
- Node.js 18+
- Cartridge Controller account

### Local Development

**Terminal 1 - Run Katana (local node)**
```bash
katana --dev --dev.no-fee
```

**Terminal 2 - Build & Deploy**
```bash
# Build contracts
sozo build

# Migrate to Katana
sozo migrate

# Start Torii indexer
torii --world <WORLD_ADDRESS> --http.cors_origins "*"
```

**Terminal 3 - Frontend**
```bash
cd client
npm install
npm run dev
```

### Deploy to Sepolia

```bash
# Set environment variables
export STARKNET_RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_7"
export DOJO_ACCOUNT_ADDRESS="<your-address>"
export DOJO_PRIVATE_KEY="<your-private-key>"

# Deploy
sozo build
sozo migrate --rpc-url $STARKNET_RPC_URL
```

## Game Mechanics

### Scoring

Distance is calculated using a simplified Euclidean approximation:
```
distance = sqrt((lat1-lat2)² + (lng1-lng2)²) / 1,000,000
```

Lower score wins. In case of tie, Player 1 (game creator) wins.

### Timeouts

- **Game Duration**: 5 minutes to submit guesses
- **Reveal Timeout**: 5 minutes to reveal after location revealed
- **Forfeit Rules**:
  - If only one player reveals → they win
  - If neither reveals → Player 1 wins
  - If neither submits → Player 1 wins

### Commitment Security

Uses Poseidon hash for commitments:
```
commitment = poseidon_hash_span([lat.low, lat.high, lng.low, lng.high, salt])
```

This prevents:
- Players from changing guesses after seeing others
- Game creator from picking location after seeing guesses
- Any party from front-running reveals

## Cartridge Integration

### Session Keys

Configured policies allow gasless transactions for game actions:
```typescript
const policies = [
  {
    target: worldAddress,
    method: "create_game",
  },
  {
    target: worldAddress,
    method: "join_game",
  },
  {
    target: worldAddress,
    method: "submit_guess",
  },
  // ... other methods
]
```

### Wallet Connection

```typescript
import { ControllerConnector } from "@cartridge/controller";

const controller = new ControllerConnector({
  policies,
  rpc: "https://api.cartridge.gg/x/starknet/sepolia",
});

const account = await controller.connect();
```

## Project Structure

```
starkguessr-dojo/
├── src/
│   ├── models.cairo         # Dojo models (Game, PlayerGuess, etc.)
│   ├── systems/
│   │   └── actions.cairo    # Game logic systems
│   └── lib.cairo           # Module declarations
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── dojo/           # Dojo SDK setup
│   │   └── utils/          # Helper functions
│   └── dojoConfig.ts       # Dojo configuration
├── Scarb.toml              # Cairo package config
├── dojo_dev.toml           # Local Dojo config
└── dojo_release.toml       # Production Dojo config
```

## Hackathon Submission

**Track**: Gaming - On-Chain Worlds & Gaming (Cartridge Prize Pool)

**Current Status**:
- [X] Built with Dojo Engine
- [X] Integrated with Cartridge Controller
- [X] Fully provable game logic
- [X] Real-time multiplayer
- [X] Free or USDC wager modes

## Future Enhancements

- [ ] Tournament mode
- [ ] Leaderboards
- [ ] Multiple location rounds
- [ ] Regional challenges
- [ ] Achievements

## Resources

- [Dojo Documentation](https://dojoengine.org)
- [Cartridge Docs](https://docs.cartridge.gg)
- [Starknet Book](https://book.starknet.io)

## License

MIT

---

Built for Starknet Re{solve} Hackathon 2025
