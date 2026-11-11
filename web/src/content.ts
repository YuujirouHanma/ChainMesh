// Data situs di satu tempat: nama, peran, dan link. Ubah di sini, bukan di komponen.

export const SITE = {
  name: 'ChainMesh',
  repoUrl: 'https://github.com/YuujirouHanma/ChainMesh',
  // BASE_URL = '/' (server demo) atau '/ChainMesh/' (GitHub Pages)
  paperPdf: `${import.meta.env.BASE_URL}paper/theoretical-analysis-blockchain-p2p-network.pdf`,
  paperSource:
    'https://github.com/abdanhafidz/blockchain-withp2p-network/blob/master/documentation/assets/theoretical-analysis-blockchain-p2p-network.pdf',
  author: { name: 'Jeremia Kevin Alexandre', email: 'jeremiakevinalexandre@gmail.com' },
};

export interface TeamMember {
  name: string;
  github: string | null;
  role: { en: string; id: string };
  me?: boolean;
}

export const TEAM: TeamMember[] = [
  {
    name: 'Abdan Hafidz',
    github: 'abdanhafidz',
    role: {
      en: 'Original architecture and code, author of the theoretical analysis paper',
      id: 'Arsitektur dan kode awal, penulis paper analisis teori',
    },
  },
  {
    name: 'Farhan',
    github: 'farhanwew',
    role: { en: 'Contributor', id: 'Kontributor' },
  },
  {
    name: SITE.author.name,
    github: 'YuujirouHanma',
    role: {
      en: 'Network and consensus fixes, testing, interactive web demo',
      id: 'Perbaikan jaringan dan konsensus, pengujian, demo web interaktif',
    },
    me: true,
  },
];

export const STACK = ['Python 3.12', 'WebSocket', 'ECDSA secp256k1', 'SHA-256', 'BIP-39', 'React', 'FastAPI'];
