import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Envelope encryption for rehearsal content (transcript + situation) at rest.
//
// Each encrypted field gets its own random AES-256 data key. The field is
// encrypted with that key (AES-256-GCM), and the data key is itself encrypted
// ("wrapped") with ENCRYPTION_MASTER_KEY, which lives only in Vercel env vars.
// The database only ever holds ciphertext, the IV and the wrapped key, so
// Supabase dashboard / service-role access and database backups show blobs,
// not text.
//
// Both layers use the owning user's id as additional authenticated data, so a
// blob copied onto another user's row (or into another field) won't decrypt.
//
// NOTE: ElevenLabs keeps its own copy of every conversation unless retention
// is turned off. Data retention must be disabled on BOTH Jordan agents (Male
// and Female) in the ElevenLabs dashboard. That's a separate manual step; it is
// not handled here.
//
// Stored format (all bytea):
//   ciphertext  = AES-GCM ciphertext || 16-byte auth tag
//   iv          = 12-byte IV for the ciphertext
//   wrapped key = 12-byte IV || encrypted data key || 16-byte auth tag

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export type EncryptedField = {
  ciphertext: Buffer;
  iv: Buffer;
  wrappedKey: Buffer;
};

type Field = "transcript" | "situation";

let masterKey: Buffer | null = null;

// Throws (never falls back to plaintext) if the key is missing or malformed.
function getMasterKey(): Buffer {
  if (masterKey) return masterKey;
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is not set. Rehearsal content cannot be encrypted or decrypted."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must be ${KEY_BYTES} bytes, base64-encoded (got ${key.length} bytes). Generate one with: openssl rand -base64 32`
    );
  }
  masterKey = key;
  return key;
}

function aad(kind: "key" | Field, userId: string): Buffer {
  return Buffer.from(`align:v1:${kind}:${userId}`, "utf8");
}

function seal(key: Buffer, iv: Buffer, plaintext: Buffer, ad: Buffer): Buffer {
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(ad);
  return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
}

function open(key: Buffer, iv: Buffer, sealed: Buffer, ad: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(ad);
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)),
    decipher.final(),
  ]);
}

export function encryptText(plaintext: string, userId: string, field: Field): EncryptedField {
  const master = getMasterKey();
  const dataKey = randomBytes(KEY_BYTES);

  const iv = randomBytes(IV_BYTES);
  const ciphertext = seal(dataKey, iv, Buffer.from(plaintext, "utf8"), aad(field, userId));

  const keyIv = randomBytes(IV_BYTES);
  const wrappedKey = Buffer.concat([keyIv, seal(master, keyIv, dataKey, aad("key", userId))]);

  return { ciphertext, iv, wrappedKey };
}

export function decryptText(enc: EncryptedField, userId: string, field: Field): string {
  const master = getMasterKey();
  const keyIv = enc.wrappedKey.subarray(0, IV_BYTES);
  const dataKey = open(master, keyIv, enc.wrappedKey.subarray(IV_BYTES), aad("key", userId));
  return open(dataKey, enc.iv, enc.ciphertext, aad(field, userId)).toString("utf8");
}

export function encryptTranscript(transcript: unknown, userId: string): EncryptedField {
  return encryptText(JSON.stringify(transcript), userId, "transcript");
}

export function decryptTranscript(enc: EncryptedField, userId: string): unknown {
  return JSON.parse(decryptText(enc, userId, "transcript"));
}

// Supabase (PostgREST) sends and returns bytea as a "\x<hex>" string.
export function toBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

export function fromBytea(value: string): Buffer {
  return Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex");
}
