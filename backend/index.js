require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const logger = require('./logger');
const cors = require('cors');
app.use(cors());

const app = express();
app.use(express.json());

// log every incoming request
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Load environment variables
const { PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS } = process.env;

// Load contract ABI - extract just the ABI array from the artifact
const contractArtifact = JSON.parse(fs.readFileSync('./abi.json', 'utf8'));
const abi = contractArtifact.abi; // Extract the ABI array

// Set up provider and wallet (updated for ethers v6)
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Create contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

// API endpoint to verify a user
app.post('/verify', async (req, res) => {
  const { userAddress } = req.body;

  if (!ethers.isAddress(userAddress)) { // Updated for ethers v6
    logger.warn(`Invalid address attempt: ${userAddress}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    // For batch verification, pass as array
    const tx = await contract.verifyUser([userAddress]);
    await tx.wait();
    logger.info(`User verified: ${userAddress}, txHash: ${tx.hash}`);
    res.json({ message: 'User verified successfully', transactionHash: tx.hash });
  } catch (error) {
    logger.error(`Error verifying user: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// API endpoint to check if a user is verified
app.get('/verify/:address', async (req, res) => {
  const { address } = req.params;

  if (!ethers.isAddress(address)) {
    logger.warn(`Invalid address check attempt: ${address}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    const isVerified = await contract.isVerified(address);
    logger.info(`Verification status checked for: ${address}, status: ${isVerified}`);
    res.json({ address, isVerified });
  } catch (error) {
    logger.error(`Error checking verification status: ${error.message}`);
    res.status(500).json({ error: 'Failed to check verification status' });
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
app.listen(PORT, () => {
  logger.info(`GhostPass backend server is running on port ${PORT}`);
});