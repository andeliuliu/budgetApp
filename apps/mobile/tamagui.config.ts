import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';

/**
 * Tamagui design-system config. Starts from Tamagui's v4 default (neutral,
 * accessible scales). The gender-neutral brand palette lives in
 * `src/theme/colors.ts` and is applied at the component level for now; folding
 * it into Tamagui tokens/themes is a Phase 2 refinement.
 */
export const config = createTamagui(defaultConfig);

export type AppTamaguiConfig = typeof config;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config;
