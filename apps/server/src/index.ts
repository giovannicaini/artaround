import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config.js';
import { connectDB } from './config/database.js';
import { errorHandler } from './middleware/index.js';
import routes from './routes/index.js';
import { swaggerSpec } from './config/swagger.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Middleware
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger UI
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ArtAround API Documentation',
  }),
);

// Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api', routes);

// Serve marketplace static files
const marketplacePath = path.resolve(__dirname, '../../marketplace/dist');
app.use('/marketplace', express.static(marketplacePath));

// SPA fallback - serve index.html for all /marketplace routes
app.get('/marketplace/*', (req, res) => {
  res.sendFile(path.join(marketplacePath, 'index.html'));
});

// Serve navigator static files
const navigatorPath = path.resolve(__dirname, '../../navigator/dist');
app.use('/navigator', express.static(navigatorPath));

// SPA fallback - serve index.html for all /navigator routes
app.get('/navigator/*', (req, res) => {
  res.sendFile(path.join(navigatorPath, 'index.html'));
});

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start listening
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📝 Environment: ${config.env}`);
      console.log(`🌐 API: http://localhost:${config.port}/api`);
      console.log(`📚 API Docs: http://localhost:${config.port}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
