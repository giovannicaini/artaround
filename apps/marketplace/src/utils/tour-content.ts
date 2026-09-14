import type { User } from '@artaround/shared';
import type { TourSlide } from '../components/ui/ui-tour';
import { __ } from '../services/i18n.service';
import { isContentCreator } from '../services/permissions.service';
import type { TourId } from '../services/preferences.service';
import dashboardScreenshot from '../assets/tour/dashboard.png';
import headerScreenshot from '../assets/tour/header.png';
import marketplaceScreenshot from '../assets/tour/marketplace.png';
import navigatorScreenshot from '../assets/tour/navigator.png';

/**
 * Contenuto (slide) di ognuno dei tour per area mostrati nel Marketplace.
 */

export type { TourId };

// Tour di benvenuto: l'unico visto da chiunque, mostrato una sola volta dopo// il primo login/registrazione
function getWelcomeTourSlides(user?: User | null): TourSlide[] {
  const slides: TourSlide[] = [
    {
      icon: 'sparkles',
      title: __('Benvenuto sul Marketplace di ArtAround'),
      description: __(
        'Se sei qui, il tuo scopo è trovare una visita museale adatta ai tuoi gusti, acquistarla e viverla poi nel Navigator, davanti alle opere dal vivo.',
      ),
    },
    {
      icon: 'location',
      title: __('Un museo alla volta'),
      description: __(
        'Dalla Dashboard scegli il museo che ti interessa: da lì in poi tutto quello che vedi — visite, prezzi, descrizioni — riguarda solo il museo scelto. Cambi idea a metà pomeriggio? Lo ricambi da lì in un click.',
      ),
      image: dashboardScreenshot,
    },
    {
      icon: 'euro',
      title: __('Il credito: la tua valuta immaginaria'),
      description: __(
        'Niente pagamenti continui: ricarichi un borsellino virtuale sul tuo profilo e puoi usare il credito per tutti i contenuti che ti interessano. Zero rischi, tutta la libertà di scegliere.',
      ),
      image: headerScreenshot,
    },
    {
      icon: 'check',
      title: __('Marketplace: la vetrina delle visite'),
      description: __(
        'Qui trovi tutte le visite pubblicate, a pagamento o gratuite, e tutto il necessario per sapere cosa stai per acquistare — autore, durata, livello. La acquisti e la ritrovi per sempre in "Acquisti".',
      ),
      image: marketplaceScreenshot,
    },
    {
      icon: 'visit',
      title: __('Il Navigator: dove succede la magia'),
      description: __(
        "Le visite che acquisti qui prendono vita nel Navigator, l'app che apri con lo smartphone dentro il museo: ti guida opera per opera, con audio e testi su misura. Questo è solo il negozio — il Navigator è il viaggio.",
      ),
      image: navigatorScreenshot,
    },
    {
      icon: 'info',
      title: __('Tre scorciatoie da tenere a mente'),
      description: __(
        "I bottoni ← → in alto funzionano come indietro/avanti del browser da ovunque tu sia; l'icona info accanto ai titoli spiega cosa stai guardando; dal cerchio con la tua iniziale cambi tema, lingua e accessibilità.",
      ),
    },
  ];

  slides.push(
    isContentCreator(user ?? null)
      ? {
          icon: 'sparkles',
          title: __("Ah, e un'ultima cosa"),
          description: __(
            'Visto che crei già contenuti o visite per un museo: lo sai che puoi anche comprare item liberi di altri autori da riusare nelle tue visite? Fai un giro in "Contenuti" quando hai tempo — non serve reinventare tutto da solo.',
          ),
        }
      : {
          icon: 'sparkles',
          title: __('Ti è preso il pallino? Fai un upgrade!'),
          description: __(
            "Se un giorno ti va di raccontare TU un'opera o un museo che ami, puoi chiedere di diventare autore: creerai contenuti e visite, vendibili a tua volta ad altri come te. Nessun obbligo, ma se hai voglia ti aspettiamo!.",
          ),
        },
  );

  return slides;
}

