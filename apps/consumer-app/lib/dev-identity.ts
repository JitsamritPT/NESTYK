import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_IDENTITY_KEY = 'nestyk.dev.agent.identity.v1';

export type DevIdentity = {
  uuid: string;
  email: string;
};

function randomUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDevIdentity(): Promise<DevIdentity> {
  const raw = await AsyncStorage.getItem(DEV_IDENTITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DevIdentity;
      if (parsed.uuid && parsed.email) return parsed;
    } catch {
      // recreate below
    }
  }

  const uuid = randomUuid();
  const identity: DevIdentity = {
    uuid,
    email: `agent-${uuid.slice(0, 8)}@nestyk.local`,
  };
  await AsyncStorage.setItem(DEV_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function toDevBearer(identity: DevIdentity): string {
  return `dev|${identity.uuid}|${identity.email}|Agent|Dev`;
}
