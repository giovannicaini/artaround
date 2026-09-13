#!/usr/bin/env bash
set -euo pipefail

# Esporta il progetto via rsync/ssh verso una delle due destinazioni.
# La base è sempre un "git archive" (solo file tracciati, rispetta
# .gitattributes export-ignore) copiato in una directory temporanea, mai
# il working tree diretto — così node_modules/dist/.turbo/.env/uploads/
# locali (già in .gitignore) non finiscono mai nell'export per sbaglio.
#
# Modalità:
#   sources  solo i sorgenti — per una condivisione "pulita" del codice.
#   deploy   sorgenti + uploads/ + un file .env, pronto per un
#            "npm i && npm run build" sulla destinazione.
#
# Uso:
#   scripts/export-project.sh sources user@host:/percorso/sources
#   scripts/export-project.sh deploy  user@host:/percorso/deploy [.env.production]
#
# In modalità "deploy", uploads/ e .env sulla destinazione vengono solo
# aggiunti/aggiornati, MAI cancellati in base a --delete: se lì sono già
# cresciuti file che qui in locale non ci sono (es. upload reali fatti da
# utenti sull'ambiente di destinazione), restano intatti. Il resto
# dell'albero (il codice) invece si allinea esattamente a questo repo,
# rimuovendo sulla destinazione ciò che qui non esiste più.

mode="${1:?Modalità richiesta: sources|deploy}"
dest="${2:?Destinazione richiesta, es. user@host:/percorso}"
env_file="${3:-.env.production}"

root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
cd "$root"

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

git archive --worktree-attributes HEAD | tar -x -C "$staging"

case "$mode" in
  sources)
    rsync -avz --delete "$staging"/ "$dest"/
    ;;
  deploy)
    if [ ! -f "$env_file" ]; then
      echo "File env non trovato: $env_file" >&2
      exit 1
    fi
    rsync -avz \
      --exclude '/uploads/' \
      --exclude '/.env' \
      "$staging"/ "$dest"/
    rsync -avz "$root"/uploads/ "$dest"/uploads/
    rsync -avz "$env_file" "$dest"/.env
    ;;
  *)
    echo "Modalità sconosciuta: $mode (usa sources|deploy)" >&2
    exit 1
    ;;
esac

echo "Export '$mode' completato su $dest"
