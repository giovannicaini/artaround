/**
 * Startup shim per Phusion Passenger (Plesk).
 *
 * Il pannello Node.js di Plesk è configurato con "Application Root" =
 * questa cartella e "Application Startup File" = app.js (il default di
 * Plesk). Il vero entry point del progetto è però apps/server/dist/index.js
 * (compilato da apps/server/src/index.ts via tsc). Questo file esiste solo
 * per soddisfare quel percorso: importa ed esegue il server reale.
 *
 * apps/server è un package ESM ("type": "module" nel suo package.json),
 * mentre questo file gira come CommonJS (nessun "type" nel package.json di
 * root) — l'import() dinamico funziona comunque da un contesto CJS ed è
 * l'unico modo per caricare un modulo ESM da qui senza rinominare l'intero
 * progetto.
 */
import('./apps/server/dist/index.js');
