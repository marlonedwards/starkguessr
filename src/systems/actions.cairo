use starkguessr::models::{Coordinates, GameState, Game, PlayerGuess, GameCounter};

#[starknet::interface]
pub trait IActions<T> {
    fn create_game(ref self: T, location_commitment: felt252) -> u256;
    fn join_game(ref self: T, game_id: u256);
    fn submit_guess(ref self: T, game_id: u256, commitment: felt252);
    fn reveal_location(ref self: T, game_id: u256, location: Coordinates, salt: felt252);
    fn reveal_guess(ref self: T, game_id: u256, guess: Coordinates, salt: felt252);
    fn finalize_on_timeout(ref self: T, game_id: u256);
}

#[dojo::contract]
pub mod actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::poseidon::poseidon_hash_span;
    use super::{IActions, Coordinates, GameState, Game, PlayerGuess, GameCounter};

    // Events
    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameCreated {
        #[key]
        pub game_id: u256,
        pub creator: ContractAddress,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameJoined {
        #[key]
        pub game_id: u256,
        pub player: ContractAddress,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GuessSubmitted {
        #[key]
        pub game_id: u256,
        pub player: ContractAddress,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct LocationRevealed {
        #[key]
        pub game_id: u256,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GuessRevealed {
        #[key]
        pub game_id: u256,
        pub player: ContractAddress,
        pub score: u256,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameFinished {
        #[key]
        pub game_id: u256,
        pub winner: ContractAddress,
    }

    const GAME_DURATION: u64 = 300; // 5 minutes
    const REVEAL_TIMEOUT: u64 = 300; // 5 minutes

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_game(ref self: ContractState, location_commitment: felt252) -> u256 {
            let mut world = self.world_default();
            let caller = get_caller_address();

            // Get and increment game counter
            let mut counter: GameCounter = world.read_model(0_u8);
            let game_id = counter.count + 1;
            counter.count = game_id;
            world.write_model(@counter);

            // Create empty coordinates
            let empty_coords = Coordinates { lat: 0, lng: 0 };
            let zero_addr: ContractAddress = 0.try_into().unwrap();

            // Create game
            let game = Game {
                game_id,
                player1: caller,
                player2: zero_addr,
                game_state: GameState::AwaitingPlayer,
                end_time: 0,
                location_commitment,
                actual_location: empty_coords,
                location_revealed: false,
                winner: zero_addr,
            };
            world.write_model(@game);

            // Initialize player guesses
            let player1_guess = PlayerGuess {
                game_id,
                player: caller,
                commitment: 0,
                revealed_guess: empty_coords,
                has_submitted: false,
                has_revealed: false,
                score: 0,
            };
            world.write_model(@player1_guess);

            world.emit_event(@GameCreated { game_id, creator: caller });
            game_id
        }

        fn join_game(ref self: ContractState, game_id: u256) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let mut game: Game = world.read_model(game_id);
            assert(game.game_state == GameState::AwaitingPlayer, 'Game not awaiting player');
            assert(game.player1 != caller, 'Cannot join own game');

            // Update game
            game.player2 = caller;
            game.game_state = GameState::Active;
            game.end_time = get_block_timestamp() + GAME_DURATION;
            world.write_model(@game);

            // Initialize player2 guess
            let empty_coords = Coordinates { lat: 0, lng: 0 };
            let player2_guess = PlayerGuess {
                game_id,
                player: caller,
                commitment: 0,
                revealed_guess: empty_coords,
                has_submitted: false,
                has_revealed: false,
                score: 0,
            };
            world.write_model(@player2_guess);

            world.emit_event(@GameJoined { game_id, player: caller });
        }

        fn submit_guess(ref self: ContractState, game_id: u256, commitment: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let game: Game = world.read_model(game_id);
            assert(game.game_state == GameState::Active, 'Game not active');
            assert(get_block_timestamp() < game.end_time, 'Game time expired');
            assert(caller == game.player1 || caller == game.player2, 'Not a player');

            // Update player guess
            let mut guess: PlayerGuess = world.read_model((game_id, caller));
            assert(!guess.has_submitted, 'Already submitted');

            guess.commitment = commitment;
            guess.has_submitted = true;
            world.write_model(@guess);

            world.emit_event(@GuessSubmitted { game_id, player: caller });
        }

        fn reveal_location(ref self: ContractState, game_id: u256, location: Coordinates, salt: felt252) {
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            assert(game.game_state == GameState::Active, 'Game not active');

            // Check if both players submitted or time expired
            let player1_guess: PlayerGuess = world.read_model((game_id, game.player1));
            let player2_guess: PlayerGuess = world.read_model((game_id, game.player2));
            let both_submitted = player1_guess.has_submitted && player2_guess.has_submitted;

            assert(
                get_block_timestamp() >= game.end_time || both_submitted,
                'Game still in progress'
            );

            // Verify location commitment
            let mut data = ArrayTrait::new();
            data.append(location.lat.low.into());
            data.append(location.lat.high.into());
            data.append(location.lng.low.into());
            data.append(location.lng.high.into());
            data.append(salt);
            let computed_hash = poseidon_hash_span(data.span());

            assert(computed_hash == game.location_commitment, 'Invalid location proof');

            // Update game
            game.actual_location = location;
            game.location_revealed = true;
            game.game_state = GameState::Revealing;
            game.end_time = get_block_timestamp() + REVEAL_TIMEOUT;
            world.write_model(@game);

            world.emit_event(@LocationRevealed { game_id, timestamp: get_block_timestamp() });
        }

        fn reveal_guess(ref self: ContractState, game_id: u256, guess: Coordinates, salt: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let game: Game = world.read_model(game_id);
            assert(game.game_state == GameState::Revealing, 'Not in reveal phase');
            assert(game.location_revealed, 'Location not revealed');
            assert(caller == game.player1 || caller == game.player2, 'Not a player');

            // Verify commitment
            let mut data = ArrayTrait::new();
            data.append(guess.lat.low.into());
            data.append(guess.lat.high.into());
            data.append(guess.lng.low.into());
            data.append(guess.lng.high.into());
            data.append(salt);
            let computed_hash = poseidon_hash_span(data.span());

            let mut player_guess: PlayerGuess = world.read_model((game_id, caller));
            assert(computed_hash == player_guess.commitment, 'Invalid guess proof');
            assert(!player_guess.has_revealed, 'Already revealed');

            // Calculate score
            let score = calculate_distance(game.actual_location, guess);

            // Update guess
            player_guess.revealed_guess = guess;
            player_guess.has_revealed = true;
            player_guess.score = score;
            world.write_model(@player_guess);

            world.emit_event(@GuessRevealed { game_id, player: caller, score });

            // Check if both revealed
            let other_player = if caller == game.player1 { game.player2 } else { game.player1 };
            let other_guess: PlayerGuess = world.read_model((game_id, other_player));

            if other_guess.has_revealed {
                finalize_game(ref world, game_id, game, player_guess, other_guess);
            }
        }

        fn finalize_on_timeout(ref self: ContractState, game_id: u256) {
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            assert(game.game_state == GameState::Revealing, 'Not in reveal phase');
            assert(get_block_timestamp() >= game.end_time, 'Timeout not reached');

            let player1_guess: PlayerGuess = world.read_model((game_id, game.player1));
            let player2_guess: PlayerGuess = world.read_model((game_id, game.player2));

            // If both revealed, finalize normally
            if player1_guess.has_revealed && player2_guess.has_revealed {
                finalize_game(ref world, game_id, game, player1_guess, player2_guess);
                return;
            }

            // Determine winner by forfeit
            let winner = if player1_guess.has_revealed && !player2_guess.has_revealed {
                game.player1
            } else if !player1_guess.has_revealed && player2_guess.has_revealed {
                game.player2
            } else {
                // Both forfeited - player1 wins
                game.player1
            };

            game.winner = winner;
            game.game_state = GameState::Finished;
            world.write_model(@game);

            world.emit_event(@GameFinished { game_id, winner });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"starkguessr")
        }
    }

    // Helper functions
    fn calculate_distance(loc1: Coordinates, loc2: Coordinates) -> u256 {
        let lat_diff = if loc1.lat > loc2.lat { loc1.lat - loc2.lat } else { loc2.lat - loc1.lat };
        let lng_diff = if loc1.lng > loc2.lng { loc1.lng - loc2.lng } else { loc2.lng - loc1.lng };

        let lat_diff_sq = lat_diff * lat_diff;
        let lng_diff_sq = lng_diff * lng_diff;

        (lat_diff_sq + lng_diff_sq) / 1000000
    }

    fn finalize_game(
        ref world: dojo::world::WorldStorage,
        game_id: u256,
        mut game: Game,
        player1_guess: PlayerGuess,
        player2_guess: PlayerGuess
    ) {
        let winner = if player1_guess.score < player2_guess.score {
            game.player1
        } else if player2_guess.score < player1_guess.score {
            game.player2
        } else {
            game.player1 // Tie goes to player1
        };

        game.winner = winner;
        game.game_state = GameState::Finished;
        world.write_model(@game);

        world.emit_event(@GameFinished { game_id, winner });
    }
}
