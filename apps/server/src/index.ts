import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config.js';
import { connectDB } from './config/database.js';
import { User } from './models/index.js';
import { errorHandler } from './middleware/index.js';
import routes from './routes/index.js';
import { swaggerSpec } from './config/swagger.js';
import { UploadService } from './utils/upload.service.js';
import { reconcileOnStartup } from './utils/jobs.service.js';

// Equivalente ESM di __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Middleware
app.use(
  helmet({
    // CSP disattivata: la pagina carica immagini da origini esterne (Wikimedia Commons,
    // tile OpenStreetMap per la mappa Leaflet) e Swagger UI usa stili/script inline.
    // Una policy su misura per queste esigenze è un miglioramento futuro, non un requisito.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
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

// Rotte API (definite nei file in server/src/routes)
app.use('/api', routes);

// Homepage generale di ArtAround
const landingPagePath = path.resolve(__dirname, '../../../index.html');
app.get('/', (req, res) => {
  res.sendFile(landingPagePath);
});

// Serve le immagini caricate (file statici)
const uploadsPath = UploadService.getUploadsDir();
app.use(
  '/uploads',
  express.static(uploadsPath, {
    maxAge: '7d',
    immutable: true,
  }),
);

// Serve i file statici del marketplace
const marketplacePath = path.resolve(__dirname, '../../marketplace/dist');
app.use('/marketplace', express.static(marketplacePath));

// Fallback SPA - serve index.html per tutte le rotte /marketplace
app.get('/marketplace/*', (req, res) => {
  res.sendFile(path.join(marketplacePath, 'index.html'));
});

// Serve i file statici del navigator
const navigatorPath = path.resolve(__dirname, '../../navigator/dist');
app.use('/navigator', express.static(navigatorPath));

// Fallback SPA - serve index.html per tutte le rotte /navigator
app.get('/navigator/*', (req, res) => {
  res.sendFile(path.join(navigatorPath, 'index.html'));
});

// Gestione errori
app.use(errorHandler);

// Avvia il server
const startServer = async () => {
  try {
    // Connetti a MongoDB
    await connectDB();

    // Chiude come falliti eventuali Job rimasti "running" da prima di questo
    // boot (es. un deploy a metà di una generazione audio) — vedi jobs.service.
    await reconcileOnStartup();

    // Seed di avvio opzionale
    if (config.seed.onStart) {
      const usersCount = await User.countDocuments();
      const shouldSeed = !config.seed.onlyIfEmpty || usersCount === 0;

      if (shouldSeed) {
        console.log('🌱 Startup seed enabled: running seed...');
        const { seedDatabase } = await import('./scripts/seed.js');
        await seedDatabase({ connect: false, exitOnComplete: false });
      } else {
        console.log('🌱 Startup seed enabled, skipped because database is not empty.');
      }
    }

    // Inizia ad ascoltare
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
