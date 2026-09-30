import "server-only";
import { env } from "./env";
import { blindIndex, decryptString, encryptString } from "./crypto";

const dataKey = () => Buffer.from(env().DATA_ENCRYPTION_KEY, "base64");
const indexKey = () => Buffer.from(env().BLIND_INDEX_KEY, "base64");

export const seal = (plain: string) => encryptString(plain, dataKey());
export const unseal = (blob: string) => decryptString(blob, dataKey());
export const indexOf = (value: string) => blindIndex(value, indexKey());
export { dataKey };
