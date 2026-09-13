#!/usr/bin/env bash
set -euo pipefail

# Sincronizza il database verso la destinazione: uno specchio esatto,
# collection per collection (ogni collection di destinazione viene svuotata
# e reinserita da zero). Va bene per un ambiente di test/demo che deve
# rispecchiare sempre questo — MAI verso un DB con dati propri da preservare
# (utenti/acquisti nati lì), che verrebbero cancellati.
#
# Usa scripts/db-dump.mjs / scripts/db-restore.mjs (driver "mongodb" via
# Node, niente binari esterni tipo mongodump/mongorestore — utile quando non
# sono installabili nell'ambiente di destinazione).
#
# Modalità "direct" — l'URI di destinazione è raggiungibile direttamente da
# qui (es. un MongoDB esposto in rete, o Atlas):
#   scripts/export-db.sh direct "mongodb://utente:password@host-remoto:27017/artaround_dev"
#
# Modalità "ssh" — il DB di destinazione è raggiungibile solo dall'host
# remoto stesso (il restore va eseguito lì via SSH; richiede Node.js e
# "npm i" già fatto in quella copia, per avere il driver "mongodb"/"bson"):
#   scripts/export-db.sh ssh utente@host-remoto "mongodb://localhost:27017/artaround_dev" /percorso/progetto/remoto

mode="${1:?Modalità richiesta: direct|ssh}"
target="${2:?Destinazione richiesta}"
source_uri="${MONGODB_URI:-mongodb://localhost:27017/artaround_dev}"

root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
cd "$root"

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

node scripts/db-dump.mjs --uri="$source_uri" --out="dump"

case "$mode" in
  direct)
    # In questa modalità $target È l'URI di destinazione (raggiungibile da qui).
    #node scripts/db-restore.mjs --uri="$target" --in="$staging/dump"
    ;;
  ssh)
    # Qui $target è l'host SSH; l'URI (com'è visto DA quell'host, tipicamente
    # mongodb://localhost:...) e la cartella del progetto remoto sono
    # argomenti separati, entrambi obbligatori — nessun default silenzioso
    # che potrebbe altrimenti puntare per sbaglio al DB sbagliato.
    dest_uri="${3:?In modalità ssh serve l'URI di destinazione (com'è visto dall'host remoto)}"
    remote_project_dir="${4:?In modalità ssh serve il percorso del progetto sull'host remoto}"
    rsync -avz "$staging"/dump/ "$target":"$remote_project_dir"/db-dump-incoming/
    ssh "$target" "cd '$remote_project_dir' && node scripts/db-restore.mjs --uri='$dest_uri' --in=./db-dump-incoming && rm -rf ./db-dump-incoming"
    ;;
  *)
    echo "Modalità sconosciuta: $mode (usa direct|ssh)" >&2
    exit 1
    ;;
esac

echo "Sync DB completato verso $target ($mode)"
