/**
 * HomeAtlasUI sample data, ported verbatim from HomeAtlasUI/src/data/index.ts.
 *
 * The homepage sections that have no backend source yet (investor yields,
 * deals, sold-below-purchase, schools, incentives, market snapshot, news…)
 * render from this, per the product decision to treat the reference data as
 * correct until the endpoints in docs/HOMEPAGE_BACKEND_REQUIREMENTS.xlsx
 * exist. Live sections (listings, communities, precon, property types, blog)
 * never read from here.
 *
 * Sample records are not real MLS® listings, so sections built on them link
 * to searches (/listings?…), never to /property/<id>.
 */

export type PropertyStatus = "active" | "sold";
export type PropertyType = "Detached" | "Condo" | "Townhome" | "Semi-Detached" | "Luxury" | "Rental";

export interface Property {
  id: string;
  address: string;
  neighbourhood: string;
  community: string;
  price: number;
  soldPrice?: number;
  soldDate?: string;
  beds: number;
  baths: number;
  type: PropertyType;
  sqft: number;
  status: PropertyStatus;
  badge?: string;
  badgeColor?: string;
  mls: string;
  image: string;
  saved?: boolean;
}

export interface Community {
  id: string;
  name: string;
  listings: number;
  avgPrice: number;
  image: string;
  bgColor?: string;
  textColor?: string;
}

export interface PreconstructionProject {
  id: string;
  name: string;
  location: string;
  developer: string;
  startingPrice: number;
  status: string;
  statusColor?: string;
  image: string;
}