// Tour Area Autore: prima volta che si entra in una delle pagine di "Crea Contenuti"
function getAuthorTourSlides(): TourSlide[] {
  return [
    {
      icon: 'edit',
      title: __('Area Autore, Contenuti e Visite'),
      description: __(
        '"Area Autore" mostra solo i contenuti e le visite creati da te; "Contenuti" e "Visite" mostrano invece il catalogo completo del museo attivo, anche creato da altri autori — utile per riusare item liberi altrui nelle tue visite.',
      ),
    },
    {
      icon: 'document',
      title: __("Cos'è un item (contenuto)"),
      description: __(
        "Un item è un testo (con audio abbinato) su un'opera o un approfondimento — puoi crearne più versioni per la stessa opera, a livelli di linguaggio e durate diverse: il Navigator sceglie quella giusta per ogni visitatore.",
      ),
    },
    {
      icon: 'visit',
      title: __("Cos'è una visita"),
      description: __(
        'Una visita è una sequenza ordinata di tappe (opere, indicazioni, note logistiche) costruita scegliendo tra gli item disponibili — la pubblichi quando è pronta e può essere a pagamento o gratuita.',
      ),
    },
    {
      icon: 'location',
      title: __('La mappa della visita: la chicca del Navigator'),
      description: __(
        'Nella costruzione della visita, potrai giocare creando la mappa della visita con un apposito editor, basandoti già sulle mappe create dai curatori del musoe e dalla posizione delle opere. Nel navigator, i visitatori saranno molto aiutati con questo utile strumento.. Attento, crea dipendenza!',
      ),
    },
    {
      icon: 'sparkles',
      title: __('Audio e traduzioni'),
      description: __(
        "ArtAround è multilingua: pensa che lavoro enorme creare traduzioni di contenuti e relativi audio per tutte le lingue disponibili! Ma ArtAround è con te: tramite integrazione con LLM OpenAI, con semplici pulsanti puoi creare tutte le traduzioni e tutti gli audio mancanti nei tuoi contenuti. Ci vorrà un po', ma non ti preoccupare: il tutto si svolge in background, riceverai una notifica al termine! Se poi vuoi registrare tu gli audio ancora meglio, se non li carichi tu e non li generi tramite LLM, come ultima spiaggia il Navigator usa il sintetizzatore vocale del browser: la qualità non è il massimo, ma sei sempre coperto!",
      ),
    },
  ];
}

// Tour Gestione Museo: prima volta che si entra in una delle pagine di "Gestione Museo"
function getMuseumTourSlides(): TourSlide[] {
  return [
    {
      icon: 'edit',
      title: __('Modifica Museo'),
      description: __(
        'Dati di base, indirizzo (la mappa si aggiorna da sola mentre scrivi), servizi e contatti del museo.',
      ),
    },
    {
      icon: 'image',
      title: __('Gestione Opere'),
      description: __(
        'Le opere del museo, collegate senza ambiguità a Wikidata — puoi crearle, modificarle ed eliminarle anche se create da altri, a differenza degli item/visite dove gli autori gestiscono solo le proprie. I curatori di un museo hanno pieni poteri su quel museo.',
      ),
    },
    {
      icon: 'location',
      title: __('Piantina, Mappa e Configurazioni Navigator'),
      description: __(
        "Due pagine avanzate, ognuna con un proprio tour dedicato alla prima visita: piani/sale/marker da un lato, aspetto e branding del Navigator dall'altro. Tanta roba!",
      ),
    },
    {
      icon: 'users',
      title: __('Gestire i ruoli del tuo museo'),
      description: __(
        'Dalla Dashboard approvi o rifiuti le richieste di diventare autore per il tuo museo. Solo gli admin invece possono assegnare i curatori ai musei.',
      ),
    },
    {
      icon: 'sparkles',
      title: __('Audio e traduzioni'),
      description: __(
        "ArtAround è multilingua: pensa che lavoro enorme creare traduzioni di contenuti e relativi audio per tutte le lingue disponibili! Ma ArtAround è con te: tramite integrazione con LLM OpenAI, con due semplici pulsanti puoi creare tutte le traduzioni e tutti gli audio legati ad un museo. Ci vorrà un po', ma non ti preoccupare: il tutto si svolge in background, riceverai una notifica al termine!",
      ),
    },
  ];
}

// Tour Piantina: prima volta che si entra nella pagina "Piantina e Mappa" di un museo
function getFloorplanTourSlides(): TourSlide[] {
  return [
    {
      icon: 'location',
      title: __('Tre cose distinte: piani, sale e marker'),
      description: __(
        'I piani (a sinistra) sono le piantine caricate; le sale si creano in "Modifica Museo", qui si contornano solo sulla piantina; i marker (a destra) sono i singoli punti — opere o servizi. Prima di creare la piantina è fondamentale aver già inserito tutte le opere, le sale e avere abbinato ogni opera alla sala giusta.',
      ),
    },
    {
      icon: 'document',
      title: __('Aggiungere un piano'),
      description: __(
        'Carichi una piantina SVG, dai un nome e un "Livello" (valore semantico per l\'ordinamento, es. -1 seminterrato, 0 piano terra — non la posizione in questa lista).',
      ),
    },
    {
      icon: 'edit',
      title: __('Disegnare le sale'),
      description: __(
        'Le sale nascono in "Modifica Museo" (solo il nome); qui assegni ognuna ad un piano e ne disegni il contorno sulla piantina — è un sistema separato dai marker. Il contorno si disegna con una serie di punti (poligonale chiusa) partendo da un punto e tornando allo stesso.',
      ),
    },
    {
      icon: 'image',
      title: __('Aggiungere marker'),
      description: __(
        "Clicca sulla piantina per posizionare un marker: un'opera (collegata a quelle già inserite) oppure un servizio/orientamento (ingresso, bagno, scale...). Per le opere puoi anche regolare punto focale e zoom dell'immagine.",
      ),
    },
    {
      icon: 'sparkles',
      title: __('"Un piccolo aiuto..."'),
      description: __(
        'Una volta create e contornate le sale, potrai in automatico inserire i marker delle opere dentro le sale giuste, poi dovrai solo spostarli nella posizione giusta, ma partendo già da dentro quella sala! Non è poco!',
      ),
    },
  ];
}

