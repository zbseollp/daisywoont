import navFromWp from './nav-from-wp.json';
import { normalizeNavHref } from '../utils/format';

export const siteConfig = {
  name: 'DaisyWoont.nl',
  title: 'DaisyWoont.nl | Voor al jouw woontips!',
  description:
    'Bij DaisyWoont.nl kun je terecht voor alle tips en trends op het gebied van wonen. Op zoek naar uniek interieur? Dan zit je hier goed.',
  url: 'https://daisywoont.nl',
};

type NavChild = { label: string; href: string };
type NavItem = { label: string; href: string; children?: NavChild[] };

function mapNav(items: typeof navFromWp): NavItem[] {
  return items.map((item) => ({
    label: item.label,
    href: normalizeNavHref(item.href),
    children: item.children?.map((child) => ({
      label: child.label,
      href: normalizeNavHref(child.href),
    })),
  }));
}

export const navItems = mapNav(navFromWp).map((item) => {
  if (item.label === 'Blogs') return { ...item, href: '/blogs/' };
  return item;
});

export const services = [
  { label: 'Meubilair', icon: '/images/icon-park-outline_sofa-1.svg', href: '/#services' },
  { label: 'Bedden', icon: '/images/icon-park-outline_double-bed.svg', href: '/#services' },
  { label: 'Woonkamer', icon: '/images/icon-park-outline_tv-1.svg', href: '/#services' },
  { label: 'Kunst & Decor', icon: '/images/icon-park-outline_card-two-1.svg', href: '/#services' },
  { label: 'Keuken', icon: '/images/icon-park-outline_oven.svg', href: '/#services' },
  { label: 'Verlichting', icon: '/images/icon-park-outline_desk-lamp.svg', href: '/#services' },
  { label: 'Planten', icon: '/images/icon-park-outline_sleaves.svg', href: '/#services' },
  { label: 'Badkamer', icon: '/images/icon-park-outline_tub.svg', href: '/#services' },
];

export const newsArticles = [
  {
    category: 'Meubilair',
    title: 'De perfecte aanvulling op jouw ruimte',
    excerpt:
      'Bijzettafels vormen een essentieel en veelzijdig element in het interieurontwerp, waardoor ze een waardevolle aanvulling zijn op verschillende ruimtes in huis.',
    image: '/images/listerby-coffee-table-oak-veneer__1022538_pe832796_s5.jpg',
    alt: 'Houten bijzettafel in een gezellige woonkamer',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
  {
    category: 'Verwarmers & Koelers',
    title: 'Kleine houtkachel',
    excerpt: 'Ontdek compacte houtkachels die warmte en sfeer toevoegen aan elke ruimte in huis.',
    image: '/images/radiator-1.jpg',
    alt: 'Moderne radiator en verwarming in interieur',
    href: '/zo-maak-jij-je-huis-klaar-voor-de-toekomst/',
  },
  {
    category: 'Meubilair',
    title: 'Slaapbank 2-persoons',
    excerpt: 'Een veelzijdige slaapbank combineert comfortabel zitten met een praktische slaapoplossing voor gasten.',
    image: '/images/slaapkamer.jpg',
    alt: 'Stijlvolle slaapkamer met moderne meubels',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
];

export const blogHighlights = [
  {
    category: 'Badkamer',
    title: 'Waterbesparende douchekop',
    excerpt: 'Bespaar water zonder in te leveren op comfort met een moderne douchekop.',
    image: '/images/douche.jpg',
    alt: 'Moderne badkamer met waterbesparende douche',
    href: '/wandsieraad-ophangen-stijlvolle-decoratie-voor-uw-interieur/',
  },
  {
    category: 'Slaapkamer',
    title: 'Boxspring met tv lift',
    excerpt: 'Combineer luxe slaapcomfort met slimme technologie in je slaapkamer.',
    image: '/images/slaapkamer.jpg',
    alt: 'Slaapkamer met boxspring bed',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
  {
    category: 'Verwarmers & Koelers',
    title: 'Infrarood verwarming',
    excerpt: 'Efficiënte en comfortabele verwarming voor een aangenaam binnenklimaat.',
    image: '/images/radiator-1.jpg',
    alt: 'Infrarood verwarming paneel aan muur',
    href: '/zo-maak-jij-je-huis-klaar-voor-de-toekomst/',
  },
  {
    category: 'Wassen & Drogen',
    title: 'Dubbele wasmand',
    excerpt: 'Houd je was netjes gesorteerd met een praktische dubbele wasmand.',
    image: '/images/wasmand.jpg',
    alt: 'Dubbele wasmand in wasruimte',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
];

export const selectedArticles = [
  {
    category: 'Apparaten',
    title: 'Stoomreiniger vloer',
    excerpt: 'Grondig schoonmaken van vloeren met een krachtige stoomreiniger.',
    image: '/images/cleaner.jpg',
    alt: 'Stoomreiniger voor vloer schoonmaken',
    href: '/zo-maak-jij-je-huis-klaar-voor-de-toekomst/',
  },
  {
    category: 'Wassen & Drogen',
    title: 'Inbouw wasmachine',
    excerpt: 'Een naadloos geïntegreerde wasmachine voor een strakke keuken of badkamer.',
    image: '/images/wasmachine.jpg',
    alt: 'Ingebouwde wasmachine in keuken',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
  {
    category: 'Meubilair',
    title: 'Hangstoel binnen',
    excerpt: 'Creëer een ontspannen hoekje met een stijlvolle hangstoel voor binnen.',
    image: '/images/listerby-coffee-table-oak-veneer__1022538_pe832796_s56.jpg',
    alt: 'Hangstoel in woonkamer interieur',
    href: '/zo-creeer-je-jouw-droominterieur-tips-woontrends-en-stylingadvies/',
  },
  {
    category: 'Verlichting',
    title: 'Hanglamp eettafel',
    excerpt: 'De perfecte hanglamp als eyecatcher boven je eettafel.',
    image: '/images/listerby-coffee-table-oak-veneer__1022538_pe832796_s57.jpg',
    alt: 'Hanglamp boven eettafel',
    href: '/wandsieraad-ophangen-stijlvolle-decoratie-voor-uw-interieur/',
  },
];

export const testimonials = [
  {
    quote:
      'Dankzij DaisyWoont heb ik eindelijk de perfecte bijzettafel gevonden. Eerlijke reviews en praktische tips!',
    author: 'Sophie',
    role: 'Interieurliefhebber',
  },
  {
    quote:
      'De woontips op DaisyWoont.nl helpen me bij elke aankoop. Betrouwbaar en inspirerend.',
    author: 'Mark',
    role: 'Huiseigenaar',
  },
  {
    quote:
      'Ik lees regelmatig de blogs en vind altijd iets nieuws voor mijn interieur. Absoluut een aanrader!',
    author: 'Emma',
    role: 'Woonblogger',
  },
];
