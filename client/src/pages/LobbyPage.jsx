import { useNavigate } from 'react-router-dom';
import { GameLobby } from '../components/GameLobby';

export function LobbyPage({ wallet }) {
  const navigate = useNavigate();

  const handleGameStart = (gameId) => {
    navigate(`/game/${gameId}`);
  };

  return <GameLobby wallet={wallet} onGameStart={handleGameStart} />;
}
