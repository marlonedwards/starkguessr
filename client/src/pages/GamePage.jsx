import { useParams, useNavigate } from 'react-router-dom';
import { GamePlay } from '../components/GamePlay';

export function GamePage({ wallet }) {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const handleGameEnd = () => {
    navigate(`/results/${gameId}`);
  };

  return (
    <GamePlay
      gameId={parseInt(gameId)}
      wallet={wallet}
      onGameEnd={handleGameEnd}
    />
  );
}