export const properties: Property[] = [
  {
    id: "p1",
    address: "18 Edenbridge Drive",
    neighbourhood: "Etobicoke",
    community: "Toronto",
    price: 1289000,
    beds: 4,
    baths: 3,
    type: "Detached",
    sqft: 2480,
    status: "active",
    badge: "New",
    badgeColor: "bg-black text-white",
    mls: "W8423187",
    image: "/images/home/modern-toronto-residence.png",
  },
  {
    id: "p2",
    address: "2801 – 15 Mercer Street",
    neighbourhood: "King West",
    community: "Toronto",
    price: 748900,
    beds: 2,
    baths: 2,
    type: "Condo",
    sqft: 821,
    status: "active",
    badge: "Open House",
    badgeColor: "bg-[#f2ebdd] text-black",
    mls: "C8421992",
    image: "/images/home/toronto-condominium.png",
  },
  {
    id: "p3",
    address: "62 Coastal Trail",
    neighbourhood: "Vellore Village",
    community: "Vaughan",
    price: 1049000,
    beds: 3,
    baths: 3,
    type: "Townhome",
    sqft: 1865,
    status: "active",
    badge: "Price Drop",
    badgeColor: "bg-[#151515] text-white",
    mls: "N8422431",
    image: "/images/home/vaughan-townhome.png",
  },
  {
    id: "p4",
    address: "221 Lakeshore Rd East, Unit 803",
    neighbourhood: "Port Credit",
    community: "Mississauga",
    price: 879000,
    beds: 2,
    baths: 2,
    type: "Condo",
    sqft: 1020,
    status: "active",
    badge: "New",
    badgeColor: "bg-black text-white",
    mls: "W8524331",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p5",
    address: "44 Heritage Oak Blvd",
    neighbourhood: "Windfields",
    community: "Markham",
    price: 1375000,
    beds: 4,
    baths: 4,
    type: "Detached",
    sqft: 2920,
    status: "active",
    badge: "New",
    badgeColor: "bg-black text-white",
    mls: "N8498221",
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p6",
    address: "12 Ridgecrest Road",
    neighbourhood: "Bronte",
    community: "Oakville",
    price: 1895000,
    beds: 5,
    baths: 4,
    type: "Luxury",
    sqft: 3800,
    status: "active",
    badge: "Open House",
    badgeColor: "bg-[#f2ebdd] text-black",
    mls: "W8501843",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p7",
    address: "88 Maple Grove Ave",
    neighbourhood: "Kleinburg",
    community: "Vaughan",
    price: 1198000,
    beds: 3,
    baths: 3,
    type: "Semi-Detached",
    sqft: 2100,
    status: "active",
    mls: "N8411772",
    image: "https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p8",
    address: "310 – 2 Wellington St W",
    neighbourhood: "Downtown Core",
    community: "Toronto",
    price: 649900,
    beds: 1,
    baths: 1,
    type: "Rental",
    sqft: 610,
    status: "active",
    mls: "C8419885",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p9",
    address: "77 Brock Street North",
    neighbourhood: "Old Milton",
    community: "Milton",
    price: 989000,
    beds: 3,
    baths: 2,
    type: "Townhome",
    sqft: 1740,
    status: "active",
    badge: "Price Drop",
    badgeColor: "bg-[#151515] text-white",
    mls: "W8488901",
    image: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p10",
    address: "556 Bur Oak Ave",
    neighbourhood: "Cornell",
    community: "Markham",
    price: 1125000,
    beds: 4,
    baths: 3,
    type: "Detached",
    sqft: 2300,
    status: "active",
    mls: "N8511224",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p11",
    address: "1120 Burnhamthorpe Rd W, Suite 904",
    neighbourhood: "Erin Mills",
    community: "Mississauga",
    price: 559000,
    beds: 1,
    baths: 1,
    type: "Condo",
    sqft: 688,
    status: "active",
    badge: "New",
    badgeColor: "bg-black text-white",
    mls: "W8499010",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "p12",
    address: "29 Stonehaven Drive",
    neighbourhood: "Woodland Beach",
    community: "Oakville",
    price: 2250000,
    beds: 5,
    baths: 5,
    type: "Luxury",
    sqft: 4600,
    status: "active",
    mls: "W8523441",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop&auto=format",
  },
  // SOLD PROPERTIES
  {
    id: "s1",
    address: "91 Sherwood Ave",
    neighbourhood: "North Toronto",
    community: "Toronto",
    price: 1550000,
    soldPrice: 1625000,
    soldDate: "2024-07-15",
    beds: 4,
    baths: 3,
    type: "Detached",
    sqft: 2650,
    status: "sold",
    mls: "C8311044",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s2",
    address: "401 – 80 Queens Wharf Rd",
    neighbourhood: "CityPlace",
    community: "Toronto",
    price: 699000,
    soldPrice: 720000,
    soldDate: "2024-08-02",
    beds: 2,
    baths: 2,
    type: "Condo",
    sqft: 830,
    status: "sold",
    mls: "C8344982",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s3",
    address: "14 Cactus Ave",
    neighbourhood: "Bayview Village",
    community: "Toronto",
    price: 1350000,
    soldPrice: 1280000,
    soldDate: "2024-06-20",
    beds: 3,
    baths: 3,
    type: "Semi-Detached",
    sqft: 2100,
    status: "sold",
    mls: "C8288710",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s4",
    address: "55 Dunblaine Ave",
    neighbourhood: "Bedford Park",
    community: "Toronto",
    price: 2100000,
    soldPrice: 2280000,
    soldDate: "2024-09-10",
    beds: 5,
    baths: 5,
    type: "Luxury",
    sqft: 4100,
    status: "sold",
    mls: "C8402119",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s5",
    address: "188 Palmer Ave",
    neighbourhood: "Lakeview",
    community: "Mississauga",
    price: 1150000,
    soldPrice: 1175000,
    soldDate: "2024-07-28",
    beds: 3,
    baths: 2,
    type: "Detached",
    sqft: 2000,
    status: "sold",
    mls: "W8322445",
    image: "https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s6",
    address: "30 Alton Towers Circle, Unit 12",
    neighbourhood: "Milliken",
    community: "Markham",
    price: 895000,
    soldPrice: 910000,
    soldDate: "2024-08-19",
    beds: 3,
    baths: 3,
    type: "Townhome",
    sqft: 1680,
    status: "sold",
    mls: "N8389001",
    image: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s7",
    address: "67 Baycliffe Crescent",
    neighbourhood: "West Humber",
    community: "Vaughan",
    price: 1320000,
    soldPrice: 1295000,
    soldDate: "2024-05-30",
    beds: 4,
    baths: 3,
    type: "Detached",
    sqft: 2450,
    status: "sold",
    mls: "N8261887",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&h=500&fit=crop&auto=format",
  },
  {
    id: "s8",
    address: "1900 – 1 The Esplanade",
    neighbourhood: "St. Lawrence",
    community: "Toronto",
    price: 1050000,
    soldPrice: 1025000,
    soldDate: "2024-09-05",
    beds: 2,
    baths: 2,
    type: "Condo",
    sqft: 1240,
    status: "sold",
    mls: "C8397664",
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=500&fit=crop&auto=format",
  },
];

