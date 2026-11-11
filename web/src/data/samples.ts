// Blok contoh ASLI: di-mining dengan kode Python project ini (Middleware/Hash.mine,
// KeyGenerator.sign_message) dan lolos Blockchain.verify_chain. Dipakai Fig. 1 dan Fig. 6.

export interface SampleBlock {
  hash: string;
  prev_hash: string;
  message: string;
  nonce: number;
  proof_of_work: number;
  number_of_block: number;
  timeStamp: string;
  signature: string;
}

export const SAMPLE_KEYS = {
  A: '03e25f25c79ca6aba29ceac898f14b12e5fb71c2b74ab9277f5e3ae6085506b2e3',
  B: '029f4e2f694f7a9fca0285066538b51045bd40c22db815b7b05f24be7553dc7fae',
  C: '02f1749a776c373d8254f0b2a3c0207e4a2dc08f15f097f661451f2f8ff233d20a',
};

export const GENESIS = {
  hash: '0',
  prev_hash: '0',
  message: 'genesis',
  nonce: 0,
  proof_of_work: 0,
  number_of_block: 0,
  timeStamp: 0,
  signature: 0,
};

export const BLOCK_1: SampleBlock = {
  hash: '0000c4e227f64824854d12a255dcecacc002a86780deb51ae5de2752152b5504',
  prev_hash: '0',
  message: `From ${SAMPLE_KEYS.A} to ${SAMPLE_KEYS.B}, hello from A`,
  nonce: 57815,
  proof_of_work: 57814,
  number_of_block: 1,
  timeStamp: '2026-11-09 14:02:11.482913',
  signature:
    '0e060bd9510b28d8c7b16a444c9cea1f9ae758fabc97262a3e27b9100c9d557403b70773b3f605f50d94834e09d344bb7ee3b78ec46a1b1929b295564bf70405',
};

export const BLOCK_2: SampleBlock = {
  hash: '000037bb8f12717da2f1958fa7c40206e84d650704f012280eefa70fab5b5e4c',
  prev_hash: BLOCK_1.hash,
  message: `From ${SAMPLE_KEYS.B} to ${SAMPLE_KEYS.C}, graph theory final project`,
  nonce: 36025,
  proof_of_work: 36024,
  number_of_block: 2,
  timeStamp: '2026-11-09 14:02:14.093117',
  signature:
    'deab3f5d5008a01001412a93c3a3797e5a9d9cd13fc643a58d92e973a7ade7f4fa683ce0f2513d8246a1cdf2b6b90fa79d581f7b39b4167c4d3e1ae34638ade9',
};

export type Fig6Sample = 'valid' | 'tampered' | 'rehashed' | 'relinked' | 'renumbered' | 'inflated';

// Variasi blok #2, diverifikasi terhadap blok #1 dengan Blockchain.verify_block (Python).
export const FIG6_SAMPLES: Record<Fig6Sample, { changes: Partial<SampleBlock>; errors: string[] }> = {
  valid: { changes: {}, errors: [] },
  tampered: {
    changes: { message: `From ${SAMPLE_KEYS.B} to ${SAMPLE_KEYS.C}, graph theory final project, pay Mallory` },
    errors: ['InvalidBlockHash', 'InvalidSignature'],
  },
  rehashed: {
    changes: {
      message: `From ${SAMPLE_KEYS.B} to ${SAMPLE_KEYS.C}, graph theory final project, pay Mallory`,
      hash: '059e9499aacaebc96c5c2feab3fe9639054458edd7f18e2fbc94a8517e0d3f2a',
    },
    errors: ['InvalidProofOfWork', 'InvalidSignature'],
  },
  relinked: {
    changes: { prev_hash: '0000' + '9'.repeat(60) },
    errors: ['PreviousHashBlockError', 'InvalidBlockHash'],
  },
  renumbered: { changes: { number_of_block: 3 }, errors: ['MissedBlock'] },
  inflated: { changes: { proof_of_work: 900000 }, errors: ['InvalidProofOfWork'] },
};
