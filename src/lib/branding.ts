/**
 * Single source of truth for library branding.
 * Override per environment with the NEXT_PUBLIC_* variables.
 */
export const libraryName = process.env.NEXT_PUBLIC_LIBRARY_NAME || "Digital College Library";
export const institutionName = process.env.NEXT_PUBLIC_INSTITUTION_NAME || "MIT";

/** Full display name, e.g. "Digital College Library (MIT)". */
export const fullLibraryName = `${libraryName} (${institutionName})`;

/** Email domain used for seeded demo accounts and input placeholders. */
export const emailDomain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "mit.edu";

/** Prefix for generated copy barcodes and student IDs. */
export const idPrefix = process.env.NEXT_PUBLIC_ID_PREFIX || "MIT";
