require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const logger = require('./logger');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// log every incoming request
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Load environment variables
const { PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS } = process.env;

// Validate environment variables
if (!PRIVATE_KEY || !RPC_URL || !CONTRACT_ADDRESS) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

// Load contract ABI - extract just the ABI array from the artifact
let abi;
try {
  const contractArtifact = JSON.parse(fs.readFileSync('./abi.json', 'utf8'));
  abi = contractArtifact.abi; // Extract the ABI array
  logger.info(`ABI loaded successfully with ${abi.length} items`);
} catch (error) {
  logger.error(`Failed to load ABI: ${error.message}`);
  process.exit(1);
}

// Set up provider and wallet (updated for ethers v6)
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Create contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

// Verify contract deployment on startup
async function verifyContractDeployment() {
  try {
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === '0x') {
      logger.error('No contract found at the specified address');
      process.exit(1);
    }
    logger.info('Contract verified at address:', CONTRACT_ADDRESS);
    
    // Test if we can call a view function
    const owner = await contract.owner();
    logger.info('Contract owner:', owner);
  } catch (error) {
    logger.error('Contract verification failed:', error.message);
  }
}

// API endpoint to verify a user - FIXED the route path
app.post('/verify', async (req, res) => {
  const { walletAddress } = req.body;

  if (!ethers.isAddress(walletAddress)) {
    logger.warn(`Invalid address attempt: ${walletAddress}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    // For batch verification, pass as array
    const tx = await contract.verifyUser([walletAddress]);
    await tx.wait();
    logger.info(`User verified: ${walletAddress}, txHash: ${tx.hash}`);
    res.json({ message: 'User verified successfully', transactionHash: tx.hash });
  } catch (error) {
    logger.error(`Error verifying user: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// API endpoint to check if a user is verified - ENHANCED with better error handling
app.get('/verify/:address', async (req, res) => {
  const { address } = req.params;

  if (!ethers.isAddress(address)) {
    logger.warn(`Invalid address check attempt: ${address}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    logger.info(`Checking verification status for: ${address}`);
    
    // Add timeout and better error handling
    const isVerified = await Promise.race([
      contract.isVerified(address),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Contract call timeout')), 10000)
      )
    ]);
    
    logger.info(`Verification status for ${address}: ${isVerified}`);
    res.json({ address, isVerified });
  } catch (error) {
    logger.error(`Error checking verification status for ${address}: ${error.message}`);
    
    // More detailed error response
    let errorMessage = 'Failed to check verification status';
    if (error.message.includes('could not decode result data')) {
      errorMessage = 'Contract function call failed - possibly wrong contract address or ABI mismatch';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Contract call timed out';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// API endpoint to revoke verification
app.post('/revoke', async (req, res) => {
  const { userAddress } = req.body;

  if (!ethers.isAddress(userAddress)) {
    logger.warn(`Invalid address revoke attempt: ${userAddress}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    // For batch revocation, pass as array
    const tx = await contract.revokeVerification([userAddress]);
    await tx.wait();
    logger.info(`User verification revoked: ${userAddress}, txHash: ${tx.hash}`);
    res.json({ message: 'User verification revoked successfully', transactionHash: tx.hash });
  } catch (error) {
    logger.error(`Error revoking user verification: ${error.message}`);
    res.status(500).json({ error: 'Failed to revoke user verification' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  logger.info(`GhostPass backend server is running on port ${PORT}`);
  // await verifyContractDeployment();
});