/* tslint:disable */
/* eslint-disable */

export function delete_signature(signature_id: string): Promise<any>;

export function from_base64(base64_str: string): string;

export function generate_hybrid_keys(): Promise<any>;

export function generate_id(): string;

export function generate_kem_keys(): Promise<any>;

export function get_signature(signature_id: string): Promise<any>;

export function get_stats(): Promise<any>;

export function hash_document(document: Uint8Array): string;

export function health_check(): Promise<any>;

export function init(): void;

export function kem_decapsulate(secret_key_hex: string, ciphertext_hex: string): Promise<any>;

export function kem_decrypt(secret_key_hex: string, kem_ciphertext_hex: string, encrypted_data_b64: string, nonce_hex: string): Promise<any>;

export function kem_encapsulate(public_key_hex: string): Promise<any>;

export function kem_encrypt(public_key_hex: string, plaintext_b64: string): Promise<any>;

export function list_signatures(): Promise<any>;

/**
 * Définir l'URL de base de l'API (à appeler au démarrage)
 */
export function set_api_base_url(url: string): void;

export function sign_document(document_b64: string): Promise<any>;

export function to_base64(data: Uint8Array): string;

export function verify_signature(signature_id: string, document_b64: string): Promise<any>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly delete_signature: (a: number, b: number) => any;
    readonly from_base64: (a: number, b: number) => [number, number, number, number];
    readonly generate_hybrid_keys: () => any;
    readonly generate_id: () => [number, number];
    readonly generate_kem_keys: () => any;
    readonly get_signature: (a: number, b: number) => any;
    readonly get_stats: () => any;
    readonly hash_document: (a: number, b: number) => [number, number];
    readonly health_check: () => any;
    readonly init: () => void;
    readonly kem_decapsulate: (a: number, b: number, c: number, d: number) => any;
    readonly kem_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
    readonly kem_encapsulate: (a: number, b: number) => any;
    readonly kem_encrypt: (a: number, b: number, c: number, d: number) => any;
    readonly list_signatures: () => any;
    readonly set_api_base_url: (a: number, b: number) => void;
    readonly sign_document: (a: number, b: number) => any;
    readonly to_base64: (a: number, b: number) => [number, number];
    readonly verify_signature: (a: number, b: number, c: number, d: number) => any;
    readonly wasm_bindgen__closure__destroy__h60629bae2ee34eac: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h1e19936ed6277e2e: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h532914be8937acf4: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
