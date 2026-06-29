const canonicalManualIntelligenceFiles = new Set(['.ai/goals.md']);
const generatedIntelligenceFilePattern = /^\.ai\/(?:context-package|recommendation-trace|architecture|strategy|backlog|decisions|validation|repository-health|execution-model|next-improvement-prompt|decision-ranking|repository-judgment|product-judgment|judgment-comparison|intelligence-|ai-handoff-validation|evidence-lineage|outcomes|prompts\/)/;
const implementationFilePattern = /^(?:scripts|src)\/[^\s`'"),;]+\.(?:mjs|js|ts|tsx|css)$/;
const testFilePattern = /^(?:tests\/[^\s`'"),;]+\.test\.mjs|(?:src|scripts)\/[^\s`'"),;]+\.(?:test|spec)\.(?:mjs|js|ts|tsx))$/;
const repositoryFilePattern = /(?:^|[`\s(,])((?:\.ai|scripts|src|tests)\/[^`\s)'",;]+\.(?:md|json|mjs|js|ts|tsx|css))/g;

type PrimaryFileSelection = { primaryFile: string | null; supportingFiles: string[]; source: 'direct' | 'inferred' | 'missing'; note: string };

export function uniqueFiles(files: Array<string | null | undefined>) {
  return [...new Set(files.filter((file): file is string => Boolean(file)).map((file) => file.replace(/[.,;:)]+$/, '')))];
}

function isManualProductDecision(recommendation: any, candidate: any) {
  return recommendation.packageType === 'product-decision' || recommendation.actionability === 'manual' || candidate?.actionability === 'manual';
}

function isCodeFixable(recommendation: any, candidate: any) {
  return !isManualProductDecision(recommendation, candidate) && (recommendation.packageType === 'implementation' || recommendation.packageType === 'task-clarification' || recommendation.actionability === 'code-fixable' || candidate?.actionability === 'code-fixable');
}

function classifyRepositoryFile(file: string) {
  if (canonicalManualIntelligenceFiles.has(file)) return 'manual';
  if (generatedIntelligenceFilePattern.test(file)) return 'generated';
  if (testFilePattern.test(file)) return 'test';
  if (implementationFilePattern.test(file)) return 'implementation';
  return 'other';
}

function filePathCandidatesForTask(candidate: any, recommendation: any) {
  const text = [
    ...(candidate?.engineeringTask?.likelyFiles ?? []),
    ...(recommendation.engineeringTask?.likelyFiles ?? []),
    candidate?.ownerAction,
    candidate?.reason,
    candidate?.evidence,
    candidate?.category,
    recommendation.displaySummary,
    recommendation.explanation,
    recommendation.evidenceSource,
    recommendation.prompt,
    recommendation.implementationPrompt,
  ].filter(Boolean).join('\n');
  return uniqueFiles([...text.matchAll(repositoryFilePattern)].map((match) => match[1]));
}

function inferredFilesForTask(candidate: any, recommendation: any) {
  const text = [candidate?.id, candidate?.title, candidate?.category, recommendation.id, recommendation.title, recommendation.originalRecommendationTitle, recommendation.displayTitle, recommendation.displaySummary, recommendation.explanation, recommendation.whyItMatters].filter(Boolean).join(' ');
  if (/backlog|candidate|next improvement|recommendation|ranking|filter|noise/i.test(text)) return ['scripts/next-improvement.mjs', 'scripts/backlog.mjs', 'tests/backlog-quality-filtering.test.mjs', 'tests/next-improvement.test.mjs', 'tests/recommendation-candidate-expansion.test.mjs'];
  if (/control plane|primary files|implementation guidance|ui|readiness/i.test(text)) return ['src/App.tsx', 'tests/control-plane-copy.test.mjs'];
  if (/validation|confidence|handoff/i.test(text)) return ['scripts/validate-intel.mjs', 'scripts/context-package.mjs', 'tests/context-package.test.mjs'];
  if (/architecture|audit|core systems/i.test(text)) return ['scripts/audit.mjs', 'tests/intelligence-quality.test.mjs'];
  return [];
}

export function selectPrimaryFiles(candidate: any, recommendation: any): PrimaryFileSelection {
  const directFiles = filePathCandidatesForTask(candidate, recommendation);
  const codeFixable = isCodeFixable(recommendation, candidate);
  if (!codeFixable) {
    const primaryFile = directFiles.find((file) => classifyRepositoryFile(file) === 'manual') ?? directFiles[0] ?? (isManualProductDecision(recommendation, candidate) ? '.ai/goals.md' : null);
    return { primaryFile, supportingFiles: uniqueFiles(directFiles.filter((file) => file !== primaryFile)), source: primaryFile ? 'direct' : 'missing', note: primaryFile ? 'Primary file is directly evidenced by the selected manual/product-decision package.' : 'No primary file is named by repository intelligence.' };
  }

  const implementationOrTest = directFiles.filter((file) => ['implementation', 'test'].includes(classifyRepositoryFile(file))).sort((a, b) => (classifyRepositoryFile(a) === 'implementation' ? 0 : 1) - (classifyRepositoryFile(b) === 'implementation' ? 0 : 1));
  if (implementationOrTest.length) {
    const [primaryFile, ...supporting] = implementationOrTest;
    return { primaryFile, supportingFiles: uniqueFiles([...supporting, ...directFiles.filter((file) => file !== primaryFile)]), source: 'direct', note: 'Primary file is directly evidenced by likely files, package text, or decision-ranking evidence.' };
  }

  const inferred = inferredFilesForTask(candidate, recommendation);
  if (inferred.length) {
    const [primaryFile, ...supporting] = inferred;
    return { primaryFile, supportingFiles: supporting, source: 'inferred', note: 'Primary file is inferred from recommendation category, package type, and known local repository structure.' };
  }

  const nonManual = directFiles.filter((file) => classifyRepositoryFile(file) !== 'manual');
  return { primaryFile: null, supportingFiles: nonManual, source: 'missing', note: 'No implementation or test file could be identified from deterministic repository-local evidence.' };
}

export function filePathForTask(candidate: any, recommendation: any) {
  return selectPrimaryFiles(candidate, recommendation).primaryFile;
}
