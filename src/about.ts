/**
 * About / credits for OpenScrape (CLI and API)
 */

export const ABOUT = {
  by: 'John F. Gonzales',
  repository: 'https://github.com/RantsRoamer/OpenScrape',
} as const;

export function getAboutInfo(version: string) {
  return {
    name: 'openscrape',
    version,
    by: ABOUT.by,
    repository: ABOUT.repository,
  };
}
