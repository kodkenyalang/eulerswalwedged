const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const poolsRouter = require('./routes/pools');
const hedgingRouter = require('./routes/hedging');
const vaultsRouter = require('./routes/vaults');
const evcRouter = require('./routes/evc');

// Import services
const HedgingService = require('./services/hedgingService');
const RiskAnalyzer = require('./services/riskAnalyzer');
const EulerSwapService = require('./services/eulerSwapService');
const EulerVaultService = require('./services/eulerVaultService');
const EVCService = require('./services/evcService');

// Initialize services
const hedgingService = new HedgingService();
const riskAnalyzer = new RiskAnalyzer();
const eulerSwapService = new EulerSwapService();
const eulerVaultService = new EulerVaultService();
const evcService = new EVCService();

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'http://localhost:5000']
    : ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/pools', poolsRouter);
app.use('/api/hedging', hedgingRouter);
app.use('/api/vaults', vaultsRouter);
app.use('/api/evc', evcRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Wedged Protocol API Server',
    version: '1.0.0',
    description: 'Risk-managed liquidity hedging pools integrated with EulerSwap protocol',
    endpoints: {
      health: '/health',
      pools: '/api/pools',
      hedging: '/api/hedging'
    },
    documentation: process.env.API_DOCS_URL || 'https://docs.wedged.protocol'
  });
});

// WebSocket endpoint for real-time updates
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'http://localhost:5000']
      : ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST']
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Subscribe to pool updates
  socket.on('subscribe-pool', (poolId) => {
    socket.join(`pool-${poolId}`);
    console.log(`Client ${socket.id} subscribed to pool ${poolId}`);
  });

  // Unsubscribe from pool updates
  socket.on('unsubscribe-pool', (poolId) => {
    socket.leave(`pool-${poolId}`);
    console.log(`Client ${socket.id} unsubscribed from pool ${poolId}`);
  });

  // Subscribe to portfolio updates
  socket.on('subscribe-portfolio', (userAddress) => {
    socket.join(`portfolio-${userAddress}`);
    console.log(`Client ${socket.id} subscribed to portfolio ${userAddress}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Real-time data broadcasting
const broadcastPoolUpdate = (poolId, data) => {
  io.to(`pool-${poolId}`).emit('pool-update', data);
};

const broadcastPortfolioUpdate = (userAddress, data) => {
  io.to(`portfolio-${userAddress}`).emit('portfolio-update', data);
};

// Periodic updates
const startPeriodicUpdates = () => {
  // Update pool data every 30 seconds
  setInterval(async () => {
    try {
      // This would typically fetch and broadcast updated pool data
      console.log('Broadcasting periodic pool updates...');
    } catch (error) {
      console.error('Error in periodic updates:', error);
    }
  }, 30000);

  // Update risk metrics every 60 seconds
  setInterval(async () => {
    try {
      console.log('Updating risk metrics...');
      // Risk metrics update logic would go here
    } catch (error) {
      console.error('Error updating risk metrics:', error);
    }
  }, 60000);
};

// Error handling middleware
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  
  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    console.log('Initializing services...');
    
    // Initialize blockchain connection
    await hedgingService.initialize();
    await riskAnalyzer.initialize();
    await eulerSwapService.initialize();
    await eulerVaultService.initialize();
    await evcService.initialize();
    
    console.log('All services initialized successfully');
    
    // Start periodic updates
    startPeriodicUpdates();
    
    console.log('Periodic updates started');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections, cleanup resources
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Wedged Protocol API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  await initializeServices();
});

// Export for testing
module.exports = { app, io, broadcastPoolUpdate, broadcastPortfolioUpdate };
