import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { DojoProvider } from './dojo/DojoContext';
import { WalletConnect } from './components/WalletConnect';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';

function AppContent() {
  const [wallet, setWallet] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleWalletConnect = (connectedWallet) => {
    console.log('App received wallet:', connectedWallet);
    setWallet(connectedWallet);
  };

  const handleBackToLobby = () => {
    navigate('/');
  };

  if (!wallet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">StarkGuessr</h1>
          <p className="text-muted-foreground">
            A location guessing game on Starknet
          </p>
        </div>
        <WalletConnect onConnect={handleWalletConnect} />
      </div>
    );
  }

  // Hide header on game page for full screen experience
  const isGamePage = location.pathname.startsWith('/game/');

  return (
    <div className="min-h-screen">
      {!isGamePage && (
        <header className="border-b bg-background">
          <div className="container mx-auto p-4 flex items-center justify-between">
            <h1
              className="text-2xl font-bold cursor-pointer"
              onClick={handleBackToLobby}
            >
              StarkGuessr
            </h1>
            <WalletConnect onConnect={handleWalletConnect} />
          </div>
        </header>
      )}

      <Routes>
        <Route path="/" element={<LobbyPage wallet={wallet} />} />
        <Route path="/game/:gameId" element={<GamePage wallet={wallet} />} />
        <Route path="/results/:gameId" element={<ResultsPage wallet={wallet} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <DojoProvider>
        <AppContent />
      </DojoProvider>
    </BrowserRouter>
  );
}

export default App;
