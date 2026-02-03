import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import { User, Museum, Item, Visit } from '../models/index.js';
import {
  UserRole,
  CompetenceLevel,
  ContentDuration,
  LicenseType,
  TimePreference,
  MarkerType,
  type MuseumConfig,
} from '@artaround/shared';

async function seed() {
  try {
    console.log('Starting database seeding...\n');

    await connectDB();

    // Clear existing data
    console.log('Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Museum.deleteMany({}),
      Item.deleteMany({}),
      Visit.deleteMany({}),
    ]);
    console.log('✅ Data cleared\n');

    // Create users
    console.log('Creating users...');
    const hashedPassword = await bcrypt.hash('12345678', 10);

    const users = await User.create([
      {
        username: 'autore1',
        email: 'autore1@artaround.it',
        password: hashedPassword,
        role: UserRole.AUTHOR,
      },
      {
        username: 'autore2',
        email: 'autore2@artaround.it',
        password: hashedPassword,
        role: UserRole.AUTHOR,
      },
      {
        username: 'visitatore1',
        email: 'visitatore1@artaround.it',
        password: hashedPassword,
        role: UserRole.VISITOR,
        preferences: {
          competenceLevel: CompetenceLevel.MEDIO,
          interests: ['arte', 'storia', 'scultura'],
          availableTime: TimePreference.NORMALE,
          language: 'it',
        },
      },
      {
        username: 'visitatore2',
        email: 'visitatore2@artaround.it',
        password: hashedPassword,
        role: UserRole.VISITOR,
        preferences: {
          competenceLevel: CompetenceLevel.SEMPLICE,
          interests: ['pittura', 'barocco'],
          availableTime: TimePreference.VELOCE,
          age: 25,
          language: 'it',
        },
      },
    ]);

    console.log(`✅ Created ${users.length} users\n`);

    // ========================================
    // GALLERIA BORGHESE - ROMA
    // ========================================
    console.log('🏛️ Creating Galleria Borghese...');

    // SVG floor plan of Galleria Borghese - Based on actual museum architecture
    // The villa has an elongated rectangular shape typical of Roman baroque villas
    // Central Salone (portico) running through the building with rooms on sides
    // Ground Floor: Portico/Salone with Sala I-VIII arranged around it
    const floorPlanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <pattern id="marble" patternUnits="userSpaceOnUse" width="40" height="40">
      <rect width="40" height="40" fill="#f8f4ed"/>
      <circle cx="20" cy="20" r="15" fill="#f0ebe0" opacity="0.4"/>
      <path d="M0 20 Q10 15 20 20 T40 20" stroke="#e8e0d4" stroke-width="0.5" fill="none"/>
    </pattern>
    <pattern id="salone" patternUnits="userSpaceOnUse" width="60" height="60">
      <rect width="60" height="60" fill="#fff8e8"/>
      <rect x="5" y="5" width="50" height="50" fill="none" stroke="#e8dcc8" stroke-width="1"/>
      <circle cx="30" cy="30" r="8" fill="#f5edd8" opacity="0.5"/>
    </pattern>
  </defs>
  
  <!-- Dark background -->
  <rect width="800" height="600" fill="#1a1a1a"/>
  
  <!-- Main building shadow -->
  <rect x="55" y="55" width="690" height="460" fill="#333" rx="3"/>
  
  <!-- Main building outline - elongated villa shape -->
  <rect x="50" y="50" width="700" height="470" fill="#f5f0e6" stroke="#6b5a40" stroke-width="3" rx="2"/>
  
  <!-- PORTICO / SALONE CENTRALE - runs through building -->
  <rect x="280" y="50" width="240" height="470" fill="url(#salone)" stroke="#8b7355" stroke-width="2"/>
  
  <!-- Portico entrance columns suggestion -->
  <rect x="330" y="480" width="20" height="40" fill="#d4c4a8" stroke="#8b7355" stroke-width="1"/>
  <rect x="370" y="480" width="20" height="40" fill="#d4c4a8" stroke="#8b7355" stroke-width="1"/>
  <rect x="410" y="480" width="20" height="40" fill="#d4c4a8" stroke="#8b7355" stroke-width="1"/>
  <rect x="450" y="480" width="20" height="40" fill="#d4c4a8" stroke="#8b7355" stroke-width="1"/>
  
  <!-- LEFT WING - West side -->
  
  <!-- SALA I - Paolina (first room on left from entrance) -->
  <rect x="55" y="380" width="220" height="135" fill="url(#marble)" stroke="#8b7355" stroke-width="2"/>
  <text x="165" y="440" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA I</text>
  <text x="165" y="460" text-anchor="middle" fill="#6b5a40" font-size="11">Paolina Borghese</text>
  <text x="165" y="475" text-anchor="middle" fill="#8b7355" font-size="9">(Canova)</text>
  
  <!-- SALA II - David -->
  <rect x="55" y="230" width="220" height="145" fill="#faf6ee" stroke="#8b7355" stroke-width="2"/>
  <text x="165" y="295" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA II</text>
  <text x="165" y="315" text-anchor="middle" fill="#6b5a40" font-size="11">David</text>
  <text x="165" y="330" text-anchor="middle" fill="#8b7355" font-size="9">(Bernini)</text>
  
  <!-- SALA IV - Ratto di Proserpina (Galleria degli Imperatori) -->
  <rect x="55" y="55" width="220" height="170" fill="url(#marble)" stroke="#8b7355" stroke-width="2"/>
  <text x="165" y="125" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA IV</text>
  <text x="165" y="145" text-anchor="middle" fill="#6b5a40" font-size="11">Ratto di Proserpina</text>
  <text x="165" y="160" text-anchor="middle" fill="#8b7355" font-size="9">(Bernini)</text>
  
  <!-- RIGHT WING - East side -->
  
  <!-- SALA III - Apollo e Dafne -->
  <rect x="525" y="380" width="220" height="135" fill="url(#marble)" stroke="#8b7355" stroke-width="2"/>
  <text x="635" y="440" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA III</text>
  <text x="635" y="460" text-anchor="middle" fill="#6b5a40" font-size="11">Apollo e Dafne</text>
  <text x="635" y="475" text-anchor="middle" fill="#8b7355" font-size="9">(Bernini)</text>
  
  <!-- SALA V - Ermafrodito -->
  <rect x="525" y="230" width="220" height="145" fill="#faf6ee" stroke="#8b7355" stroke-width="2"/>
  <text x="635" y="295" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA V</text>
  <text x="635" y="315" text-anchor="middle" fill="#6b5a40" font-size="11">Ermafrodito</text>
  <text x="635" y="330" text-anchor="middle" fill="#8b7355" font-size="9">(Dormiente)</text>
  
  <!-- SALA VI - Enea e Anchise -->
  <rect x="525" y="55" width="220" height="170" fill="url(#marble)" stroke="#8b7355" stroke-width="2"/>
  <text x="635" y="125" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA VI</text>
  <text x="635" y="145" text-anchor="middle" fill="#6b5a40" font-size="11">Enea e Anchise</text>
  <text x="635" y="160" text-anchor="middle" fill="#8b7355" font-size="9">(Bernini)</text>
  
  <!-- BACK ROOMS (top) -->
  
  <!-- SALA VIII - Caravaggio (Sala del Sileno) - CENTER BACK -->
  <rect x="285" y="55" width="230" height="110" fill="#fff5e0" stroke="#8b7355" stroke-width="2"/>
  <text x="400" y="95" text-anchor="middle" fill="#4a3c28" font-size="15" font-weight="bold">SALA VIII</text>
  <text x="400" y="115" text-anchor="middle" fill="#6b5a40" font-size="11">Caravaggio</text>
  <text x="400" y="130" text-anchor="middle" fill="#8b7355" font-size="9">(6 capolavori)</text>
  
  <!-- Doorways between rooms (arched openings) -->
  <rect x="275" y="420" width="5" height="50" fill="#e8dcc8"/>
  <rect x="520" y="420" width="5" height="50" fill="#e8dcc8"/>
  <rect x="275" y="280" width="5" height="50" fill="#e8dcc8"/>
  <rect x="520" y="280" width="5" height="50" fill="#e8dcc8"/>
  <rect x="275" y="110" width="5" height="50" fill="#e8dcc8"/>
  <rect x="520" y="110" width="5" height="50" fill="#e8dcc8"/>
  
  <!-- Central Salone text -->
  <text x="400" y="290" text-anchor="middle" fill="#6b5a40" font-size="14" font-weight="bold">SALONE</text>
  <text x="400" y="310" text-anchor="middle" fill="#8b7355" font-size="10">Mosaico Gladiatori</text>
  
  <!-- Entrance text -->
  <text x="400" y="505" text-anchor="middle" fill="#4a3c28" font-size="12" font-weight="bold">INGRESSO</text>
  
  <!-- Stairs indicators -->
  <g transform="translate(60, 228)">
    <rect width="30" height="4" fill="#c9b896"/>
    <rect y="5" width="28" height="4" fill="#c9b896"/>
    <rect y="10" width="26" height="4" fill="#c9b896"/>
    <text x="15" y="25" text-anchor="middle" fill="#8b7355" font-size="8">Scale</text>
  </g>
  
  <g transform="translate(710, 228)">
    <rect width="30" height="4" fill="#c9b896"/>
    <rect y="5" width="28" height="4" fill="#c9b896"/>
    <rect y="10" width="26" height="4" fill="#c9b896"/>
    <text x="15" y="25" text-anchor="middle" fill="#8b7355" font-size="8">Scale</text>
  </g>
  
  <!-- Title -->
  <text x="400" y="560" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">GALLERIA BORGHESE</text>
  <text x="400" y="580" text-anchor="middle" fill="#aaaaaa" font-size="12">Piano Terra • Roma</text>
  
  <!-- Compass -->
  <g transform="translate(740, 560)">
    <circle cx="0" cy="0" r="18" fill="#2a2a2a" stroke="#555" stroke-width="1"/>
    <text x="0" y="-5" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">N</text>
    <polygon points="0,-12 3,-4 -3,-4" fill="#fff"/>
  </g>
</svg>`;

    // Convert SVG to data URL
    const svgBase64 = Buffer.from(floorPlanSvg).toString('base64');
    const floorPlanDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    // Museum configuration with floor plan and markers
    // The Galleria Borghese has 2 floors: Piano Terra (ground) and Primo Piano (first floor)
    // Dimensions are based on the actual museum layout (approximately 800x600 virtual units)
    const galleriaBorgheseConfig: MuseumConfig = {
      id: 'galleria-borghese',
      name: 'Galleria Borghese',
      coverImage:
        'https://upload.wikimedia.org/wikipedia/commons/5/5d/Galleria_borghese_facade.jpg',
      map: {
        type: 'image',
        imageUrl: floorPlanDataUrl,
        dimensions: { width: 800, height: 600 },
        markers: [
          // POI - Servizi
          { id: 'entrance', x: 400, y: 500, type: MarkerType.ENTRANCE, label: 'Ingresso' },
          { id: 'toilette1', x: 60, y: 510, type: MarkerType.TOILETTE, label: 'Bagni' },
          {
            id: 'toilette-acc',
            x: 90,
            y: 510,
            type: MarkerType.ACCESSIBLE_TOILETTE,
            label: 'Bagno accessibile',
          },
          { id: 'bookshop', x: 740, y: 510, type: MarkerType.SHOP, label: 'Bookshop' },
          { id: 'bar', x: 60, y: 60, type: MarkerType.BAR, label: 'Caffetteria' },
          { id: 'info', x: 400, y: 470, type: MarkerType.INFO_POINT, label: 'Informazioni' },
          { id: 'elevator', x: 740, y: 300, type: MarkerType.ELEVATOR, label: 'Ascensore' },
          { id: 'stairs1', x: 75, y: 230, type: MarkerType.STAIRS, label: 'Scale Ovest' },
          { id: 'stairs2', x: 725, y: 230, type: MarkerType.STAIRS, label: 'Scale Est' },
          {
            id: 'emergency1',
            x: 55,
            y: 55,
            type: MarkerType.EMERGENCY_EXIT,
            label: 'Uscita Emergenza',
          },
          {
            id: 'emergency2',
            x: 745,
            y: 55,
            type: MarkerType.EMERGENCY_EXIT,
            label: 'Uscita Emergenza',
          },
        ],
      },
      locations: {
        entrance: 'Piazzale Scipione Borghese 5, 00197 Roma',
        ticketPrice: '€15.00 (prenotazione obbligatoria)',
        openingHours: 'Mar-Dom 9:00-19:00 (ultimo ingresso 17:00)',
        services: [
          'Audioguida disponibile',
          'Guardaroba gratuito',
          'Accesso disabili',
          'Bookshop',
          'Caffetteria con giardino',
          'WiFi gratuito',
        ],
      },
    };

    const galleriaBorghese = await Museum.create({
      name: 'Galleria Borghese',
      description:
        "La Galleria Borghese è uno dei musei più celebri al mondo, situata all'interno della splendida Villa Borghese Pinciana a Roma. Fondata dal cardinale Scipione Borghese nel XVII secolo, ospita una straordinaria collezione di sculture del Bernini, dipinti di Caravaggio, Raffaello, Tiziano e opere di Canova. L'edificio stesso è un capolavoro architettonico circondato dai magnifici giardini di Villa Borghese.",
      location: {
        address: 'Piazzale Scipione Borghese 5',
        city: 'Roma',
        country: 'Italia',
        coordinates: {
          lat: 41.9142,
          lng: 12.4922,
        },
      },
      images: ['https://upload.wikimedia.org/wikipedia/commons/5/5d/Galleria_borghese_facade.jpg'],
      configFile: JSON.stringify(galleriaBorgheseConfig),
      isActive: true,
    });

    console.log(`✅ Created Galleria Borghese\n`);

    // ========================================
    // ITEMS - OPERE DELLA GALLERIA BORGHESE
    // ========================================
    console.log('🎨 Creating items for Galleria Borghese...');
    const author1 = users[0];
    const author2 = users[1];

    // Real artworks from Galleria Borghese with Wikidata IDs
    // Coordinates match the SVG floor plan (faithful to real museum layout):
    // Sala I (Paolina/Canova): x=165, y=447 - left bottom wing
    // Sala II (David/Bernini): x=165, y=302 - left middle wing
    // Sala III (Apollo e Dafne/Bernini): x=635, y=447 - right bottom wing
    // Sala IV (Proserpina/Bernini): x=165, y=140 - left top wing
    // Sala V (Ermafrodito): x=635, y=302 - right middle wing
    // Sala VI (Enea e Anchise/Bernini): x=635, y=140 - right top wing
    // Sala VIII (Caravaggio): x=400, y=110 - center back
    const borgheseItemsData = [
      // SCULTURE DEL BERNINI
      {
        title: 'Apollo e Dafne',
        objectId: 'Q220922', // Wikidata ID reale
        author: 'Q170515', // Gian Lorenzo Bernini
        style: 'Q37853', // Barocco
        epoch: '1622-1625',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/c/c5/Apollo_and_Daphne_%28Bernini%29.jpg',
        room: 'Sala III',
        x: 635, // Sala III - right bottom wing
        y: 447,
        descriptions: {
          infantile:
            'Questo è Apollo che rincorre Dafne. Ma Dafne non vuole essere presa, così chiede aiuto al papà e si trasforma in un albero! Guarda le foglie che spuntano dalle sue dita e i piedi che diventano radici. È come magia scolpita nella pietra!',
          semplice:
            'Apollo e Dafne è una scultura che racconta una storia della mitologia greca. Apollo, il dio del sole, si innamora di Dafne, ma lei non lo vuole. Mentre lui la insegue, Dafne chiede al padre fiume di salvarla e viene trasformata in un albero di alloro. Bernini ha catturato il momento esatto della trasformazione.',
          medio:
            "Quest'opera straordinaria rappresenta il momento culminante del mito narrato da Ovidio nelle Metamorfosi. Bernini, con virtuosismo tecnico senza precedenti, coglie l'istante della trasformazione: le dita di Dafne diventano foglie, la pelle corteccia, i piedi radici. Il movimento spiraliforme e la tensione dinamica creano un effetto teatrale tipico del Barocco.",
          avanzato:
            "Realizzata tra il 1622 e il 1625 per il cardinale Scipione Borghese, Apollo e Dafne rappresenta l'apice del virtuosismo berniniano. L'opera trascende i limiti fisici del marmo: la composizione elicoidale invita a una fruizione multipla, mentre il trattamento della superficie alterna zone levigate a dettagli quasi pittorici nelle foglie e nella corteccia nascente. L'iconografia, tratta dal primo libro delle Metamorfosi ovidiane, assume qui un significato morale espresso nel distico inciso sulla base: l'amore fugace lascia solo amarezza.",
        },
      },
      {
        title: 'Il Ratto di Proserpina',
        objectId: 'Q1471375',
        author: 'Q170515', // Bernini
        style: 'Q37853', // Barocco
        epoch: '1621-1622',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/3/36/Rape_of_Prosepina_September_2015-3a.jpg',
        room: 'Sala IV',
        x: 165, // Sala IV - left top wing
        y: 140,
        descriptions: {
          infantile:
            'Plutone, il re del mondo sotto terra, sta portando via Proserpina. Lei piange e cerca di liberarsi. Guarda come le sue dita premono forte sulla gamba di lui! Sembra vera la pelle, ma è tutto fatto di marmo.',
          semplice:
            'Questa scultura mostra Plutone, il dio degli Inferi, mentre rapisce la bella Proserpina per portarla nel suo regno sotterraneo. Bernini è stato così bravo che il marmo sembra morbido come la vera pelle: guarda dove le dita di Plutone affondano nella coscia di Proserpina!',
          medio:
            'Il Ratto di Proserpina, commissionato dal cardinale Scipione Borghese, esemplifica la capacità di Bernini di infondere vita al marmo. La composizione piramidale si sviluppa in un vortice ascendente, mentre il contrasto tra la forza brutale di Plutone e la disperazione di Proserpina genera una tensione drammatica. Il celebre dettaglio delle dita che affondano nella carne dimostra una padronanza tecnica straordinaria.',
          avanzato:
            "Opera giovanile ma già pienamente matura, Il Ratto di Proserpina (1621-22) segna il superamento definitivo del tardo Manierismo romano. Bernini orchestra una narrazione complessa: Cerbero tricefalo ai piedi, le lacrime cristallizzate di Proserpina, il panneggio vorticoso. L'opera dialoga con la tradizione classica del Laocoonte ma la trascende attraverso un'energia centrifuga che dissolve la visione frontale privilegiata, anticipando la teatralità del barocco maturo.",
        },
      },
      {
        title: 'David',
        objectId: 'Q1354095',
        author: 'Q170515', // Bernini
        style: 'Q37853', // Barocco
        epoch: '1623-1624',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/2/22/Gianlorenzo_bernini%2C_david%2C_1623-24%2C_01.jpg',
        room: 'Sala II',
        x: 165, // Sala II - left middle wing
        y: 302,
        descriptions: {
          infantile:
            'Ecco David, il ragazzo che ha sconfitto il gigante Golia! Sta per lanciare il sasso con la fionda. Guarda la sua faccia concentrata e i muscoli tesi. Bernini ha scolpito questa statua guardandosi allo specchio!',
          semplice:
            "A differenza delle statue di David fatte da altri artisti, quella di Bernini mostra il momento dell'azione: David sta per lanciare il sasso contro Golia. Il corpo è tutto in tensione, il volto è concentrato. Si dice che Bernini abbia usato il proprio volto come modello.",
          medio:
            "Il David berniniano rompe con la tradizione iconografica che lo rappresentava trionfante dopo la vittoria. Qui colto nell'attimo che precede il lancio, il giovane eroe biblico esprime tensione muscolare e concentrazione psicologica. La composizione diagonale e lo spazio circostante coinvolto nell'azione anticipano la concezione barocca dello spazio come teatro.",
          avanzato:
            "Realizzato in soli sette mesi nel 1623-24, il David rappresenta una rivoluzione nella statuaria monumentale. Bernini rifiuta sia la contemplazione michelangiolesca sia l'eleganza post-verrocchiesca del Donatello, optando per la rappresentazione dell'actio in atto. Lo sguardo intenso, tradizionalmente identificato come autoritratto, e la torsione del corpo generano un campo energetico che si proietta nello spazio dello spettatore, dissolvendone la passività contemplativa.",
        },
      },
      {
        title: 'Enea, Anchise e Ascanio',
        objectId: 'Q3721756',
        author: 'Q170515', // Bernini
        style: 'Q37853', // Barocco
        epoch: '1618-1619',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/9/97/Aeneas%2C_Anchises%2C_and_Ascanius_by_Bernini.jpg',
        room: 'Sala VI',
        x: 635, // Sala VI - right top wing
        y: 140,
        descriptions: {
          infantile:
            'Enea sta scappando dalla città di Troia che brucia. Porta sulle spalle il suo papà anziano e tiene per mano il suo bambino. Anche se è pesante, non si arrende perché ama la sua famiglia!',
          semplice:
            "Questa scultura racconta la fuga di Enea dalla città di Troia in fiamme. Enea porta sulle spalle il vecchio padre Anchise, che tiene in mano le statuette degli dei, mentre il piccolo Ascanio li segue. È un simbolo dell'amore familiare e del rispetto per i genitori.",
          medio:
            "Prima opera importante del giovane Bernini, realizzata con la collaborazione del padre Pietro. Il gruppo rappresenta tre generazioni: il vigore di Enea, la fragilità di Anchise, l'innocenza di Ascanio. La struttura verticale e l'andamento serpentinato mostrano l'influenza del Manierismo, ma già si percepisce la ricerca del movimento e dell'espressione che caratterizzeranno la maturità dell'artista.",
          avanzato:
            "Eseguita tra il 1618 e il 1619, quando Bernini aveva appena vent'anni, l'opera evidenzia ancora una matrice manierista nella struttura verticale a blocco, ma preannuncia sviluppi futuri nell'attenzione ai passaggi epidermici differenziati tra le tre età della vita. La collaborazione con il padre Pietro, ipotizzata dalle fonti, si rivela nella compresenza di elementi stilisticamente eterogenei. Il tema virgiliano della pietas familiare e del trasferimento dei Penati simboleggia anche il passaggio di consegne artistico tra padre e figlio.",
        },
      },
      // DIPINTI DEL CARAVAGGIO - tutti nella Sala VIII (x=400, y=130)
      {
        title: 'Ragazzo con canestra di frutta',
        objectId: 'Q2628416',
        author: 'Q42207', // Caravaggio
        style: 'Q37853', // Barocco
        epoch: '1593-1594',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/6/64/Boy_with_a_Basket_of_Fruit-Caravaggio_%281593%29.jpg',
        room: 'Sala VIII',
        x: 340, // Sala VIII - center back (left)
        y: 110,
        descriptions: {
          infantile:
            'Un ragazzo tiene un cesto pieno di frutta: mele, uva, pere, pesche. Ma guarda bene: alcune foglie sono secche e la frutta ha qualche macchiolina. Caravaggio dipingeva le cose proprio come le vedeva, anche se non erano perfette!',
          semplice:
            "Questo è uno dei primi dipinti di Caravaggio. Un giovane tiene un cesto di frutta dipinta con incredibile realismo. Se guardi bene, vedrai che la frutta non è perfetta: alcune foglie sono appassite, alcuni frutti hanno imperfezioni. Caravaggio amava dipingere la realtà, non l'ideale.",
          medio:
            'Opera giovanile di Caravaggio, questo dipinto rivela già la sua rivoluzionaria attenzione al dato naturale. La frutta è rappresentata con precisione quasi scientifica, incluse le imperfezioni. La luce radente modella le forme con un realismo che rompe con la tradizione idealizzante del Rinascimento, annunciando il naturalismo barocco.',
          avanzato:
            "Databile al 1593-94, l'opera appartiene al primo periodo romano del Merisi. La rappresentazione botanicamente accurata della frutta, studiata da esperti come il professor Baldini, rivela la presenza di patologie vegetali realistiche. L'opera trascende la tradizione della natura morta simbolica per affermare una nuova poetica del reale che influenzerà profondamente la pittura europea. Il modello è probabilmente Mario Minniti, futuro collaboratore dell'artista.",
        },
      },
      {
        title: 'Bacchino malato',
        objectId: 'Q1778929',
        author: 'Q42207', // Caravaggio
        style: 'Q37853', // Barocco
        epoch: '1593-1594',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/1/10/Bacchino_malato_%28Caravaggio%29.jpg',
        room: 'Sala VIII',
        x: 370, // Sala VIII - center back
        y: 110,
        descriptions: {
          infantile:
            "Questo è Bacco, il dio del vino, ma non sta molto bene! Ha la faccia un po' verde e sembra stanco. Si dice che Caravaggio abbia dipinto se stesso quando era malato. Tiene dell'uva e delle pesche.",
          semplice:
            "Il Bacchino malato è probabilmente un autoritratto di Caravaggio. Il giovane dio del vino ha un colorito malsano, verdastro. Si pensa che l'artista si sia dipinto durante una convalescenza in ospedale. Nonostante la corona di edera e l'uva, questo Bacco non celebra la gioia del vino ma mostra fragilità umana.",
          medio:
            "Quest'opera giovanile, probabilmente un autoritratto, mostra Caravaggio nelle vesti di Bacco, ma con un incarnato livido che suggerisce malattia. Realizzato forse durante un ricovero ospedaliero, il dipinto trasforma l'iconografia tradizionale del dio del vino in una meditazione sulla caducità. Lo specchio usato per l'autoritratto spiega l'uva tenuta nella mano sinistra.",
          avanzato:
            "Il Bacchino malato costituisce un unicum iconografico nella tradizione della rappresentazione dionisiaca. L'incarnato terreo, analizzato anche in chiave medica, suggerisce ittero o malaria. L'opera, eseguita allo specchio (da cui l'inversione delle mani), rivela già la poetica caravaggesca: il rifiuto dell'idealizzazione, l'attenzione al dato naturale, la capacità di trasformare un soggetto mitologico in riflessione esistenziale. La fattura rapida e la pasta cromatica sottile caratterizzano questa fase giovanile.",
        },
      },
      {
        title: 'Madonna dei Palafrenieri',
        objectId: 'Q2495987',
        author: 'Q42207', // Caravaggio
        style: 'Q37853', // Barocco
        epoch: '1605-1606',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/e/e7/Caravaggio_-_Madonna_dei_Palafrenieri.jpg',
        room: 'Sala VIII',
        x: 400, // Sala VIII - center back
        y: 110,
        descriptions: {
          infantile:
            "La Madonna e Gesù Bambino schiacciano insieme un serpente cattivo, con l'aiuto della nonna Anna. È come se stessero vincendo contro il male! Caravaggio ha usato persone vere come modelli, per questo sembrano così reali.",
          semplice:
            "In questo dipinto, la Madonna aiuta il piccolo Gesù a schiacciare un serpente, simbolo del male. Sant'Anna, madre di Maria, osserva la scena. L'opera fu rifiutata dalla chiesa che l'aveva commissionata perché considerata troppo realistica e poco rispettosa: la Madonna ha una scollatura pronunciata e i personaggi sembrano gente comune.",
          medio:
            "Commissionata per l'altare dei Palafrenieri in San Pietro, l'opera fu rimossa dopo pochi giorni per il realismo considerato indecoroso. La composizione mostra Maria e il Bambino che insieme schiacciano il serpente, in una reinterpretazione della simbologia dell'Immacolata Concezione. Il fondo scuro, i contrasti luminosi e il realismo dei modelli sono caratteristici del Caravaggio maturo.",
          avanzato:
            "L'opera, commissionata nel 1605 dalla Confraternita dei Palafrenieri Pontifici per la Basilica Vaticana, fu rimossa dopo appena due giorni di esposizione. Le ragioni del rifiuto sono molteplici: la scollatura della Vergine, l'identificazione del modello maschile, il Bambino troppo cresciuto e nudo. Ma la vera trasgressione è teologica: l'interpretazione del tema dell'Immacolata Concezione, dove la vittoria sul male è azione congiunta di madre e figlio, contraddice la dottrina tridentina. L'acquisto da parte di Scipione Borghese sancisce il suo ruolo di mecenate del Caravaggio.",
        },
      },
      {
        title: 'San Girolamo scrivente',
        objectId: 'Q3947023',
        author: 'Q42207', // Caravaggio
        style: 'Q37853', // Barocco
        epoch: '1605-1606',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/4/4d/Saint_Jerome_Writing-Caravaggio_%281605-6%29.jpg',
        room: 'Sala VIII',
        x: 430, // Sala VIII - center back (right)
        y: 110,
        descriptions: {
          infantile:
            "Un vecchio signore con la barba bianca sta scrivendo. È San Girolamo, che ha tradotto la Bibbia in latino. Sul tavolo c'è un teschio che ci ricorda che tutti diventiamo vecchi. Guarda quanto è rugosa la sua pelle!",
          semplice:
            "San Girolamo, lo studioso che tradusse la Bibbia in latino, è mostrato mentre scrive. Caravaggio lo ritrae come un vecchio vero, con la pelle rugosa e il corpo magro. Il teschio sul tavolo è un 'memento mori', un ricordo che la vita terrena finisce. La luce illumina solo le parti importanti.",
          medio:
            "Questo San Girolamo esemplifica il naturalismo caravaggesco nella rappresentazione del corpo anziano: la pelle cadente, le vene in rilievo, la magrezza senile. L'essenzialità della composizione - il santo, i libri, il teschio - concentra l'attenzione sulla meditazione e sulla scrittura. Il fondo neutro e la luce radente isolano la figura in una dimensione atemporale.",
          avanzato:
            "L'iconografia girolimiana conosce con Caravaggio una svolta decisiva: abbandonate le ambientazioni studiate, il santo appare in un non-luogo definito solo dalla luce. Il modello anziano, forse lo stesso usato per altre figure di vecchi nella produzione del Merisi, è reso con impietoso realismo anatomico. L'opera dialoga con la tradizione veneta del soggetto ma la supera attraverso l'immediatezza del dato naturale e l'eliminazione di ogni elemento aneddotico. Il teschio, più che simbolo, è oggetto di studio quasi scientifico.",
        },
      },
      {
        title: 'Davide con la testa di Golia',
        objectId: 'Q2626222',
        author: 'Q42207', // Caravaggio
        style: 'Q37853', // Barocco
        epoch: '1609-1610',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/7/78/David_con_la_cabeza_de_Goliat_%28Caravaggio%29.jpg',
        room: 'Sala VIII',
        x: 460, // Sala VIII - center back (right)
        y: 110,
        descriptions: {
          infantile:
            "David ha appena sconfitto il gigante Golia e tiene la sua testa. Ma guarda: la faccia di Golia è in realtà quella di Caravaggio! L'artista si è dipinto come il cattivo sconfitto. David sembra quasi triste per quello che ha dovuto fare.",
          semplice:
            "In questo drammatico dipinto, il giovane David tiene la testa mozzata di Golia. Caravaggio ha usato il proprio volto per Golia, come se si rappresentasse sconfitto e punito. L'espressione di David non è trionfante ma malinconica. L'opera fu forse dipinta per chiedere perdono al Papa.",
          medio:
            "Quest'opera tarda mostra David in un momento di riflessione piuttosto che di trionfo. L'identificazione di Golia con un autoritratto di Caravaggio trasforma il dipinto in una meditazione sulla colpa: l'artista, fuggitivo per omicidio, si rappresenta come il peccatore sconfitto. Sulla spada è incisa un'abbreviazione latina che allude all'umiltà che vince la superbia.",
          avanzato:
            "Realizzata durante la fuga nel Mezzogiorno, l'opera è stata interpretata come richiesta di grazia inviata al Cardinal Scipione Borghese, nipote del Papa. L'iscrizione sulla spada 'H-AS OS' (Humilitas occidit superbiam) conferma la chiave interpretativa penitenziale. Il doppio autoritratto - Caravaggio adulto come Golia e Caravaggio giovane come David - suggerisce una riflessione autobiografica sulla propria esistenza violenta. La pennellata rapida e la drammatica illuminazione caratterizzano il tardo stile del Merisi.",
        },
      },
      // ALTRI CAPOLAVORI
      {
        title: 'Paolina Borghese come Venere vincitrice',
        objectId: 'Q538526',
        author: 'Q5592', // Antonio Canova
        style: 'Q14378', // Neoclassicismo
        epoch: '1804-1808',
        image: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Canova-Paolina_Borghese.jpg',
        room: 'Sala I',
        x: 165, // Sala I - left bottom wing
        y: 447,
        descriptions: {
          infantile:
            "Questa signora elegante si chiama Paolina, era la sorella di Napoleone! È sdraiata su un bel divano e tiene in mano una mela. Lo scultore Canova l'ha fatta sembrare una dea greca. Il divano è vero, coperto di velluto!",
          semplice:
            "Paolina Bonaparte, sorella di Napoleone, è ritratta come Venere, la dea della bellezza. Tiene in mano il pomo della discordia, segno che è la più bella di tutte. Canova ha creato un'opera perfetta, levigatissima, che sembra quasi porcellana. Il divano originariamente girava su un meccanismo.",
          medio:
            "Quest'opera neoclassica di Canova rappresenta Paolina Bonaparte, moglie del principe Camillo Borghese, nelle sembianze di Venere vincitrice. La scultura, tecnicamente impeccabile, combina il riferimento all'antico con un ritratto realistico. La superficie levigata del marmo, i morbidi panneggi e la base-triclinio con meccanismo rotante dimostrano il virtuosismo dell'artista veneto.",
          avanzato:
            "Realizzata tra il 1804 e il 1808, l'opera rappresenta l'apice del Neoclassicismo scultoreo. L'identificazione di Paolina con Venere Vincitrice (che tiene il pomo del giudizio di Paride) suscitò scandalo per l'audacia del seminudo. Canova trasforma il marmo in epidermide attraverso l'applicazione di cera leggermente rosata. Il triclinio ligneo, originariamente dotato di meccanismo rotante, esalta la visione multipla dell'opera. L'ambiguità tra ritratto e allegoria mitologica definisce la dialettica neoclassica tra reale e ideale.",
        },
      },
      {
        title: 'Amor sacro e Amor profano',
        objectId: 'Q2080379',
        author: 'Q47551', // Tiziano
        style: 'Q1474884', // Rinascimento
        epoch: '1514',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/e/ef/Tiziano_-_Amor_Sacro_y_Amor_Profano_%28Galer%C3%ADa_Borghese%2C_Roma%2C_1514%29.jpg',
        room: 'Pinacoteca',
        x: 400, // Pinacoteca (Piano Superiore) - shown in Salone
        y: 290,
        descriptions: {
          infantile:
            "Due donne bellissime sono sedute su una fontana. Una è vestita elegante, l'altra è senza vestiti. In mezzo un angioletto gioca con l'acqua. È un quadro misterioso: nessuno sa bene cosa significhi, ma è bellissimo!",
          semplice:
            "Questo enigmatico dipinto di Tiziano mostra due figure femminili ai lati di una fontana-sarcofago. Contrariamente al titolo, dato in seguito, il significato originale resta discusso: forse rappresenta la sposa ideale (vestita) e la dea dell'amore (nuda). I colori caldi e il paesaggio veneto sono tipici del giovane Tiziano.",
          medio:
            "Opera giovanile di Tiziano, questo dipinto presenta un'iconografia ancora discussa. Le due figure, tradizionalmente identificate come Amor Sacro (la donna nuda) e Amor Profano (la vestita), potrebbero invece rappresentare concetti neoplatonici o celebrare un matrimonio. La fontana-sarcofago, i paesaggi contrastanti e la luce dorata creano un'atmosfera sospesa e poetica caratteristica del tonalismo veneto.",
          avanzato:
            "Eseguita nel 1514, probabilmente per le nozze di Niccolò Aurelio, l'opera sfugge a interpretazioni univoche. L'inversione moderna dei titoli (in origine la Venere celeste era nuda) riflette il mutamento dei codici simbolici. Lo stemma Aurelio sul sarcofago-fontana e i rilievi classicheggianti suggeriscono una committenza colta. La dialettica tra i due paesaggi - ordinato a sinistra, selvaggio a destra - e l'ambiguità semantica delle due figure costituiscono il fascino inesauribile dell'opera, punto di riferimento per la fortuna critica di Tiziano.",
        },
      },
      {
        title: 'Deposizione',
        objectId: 'Q3705201',
        author: 'Q5597', // Raffaello
        style: 'Q1474884', // Rinascimento
        epoch: '1507',
        image: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Raffael_040.jpg',
        room: 'Pinacoteca',
        x: 400, // Pinacoteca (Piano Superiore) - shown in Salone
        y: 320,
        descriptions: {
          infantile:
            'Gli amici di Gesù lo stanno portando via dopo che è morto. La mamma Maria è molto triste e le sue amiche la sostengono. Raffaello ha messo tanti colori belli e luminosi anche in una scena così triste.',
          semplice:
            "Raffaello ha dipinto il momento in cui il corpo di Gesù viene portato al sepolcro. Le figure mostrano diversi tipi di dolore: dalla disperazione di Maria Maddalena alla compassione di chi sostiene la Madonna svenuta. È un'opera importante perché Raffaello studiò le sculture antiche e i lavori di Michelangelo.",
          medio:
            "Commissionata da Atalanta Baglioni per commemorare il figlio assassinato, questa pala d'altare segna la maturazione di Raffaello. La composizione, studiata attraverso numerosi disegni preparatori, combina lo schema della Deposizione con quello del Trasporto. Le figure, ispirate al Laocoonte e alla Pietà di Michelangelo, esprimono una gamma di emozioni che anticipa la Grande Maniera romana.",
          avanzato:
            "L'opera, documentata nella cappella di San Francesco al Prato a Perugia, fu commissionata da Atalanta Baglioni nel 1506 per commemorare il figlio Grifonetto, ucciso nelle faide familiari del 1500. L'evoluzione progettuale, ricostruibile attraverso i disegni, mostra il passaggio da un iniziale schema di Compianto a una Deposizione dinamica influenzata dal sarcofago Borghese e dalla battaglia di Cascina michelangiolesca. Lo svenimento della Madonna, innovazione iconografica, riflette il dolore materno della committente. Il trafugamento dell'opera nel 1608 per ordine del cardinale Scipione la porta nella collezione Borghese.",
        },
      },
      {
        title: 'Danae',
        objectId: 'Q27493',
        author: 'Q9299', // Correggio
        style: 'Q1474884', // Rinascimento
        epoch: '1531',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/e/e4/Correggio_-_Dana%C3%AB_-_Google_Art_Project.jpg',
        room: 'Pinacoteca',
        x: 400, // Pinacoteca (Piano Superiore) - shown in Salone
        y: 350,
        descriptions: {
          infantile:
            "Danae è una principessa che sta ricevendo un regalo molto speciale: una pioggia d'oro che cade dal cielo! È il dio Giove che si trasforma in oro per incontrarla. L'angioletto ai piedi del letto controlla la penna: chissà cosa sta scrivendo!",
          semplice:
            'Correggio racconta il mito di Danae: la principessa rinchiusa dal padre riceve la visita di Giove trasformato in pioggia dorata. La morbidezza dei corpi, la luce diffusa e i colori delicati sono caratteristici di questo pittore emiliano, famoso per le sue figure femminili sensuali e poetiche.',
          medio:
            "Quest'opera fa parte di una serie mitologica commissionata dai Gonzaga. Correggio interpreta il mito ovidiano con raffinata sensualità: Danae accoglie la pioggia d'oro con languore, mentre Eros alla base del letto verifica qualcosa su una pietra di paragone. Lo sfumato morbido e la gamma cromatica chiara anticipano il Rococò.",
          avanzato:
            "Appartenente al ciclo degli Amori di Giove commissionato da Federico II Gonzaga, la Danae esemplifica il sensualismo correggesco. L'opera pervenne alla collezione Borghese nel 1827. L'iconografia presenta elementi insoliti: Eros testa l'oro su una pietra di paragone, dettaglio interpretato come allusione all'incorruttibilità dell'amore. La tecnica dello sfumato, portata a esiti di straordinaria morbidezza, e l'impaginazione diagonale influenzeranno profondamente il Barocco e il Rococò.",
        },
      },
      {
        title: 'La caccia di Diana',
        objectId: 'Q3821685',
        author: 'Q47293', // Domenichino
        style: 'Q37853', // Barocco
        epoch: '1616-1617',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/5/52/Domenichino_-_The_Hunt_of_Diana_-_Google_Art_Project.jpg',
        room: 'Pinacoteca',
        x: 400, // Pinacoteca (Piano Superiore) - shown in Salone
        y: 380,
        descriptions: {
          infantile:
            "Le amiche della dea Diana stanno facendo una gara: chi riesce a tirare meglio con l'arco? Si stanno anche divertendo a fare il bagno nel laghetto. È come un'immagine di una giornata al parco, ma con le dee!",
          semplice:
            "Domenichino ci mostra Diana, dea della caccia, con le sue ninfe durante una pausa. Alcune fanno il bagno, altre gareggiano con l'arco. I colori sono luminosi e il paesaggio è bellissimo. Quest'opera ebbe così tanto successo che ispirò molti altri artisti.",
          medio:
            "Questo dipinto idillico rappresenta Diana e le sue ninfe in un momento di svago dopo la caccia. La composizione equilibrata, i riferimenti all'antico e il paesaggio idealizzato riflettono il classicismo bolognese di Domenichino, allievo dei Carracci. L'opera fu acquistata dal cardinale Scipione Borghese, che dovette competere per averla.",
          avanzato:
            "Eseguita per il cardinale Aldobrandini, l'opera fu oggetto di una controversia con Scipione Borghese, che pretese di acquistarla minacciando ritorsioni. L'iconografia riprende il tema della gara di tiro della Diana cacciatrice del mito classico, ma aggiunge elementi narrativi originali. La figura della ninfa in primo piano, colta mentre sta per scoccare la freccia, esemplifica l'ideale classicista di moderata espressività. Il paesaggio arcadico, costruito secondo le regole della prospettiva atmosferica, anticipa gli sviluppi del paesismo ideale seicentesco.",
        },
      },
      {
        title: 'Ermafrodito dormiente',
        objectId: 'Q2395438',
        author: 'Q106599', // Copia romana da originale greco
        style: 'Q47433', // Arte romana
        epoch: 'II secolo d.C.',
        image: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Borghese_Hermaphroditus.jpg',
        room: 'Sala V',
        x: 635, // Sala V - right middle wing
        y: 302,
        descriptions: {
          infantile:
            'Questa persona dorme su un comodo materasso di marmo. È Ermafrodito, che nelle storie antiche era sia maschio che femmina. Sembra così comodo quel cuscino! Ma è tutto di pietra!',
          semplice:
            'Questa scultura antica mostra Ermafrodito, una figura mitologica che era sia uomo che donna. Sta dormendo su un materasso che sembra morbidissimo, ma in realtà è di marmo, aggiunto nel Seicento da Bernini. Girando attorno alla statua, si scopre la sua doppia natura.',
          medio:
            "L'Ermafrodito dormiente è una copia romana del II secolo d.C. da un originale greco. La figura androgina giace su un materasso scolpito da Bernini nel 1619, che trasforma l'opera antica in un insieme barocco. La scultura gioca sull'ambiguità: la visione posteriore mostra una figura femminile, quella frontale rivela la natura duplice del personaggio.",
          avanzato:
            "Quest'opera, replica romana di un prototipo ellenistico attribuito a Policle, esemplifica la fortuna del tema androgino nell'arte antica. Il materasso berniniano del 1619, con le sue pieghe morbidamente incise, trasforma la scultura antica in un insieme che dissolve i confini tra antico e moderno. L'iconografia dell'ermafrodito dormiente, legata al mito narrato da Ovidio, si carica nel contesto della collezione Borghese di una valenza estetica legata alla meraviglia e allo stupore barocco per l'inganno visivo.",
        },
      },
    ];

    // Update config with artwork markers
    const artworkMarkers = borgheseItemsData.map((item, index) => ({
      id: `artwork-${index + 1}`,
      x: item.x,
      y: item.y,
      type: MarkerType.ARTWORK,
      label: item.title,
      itemId: `placeholder-${index}`, // Will be updated with real IDs
    }));

    galleriaBorgheseConfig.map.markers = [...galleriaBorgheseConfig.map.markers, ...artworkMarkers];

    // Create items
    const items: Array<{ _id: { toString(): string }; title: string }> = [];
    for (let i = 0; i < borgheseItemsData.length; i++) {
      const itemData = borgheseItemsData[i];
      const item = await Item.create({
        museumId: galleriaBorghese._id.toString(),
        objectId: itemData.objectId,
        authorId: i % 2 === 0 ? author1._id.toString() : author2._id.toString(),
        title: itemData.title,
        image: itemData.image,
        contents: [
          // Infantile level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.INFANTILE,
            text: itemData.title,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.INFANTILE,
            text: itemData.descriptions.infantile,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.INFANTILE,
            text: `${itemData.descriptions.infantile} Questa opera è del periodo ${itemData.epoch}.`,
          },
          // Semplice level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.SEMPLICE,
            text: `${itemData.title} - ${itemData.room}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.SEMPLICE,
            text: itemData.descriptions.semplice,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.SEMPLICE,
            text: `${itemData.descriptions.semplice} L'opera risale al periodo ${itemData.epoch}.`,
          },
          // Medio level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.MEDIO,
            text: `${itemData.title} (${itemData.epoch})`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.MEDIO,
            text: itemData.descriptions.medio,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.MEDIO,
            text: `${itemData.descriptions.medio} L'opera risale al periodo ${itemData.epoch} ed è esposta nella ${itemData.room}.`,
          },
          // Avanzato level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.AVANZATO,
            text: `${itemData.title}, ${itemData.epoch}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.AVANZATO,
            text: itemData.descriptions.avanzato.substring(0, 500),
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.AVANZATO,
            text: itemData.descriptions.avanzato,
          },
        ],
        metadata: {
          author: itemData.author,
          style: itemData.style,
          epoch: itemData.epoch,
          license: LicenseType.CC_BY,
          price: 0,
          isFree: true,
          tags: [
            itemData.room.toLowerCase(),
            itemData.author === 'Q170515' ? 'bernini' : '',
            itemData.author === 'Q42207' ? 'caravaggio' : '',
            itemData.author === 'Q5592' ? 'canova' : '',
            itemData.style === 'Q37853' ? 'barocco' : '',
            itemData.style === 'Q14378' ? 'neoclassicismo' : '',
            itemData.style === 'Q1474884' ? 'rinascimento' : '',
          ].filter(Boolean),
        },
      });
      items.push(item);
    }

    // Update config with real item IDs
    for (let i = 0; i < items.length; i++) {
      const markerIndex = galleriaBorgheseConfig.map.markers.findIndex(
        (m) => m.id === `artwork-${i + 1}`,
      );
      if (markerIndex >= 0) {
        galleriaBorgheseConfig.map.markers[markerIndex].itemId = items[i]._id.toString();
      }
    }

    // Update museum config with real item IDs
    await Museum.findByIdAndUpdate(galleriaBorghese._id, {
      configFile: JSON.stringify(galleriaBorgheseConfig),
    });

    console.log(`✅ Created ${items.length} items for Galleria Borghese\n`);

    // ========================================
    // VISITE - GALLERIA BORGHESE
    // ========================================
    console.log('🚶 Creating visits for Galleria Borghese...');

    const visits: Array<{ _id: { toString(): string }; title: string }> = [];

    // VISITA 1: I Capolavori del Bernini (sculture barocche)
    // Opere: Apollo e Dafne, Ratto di Proserpina, David, Enea Anchise Ascanio
    const berniniItems = [items[0], items[1], items[2], items[3]]; // Le 4 sculture del Bernini

    const visit1 = await Visit.create({
      museumId: galleriaBorghese._id.toString(),
      authorId: author1._id.toString(),
      title: 'I Capolavori del Bernini',
      description:
        "Un percorso dedicato alle quattro grandi sculture di Gian Lorenzo Bernini, che rivoluzionarono l'arte del marmo nel XVII secolo. Dalla giovinezza artistica alla piena maturità, scoprirai come il genio barocco abbia dato vita al marmo.",
      items: berniniItems.map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: false,
      })),
      logisticNotes: [
        {
          order: 0,
          text: "La prenotazione è obbligatoria. L'ingresso è da Piazzale Scipione Borghese 5. Presentarsi 15 minuti prima.",
          type: 'info',
        },
        {
          order: 1,
          text: 'Le sculture si trovano al Piano Terra. Iniziare dalla Sala I e procedere in senso antiorario.',
          type: 'direction',
        },
        {
          order: 2,
          text: 'È vietato toccare le opere e usare il flash fotografico.',
          type: 'warning',
        },
      ],
      navigationNotes: [
        {
          fromItemId: berniniItems[0]._id.toString(),
          toItemId: berniniItems[1]._id.toString(),
          text: 'Dalla Sala III (Apollo e Dafne), attraversare la Sala II e proseguire verso la Sala IV dove si trova il Ratto di Proserpina.',
          estimatedTime: 120,
        },
        {
          fromItemId: berniniItems[1]._id.toString(),
          toItemId: berniniItems[2]._id.toString(),
          text: 'Tornare indietro verso la Sala II dove si trova il David.',
          estimatedTime: 60,
        },
        {
          fromItemId: berniniItems[2]._id.toString(),
          toItemId: berniniItems[3]._id.toString(),
          text: 'Procedere verso la Sala VI per ammirare Enea, Anchise e Ascanio.',
          estimatedTime: 90,
        },
      ],
      targetAudience: {
        competenceLevel: [CompetenceLevel.MEDIO, CompetenceLevel.AVANZATO],
        interests: ['scultura', 'barocco', 'bernini', "storia dell'arte"],
        timeRequired: TimePreference.NORMALE,
      },
      metadata: {
        language: 'it',
        duration: 45,
        itemsCount: 4,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });
    visits.push(visit1);

    // VISITA 2: Caravaggio - Luce e Ombra
    // Opere: Ragazzo con canestra, Bacchino malato, Madonna dei Palafrenieri, San Girolamo, David con Golia
    const caravaggioItems = [items[4], items[5], items[6], items[7], items[8]]; // Le 5 opere del Caravaggio

    const visit2 = await Visit.create({
      museumId: galleriaBorghese._id.toString(),
      authorId: author1._id.toString(),
      title: 'Caravaggio - Luce e Ombra',
      description:
        "Un viaggio attraverso le opere di Michelangelo Merisi da Caravaggio conservate nella Galleria Borghese. Dalle opere giovanili fino ai drammatici dipinti dell'ultimo periodo, scoprirai la rivoluzione luministica che cambiò per sempre la pittura europea.",
      items: caravaggioItems.map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: index === 4, // L'ultima opera è opzionale
      })),
      logisticNotes: [
        {
          order: 0,
          text: 'Tutte le opere di Caravaggio si trovano nella Sala VIII (Sala del Caravaggio) al Piano Terra.',
          type: 'info',
        },
        {
          order: 1,
          text: 'Si consiglia di osservare i dipinti a diverse distanze per apprezzare gli effetti luminosi.',
          type: 'info',
        },
      ],
      navigationNotes: [
        {
          fromItemId: caravaggioItems[0]._id.toString(),
          toItemId: caravaggioItems[1]._id.toString(),
          text: 'Il Bacchino malato è sulla parete adiacente, a pochi passi.',
          estimatedTime: 30,
        },
        {
          fromItemId: caravaggioItems[1]._id.toString(),
          toItemId: caravaggioItems[2]._id.toString(),
          text: 'La Madonna dei Palafrenieri è sulla parete di fronte.',
          estimatedTime: 30,
        },
        {
          fromItemId: caravaggioItems[2]._id.toString(),
          toItemId: caravaggioItems[3]._id.toString(),
          text: 'San Girolamo è accanto, sulla stessa parete.',
          estimatedTime: 20,
        },
        {
          fromItemId: caravaggioItems[3]._id.toString(),
          toItemId: caravaggioItems[4]._id.toString(),
          text: 'Il David con la testa di Golia completa il percorso sulla parete sinistra.',
          estimatedTime: 30,
        },
      ],
      targetAudience: {
        competenceLevel: [
          CompetenceLevel.SEMPLICE,
          CompetenceLevel.MEDIO,
          CompetenceLevel.AVANZATO,
        ],
        interests: ['pittura', 'caravaggio', 'barocco', 'chiaroscuro'],
        timeRequired: TimePreference.NORMALE,
      },
      metadata: {
        language: 'it',
        duration: 50,
        itemsCount: 5,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });
    visits.push(visit2);

    // VISITA 3: Percorso Famiglia - Miti e Storie
    // Un percorso adatto ai bambini con le opere più suggestive
    // Opere: Apollo e Dafne, Paolina Borghese, Ragazzo con canestra, Amor sacro e profano, Danae
    const familyItems = [items[0], items[9], items[4], items[10], items[13]];

    const visit3 = await Visit.create({
      museumId: galleriaBorghese._id.toString(),
      authorId: author2._id.toString(),
      title: 'Miti e Storie - Percorso Famiglia',
      description:
        "Un percorso pensato per famiglie con bambini, alla scoperta delle storie mitologiche e dei personaggi più affascinanti della Galleria Borghese. Ogni opera racconta una storia avvincente, dalla trasformazione di Dafne alla pioggia d'oro di Danae.",
      items: familyItems.map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: index >= 4, // Ultime opere opzionali
      })),
      logisticNotes: [
        {
          order: 0,
          text: "Servizi igienici disponibili all'ingresso. Bagno accessibile presente.",
          type: 'info',
        },
        {
          order: 1,
          text: 'Non è consentito portare zaini nelle sale. Utilizzare il guardaroba gratuito.',
          type: 'warning',
        },
        {
          order: 2,
          text: 'La caffetteria con giardino è perfetta per una pausa con i bambini.',
          type: 'info',
        },
      ],
      navigationNotes: [
        {
          fromItemId: familyItems[0]._id.toString(),
          toItemId: familyItems[1]._id.toString(),
          text: 'Dalla Sala III torna indietro verso la Sala I per vedere la bella Paolina!',
          estimatedTime: 90,
        },
        {
          fromItemId: familyItems[1]._id.toString(),
          toItemId: familyItems[2]._id.toString(),
          text: 'Andiamo alla Sala VIII per vedere il ragazzo con la frutta.',
          estimatedTime: 120,
        },
        {
          fromItemId: familyItems[2]._id.toString(),
          toItemId: familyItems[3]._id.toString(),
          text: "Saliamo al primo piano! Usa l'ascensore o le scale. Direzione Sala VII.",
          estimatedTime: 180,
        },
        {
          fromItemId: familyItems[3]._id.toString(),
          toItemId: familyItems[4]._id.toString(),
          text: 'La Danae è nella stessa sala, sulla parete accanto.',
          estimatedTime: 30,
        },
      ],
      targetAudience: {
        minAge: 5,
        maxAge: 14,
        competenceLevel: [CompetenceLevel.INFANTILE, CompetenceLevel.SEMPLICE],
        interests: ['miti', 'storie', 'avventura', 'arte'],
        timeRequired: TimePreference.VELOCE,
      },
      metadata: {
        language: 'it',
        duration: 40,
        itemsCount: 5,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });
    visits.push(visit3);

    console.log(`✅ Created ${visits.length} visits for Galleria Borghese\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('🎉 Seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Museums: 1 (Galleria Borghese)`);
    console.log(`   - Items: ${items.length}`);
    console.log(`   - Visits: ${visits.length}`);
    console.log('\n🏛️ Galleria Borghese:');
    console.log('   - 15 opere (Bernini, Caravaggio, Canova, Tiziano, Raffaello, ecc.)');
    console.log('   - 20+ POI (ingressi, bagni, scale, ascensore, bar, bookshop)');
    console.log('   - 3 visite tematiche:\n');
    console.log('     1️⃣  I Capolavori del Bernini (4 sculture, 45 min)');
    console.log('     2️⃣  Caravaggio - Luce e Ombra (5 dipinti, 50 min)');
    console.log('     3️⃣  Miti e Storie - Percorso Famiglia (5 opere, 40 min)\n');
    console.log('👤 Test Users:');
    console.log('   - autore1@artaround.it / 12345678');
    console.log('   - autore2@artaround.it / 12345678');
    console.log('   - visitatore1@artaround.it / 12345678');
    console.log('   - visitatore2@artaround.it / 12345678\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seed();