// Tour Configurazioni Navigator: prima volta che si entra nella pagina "Configurazioni Navigator" di un museo
function getNavigatorConfigTourSlides(): TourSlide[] {
  return [
    {
      icon: 'cog',
      title: __("L'aspetto del Navigator, per questo museo"),
      description: __(
        'Questa è la vera potenza di ArtAround. Qui puoi creare e personalizzare tante configurazioni diverse del Navigator per il tuo museo. Colori, testi, font, loghi e immagini: la base è la stessa, ma due configurazioni diverse rendono i due relativi navigator due applicazioni che non collegheresti mai! La brandizzazione è completa, puoi cambiare addirittura il nome ',
      ),
    },
    {
      icon: 'image',
      title: __('Manifest e schermata di benvenuto'),
      description: __(
        'Nome, nome breve e testo di benvenuto sono ciò che il visitatore legge per primo; le immagini (logo, splash, icone) sono quelle usate se il Navigator viene installato come app sul telefono.',
      ),
    },
    {
      icon: 'sparkles',
      title: __('Colori'),
      description: __(
        "Ogni colore ha uno swatch e un campo esadecimale collegati: cambi uno e si aggiorna anche l'altro. Se non imposti nulla, si usa la configurazione globale definita dagli admin.",
      ),
    },
  ];
}

// Tour Amministrazione: prima volta che si entra in una delle pagine di "Amministrazione"
function getAdminTourSlides(): TourSlide[] {
  return [
    {
      icon: 'cog',
      title: __('Gestione Musei'),
      description: __(
        "Crea o elimina musei, assegna e revoca i curatori — l'unica azione riservata sempre e solo agli admin.",
      ),
    },
    {
      icon: 'cog',
      title: __('Configurazione Navigator globale'),
      description: __(
        "L'aspetto di default del Navigator, usato da ogni museo che non ha una propria configurazione dedicata.",
      ),
    },
    {
      icon: 'users',
      title: __('Gestione Utenti'),
      description: __(
        "L'unico posto da cui creare un utente a mano, disattivarlo o cambiargli i permessi direttamente — normalmente i ruoli nascono invece dalle richieste approvate.",
      ),
    },
    {
      icon: 'edit',
      title: __('E poi? Tutto qui?'),
      description: __(
        'In quanto Admin, puoi fare tutto: sei curatore e autore di tutti i musei e puoi modificare qualsiasi contenuto, per poter risolvere richieste da parte di altri utenti o per motivi di sicurezza, ma... ricordati: ognuno ha il suo ruolo, non sovrastare gli altri perchè questo è il bello di ArtAround!',
      ),
    },
  ];
}

export function getTourSlides(id: TourId, user?: User | null): TourSlide[] {
  switch (id) {
    case 'welcome':
      return getWelcomeTourSlides(user);
    case 'author':
      return getAuthorTourSlides();
    case 'museum':
      return getMuseumTourSlides();
    case 'floorplan':
      return getFloorplanTourSlides();
    case 'navigatorConfig':
      return getNavigatorConfigTourSlides();
    case 'admin':
      return getAdminTourSlides();
  }
}

// Etichetta e descrizione brevi usate dalla Dashboard per elencare i tour rivedibili
export function getTourMeta(id: TourId): { label: string; description: string } {
  switch (id) {
    case 'welcome':
      return {
        label: __('Tour di benvenuto'),
        description: __('Come acquistare una visita e ritrovarla nel Navigator, in 7 schermate.'),
      };
    case 'author':
      return {
        label: __('Tour Area Autore'),
        description: __('Come creare item e visite, e riusare contenuti di altri autori.'),
      };
    case 'museum':
      return {
        label: __('Tour Gestione Museo'),
        description: __('Dati del museo, opere, e un cenno a piantina/config Navigator.'),
      };
    case 'floorplan':
      return {
        label: __('Tour Piantina e Mappa'),
        description: __('Piani, sale e marker: come costruire la mappa del museo.'),
      };
    case 'navigatorConfig':
      return {
        label: __('Tour Configurazioni Navigator'),
        description: __("Colori, testi e immagini dell'aspetto del Navigator per il museo."),
      };
    case 'admin':
      return {
        label: __('Tour Amministrazione'),
        description: __('Gestione musei, configurazione Navigator globale e utenti.'),
      };
  }
}