export const communities: Community[] = [
  {
    id: "toronto",
    name: "Toronto",
    listings: 683,
    avgPrice: 1120000,
    image: "/images/home/toronto.png",
  },
  {
    id: "mississauga",
    name: "Mississauga",
    listings: 421,
    avgPrice: 952000,
    bgColor: "bg-[#151515]",
    textColor: "text-white",
    image: "https://images.unsplash.com/photo-1629906408226-af8e58bfa60f?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "vaughan",
    name: "Vaughan",
    listings: 317,
    avgPrice: 1280000,
    bgColor: "bg-[#f2ebdd]",
    textColor: "text-black",
    image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "oakville",
    name: "Oakville",
    listings: 204,
    avgPrice: 1760000,
    bgColor: "bg-white",
    textColor: "text-black",
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "markham",
    name: "Markham",
    listings: 298,
    avgPrice: 1140000,
    bgColor: "bg-[#f7f7f6]",
    textColor: "text-black",
    image: "https://images.unsplash.com/photo-1464146072230-91cabc968266?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "milton",
    name: "Milton",
    listings: 156,
    avgPrice: 1050000,
    bgColor: "bg-[#c7a45a]",
    textColor: "text-black",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "brampton",
    name: "Brampton",
    listings: 388,
    avgPrice: 940000,
    bgColor: "bg-[#151515]",
    textColor: "text-white",
    image: "https://images.unsplash.com/photo-1471039497385-b6d6ba609f9c?w=500&h=300&fit=crop&auto=format",
  },
  {
    id: "pickering",
    name: "Pickering",
    listings: 142,
    avgPrice: 1020000,
    bgColor: "bg-white",
    textColor: "text-black",
    image: "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=500&h=300&fit=crop&auto=format",
  },
];

export const preconstructionProjects: PreconstructionProject[] = [
  {
    id: "pc1",
    name: "Sora at The Glade",
    location: "Lansing Square · North York",
    developer: "Graywood",
    startingPrice: 699000,
    status: "COMING SOON",
    image: "/images/home/sora-at-the-glade.png",
  },
  {
    id: "pc2",
    name: "The Moderne",
    location: "Unionville · Markham",
    developer: "Menkes",
    startingPrice: 819000,
    status: "NOW SELLING",
    image: "/images/home/the-moderne.png",
  },
  {
    id: "pc3",
    name: "Harbourlight Residences",
    location: "Port Credit · Mississauga",
    developer: "Tridel",
    startingPrice: 735000,
    status: "VIP RELEASE",
    image: "/images/home/harbourlight-residences.png",
  },
  {
    id: "pc4",
    name: "Artsy Condos",
    location: "Queen West · Toronto",
    developer: "Streetcar",
    startingPrice: 649000,
    status: "NOW SELLING",
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&h=400&fit=crop&auto=format",
  },
  {
    id: "pc5",
    name: "Pinnacle Grand Park 2",
    location: "Mississauga City Centre · Mississauga",
    developer: "Pinnacle International",
    startingPrice: 599000,
    status: "COMING SOON",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=400&fit=crop&auto=format",
  },
  {
    id: "pc6",
    name: "The One",
    location: "Yorkville · Toronto",
    developer: "Mizrahi Developments",
    startingPrice: 1800000,
    status: "NOW SELLING",
    image: "https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=800&h=400&fit=crop&auto=format",
  },
];

export const propertyTypes: Array<{ type: PropertyType; icon: string }> = [
  { type: "Detached", icon: "house" },
  { type: "Semi-Detached", icon: "semi" },
  { type: "Townhome", icon: "townhome" },
  { type: "Luxury", icon: "luxury" },
  { type: "Condo", icon: "building" },
  { type: "Rental", icon: "rental" },
];

export function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 2)}M`;
  }
  return `$${(price / 1000).toFixed(0)}K`;
}

export function formatFullPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}
