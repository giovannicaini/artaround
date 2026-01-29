import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database';
import { User, Museum, Item, Visit } from '../models';
import { UserRole, CompetenceLevel, ContentDuration, LicenseType, TimePreference } from '@artaround/shared';

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
          interests: ['arte', 'storia'],
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
          interests: ['pittura', 'scultura'],
          availableTime: TimePreference.VELOCE,
          age: 25,
          language: 'it',
        },
      },
    ]);

    console.log(`✅ Created ${users.length} users\n`);

    // Create museums
    console.log('Creating museums...');
    const museums = await Museum.create([
      {
        name: 'Galleria Nazionale di Parma',
        description: 'La Galleria Nazionale di Parma ospita una straordinaria collezione di opere d\'arte dal Medioevo al Settecento.',
        location: {
          address: 'Piazzale della Pilotta, 15',
          city: 'Parma',
          country: 'Italia',
          coordinates: {
            lat: 44.8028,
            lng: 10.3283,
          },
        },
        images: [],
        isActive: true,
      },
      {
        name: 'Museo Generico',
        description: 'Un museo generico per testare l\'applicazione con contenuti multipli.',
        location: {
          address: 'Via Roma, 1',
          city: 'Milano',
          country: 'Italia',
        },
        images: [],
        isActive: true,
      },
    ]);

    console.log(`✅ Created ${museums.length} museums\n`);

    // Create items for Galleria Nazionale di Parma
    console.log('🎨 Creating items...');
    const museum1 = museums[0];
    const author1 = users[0];

    const itemsData = [
      {
        title: 'Ritratto di frate in veste di San Tommaso d\'Aquino',
        objectId: 'Q126599960',
        author: 'Q1527051', // Girolamo Mazzola Bedoli
        style: 'Q131808', // Manierismo
      },
      {
        title: 'Madonna col Bambino',
        objectId: 'Q123456',
        author: 'Q5597',
        style: 'Q1474884',
      },
      {
        title: 'La Deposizione',
        objectId: 'Q789012',
        author: 'Q5597',
        style: 'Q1474884',
      },
      {
        title: 'Ritratto di giovane donna',
        objectId: 'Q345678',
        author: 'Q1527051',
        style: 'Q131808',
      },
      {
        title: 'Natura morta con frutta',
        objectId: 'Q901234',
        author: 'Q123456',
        style: 'Q164900',
      },
      {
        title: 'Paesaggio campestre',
        objectId: 'Q567890',
        author: 'Q234567',
        style: 'Q191163',
      },
      {
        title: 'San Sebastiano',
        objectId: 'Q678901',
        author: 'Q5597',
        style: 'Q1474884',
      },
      {
        title: 'Annunciazione',
        objectId: 'Q789013',
        author: 'Q1527051',
        style: 'Q131808',
      },
      {
        title: 'Ritratto di nobile',
        objectId: 'Q890124',
        author: 'Q234567',
        style: 'Q166379',
      },
      {
        title: 'La Crocifissione',
        objectId: 'Q901235',
        author: 'Q5597',
        style: 'Q1474884',
      },
    ];

    const items = [];
    for (const itemData of itemsData) {
      const item = await Item.create({
        museumId: museum1._id.toString(),
        objectId: itemData.objectId,
        authorId: author1._id.toString(),
        title: itemData.title,
        contents: [
          // Infantile level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.INFANTILE,
            text: `${itemData.title}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.INFANTILE,
            text: `Questo quadro si chiama "${itemData.title}". È un'opera d'arte molto bella dipinta tanto tempo fa.`,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.INFANTILE,
            text: `Questo bellissimo quadro si chiama "${itemData.title}". È stato dipinto da un artista molto bravo che viveva tanti anni fa. Nel quadro puoi vedere tante cose interessanti e bei colori che l'artista ha usato con molta cura.`,
          },
          // Semplice level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.SEMPLICE,
            text: `${itemData.title}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.SEMPLICE,
            text: `Questo dipinto, "${itemData.title}", rappresenta un esempio significativo dell'arte italiana. L'opera mostra uno stile elegante e una composizione equilibrata.`,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.SEMPLICE,
            text: `"${itemData.title}" è un'opera che cattura l'attenzione per la sua composizione armoniosa e l'uso sapiente dei colori. L'artista ha creato un'immagine che riesce a comunicare emozioni attraverso l'espressione dei soggetti rappresentati e la qualità della tecnica pittorica impiegata.`,
          },
          // Medio level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.MEDIO,
            text: `${itemData.title}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.MEDIO,
            text: `"${itemData.title}" rappresenta un esempio significativo della produzione artistica italiana. L'opera si distingue per l'eleganza compositiva e la padronanza tecnica, caratteristiche distintive dello stile dell'autore.`,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.MEDIO,
            text: `Quest'opera, "${itemData.title}", esemplifica le caratteristiche fondamentali della pittura italiana del periodo. La composizione mostra un equilibrio formale notevole, con una distribuzione armoniosa degli elementi e un uso sofisticato del chiaroscuro. L'artista dimostra una profonda comprensione dei canoni estetici dell'epoca, realizzando un'opera che unisce virtuosismo tecnico e profondità espressiva.`,
          },
          // Avanzato level
          {
            duration: ContentDuration.SHORT,
            language: CompetenceLevel.AVANZATO,
            text: `${itemData.title}`,
          },
          {
            duration: ContentDuration.MEDIUM,
            language: CompetenceLevel.AVANZATO,
            text: `"${itemData.title}" si configura come un'espressione paradigmatica della sensibilità artistica del periodo, caratterizzata da una rigorosa costruzione formale e da una raffinata elaborazione cromatica che riflette l'influenza delle correnti artistiche contemporanee.`,
          },
          {
            duration: ContentDuration.LONG,
            language: CompetenceLevel.AVANZATO,
            text: `L'opera "${itemData.title}" rappresenta un momento significativo nell'evoluzione stilistica dell'autore. La composizione rivela una complessa stratificazione semantica, ottenuta attraverso un'accurata orchestrazione degli elementi formali. L'articolazione spaziale evidenzia una profonda riflessione sui canoni estetici del periodo, mentre l'elaborazione cromatica dimostra una piena padronanza delle tecniche pittoriche. L'opera si inserisce nel dibattito artistico dell'epoca, offrendo una sintesi originale tra tradizione e innovazione.`,
          },
        ],
        metadata: {
          author: itemData.author,
          style: itemData.style,
          license: LicenseType.CC_BY,
          price: 0,
          isFree: true,
          tags: ['pittura', 'arte italiana'],
        },
      });
      items.push(item);
    }

    console.log(`✅ Created ${items.length} items\n`);

    // Create visits
    console.log('🚶 Creating visits...');
    
    // Visit 1: Base (medio, 1 ora)
    const visit1 = await Visit.create({
      museumId: museum1._id.toString(),
      authorId: author1._id.toString(),
      title: 'Visita Base - Capolavori della Galleria',
      description: 'Un percorso di un\'ora attraverso i principali capolavori della collezione, adatto a tutti i visitatori.',
      items: items.slice(0, 10).map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: false,
      })),
      logisticNotes: [
        {
          order: 0,
          text: 'L\'entrata del museo è da Piazzale della Pilotta 15. Il biglietto costa 15€.',
          type: 'info',
        },
      ],
      navigationNotes: [
        {
          fromItemId: items[0]._id.toString(),
          toItemId: items[1]._id.toString(),
          text: 'Proseguire nella sala successiva verso destra.',
          estimatedTime: 60,
        },
      ],
      targetAudience: {
        competenceLevel: [CompetenceLevel.MEDIO],
        interests: ['arte', 'pittura', 'storia'],
        timeRequired: TimePreference.NORMALE,
      },
      metadata: {
        language: 'it',
        duration: 60,
        itemsCount: 10,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });

    // Visit 2: Approfondita (avanzato, 2-3 ore)
    const visit2 = await Visit.create({
      museumId: museum1._id.toString(),
      authorId: author1._id.toString(),
      title: 'Visita Approfondita - Analisi Critica',
      description: 'Un percorso approfondito di 2-3 ore per esperti d\'arte, con analisi critiche dettagliate.',
      items: items.slice(0, 10).map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: false,
      })),
      logisticNotes: [
        {
          order: 0,
          text: 'Questa visita richiede circa 2-3 ore. Si consiglia di prevedere una pausa.',
          type: 'info',
        },
      ],
      navigationNotes: [],
      targetAudience: {
        competenceLevel: [CompetenceLevel.AVANZATO],
        interests: ['storia dell\'arte', 'critica d\'arte', 'iconografia'],
        timeRequired: TimePreference.APPROFONDITO,
      },
      metadata: {
        language: 'it',
        duration: 150,
        itemsCount: 10,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });

    // Visit 3: Famiglia (infantile/semplice, 45 min)
    const visit3 = await Visit.create({
      museumId: museum1._id.toString(),
      authorId: users[1]._id.toString(), // autore2
      title: 'Visita per Famiglie - Arte per Tutti',
      description: 'Un percorso breve e coinvolgente di 45 minuti, perfetto per famiglie con bambini.',
      items: items.slice(0, 8).map((item, index) => ({
        itemId: item._id.toString(),
        order: index + 1,
        isOptional: index >= 6, // Ultimi 2 opzionali
      })),
      logisticNotes: [
        {
          order: 0,
          text: 'Servizi igienici disponibili all\'ingresso e al secondo piano.',
          type: 'info',
        },
        {
          order: 1,
          text: 'Bar e area relax al piano terra.',
          type: 'info',
        },
      ],
      navigationNotes: [],
      targetAudience: {
        minAge: 6,
        maxAge: 12,
        competenceLevel: [CompetenceLevel.INFANTILE, CompetenceLevel.SEMPLICE],
        interests: ['arte', 'colori', 'storie'],
        timeRequired: TimePreference.VELOCE,
      },
      metadata: {
        language: 'it',
        duration: 45,
        itemsCount: 8,
        price: 0,
        isFree: true,
        license: LicenseType.CC_BY,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });

    console.log(`✅ Created 3 visits\n`);

    console.log('🎉 Seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Museums: ${museums.length}`);
    console.log(`   - Items: ${items.length}`);
    console.log(`   - Visits: 3\n`);
    console.log('👤 Test Users:');
    console.log('   - autore1 / 12345678');
    console.log('   - autore2 / 12345678');
    console.log('   - visitatore1 / 12345678');
    console.log('   - visitatore2 / 12345678\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seed();
