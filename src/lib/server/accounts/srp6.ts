import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * SRP6 verifier math — the part of AzerothCore's logon that lets us answer
 * "is this the password for that game account?" without asking the server and
 * without changing anything.
 *
 * Transcribed from `azerothcore-wotlk/src/common/Cryptography/Authentication/SRP6.cpp`:
 *
 *     v = g ^ H(s || H(u || ':' || p)) mod N
 *
 * Two details of that implementation are easy to get wrong, so they are called
 * out rather than left implicit:
 *
 * 1. **The modulus and generator are the game's own.** `g` is 7 and `N` is the
 *    256-bit value below, read from the same file (`N` is written there as a hex
 *    string that is byte-reversed on the way in).
 * 2. **`BigNumber` treats byte arrays as little-endian by default**, and both
 *    the SHA-1 digest and the finished verifier go through it
 *    (`BigNumber(std::array<uint8, N>, bool littleEndian = true)` and
 *    `ToByteArray<32>()`). So the digest is read little-endian and the stored
 *    `verifier` column is little-endian too. Implementing this the textbook way
 *    (big-endian) would produce a value that never matches the database.
 *
 * The consequence of getting it wrong is one-sided: a mismatch can only deny a
 * legitimate login attempt, never grant one. There is no golden test vector in
 * the core repository, so the spec next to this file covers round-trip and
 * rejection behaviour — not cross-implementation agreement, which needs a live
 * server to confirm.
 */

/** `SRP6::N`. */
const N = BigInt('0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7');
/** `SRP6::g`. */
const G = 7n;

export const SALT_LENGTH = 32;
export const VERIFIER_LENGTH = 32;

function sha1(...chunks: Uint8Array[]): Buffer {
	const hash = createHash('sha1');

	for (const chunk of chunks) {
		hash.update(chunk);
	}

	return hash.digest();
}

/** `BigNumber(bytes, /* littleEndian *\/ true)`. */
function readLittleEndian(bytes: Uint8Array): bigint {
	let value = 0n;

	for (let i = bytes.length - 1; i >= 0; i--) {
		value = (value << 8n) | BigInt(bytes[i]);
	}

	return value;
}

/** `BigNumber::ToByteArray<length>()`, also little-endian. */
function writeLittleEndian(value: bigint, length: number): Buffer {
	const out = Buffer.alloc(length);
	let remaining = value;

	for (let i = 0; i < length; i++) {
		out[i] = Number(remaining & 0xffn);
		remaining >>= 8n;
	}

	return out;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
	let result = 1n;
	let factor = base % modulus;
	let power = exponent;

	while (power > 0n) {
		if (power & 1n) {
			result = (result * factor) % modulus;
		}

		factor = (factor * factor) % modulus;
		power >>= 1n;
	}

	return result;
}

/**
 * Computes the 32-byte verifier for a username/password/salt triple.
 *
 * The username and password are uppercased here rather than by the caller: the
 * server does it inside `AccountMgr::CheckPassword` before calling into SRP6,
 * and every caller of that helper has to match it.
 */
export function calculateVerifier(username: string, password: string, salt: Buffer): Buffer {
	const identity = sha1(
		Buffer.from(username.toUpperCase(), 'utf8'),
		Buffer.from(':', 'utf8'),
		Buffer.from(password.toUpperCase(), 'utf8')
	);

	const x = readLittleEndian(sha1(salt, identity));

	return writeLittleEndian(modPow(G, x, N), VERIFIER_LENGTH);
}

/**
 * Compares a candidate password against the salt and verifier stored on the
 * account row. This is the same check the auth server performs at logon.
 */
export function verifierMatches(
	username: string,
	password: string,
	salt: Buffer,
	storedVerifier: Buffer
): boolean {
	if (salt.length !== SALT_LENGTH || storedVerifier.length !== VERIFIER_LENGTH) {
		return false;
	}

	const candidate = calculateVerifier(username, password, salt);

	return timingSafeEqual(candidate, storedVerifier);
}
