import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config.js';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ArtAround API',
    version: '1.0.0',
    description: `
      API REST per ArtAround - L'unica audioguida pensata per te.
      
      Sistema completo per la creazione e fruizione di visite museali personalizzate.
      
      ## Autenticazione
      La maggior parte degli endpoint richiede autenticazione JWT.
      Includi il token nell'header: \`Authorization: Bearer <token>\`
      
      ## Ruoli
      - **VISITOR**: Può acquistare e fruire visite
      - **AUTHOR**: Può creare items e visite
      - **ADMIN**: Accesso completo al sistema
    `,
    contact: {
      name: 'ArtAround Support',
      email: 'giovanni.caini@studio.unibo.it',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: 'Development server',
    },
    {
      url: 'https://artaround.giovannicaini.it',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token ricevuto dal login',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          username: { type: 'string', example: 'autore1' },
          email: { type: 'string', format: 'email', example: 'autore1@artaround.com' },
          role: { type: 'string', enum: ['VISITOR', 'AUTHOR', 'ADMIN'], example: 'AUTHOR' },
          preferences: {
            type: 'object',
            properties: {
              language: { type: 'string', example: 'it' },
              targetAudience: {
                type: 'string',
                enum: ['CHILDREN', 'FAMILIES', 'ADULTS', 'EXPERTS'],
              },
              difficulty: {
                type: 'string',
                enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Museum: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Museo Archeologico Nazionale' },
          description: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              coordinates: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
              },
            },
          },
          configFile: { type: 'object', description: 'Configurazione museo in formato JSON' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Item: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          museumId: { type: 'string' },
          objectId: { type: 'string', example: 'Q123456' },
          contents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                targetAudience: {
                  type: 'string',
                  enum: ['CHILDREN', 'FAMILIES', 'ADULTS', 'EXPERTS'],
                },
                difficulty: {
                  type: 'string',
                  enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
                },
                title: { type: 'string' },
                description: { type: 'string' },
                audioUrl: { type: 'string' },
              },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              author: { type: 'string' },
              period: { type: 'string' },
              technique: { type: 'string' },
              dimensions: { type: 'string' },
            },
          },
          image: { type: 'string', description: 'Base64 o URL immagine' },
          authorId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Visit: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          museumId: { type: 'string' },
          title: { type: 'string', example: 'Visita per Famiglie' },
          description: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                itemId: { type: 'string' },
                order: { type: 'number' },
              },
            },
          },
          targetAudience: { type: 'string', enum: ['CHILDREN', 'FAMILIES', 'ADULTS', 'EXPERTS'] },
          difficulty: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] },
          estimatedDuration: { type: 'number', description: 'Minuti' },
          price: { type: 'number', description: 'Prezzo in euro' },
          isPublished: { type: 'boolean' },
          authorId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      APIResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input data' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Token mancante o non valido',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Token non valido o scaduto',
              },
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Permessi insufficienti',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Non hai i permessi per questa operazione',
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Risorsa non trovata',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Risorsa non trovata',
              },
            },
          },
        },
      },
      ValidationError: {
        description: 'Errore di validazione',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Dati non validi',
                details: [
                  {
                    field: 'email',
                    message: 'Email non valida',
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Auth',
      description: 'Autenticazione e gestione utenti',
    },
    {
      name: 'Museums',
      description: 'Gestione musei',
    },
    {
      name: 'Items',
      description: "Gestione opere d'arte e contenuti",
    },
    {
      name: 'Visits',
      description: 'Gestione visite museali',
    },
    {
      name: 'Marketplace',
      description: 'Marketplace visite e acquisti',
    },
    {
      name: 'Utils',
      description: 'Utilità (traduzioni, Wikidata)',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts'], // Path ai file con le annotazioni JSDoc
};

export const swaggerSpec = swaggerJsdoc(options);
