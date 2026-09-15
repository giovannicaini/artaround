/*
 * File: /src/config/swagger.ts                                                          *
 * Project: @artaround/server                                                            *
 * Last Modified: 08/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

/**
 * Configura swagger-jsdoc: legge i blocchi @swagger da routes/*.ts e genera lo spec OpenAPI servito su /api-docs.
 */
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

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
      Ogni utente ha un ruolo globale (\`isAdmin\`: true/false) più, opzionalmente,
      ruoli specifici su singoli musei (\`museumRoles\`):
      - Utente semplice: può acquistare e fruire visite/contenuti nel marketplace
      - **author**: può creare item e visite per il museo su cui ha questo ruolo
      - **curator**: può gestire un museo (piantine, sale, curatori, lingue...)
      - **isAdmin**: accesso completo al sistema, su tutti i musei
    `,
    contact: {
      name: 'Giovanni Caini',
      email: 'giovanni.caini@studio.unibo.it',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `https://site2519.tw.cs.unibo.it`,
      description: 'Server di produzione',
    },
    {
      url: `http://localhost:${config.port}`,
      description: 'Server di sviluppo',
    },
    {
      url: 'https://artaround.giovannicaini.it',
      description: 'Server di sviluppo',
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
          isAdmin: {
            type: 'boolean',
            description: 'Ruolo globale di amministratore',
            example: false,
          },
          isActive: { type: 'boolean', example: true },
          creditBalance: { type: 'number', example: 12.5 },
          lastLogin: { type: 'string', format: 'date-time' },
          museumRoles: {
            type: 'array',
            description:
              'Ruoli assegnati su singoli musei (curatore/autore) — diversi dal ruolo globale isAdmin',
            items: {
              type: 'object',
              properties: {
                museumId: { type: 'string' },
                role: { type: 'string', enum: ['curator', 'author'], example: 'curator' },
                assignedAt: { type: 'string', format: 'date-time' },
                assignedBy: { type: 'string' },
              },
            },
          },
          preferences: {
            type: 'object',
            properties: {
              competenceLevel: {
                type: 'string',
                enum: ['infantile', 'semplice', 'medio', 'avanzato'],
                example: 'medio',
              },
              availableTime: {
                type: 'string',
                enum: ['veloce', 'normale', 'approfondito'],
                example: 'normale',
              },
              age: { type: 'number' },
              language: { type: 'string', example: 'it' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Museum: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'ObjectId MongoDB' },
          wikidataId: {
            type: 'string',
            description:
              'Q number Wikidata — chiave primaria del museo, usata anche come museumId su opere/item/visite',
            example: 'Q841506',
          },
          name: { type: 'string', example: 'Galleria Borghese' },
          description: { type: 'string' },
          nameTranslations: { type: 'object', additionalProperties: { type: 'string' } },
          descriptionTranslations: { type: 'object', additionalProperties: { type: 'string' } },
          activeLanguages: {
            type: 'array',
            items: { type: 'string', example: 'it' },
            description: 'Sottoinsieme delle lingue app in cui questo museo va tradotto',
          },
          location: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
              nation: { type: 'string' },
              postalCode: { type: 'string' },
              coordinates: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
              },
            },
          },
          images: {
            type: 'array',
            items: { type: 'string' },
            description: 'Foto importate da Wikidata',
          },
          coverImage: { type: 'string', description: 'Foto scelta esplicitamente dal curatore' },
          floors: { type: 'array', items: { type: 'object' }, description: 'Piantine del museo' },
          rooms: { type: 'array', items: { type: 'object' }, description: 'Sale del museo' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Item: {
        type: 'object',
        description:
          "Contenuto riusabile (testo/audio) su un'opera, autore, movimento, periodo o museo",
        properties: {
          _id: { type: 'string' },
          museumId: { type: 'string' },
          referenceType: {
            type: 'string',
            enum: ['artwork', 'author', 'movement', 'period', 'museum'],
            description: 'A cosa si riferisce questo item',
          },
          referenceId: {
            type: 'string',
            description: "ID Wikidata dell'entità referenziata",
            example: 'Q123456',
          },
          referenceTitle: { type: 'string' },
          sourceLanguage: { type: 'string', example: 'it' },
          title: { type: 'string' },
          text: { type: 'string' },
          translatedTitles: { type: 'object', additionalProperties: { type: 'string' } },
          translatedTexts: { type: 'object', additionalProperties: { type: 'string' } },
          audio: {
            type: 'object',
            description: 'Audio generato (OpenAI) per lingua, con i tempi delle singole parole',
            additionalProperties: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                words: { type: 'array', items: { type: 'object' } },
                source: { type: 'string', enum: ['ai', 'manual'] },
              },
            },
          },
          duration: { type: 'string', enum: ['3s', '15s', '1min', '4min'] },
          languageLevel: {
            type: 'string',
            enum: ['infantile', 'elementare', 'medio', 'specialistico'],
          },
          authorId: { type: 'string' },
          authorName: { type: 'string' },
          license: {
            type: 'string',
            enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA', 'proprietary'],
          },
          price: { type: 'number', description: '0 per gratis' },
          isFree: { type: 'boolean' },
          image: { type: 'string' },
          usageCount: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Visit: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          museumId: { type: 'string', description: 'ID Wikidata del museo' },
          authorId: { type: 'string' },
          authorName: { type: 'string' },
          title: { type: 'string', example: 'Galleria Borghese — Visita per famiglie' },
          description: { type: 'string' },
          titleTranslations: { type: 'object', additionalProperties: { type: 'string' } },
          descriptionTranslations: { type: 'object', additionalProperties: { type: 'string' } },
          coverImage: { type: 'string' },
          steps: {
            type: 'array',
            description:
              'Sequenza ordinata di tappe (opera, logistica, indicazioni, approfondimento, svolta)',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                order: { type: 'number' },
                type: {
                  type: 'string',
                  enum: ['artwork', 'logistic', 'navigation', 'waypoint', 'content'],
                },
                artworkId: { type: 'string' },
                itemIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          generalInfo: { type: 'object' },
          targetAudience: {
            type: 'object',
            properties: {
              minAge: { type: 'number' },
              maxAge: { type: 'number' },
              languageLevels: { type: 'array', items: { type: 'string' } },
              interests: { type: 'array', items: { type: 'string' } },
              estimatedDuration: { type: 'number', description: 'Minuti' },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              supportedLanguages: { type: 'array', items: { type: 'string' } },
              artworksCount: { type: 'number' },
              totalItemsCount: { type: 'number' },
              estimatedDuration: { type: 'number', description: 'Minuti' },
              price: { type: 'number', description: '0 per gratis' },
              isFree: { type: 'boolean' },
              license: { type: 'string' },
              downloadsCount: { type: 'number' },
            },
          },
          isPublished: { type: 'boolean' },
          publishedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
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
              message: { type: 'string', example: 'Dati non validi' },
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
    {
      name: 'Jobs',
      description: 'Processi lunghi in background (generazione audio, traduzioni)',
    },
    {
      name: 'Notifications',
      description: 'Notifiche in-app (richieste di ruolo museo)',
    },
    {
      name: 'Backups',
      description: 'Snapshot di database + uploads, solo admin',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [path.join(moduleDir, '../../src/routes/*.ts')],
};

export const swaggerSpec = swaggerJsdoc(options);
