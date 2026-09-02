import mongoose from 'mongoose';
import { config } from './config.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log(`Connesso a MongoDB: ${config.mongodb.uri}`);
  } catch (error) {
    console.error('Errore nella connessione a MongoDB:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Connessione a MongoDB chiusa');
  process.exit(0);
});
