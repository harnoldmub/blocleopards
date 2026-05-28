import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    body TEXT NOT NULL,
    date TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    image TEXT,
    video TEXT,
    audio TEXT,
    source_title TEXT,
    source_url TEXT,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
console.log("Table articles créée");

const articles = [
  {
    slug: "2026-05-25-retour-mondial-52-ans",
    title: "Les Léopards retrouvent le Mondial après 52 ans",
    description: "La RDC a validé son retour en Coupe du monde après une victoire 1-0 contre la Jamaïque en barrage intercontinental.",
    body: `La qualification face à la Jamaïque a remis les Léopards sur la scène mondiale pour la première fois depuis 1974.

La CAF souligne le rôle décisif d'Axel Tuanzebe, buteur en prolongation, et l'importance de la solidité défensive autour de Chancel Mbemba et Lionel Mpasi. La RDC rejoint ainsi un groupe relevé avec le Portugal, la Colombie et l'Ouzbékistan.

Pour les supporters, cette qualification dépasse le terrain : elle ouvre un été de mobilisation nationale et diaspora.`,
    date: "2026-05-25",
    tags: ["Mondial 2026", "Qualification", "CAF"],
    image: "/media/web-supporters-chan.jpg",
    video: "/videos/retour-mondial-52-ans.mp4",
    source_title: "CAF Online",
    source_url: "https://www.cafonline.com/fifa-world-cup/news/dr-congo-end-52-year-world-cup-wait-with-extra-time-victory-over-jamaica/",
  },
  {
    slug: "2026-05-25-hommage-diaspora",
    title: "Hommage à la diaspora",
    description: "De Liège à Marbella, retour sur l'élan de la diaspora autour des Léopards.",
    body: `Le match amical à Liège et le rassemblement de Marbella ont rappelé une évidence : la diaspora est une force vive du soutien aux Léopards.

Dans les tribunes, devant les bus, autour des drapeaux et des chants, la même émotion circule. Chaque voix compte, chaque couleur levée raconte l'attachement au pays.

Cet hommage rassemble ces moments de ferveur et de gratitude pour celles et ceux qui portent la RDC partout où les Léopards jouent.`,
    date: "2026-05-25",
    tags: ["Diaspora", "Liège", "Marbella"],
    image: "/media/hommage-diaspora-cover.jpg",
    video: "/videos/hommage-diaspora-match-amical.mp4",
    audio: "/audio/hommage-diaspora.mp3",
  },
  {
    slug: "2026-05-25-desabre-continuite-groupe",
    title: "Désabre mise sur la continuité",
    description: "La liste des 26 confirme une ossature stable, avec Gaël Kakuta de retour et plusieurs absents commentés.",
    body: `La liste de Sébastien Désabre confirme une idée claire : garder le socle qui a porté les Léopards jusqu'au Mondial.

Factuel détaille un groupe de 26 avec 3 gardiens, 9 défenseurs, 7 milieux et 7 attaquants. Le retour de Gaël Kakuta accompagne une sélection construite sur l'équilibre, même si plusieurs binationaux et joueurs attendus restent hors du groupe.

Le message sportif est lisible : stabilité, automatismes et confiance avant la dernière ligne droite.`,
    date: "2026-05-25",
    tags: ["Sélection", "Désabre", "Liste"],
    image: "/media/liste-officielle-leopards-2026.jpg",
    source_title: "Factuel",
    source_url: "https://www.factuel.cd/2026/05/19/mondial-2026-les-26-elus-de-desabre-sont-connus",
  },
  {
    slug: "2026-05-25-liste-officielle-leopards",
    title: "La liste officielle des Léopards",
    description: "Voici la liste officielle des Léopards qui vont défendre le drapeau au mondial.",
    body: `Un seul bloc, que pour la nation, fimbu n'a fimbu.

L'heure a sonné. Tout un peuple pousse derrière nos fauves, dans la même énergie et avec la même fierté.

Ensemble vers les sommets. Le drapeau devant, la nation derrière.`,
    date: "2026-05-25",
    tags: ["Léopards", "Sélection", "Mondial"],
    image: "/media/liste-officielle-leopards-2026.jpg",
  },
  {
    slug: "2026-05-25-programme-preparation-danemark-chili",
    title: "Danemark et Chili au programme des Léopards",
    description: "Deux amicaux de haut niveau attendent la RDC avant le départ vers les États-Unis.",
    body: `Les Léopards tiennent leur feuille de route européenne : Danemark le 3 juin à Liège, puis Chili le 9 juin à Marbella.

Digital Congo présente ces deux rencontres comme des tests importants avant l'entrée dans le grand bain mondial. Liège donne rendez-vous à une diaspora très mobilisée, tandis que Marbella prolonge une histoire déjà familière avec la sélection congolaise.

Pour le Bloc, ces dates sont des points de ralliement : drapeaux, chants et soutien positif.`,
    date: "2026-05-25",
    tags: ["Préparation", "Danemark", "Chili"],
    image: "/media/hommage-diaspora-cover.jpg",
    source_title: "Digital Congo",
    source_url: "https://digitalcongo.org/detail15035-mondial-2026-les-leopards-s-offrent-le-danemark-et-le-chili-en-amical",
  },
  {
    slug: "2026-05-28-naza-liege",
    title: "Naza en prestation à Liège le soir du match",
    description: "L'artiste @nazaofficiel en prestation exceptionnelle lors du match RDC vs Danemark ce 3 juin à Liège.",
    body: `Le 28 mai 2026, une annonce électrise la diaspora congolaise : l'artiste Naza se produira en prestation exceptionnelle lors du match RDC 🇨🇩 vs Danemark 🇩🇰, ce 3 juin à Liège.

Football, ambiance et fierté congolaise au rendez-vous.

Naza, figure incontournable de la scène afro-urbaine, apportera toute son énergie pour faire vibrer les supporters des Léopards. Un moment rare où musique et football se rejoignent pour célébrer la RDC sur la scène européenne.

Diaspora congolaise, c'est le moment de réserver vos places et de former un seul bloc derrière nos Léopards pour cette grande répétition avant la Coupe du Monde.

Qui sera à Liège ce 3 juin ?

#BlocLeopards #WorldCup2026 #DiasporaCongolaise`,
    date: "2026-05-28",
    tags: ["Naza", "Liège", "Diaspora", "Musique", "Danemark"],
    image: "/media/hommage-diaspora-cover.jpg",
    video: "/videos/naza-liege.mp4",
  },
];

for (const a of articles) {
  await sql`
    INSERT INTO articles (slug, title, description, body, date, tags, image, video, audio, source_title, source_url, published)
    VALUES (
      ${a.slug}, ${a.title}, ${a.description}, ${a.body}, ${a.date},
      ${a.tags || []}, ${a.image || null}, ${a.video || null}, ${a.audio || null},
      ${a.source_title || null}, ${a.source_url || null}, true
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, description = EXCLUDED.description, body = EXCLUDED.body,
      date = EXCLUDED.date, tags = EXCLUDED.tags, image = EXCLUDED.image,
      video = EXCLUDED.video, audio = EXCLUDED.audio,
      source_title = EXCLUDED.source_title, source_url = EXCLUDED.source_url,
      updated_at = NOW()
  `;
  console.log(`✓ ${a.slug}`);
}

console.log("Migration terminée.");
process.exit(0);
