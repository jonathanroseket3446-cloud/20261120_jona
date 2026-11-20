export interface CohortFilters {
  tapStages: string[];
  tapGenetics: string[];
  tapYears: string[];
  tapTargets: string[];
  tnpStages: string[];
  tnpGenetics: string[];
  tnpYears: string[];
  tnpTargets: string[];
}

const STORAGE_KEYS: Record<keyof CohortFilters, string> = {
  tapStages: 'tapStages',
  tapGenetics: 'tapGenetics',
  tapYears: 'tapYears',
  tapTargets: 'tapTargets',
  tnpStages: 'tnpStages',
  tnpGenetics: 'tnpGenetics',
  tnpYears: 'tnpYears',
  tnpTargets: 'tnpTargets'
};

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function loadCohortFilters(): CohortFilters {
  return {
    tapStages: readStringArray(STORAGE_KEYS.tapStages),
    tapGenetics: readStringArray(STORAGE_KEYS.tapGenetics),
    tapYears: readStringArray(STORAGE_KEYS.tapYears),
    tapTargets: readStringArray(STORAGE_KEYS.tapTargets),
    tnpStages: readStringArray(STORAGE_KEYS.tnpStages),
    tnpGenetics: readStringArray(STORAGE_KEYS.tnpGenetics),
    tnpYears: readStringArray(STORAGE_KEYS.tnpYears),
    tnpTargets: readStringArray(STORAGE_KEYS.tnpTargets)
  };
}

export function saveCohortFilters(filters: CohortFilters): void {
  (Object.keys(STORAGE_KEYS) as Array<keyof CohortFilters>).forEach(k => {
    localStorage.setItem(STORAGE_KEYS[k], JSON.stringify(filters[k] || []));
  });
}

export function getEmptyCohortFilters(): CohortFilters {
  return {
    tapStages: [],
    tapGenetics: [],
    tapYears: [],
    tapTargets: [],
    tnpStages: [],
    tnpGenetics: [],
    tnpYears: [],
    tnpTargets: []
  };
}

export function buildGuidelinesSearchParams(filters: CohortFilters): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(STORAGE_KEYS) as Array<keyof CohortFilters>).forEach(k => {
    const arr = filters[k];
    if (arr && arr.length > 0) {
      params.append(k, arr.join(','));
    }
  });
  return params;
}

export function countModalityFilters(filters: CohortFilters, modality: 'TAP' | 'TNP'): number {
  if (modality === 'TAP') {
    return (
      filters.tapStages.length +
      filters.tapGenetics.length +
      filters.tapYears.length +
      filters.tapTargets.length
    );
  }
  return (
    filters.tnpStages.length +
    filters.tnpGenetics.length +
    filters.tnpYears.length +
    filters.tnpTargets.length
  );
}
