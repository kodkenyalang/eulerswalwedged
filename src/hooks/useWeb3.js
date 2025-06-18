import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const useWeb3 = () => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if wallet is already connected on mount
  useEffect(() => {
    checkConnection();
    setupEventListeners();
    
    return () => {
      removeEventListeners();
    };
  }, []);

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          const signer = provider.getSigner();
          const network = await provider.getNetwork();
          
          setProvider(provider);
          setSigner(signer);
          setAccount(accounts[0]);
          setChainId(network.chainId);
        }
      } catch (err) {
        console.error('Error checking connection:', err);
        setError('Failed to check wallet connection');
      }
    }
  };

  const setupEventListeners = () => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
    }
  };

  const removeEventListeners = () => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    }
  };

  const handleAccountsChanged = useCallback((accounts) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setAccount(accounts[0]);
      // Refresh provider and signer when account changes
      if (provider) {
        const newSigner = provider.getSigner();
        setSigner(newSigner);
      }
    }
  }, [provider]);

  const handleChainChanged = useCallback((chainId) => {
    // Convert hex chainId to decimal
    const decimalChainId = parseInt(chainId, 16);
    setChainId(decimalChainId);
    
    // Refresh the page to avoid any issues with the new chain
    window.location.reload();
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, []);

  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask or another Web3 wallet is required. Please install MetaMask to continue.');
      return false;
    }

    try {
      setLoading(true);
      setError('');
      console.log('Attempting to connect wallet...');

      // Check if already connected
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log('Existing accounts:', accounts);

      let requestedAccounts;
      if (accounts.length === 0) {
        console.log('No existing accounts, requesting access...');
        
        // Add timeout to prevent hanging
        const connectionPromise = window.ethereum.request({ method: 'eth_requestAccounts' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout - please try again')), 15000)
        );
        
        try {
          requestedAccounts = await Promise.race([connectionPromise, timeoutPromise]);
          console.log('Requested accounts:', requestedAccounts);
        } catch (err) {
          if (err.message.includes('timeout')) {
            console.log('Connection timed out, checking if connection succeeded...');
            // Check if connection actually succeeded despite timeout
            const recheckAccounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (recheckAccounts.length > 0) {
              requestedAccounts = recheckAccounts;
              console.log('Connection succeeded after timeout, using accounts:', requestedAccounts);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      } else {
        requestedAccounts = accounts;
        console.log('Using existing accounts');
      }

      if (!requestedAccounts || requestedAccounts.length === 0) {
        throw new Error('No accounts available');
      }

      console.log('Creating provider...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      console.log('Connected successfully:', {
        address,
        chainId: network.chainId,
        networkName: network.name
      });

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setChainId(Number(network.chainId));

      return true;
    } catch (err) {
      console.error('Connection error:', err);
      
      if (err.code === 4001) {
        setError('Connection was rejected. Please approve the connection in your wallet to continue.');
      } else if (err.code === -32002) {
        setError('Connection request is pending. Please check your wallet for a pending request.');
      } else if (err.message?.includes('User rejected')) {
        setError('Connection was rejected. Please try again and approve the connection.');
      } else if (err.message?.includes('No accounts')) {
        setError('No wallet accounts found. Please unlock your wallet and try again.');
      } else {
        setError(`Failed to connect wallet: ${err.message || 'Unknown error'}`);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setError('');
  }, []);

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) {
      setError('No wallet found');
      return false;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      return true;
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await addNetwork(targetChainId);
          return true;
        } catch (addError) {
          setError('Failed to add network: ' + addError.message);
          return false;
        }
      } else {
        setError('Failed to switch network: ' + switchError.message);
        return false;
      }
    }
  };

  const addNetwork = async (chainId) => {
    const networkConfigs = {
      1: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.infura.io/v3/'],
        blockExplorerUrls: ['https://etherscan.io/']
      },
      5: {
        chainId: '0x5',
        chainName: 'Goerli Testnet',
        nativeCurrency: { name: 'Goerli Ether', symbol: 'GoerliETH', decimals: 18 },
        rpcUrls: ['https://goerli.infura.io/v3/'],
        blockExplorerUrls: ['https://goerli.etherscan.io/']
      },
      11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia Testnet',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'SepoliaETH', decimals: 18 },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io/']
      },
      137: {
        chainId: '0x89',
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
      },
      42161: {
        chainId: '0xa4b1',
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io/']
      },
      10: {
        chainId: '0xa',
        chainName: 'Optimism',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.optimism.io'],
        blockExplorerUrls: ['https://optimistic.etherscan.io/']
      }
    };

    const networkConfig = networkConfigs[chainId];
    if (!networkConfig) {
      throw new Error('Unsupported network');
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    });
  };

  const getBalance = async (address = null) => {
    if (!provider) return '0';
    
    try {
      const targetAddress = address || account;
      if (!targetAddress) return '0';
      
      const balance = await provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (err) {
      console.error('Error getting balance:', err);
      return '0';
    }
  };

  const getGasPrice = async () => {
    if (!provider) return null;
    
    try {
      const gasPrice = await provider.getGasPrice();
      return gasPrice;
    } catch (err) {
      console.error('Error getting gas price:', err);
      return null;
    }
  };

  const estimateGas = async (transaction) => {
    if (!provider) return null;
    
    try {
      const gasEstimate = await provider.estimateGas(transaction);
      return gasEstimate;
    } catch (err) {
      console.error('Error estimating gas:', err);
      return null;
    }
  };

  const sendTransaction = async (transaction) => {
    if (!signer) throw new Error('No signer available');
    
    try {
      const tx = await signer.sendTransaction(transaction);
      return tx;
    } catch (err) {
      console.error('Transaction failed:', err);
      throw err;
    }
  };

  const signMessage = async (message) => {
    if (!signer) throw new Error('No signer available');
    
    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (err) {
      console.error('Message signing failed:', err);
      throw err;
    }
  };

  const isCorrectNetwork = (targetChainId) => {
    return chainId === targetChainId;
  };

  const getNetworkName = (chainId) => {
    const networks = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      31337: 'Hardhat Local',
      137: 'Polygon',
      42161: 'Arbitrum One',
      10: 'Optimism'
    };
    return networks[chainId] || `Chain ID ${chainId}`;
  };

  const getBlockNumber = async () => {
    if (!provider) return null;
    
    try {
      const blockNumber = await provider.getBlockNumber();
      return blockNumber;
    } catch (err) {
      console.error('Error getting block number:', err);
      return null;
    }
  };

  const waitForTransaction = async (txHash, confirmations = 1) => {
    if (!provider) throw new Error('No provider available');
    
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (err) {
      console.error('Error waiting for transaction:', err);
      throw err;
    }
  };

  return {
    // State
    account,
    provider,
    signer,
    chainId,
    loading,
    error,
    
    // Connection methods
    connect,
    disconnect,
    checkConnection,
    
    // Network methods
    switchNetwork,
    addNetwork,
    isCorrectNetwork,
    getNetworkName,
    
    // Utility methods
    getBalance,
    getGasPrice,
    estimateGas,
    sendTransaction,
    signMessage,
    getBlockNumber,
    waitForTransaction,
    
    // Computed values
    isConnected: !!account,
    isWalletInstalled: typeof window.ethereum !== 'undefined'
  };
};

export default useWeb3;
