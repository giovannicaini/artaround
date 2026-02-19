import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import { User, MuseumModel, ArtworkModel, ItemModel, VisitModel } from '../models/index.js';
import {
  UserRole,
  CompetenceLevel,
  ContentDuration,
  LicenseType,
  TimePreference,
  ItemReferenceType,
  LanguageLevel,
  VisitStepType,
  ArtworkType,
  MarkerType,
} from '@artaround/shared';

/**
 * Seed script for ArtAround database
 *
 * Creates realistic data for Galleria Borghese (Q180916) with:
 * - Real artworks from Wikidata
 * - Content items at various durations and language levels
 * - Sample visits
 */

async function seed() {
  try {
    console.log('🌱 Starting database seeding...\n');

    await connectDB();

    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      MuseumModel.deleteMany({}),
      ArtworkModel.deleteMany({}),
      ItemModel.deleteMany({}),
      VisitModel.deleteMany({}),
    ]);
    console.log('✅ Data cleared\n');

    // ========================================
    // USERS
    // ========================================
    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('12345678', 10);

    const users = await User.create([
      {
        username: 'autore1',
        email: 'autore1@artaround.it',
        password: hashedPassword,
        role: UserRole.AUTHOR,
      },
      {
        username: 'curatore1',
        email: 'curatore1@artaround.it',
        password: hashedPassword,
        role: UserRole.CURATOR,
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
        username: 'admin',
        email: 'admin@artaround.it',
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
    ]);
    console.log(`✅ Created ${users.length} users\n`);

    const author = users[0];

    // ========================================
    // MUSEUM: Galleria Borghese
    // ========================================
    console.log('🏛️ Creating Galleria Borghese...');

    const galleriaBorghese = await MuseumModel.create({
      wikidataId: 'Q180916',
      name: 'Galleria Borghese',
      description:
        "La Galleria Borghese è un museo statale italiano, ospitato nella villa Borghese Pinciana, a Roma. Il museo espone sculture, bassorilievi e mosaici antichi, nonché dipinti e sculture dal XV al XIX secolo. Il nucleo principale della raccolta è costituito dalla collezione d'arte iniziata dal cardinale Scipione Borghese.",
      location: {
        address: 'Piazzale Scipione Borghese, 5',
        city: 'Roma',
        country: 'Italia',
        region: 'Lazio',
        postalCode: '00197',
        coordinates: {
          lat: 41.914167,
          lng: 12.492222,
        },
      },
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Galleria_borghese_facade.jpg/800px-Galleria_borghese_facade.jpg',
      ],
      coverImage:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Galleria_borghese_facade.jpg/800px-Galleria_borghese_facade.jpg',
      floors: [
        {
          id: 'piano-terra',
          name: 'Piano Terra',
          level: 0,
          svgContent:
            '<svg viewBox="0 0 1000 800"><rect fill="#f5f5f5" width="1000" height="800"/></svg>',
          dimensions: { width: 1000, height: 800 },
          markers: [],
          connections: [],
        },
        {
          id: 'primo-piano',
          name: 'Primo Piano (Pinacoteca)',
          level: 1,
          svgContent:
            '<svg viewBox="0 0 1000 800"><rect fill="#f5f5f5" width="1000" height="800"/></svg>',
          dimensions: { width: 1000, height: 800 },
          markers: [],
          connections: [],
        },
      ],
      services: {
        ticketInfo: '€15 intero, €8 ridotto (18-25 anni UE), gratuito under 18',
        openingHours: 'Martedì - Domenica: 9:00 - 19:00 (ultimo ingresso 17:00)',
        closedDays: 'Lunedì, 25 dicembre, 1 gennaio',
        website: 'https://galleriaborghese.beniculturali.it',
        phone: '+39 06 841 3979',
        email: 'info@galleriaborghese.it',
        services: [
          'Prenotazione obbligatoria',
          'Audioguide',
          'Bookshop',
          'Guardaroba',
          'WiFi gratuito',
          'Accessibilità',
        ],
        accessibility:
          'Museo accessibile ai visitatori con disabilità motorie. Ascensore disponibile.',
        wheelchairAccessible: true,
      },
      isActive: true,
    });

    console.log(`✅ Created museum: ${galleriaBorghese.name}\n`);

    // ========================================
    // ARTWORKS
    // ========================================
    console.log('🖼️ Creating artworks...');

    const artworks = await ArtworkModel.create([
      // BERNINI SCULPTURES
      {
        wikidataId: 'Q506980', // Apollo and Daphne
        museumId: 'Q180916',
        title: 'Apollo e Dafne',
        description:
          'Gruppo scultoreo in marmo realizzato da Gian Lorenzo Bernini tra il 1622 e il 1625. Rappresenta il momento in cui Apollo raggiunge Dafne, che si sta trasformando in alloro.',
        author: 'Gian Lorenzo Bernini',
        authorWikidataId: 'Q29430',
        year: '1622-1625',
        startYear: 1622,
        endYear: 1625,
        artworkType: ArtworkType.SCULPTURE,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        dimensions: {
          height: 243,
          unit: 'cm' as const,
          displayText: '243 cm',
        },
        materials: ['Marmo di Carrara'],
        subjects: ['Mitologia', 'Metamorfosi'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Apollo_and_Daphne_%28Bernini%29.jpg/800px-Apollo_and_Daphne_%28Bernini%29.jpg',
        room: 'Sala III',
        floor: 'Piano Terra',
        mapPosition: {
          floorId: 'piano-terra',
          x: 350,
          y: 300,
          rotation: 0,
        },
      },
      {
        wikidataId: 'Q1192658', // Ratto di Proserpina
        museumId: 'Q180916',
        title: 'Il ratto di Proserpina',
        description:
          'Gruppo scultoreo in marmo realizzato da Gian Lorenzo Bernini tra il 1621 e il 1622. Raffigura il rapimento di Proserpina da parte di Plutone.',
        author: 'Gian Lorenzo Bernini',
        authorWikidataId: 'Q29430',
        year: '1621-1622',
        startYear: 1621,
        endYear: 1622,
        artworkType: ArtworkType.SCULPTURE,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        dimensions: {
          height: 255,
          unit: 'cm' as const,
          displayText: '255 cm',
        },
        materials: ['Marmo di Carrara'],
        subjects: ['Mitologia', 'Ratto'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/The_Rape_of_Proserpina_1_-_Galleria_Borghese_%28Rome%29.jpg/800px-The_Rape_of_Proserpina_1_-_Galleria_Borghese_%28Rome%29.jpg',
        room: 'Sala IV',
        floor: 'Piano Terra',
        mapPosition: {
          floorId: 'piano-terra',
          x: 450,
          y: 300,
          rotation: 0,
        },
      },
      {
        wikidataId: 'Q1192655', // David
        museumId: 'Q180916',
        title: 'David',
        description:
          "Scultura in marmo realizzata da Gian Lorenzo Bernini tra il 1623 e il 1624. Rappresenta David nell'atto di scagliare la pietra contro Golia.",
        author: 'Gian Lorenzo Bernini',
        authorWikidataId: 'Q29430',
        year: '1623-1624',
        startYear: 1623,
        endYear: 1624,
        artworkType: ArtworkType.SCULPTURE,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        dimensions: {
          height: 170,
          unit: 'cm' as const,
          displayText: '170 cm',
        },
        materials: ['Marmo di Carrara'],
        subjects: ['Religione', 'Bibbia'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/David_by_Bernini.jpg/800px-David_by_Bernini.jpg',
        room: 'Sala II',
        floor: 'Piano Terra',
        mapPosition: {
          floorId: 'piano-terra',
          x: 250,
          y: 350,
          rotation: 0,
        },
      },
      // CARAVAGGIO PAINTINGS
      {
        wikidataId: 'Q2338615', // Ragazzo con canestra di frutta
        museumId: 'Q180916',
        title: 'Ragazzo con canestra di frutta',
        description:
          'Dipinto a olio su tela realizzato da Caravaggio intorno al 1593-1594. È considerata una delle prime opere del pittore.',
        author: 'Caravaggio',
        authorWikidataId: 'Q42207',
        year: 'c. 1593-1594',
        startYear: 1593,
        endYear: 1594,
        artworkType: ArtworkType.PAINTING,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        style: 'Caravaggismo',
        dimensions: {
          height: 70,
          width: 67,
          unit: 'cm' as const,
          displayText: '70 × 67 cm',
        },
        materials: ['Olio su tela'],
        subjects: ['Ritratto', 'Natura morta'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Boy_with_a_Basket_of_Fruit-Caravaggio_%281593%29.jpg/800px-Boy_with_a_Basket_of_Fruit-Caravaggio_%281593%29.jpg',
        room: 'Sala VIII',
        floor: 'Primo Piano',
        mapPosition: {
          floorId: 'primo-piano',
          x: 300,
          y: 200,
          rotation: 0,
        },
      },
      {
        wikidataId: 'Q2626251', // San Giovanni Battista
        museumId: 'Q180916',
        title: 'San Giovanni Battista',
        description:
          'Dipinto a olio su tela realizzato da Caravaggio nel 1610. Raffigura San Giovanni Battista giovane.',
        author: 'Caravaggio',
        authorWikidataId: 'Q42207',
        year: '1610',
        startYear: 1610,
        endYear: 1610,
        artworkType: ArtworkType.PAINTING,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        dimensions: {
          height: 159,
          width: 124,
          unit: 'cm' as const,
          displayText: '159 × 124 cm',
        },
        materials: ['Olio su tela'],
        subjects: ['Religione', 'Santo'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Michelangelo_Merisi_da_Caravaggio_-_St_John_the_Baptist_-_WGA04154.jpg/800px-Michelangelo_Merisi_da_Caravaggio_-_St_John_the_Baptist_-_WGA04154.jpg',
        room: 'Sala VIII',
        floor: 'Primo Piano',
        mapPosition: {
          floorId: 'primo-piano',
          x: 400,
          y: 200,
          rotation: 0,
        },
      },
      {
        wikidataId: 'Q1471498', // Madonna dei Palafrenieri
        museumId: 'Q180916',
        title: 'Madonna dei Palafrenieri',
        description:
          'Dipinto a olio su tela realizzato da Caravaggio nel 1606. Fu commissionato per la Basilica di San Pietro ma rifiutato.',
        author: 'Caravaggio',
        authorWikidataId: 'Q42207',
        year: '1606',
        startYear: 1606,
        endYear: 1606,
        artworkType: ArtworkType.PAINTING,
        movement: 'Barocco',
        movementWikidataId: 'Q37853',
        dimensions: {
          height: 292,
          width: 211,
          unit: 'cm' as const,
          displayText: '292 × 211 cm',
        },
        materials: ['Olio su tela'],
        subjects: ['Religione', 'Madonna'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Caravaggio_-_Madonna_dei_Palafrenieri.jpg/800px-Caravaggio_-_Madonna_dei_Palafrenieri.jpg',
        room: 'Sala VIII',
        floor: 'Primo Piano',
        mapPosition: {
          floorId: 'primo-piano',
          x: 500,
          y: 250,
          rotation: 0,
        },
      },
      // TITIAN
      {
        wikidataId: 'Q5765961', // Amor Sacro e Amor Profano
        museumId: 'Q180916',
        title: 'Amor Sacro e Amor Profano',
        description:
          'Dipinto a olio su tela realizzato da Tiziano intorno al 1514. È una delle opere più celebri del Rinascimento veneto.',
        author: 'Tiziano',
        authorWikidataId: 'Q47551',
        year: 'c. 1514',
        startYear: 1514,
        endYear: 1514,
        artworkType: ArtworkType.PAINTING,
        movement: 'Rinascimento',
        movementWikidataId: 'Q4692',
        dimensions: {
          height: 118,
          width: 279,
          unit: 'cm' as const,
          displayText: '118 × 279 cm',
        },
        materials: ['Olio su tela'],
        subjects: ['Allegoria', 'Amore'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Tiziano_-_Amor_Sacro_y_Amor_Profano_%28Galer%C3%ADa_Borghese%2C_Roma%2C_1514%29.jpg/800px-Tiziano_-_Amor_Sacro_y_Amor_Profano_%28Galer%C3%ADa_Borghese%2C_Roma%2C_1514%29.jpg',
        room: 'Sala XX',
        floor: 'Primo Piano',
        mapPosition: {
          floorId: 'primo-piano',
          x: 600,
          y: 300,
          rotation: 0,
        },
      },
      // CANOVA
      {
        wikidataId: 'Q2992978', // Paolina Borghese
        museumId: 'Q180916',
        title: 'Paolina Borghese come Venere vincitrice',
        description:
          'Scultura in marmo di Antonio Canova, realizzata tra il 1804 e il 1808. Raffigura Paolina Bonaparte, sorella di Napoleone, nelle vesti di Venere.',
        author: 'Antonio Canova',
        authorWikidataId: 'Q5547',
        year: '1804-1808',
        startYear: 1804,
        endYear: 1808,
        artworkType: ArtworkType.SCULPTURE,
        movement: 'Neoclassicismo',
        movementWikidataId: 'Q14378',
        dimensions: {
          height: 92,
          width: 200,
          unit: 'cm' as const,
          displayText: '92 × 200 cm',
        },
        materials: ['Marmo'],
        subjects: ['Ritratto', 'Mitologia'],
        image:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Pauline_Bonaparte_as_Venus_Victrix_by_Antonio_Canova_%2C_front_view%2C_Galleria_Borghese%2C_Rome%2C_Italy_%282%29.jpg/800px-Pauline_Bonaparte_as_Venus_Victrix_by_Antonio_Canova_%2C_front_view%2C_Galleria_Borghese%2C_Rome%2C_Italy_%282%29.jpg',
        room: 'Sala I',
        floor: 'Piano Terra',
        mapPosition: {
          floorId: 'piano-terra',
          x: 150,
          y: 400,
          rotation: 0,
        },
      },
    ]);

    console.log(`✅ Created ${artworks.length} artworks\n`);

    // ========================================
    // ITEMS (Content)
    // ========================================
    console.log('📝 Creating content items...');

    const items = await ItemModel.create([
      // Apollo e Dafne - Items at different durations/levels
      {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: 'Q506980', // Apollo e Dafne
        title: 'Apollo e Dafne - Introduzione breve',
        text: 'Questa scultura mostra Apollo che insegue Dafne, che si trasforma in un albero di alloro per sfuggirgli. È fatta di marmo bianco ed è alta quasi 2 metri e mezzo!',
        duration: ContentDuration.SHORT,
        languageLevel: LanguageLevel.ELEMENTARY,
        authorId: author._id.toString(),
        license: LicenseType.CC0,
        price: 0,
        isFree: true,
        tags: ['bernini', 'scultura', 'mitologia', 'bambini'],
      },
      {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: 'Q506980',
        title: 'Apollo e Dafne - Descrizione completa',
        text: `L'Apollo e Dafne è un gruppo scultoreo marmoreo di Gian Lorenzo Bernini, eseguito tra il 1622 e il 1625, conservato nella Galleria Borghese di Roma.

L'opera rappresenta il momento culminante del mito narrato nelle Metamorfosi di Ovidio: Apollo, colpito dalla freccia d'oro di Eros, si innamora perdutamente della ninfa Dafne, che invece è stata colpita dalla freccia di piombo che genera repulsione.

La ninfa, inseguita dal dio, invoca l'aiuto del padre, il fiume Peneo, che la trasforma in alloro. Bernini cattura esattamente l'istante della metamorfosi: le dita di Dafne si stanno già trasformando in fronde, mentre la corteccia inizia a ricoprire il suo corpo.

La straordinaria capacità tecnica di Bernini si manifesta nella resa del marmo che sembra perdere la sua durezza per diventare carne, corteccia e foglie. Il gioco di panneggi e la dinamica compositiva creano un'opera di grande intensità drammatica.`,
        duration: ContentDuration.LONG,
        languageLevel: LanguageLevel.MEDIUM,
        authorId: author._id.toString(),
        license: LicenseType.CC_BY,
        price: 0,
        isFree: true,
        tags: ['bernini', 'scultura', 'mitologia', 'barocco'],
      },
      {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: 'Q506980',
        title: 'Apollo e Dafne - Analisi specialistica',
        text: `L'Apollo e Dafne rappresenta uno dei vertici della scultura barocca e costituisce una rivoluzione nell'arte della rappresentazione del movimento e della metamorfosi nel marmo.

COMMISSIONE E DATAZIONE
L'opera fu commissionata dal cardinale Scipione Borghese e realizzata tra il 1622 e il 1625. Bernini aveva appena 23 anni quando iniziò l'opera, ma aveva già dimostrato le sue straordinarie capacità con il Ratto di Proserpina (1621-22).

ANALISI FORMALE
Dal punto di vista compositivo, l'opera si sviluppa secondo una diagonale ascendente che parte dai piedi di Apollo e culmina nelle braccia alzate di Dafne. Questa linea di forza genera un movimento a spirale che invita lo spettatore a ruotare attorno alla scultura.

La policromia originale è andata perduta, ma alcuni documenti dell'epoca testimoniano che le foglie d'alloro erano dorate, creando un contrasto cromatico con il bianco del marmo.

ICONOGRAFIA E FONTI
Bernini si ispirò direttamente alle Metamorfosi di Ovidio (Libro I, vv. 452-567). La scelta del momento specifico della trasformazione risponde a un preciso intento narrativo: mostrare simultaneamente la causa (l'inseguimento) e l'effetto (la metamorfosi).

TECNICA ESECUTIVA
La virtuosistica resa della corteccia e delle foglie fu resa possibile dall'uso di trapani e strumenti sottili. Le dita di Dafne che si trasformano in ramoscelli rappresentano un tour de force tecnico senza precedenti.`,
        duration: ContentDuration.EXTENDED,
        languageLevel: LanguageLevel.SPECIALIST,
        authorId: author._id.toString(),
        license: LicenseType.CC_BY_NC,
        price: 2.99,
        isFree: false,
        tags: ['bernini', 'scultura', 'mitologia', 'barocco', 'analisi', "storia dell'arte"],
      },
      // Caravaggio - Ragazzo con canestra
      {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: 'Q2338615',
        title: 'Ragazzo con canestra di frutta - Introduzione',
        text: `Questo dipinto mostra un ragazzo che tiene un cesto pieno di frutta. Fu dipinto da Caravaggio quando era molto giovane, intorno ai 20 anni.

Guarda bene la frutta nel cesto: riesci a vedere che alcune foglie sono appassite e qualche frutto è un po' rovinato? Caravaggio voleva mostrare le cose come sono nella vita vera, non perfette come facevano altri pittori.

Il ragazzo guarda verso di noi con uno sguardo intenso. La luce arriva da sinistra e illumina il suo viso e la frutta, mentre lo sfondo resta scuro.`,
        duration: ContentDuration.MEDIUM,
        languageLevel: LanguageLevel.ELEMENTARY,
        authorId: author._id.toString(),
        license: LicenseType.CC0,
        price: 0,
        isFree: true,
        tags: ['caravaggio', 'pittura', 'natura morta'],
      },
      // Author item - about Bernini
      {
        referenceType: ItemReferenceType.AUTHOR,
        referenceId: 'Q29430', // Bernini Wikidata ID
        title: 'Gian Lorenzo Bernini - Vita e opere',
        text: `Gian Lorenzo Bernini (Napoli, 1598 – Roma, 1680) è stato uno scultore, architetto e pittore italiano, considerato il massimo esponente del Barocco.

Figlio di Pietro Bernini, scultore toscano, Gian Lorenzo mostrò un talento precoce che attirò l'attenzione del cardinale Scipione Borghese. Sotto la sua protezione, il giovane artista realizzò alcune delle sue opere più celebri, oggi custodite nella Galleria Borghese: l'Enea, Anchise e Ascanio (1618-19), Il ratto di Proserpina (1621-22), il David (1623-24) e l'Apollo e Dafne (1622-25).

Nominato architetto di San Pietro da Papa Urbano VIII nel 1629, Bernini trasformò il volto di Roma con opere monumentali come il Baldacchino di San Pietro, la Cattedra di San Pietro e il Colonnato di Piazza San Pietro.

La sua capacità di rendere il marmo "vivo" e di catturare l'istante drammatico delle sue narrazioni rimane insuperata nella storia della scultura occidentale.`,
        duration: ContentDuration.LONG,
        languageLevel: LanguageLevel.MEDIUM,
        authorId: author._id.toString(),
        license: LicenseType.CC_BY,
        price: 0,
        isFree: true,
        tags: ['bernini', 'biografia', 'barocco', 'scultura'],
      },
      // Museum intro item
      {
        referenceType: ItemReferenceType.MUSEUM,
        referenceId: 'Q180916', // Galleria Borghese
        title: 'Benvenuti alla Galleria Borghese',
        text: `Benvenuti alla Galleria Borghese! Questo bellissimo museo si trova dentro Villa Borghese, il grande parco nel centro di Roma.

La collezione fu iniziata più di 400 anni fa dal Cardinale Scipione Borghese, nipote del Papa. Amava l'arte e collezionava sculture e dipinti dei migliori artisti del suo tempo.

Oggi potrai vedere opere straordinarie di Bernini, Caravaggio, Raffaello, Tiziano e molti altri grandi maestri. Buona visita!`,
        duration: ContentDuration.MEDIUM,
        languageLevel: LanguageLevel.ELEMENTARY,
        authorId: author._id.toString(),
        license: LicenseType.CC0,
        price: 0,
        isFree: true,
        tags: ['introduzione', 'museo', 'storia'],
      },
      // NOTE: Logistic and Navigation content is now defined inline in VisitSteps,
      // not as separate Items. They are specific to each visit's context.
    ]);

    console.log(`✅ Created ${items.length} content items\n`);

    // Get item IDs for visit
    const apolloDafneIntro = items.find((i) => i.title.includes('Apollo e Dafne - Introduzione'));
    const apolloDafneCompleto = items.find((i) =>
      i.title.includes('Apollo e Dafne - Descrizione completa'),
    );
    const caravaggioIntro = items.find((i) => i.title.includes('Ragazzo con canestra'));
    // Note: berniniVita and museoIntro Items exist but are not currently linked to visit steps.
    // They can be used in future visits or as standalone content.

    // ========================================
    // VISITS
    // ========================================
    console.log('🚶 Creating visits...');

    const visits = await VisitModel.create([
      {
        museumId: 'Q180916',
        authorId: author._id.toString(),
        authorName: 'autore1',
        title: 'Capolavori del Barocco - Bernini e Caravaggio',
        description:
          'Un percorso alla scoperta dei due grandi maestri del Barocco italiano: le sculture dinamiche di Bernini e i dipinti intensi di Caravaggio.',
        coverImage:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Apollo_and_Daphne_%28Bernini%29.jpg/400px-Apollo_and_Daphne_%28Bernini%29.jpg',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: VisitStepType.LOGISTIC,
            logisticTitle: 'Benvenuti alla Galleria Borghese',
            logisticText:
              'La Galleria Borghese è uno dei musei più importanti di Roma. Il percorso inizia al piano terra con le sculture del Bernini.',
            logisticIcon: 'info',
            isOptional: false,
            estimatedDuration: 30,
          },
          {
            id: 'step-2',
            order: 2,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q506980', // Apollo e Dafne
            itemIds: [apolloDafneIntro?._id.toString(), apolloDafneCompleto?._id.toString()].filter(
              Boolean,
            ) as string[],
            isOptional: false,
          },
          {
            id: 'step-3',
            order: 3,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q1192658', // Ratto di Proserpina
            itemIds: [],
            isOptional: false,
          },
          {
            id: 'step-4',
            order: 4,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q1192655', // David
            itemIds: [],
            isOptional: false,
          },
          {
            id: 'step-5',
            order: 5,
            type: VisitStepType.NAVIGATION,
            navigationText:
              'Sali al primo piano usando le scale monumentali per vedere i dipinti di Caravaggio',
            fromRoom: 'Sala III',
            toRoom: 'Pinacoteca - Sala VIII',
            isOptional: false,
            estimatedDuration: 60,
          },
          {
            id: 'step-6',
            order: 6,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q2338615', // Ragazzo con canestra
            itemIds: caravaggioIntro ? [caravaggioIntro._id.toString()] : [],
            isOptional: false,
          },
          {
            id: 'step-7',
            order: 7,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q2626251', // San Giovanni Battista
            itemIds: [],
            isOptional: true,
          },
        ],
        generalInfo: {
          estimatedDuration: 60,
          difficulty: 'medio',
          accessibilityFeatures: ['wheelchair', 'audioDescription'],
        },
        targetAudience: {
          languageLevels: [LanguageLevel.ELEMENTARY, LanguageLevel.MEDIUM],
          ageGroups: ['adulti', 'famiglie'],
          estimatedDuration: 60,
        },
        metadata: {
          language: 'it',
          supportedLanguages: ['it', 'en'],
          artworksCount: 5,
          totalItemsCount: 4,
          estimatedDuration: 60,
          price: 0,
          isFree: true,
          license: LicenseType.CC0,
          downloadsCount: 0,
          purchasesCount: 0,
        },
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        museumId: 'Q180916',
        authorId: author._id.toString(),
        authorName: 'autore1',
        title: 'I capolavori in 30 minuti',
        description:
          'Una visita veloce per chi ha poco tempo: le 5 opere imperdibili della Galleria Borghese.',
        coverImage:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Pauline_Bonaparte_as_Venus_Victrix_by_Antonio_Canova_%2C_front_view%2C_Galleria_Borghese%2C_Rome%2C_Italy_%282%29.jpg/400px-Pauline_Bonaparte_as_Venus_Victrix_by_Antonio_Canova_%2C_front_view%2C_Galleria_Borghese%2C_Rome%2C_Italy_%282%29.jpg',
        steps: [
          {
            id: 'q-step-1',
            order: 1,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q2992978', // Paolina
            itemIds: [],
            isOptional: false,
          },
          {
            id: 'q-step-2',
            order: 2,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q506980', // Apollo e Dafne
            itemIds: apolloDafneIntro ? [apolloDafneIntro._id.toString()] : [],
            isOptional: false,
          },
          {
            id: 'q-step-3',
            order: 3,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q1192658', // Ratto di Proserpina
            itemIds: [],
            isOptional: false,
          },
          {
            id: 'q-step-4',
            order: 4,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q5765961', // Amor Sacro e Profano
            itemIds: [],
            isOptional: false,
          },
          {
            id: 'q-step-5',
            order: 5,
            type: VisitStepType.ARTWORK,
            artworkId: 'Q2338615', // Ragazzo con canestra
            itemIds: caravaggioIntro ? [caravaggioIntro._id.toString()] : [],
            isOptional: false,
          },
        ],
        generalInfo: {
          estimatedDuration: 30,
          difficulty: 'facile',
          accessibilityFeatures: ['wheelchair'],
        },
        targetAudience: {
          languageLevels: [LanguageLevel.ELEMENTARY],
          ageGroups: ['tutti'],
          estimatedDuration: 30,
        },
        metadata: {
          language: 'it',
          artworksCount: 5,
          totalItemsCount: 2,
          estimatedDuration: 30,
          price: 0,
          isFree: true,
          license: LicenseType.CC0,
          downloadsCount: 0,
          purchasesCount: 0,
        },
        isPublished: true,
        publishedAt: new Date(),
      },
    ]);

    console.log(`✅ Created ${visits.length} visits\n`);

    // ========================================
    // Update museum markers with artwork positions
    // ========================================
    console.log('📍 Updating museum markers...');

    const artworkMarkers = artworks
      .filter((a) => a.mapPosition)
      .map((artwork) => ({
        id: `marker-${artwork.wikidataId}`,
        floorId: artwork.mapPosition!.floorId,
        artworkId: artwork.wikidataId,
        x: artwork.mapPosition!.x,
        y: artwork.mapPosition!.y,
        rotation: artwork.mapPosition!.rotation || 0,
        type: MarkerType.ARTWORK,
        label: artwork.title,
        isVisible: true,
        isAccessible: true,
      }));

    // Add markers to floors
    for (const marker of artworkMarkers) {
      const floorIndex = galleriaBorghese.floors.findIndex((f) => f.id === marker.floorId);
      if (floorIndex >= 0) {
        galleriaBorghese.floors[floorIndex].markers.push(marker);
      }
    }

    await galleriaBorghese.save();
    console.log(`✅ Added ${artworkMarkers.length} markers to museum floors\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('═'.repeat(50));
    console.log('🌱 DATABASE SEEDING COMPLETED!');
    console.log('═'.repeat(50));
    console.log(`
📊 Summary:
   - Users: ${users.length}
   - Museums: 1 (Galleria Borghese)
   - Artworks: ${artworks.length}
   - Content Items: ${items.length}
   - Visits: ${visits.length}

🔑 Test Credentials:
   - Author: autore1 / 12345678
   - Curator: curatore1 / 12345678
   - Visitor: visitatore1 / 12345678
   - Admin: admin / 12345678

🏛️ Museum Wikidata IDs:
   - Galleria Borghese: Q180916

🎨 Artwork Wikidata IDs:
   - Apollo e Dafne: Q506980
   - Ratto di Proserpina: Q1192658
   - David (Bernini): Q1192655
   - Ragazzo con canestra: Q2338615
   - San Giovanni Battista: Q2626251
   - Madonna dei Palafrenieri: Q1471498
   - Amor Sacro e Profano: Q5765961
   - Paolina Borghese: Q2992978

👤 Author Wikidata IDs:
   - Bernini: Q29430
   - Caravaggio: Q42207
   - Tiziano: Q47551
   - Canova: Q5547
`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
