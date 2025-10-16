import { useParams, useNavigate } from 'react-router-dom';
import { GameResults } from '../components/GameResults';

export function ResultsPage({ wallet }) {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const handleBackToLobby = () => {
    navigate('/');
  };

  return (
    <GameResults
      gameId={parseInt(gameId)}
      wallet={wallet}
      onBackToLobby={handleBackToLobby}
    />
  );
}
