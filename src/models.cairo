use starknet::ContractAddress;

// Coordinates for location and guesses
#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, DojoStore)]
pub struct Coordinates {
    pub lat: u256,  // Latitude * 1e6
    pub lng: u256,  // Longitude * 1e6
}

// Game state enum
#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum GameState {
    #[default]
    AwaitingPlayer,
    Active,
    Revealing,
    Finished,
}

// Player guess with commitment and reveal
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerGuess {
    #[key]
    pub game_id: u256,
    #[key]
    pub player: ContractAddress,
    pub commitment: felt252,
    pub revealed_guess: Coordinates,
    pub has_submitted: bool,
    pub has_revealed: bool,
    pub score: u256,
}

// Main game model
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: u256,
    pub player1: ContractAddress,
    pub player2: ContractAddress,
    pub game_state: GameState,
    pub end_time: u64,
    pub location_commitment: felt252,
    pub actual_location: Coordinates,
    pub location_revealed: bool,
    pub winner: ContractAddress,
}

// Global counter for game IDs
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct GameCounter {
    #[key]
    pub id: u8,  // Always 0, just a singleton
    pub count: u256,
}

// Helper functions for Coordinates
#[generate_trait]
pub impl CoordinatesImpl of CoordinatesTrait {
    fn is_zero(self: Coordinates) -> bool {
        self.lat == 0 && self.lng == 0
    }

    fn is_equal(self: Coordinates, other: Coordinates) -> bool {
        self.lat == other.lat && self.lng == other.lng
    }
}
