import { useEffect, useState } from 'react';
import { connect, disconnect } from 'starknetkit';
import { RpcProvider } from 'starknet';
import { WalletAdapter } from '../utils/walletAdapter';
import { Button } from './ui/button';

export function WalletConnect({ onConnect }) {
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { wallet, connectorData, connector } = await connect({ modalMode: 'neverAsk' });

        if (connectorData?.account && wallet) {
          console.log('Existing connection found');

          // Create RPC provider
          const provider = new RpcProvider({
            nodeUrl: 'https://starknet-sepolia-rpc.publicnode.com'
          });

          // Create wallet adapter that uses wallet's request method
          const account = new WalletAdapter(wallet, connectorData.account, provider);

          const walletObj = {
            account,
            selectedAddress: connectorData.account,
            wallet,
            connector
          };

          setConnection(walletObj);
          setAddress(connectorData.account);
          if (onConnect) {
            onConnect(walletObj);
          }
        }
      } catch (error) {
        console.log('No existing connection:', error);
      }
    };

    checkConnection();
  }, []);

  const handleConnect = async () => {
    try {
      console.log('Attempting to connect wallet...');
      const { wallet, connectorData, connector } = await connect({
        modalMode: 'alwaysAsk',
        modalTheme: 'light'
      });

      console.log('Connect result:', { wallet, connectorData, connector });

      if (connectorData?.account && wallet) {
        console.log('Wallet connected successfully!');
        console.log('Address:', connectorData.account);

        // Create RPC provider
        const provider = new RpcProvider({
          nodeUrl: 'https://starknet-sepolia-rpc.publicnode.com'
        });

        // Create wallet adapter that uses wallet's request method
        const account = new WalletAdapter(wallet, connectorData.account, provider);

        console.log('Account adapter created');

        // Create a wallet object with the structure our app expects
        const walletObj = {
          account,
          selectedAddress: connectorData.account,
          wallet,
          connector
        };

        setConnection(walletObj);
        setAddress(connectorData.account);

        if (onConnect) {
          onConnect(walletObj);
        }
      } else {
        console.warn('Wallet connection returned but no account:', connectorData);
        alert('Failed to get account from wallet. Please try again.');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet: ' + error.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setConnection(null);
      setAddress('');
      window.location.reload(); // Reload to clear state
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (connection) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        <Button onClick={handleDisconnect} variant="outline" size="sm">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect}>
      Connect Wallet
    </Button>
  );
}
