require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const logger = require('./logger');

const app = express();
app.use(express.json());

// log every incoming request
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Load environment variables
const { PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS } = process.env;

// Load contract ABI
const abi = JSON.parse(fs.readFileSync('./abi.json', 'utf8'));

// Set up provider and wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Create contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

// API endpoint to verify a user
app.post('/verify', async (req, res) => {
  const { userAddress } = req.body;

  if (!ethers.utils.isAddress(userAddress)) {
    logger.warn(`Invalid address attempt: ${userAddress}`);
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    const tx = await contract.verifyUser(userAddress);
    await tx.wait();
    logger.info(`User verified: ${userAddress}, txHash: ${tx.hash}`);
    res.json({ message: 'User verified successfully', transactionHash: tx.hash });
  } catch (error) {
    logger.error(`Error verifying user: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`GhostPass backend server is running on port ${PORT}`);
});
