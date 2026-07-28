import type { SkinAnalysisProvider } from './contracts';
import { FixtureSkinAnalysisProvider } from './FixtureSkinAnalysisProvider';
import { YouCamSkinAnalysisProvider } from './YouCamSkinAnalysisProvider';

let fixtureProvider: FixtureSkinAnalysisProvider | null = null;

export function createSkinAnalysisProvider(): SkinAnalysisProvider {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    fixtureProvider ??= new FixtureSkinAnalysisProvider();
    return fixtureProvider;
  }
  return new YouCamSkinAnalysisProvider();
}
