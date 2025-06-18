# Wedged Platform

A sophisticated DeFi platform leveraging advanced liquidity hedging mechanisms with EulerSwap protocol integration and Ethereum Vault Connector (EVC) for cross-vault position management.

## Features

### Core Functionality
- **Risk-Managed Liquidity Pools**: Advanced hedging mechanisms to protect against impermanent loss
- **EulerSwap Integration**: Seamless DEX operations with automated market making
- **Euler Vault Kit**: Complete vault management system for yield generation
- **Cross-Vault Positions**: Leverage collateral across multiple vaults using EVC
- **Real-time Risk Analytics**: Comprehensive risk assessment and monitoring

### Key Components
- **Frontend**: React.js application with responsive design
- **Backend**: Express.js API server with WebSocket support
- **Smart Contracts**: Solidity contracts for EVC integration and risk management
- **Risk Engine**: Advanced algorithms for volatility and correlation analysis

## Architecture

```
├── src/                    # React frontend application
│   ├── components/         # UI components
│   ├── services/          # API and blockchain services
│   ├── hooks/             # React hooks
│   └── utils/             # Utility functions
├── server/                # Express.js backend
│   ├── routes/            # API endpoints
│   └── services/          # Backend services
├── contracts/             # Smart contracts
└── scripts/               # Deployment scripts
```

## Technology Stack

- **Frontend**: React 19, Chart.js, Ethers.js
- **Backend**: Node.js, Express.js, Socket.IO
- **Blockchain**: Ethereum, Hardhat, Solidity
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- Ethereum testnet access (Sepolia recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/wedged-platform.git
cd wedged-platform
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:5000`

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Network Configuration
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
CHAIN_ID=11155111

# Contract Addresses
EVC_ADDRESS=0x0000000000000000000000000000000000000000
EVC_INTEGRATION_ADDRESS=0x0000000000000000000000000000000000000000
WEDGED_POOL_ADDRESS=0x0000000000000000000000000000000000000000

# API Configuration
PORT=8000
NODE_ENV=development

# Security
JWT_SECRET=your-jwt-secret-here
```

## Smart Contract Deployment

1. Compile contracts:
```bash
npx hardhat compile
```

2. Deploy to testnet:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. Update contract addresses in `.env`

## API Endpoints

### Pools
- `GET /api/pools` - Get all liquidity pools
- `GET /api/pools/:id` - Get specific pool information
- `POST /api/pools/:id/deposit` - Deposit to pool
- `POST /api/pools/:id/withdraw` - Withdraw from pool

### Vaults
- `GET /api/vaults` - Get all Euler vaults
- `GET /api/vaults/:address` - Get vault information
- `GET /api/vaults/user/:address` - Get user vault positions

### Cross-Vault (EVC)
- `GET /api/evc/positions/:user` - Get user cross-vault positions
- `GET /api/evc/health/:user/:position` - Get position health
- `GET /api/evc/bridges` - Get liquidity bridges

### Risk Analytics
- `GET /api/hedging/risk/:poolId` - Get pool risk metrics
- `GET /api/hedging/recommendations/:poolId` - Get hedging recommendations

## Frontend Components

### Main Dashboard
- Pool overview with real-time metrics
- Portfolio management interface
- Risk analytics visualization

### Vault Management
- Euler vault integration
- Deposit/withdraw functionality
- Yield tracking

### Cross-Vault Positions
- Leveraged position creation
- Collateral management
- Health factor monitoring

## Smart Contracts

### Core Contracts
- `WedgedPool.sol` - Main liquidity pool contract
- `HedgingManager.sol` - Risk management and hedging logic
- `EVCIntegration.sol` - Ethereum Vault Connector integration
- `EulerVaultManager.sol` - Euler vault operations

### Security Features
- Reentrancy protection
- Access control mechanisms
- Emergency pause functionality
- Comprehensive event logging

## Risk Management

### Risk Metrics
- **Impermanent Loss**: Real-time calculation and hedging
- **Volatility Analysis**: Historical and implied volatility
- **Correlation Risk**: Token pair correlation monitoring
- **Liquidity Risk**: Pool depth and slippage analysis

### Hedging Strategies
- Dynamic hedging based on risk thresholds
- Automated position rebalancing
- Cross-vault arbitrage opportunities

## Development

### Running Tests
```bash
npm test
```

### Code Style
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## WebSocket Events

### Real-time Updates
- Pool metrics updates
- Risk analytics changes
- Position health notifications
- Market condition alerts

## Security Considerations

- All smart contracts audited for common vulnerabilities
- Rate limiting on API endpoints
- CORS configuration for production
- Secure header implementation
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the GitHub repository
- Join our Discord community
- Review the documentation wiki

## Acknowledgments

- Euler Finance for the Vault Kit and EVC protocols
- OpenZeppelin for security libraries
- The Ethereum community for development tools