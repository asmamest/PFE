// src/lib/issuer-utils.ts

export interface IssuerProfile {
  walletAddress: string;
  did: string;
  publicKey: string;
  legalName?: string;
  credentialTypes: string[];
  registeredAt: number;
  cid?: string;
  verificationTag?: string;
}

// === FONCTIONS D'EXPORT (pour les composants) ===

export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// === FONCTIONS DE GESTION DE PROFIL ===

export function loadIssuerProfile(): IssuerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    // Essayer de charger depuis PROFILE_KEY d'abord
    const raw = sessionStorage.getItem("qsdid.issuerProfile");
    if (raw) {
      const profile = JSON.parse(raw) as IssuerProfile;
      console.log("✅ Profil chargé depuis qsdid.issuerProfile:", profile);
      return profile;
    }
    
    // Sinon, essayer de construire depuis l'identity
    const identityRaw = sessionStorage.getItem("qsdid.identity");
    if (!identityRaw) {
      console.log("⚠️ Aucun profil trouvé");
      return null;
    }
    
    const id = JSON.parse(identityRaw);
    
    // Essayer de charger depuis la clé spécifique au wallet
    const specificRaw = sessionStorage.getItem(`qsdid.issuer.${id.walletAddress}`);
    if (specificRaw) {
      const profile = JSON.parse(specificRaw) as IssuerProfile;
      console.log("✅ Profil chargé depuis clé spécifique:", profile);
      return profile;
    }
    
    // Fallback: créer un profil basique depuis l'identity
    const fallbackProfile: IssuerProfile = {
      walletAddress: id.walletAddress,
      did: id.did,
      publicKey: id.publicKey || "",
      credentialTypes: [],
      registeredAt: id.createdAt ?? Date.now(),
    };
    console.log("⚠️ Profil fallback créé:", fallbackProfile);
    return fallbackProfile;
  } catch (error) {
    console.error("Error loading issuer profile:", error);
    return null;
  }
}

export function saveIssuerProfile(profile: IssuerProfile): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("qsdid.issuerProfile", JSON.stringify(profile));
  console.log("✅ Profil issuer sauvegardé:", profile);
}