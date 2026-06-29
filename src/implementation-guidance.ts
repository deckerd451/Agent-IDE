const canonicalManualIntelligenceFiles = new Set(['.ai/goals.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/context-package.md']);
const preferredCanonicalIntelligenceFiles = ['.ai/goals.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/context-package.md'];
const preferredValidationArtifactFiles = ['.ai/validation.md', '.ai/ai-handoff-validation.md', '.ai/intelligence-verification.md'];
const generatedIntelligenceFilePattern = /^\.ai\/(?:context-package|recommendation-trace|architecture|strategy|backlog|decisions|validation|repository-health|execution-model|next-improvement-prompt|decision-ranking|repository-judgment|product-judgment|judgment-comparison|intelligence-|ai-handoff-validation|evidence-lineage|outcomes|prompts\/)/;
const implementationFilePattern = /^(?:scripts|src)\/[^\s`'"),;]+\.(?:mjs|js|ts|tsx|css)$/;
const xcodeProjectFilePattern = /[^\s`'"),;]+\.(?:xcodeproj|xcworkspace)$/;
const testFilePattern = /^(?:tests\/[^\s`'"),;]+\.test\.mjs|(?:src|scripts)\/[^\s`'"),;]+\.(?:test|spec)\.(?:mjs|js|ts|tsx))$/;
const repositoryFilePattern = /(?:^|[`\s(,])((?:(?:\.ai|scripts|src|tests)\/[^`\s)'",;]+\.(?:md|json|mjs|js|ts|tsx|css))|(?:[^`\s)'",;]+\.(?:xcodeproj|xcworkspace)))/g;

type PrimaryFileSelection = { primaryFile: string | null; supportingFiles: string[]; source: 'direct' | 'inferred' | 'missing'; note: string; validationCommands?: string[] };
type PrimaryFileSelectionOptions = { existingFiles?: string[] | Set<string> };

export function uniqueFiles(files: Array<string | null | undefined>) {
  return [...new Set(files.filter((file): file is string => Boolean(file)).map((file) => file.replace(/[.,;:)]+$/, '')))];
}

function existingFileSet(options?: PrimaryFileSelectionOptions) {
  if (!options?.existingFiles) return null;
  return options.existingFiles instanceof Set ? options.existingFiles : new Set(options.existingFiles);
}

function filterExistingFiles(files: string[], existingFiles: Set<string> | null) {
  if (!existingFiles) return uniqueFiles(files);
  return uniqueFiles(files).filter((file) => existingFiles.has(file));
}

function isManualProductDecision(recommendation: any, candidate: any) {
  return recommendation.packageType === 'product-decision' || recommendation.actionability === 'manual' || candidate?.actionability === 'manual';
}

function isValidationExperiment(recommendation: any, candidate: any) {
  return recommendation.packageType === 'validation-experiment' || recommendation.actionability === 'validation-experiment' || candidate?.actionability === 'validation-experiment';
}

function isCodeFixable(recommendation: any, candidate: any) {
  return !isManualProductDecision(recommendation, candidate) && (recommendation.packageType === 'implementation' || recommendation.packageType === 'task-clarification' || recommendation.actionability === 'code-fixable' || candidate?.actionability === 'code-fixable');
}

function classifyRepositoryFile(file: string) {
  if (canonicalManualIntelligenceFiles.has(file)) return 'manual';
  if (preferredValidationArtifactFiles.includes(file)) return 'validation-artifact';
  if (generatedIntelligenceFilePattern.test(file)) return 'generated';
  if (testFilePattern.test(file)) return 'test';
  if (xcodeProjectFilePattern.test(file)) return file.endsWith('.xcworkspace') ? 'xcode-workspace' : 'xcode-project';
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

function isCanonicalOrContradictionTask(candidate: any, recommendation: any) {
  const text = [candidate?.id, candidate?.title, candidate?.category, candidate?.reason, candidate?.evidence, recommendation.id, recommendation.title, recommendation.originalRecommendationTitle, recommendation.displayTitle, recommendation.displaySummary, recommendation.explanation, recommendation.whyItMatters, recommendation.prompt, recommendation.implementationPrompt].filter(Boolean).join(' ');
  return /intelligence[-\s]?contradiction|contradiction|canonical|manual|repository intent|goals|strategy|architecture|context package/i.test(text);
}

function preferredExistingValidationFiles(existingFiles: Set<string> | null, directFiles: string[]) {
  const repositoryFiles = existingFiles ? [...existingFiles] : [];
  const projectFiles = filterExistingFiles(uniqueFiles([...directFiles, ...repositoryFiles]).filter((file) => ['xcode-workspace', 'xcode-project'].includes(classifyRepositoryFile(file))).sort((a, b) => (classifyRepositoryFile(a) === 'xcode-workspace' ? 0 : 1) - (classifyRepositoryFile(b) === 'xcode-workspace' ? 0 : 1) || a.localeCompare(b)), existingFiles);
  const artifactFiles = filterExistingFiles([...preferredValidationArtifactFiles.filter((file) => directFiles.includes(file)), ...preferredValidationArtifactFiles], existingFiles);
  return uniqueFiles([...projectFiles, ...artifactFiles, ...directFiles.filter((file) => classifyRepositoryFile(file) === 'validation-artifact')]);
}

function validationCommandsFor(primaryFile: string | null, supportingFiles: string[]) {
  const files = uniqueFiles([primaryFile, ...supportingFiles]);
  const workspace = files.find((file) => file.endsWith('.xcworkspace'));
  const project = files.find((file) => file.endsWith('.xcodeproj'));
  const container = workspace ?? project;
  if (!container) return [];
  const flag = workspace ? '-workspace' : '-project';
  return [`xcodebuild -list ${flag} ${container}`, `xcodebuild ${flag} ${container} -scheme <scheme-from-list> -destination '<platform-destination>' build`];
}

function preferredExistingCanonicalFiles(existingFiles: Set<string> | null, directFiles: string[]) {
  const preferred = preferredCanonicalIntelligenceFiles.filter((file) => directFiles.includes(file));
  return filterExistingFiles([...preferred, ...preferredCanonicalIntelligenceFiles], existingFiles);
}

export function selectPrimaryFiles(candidate: any, recommendation: any, options?: PrimaryFileSelectionOptions): PrimaryFileSelection {
  const existingFiles = existingFileSet(options);
  const allDirectFiles = filePathCandidatesForTask(candidate, recommendation);
  const directFiles = filterExistingFiles(allDirectFiles, existingFiles);
  const validationExperiment = isValidationExperiment(recommendation, candidate);
  if (validationExperiment) {
    const validationFiles = preferredExistingValidationFiles(existingFiles, directFiles);
    const [primaryFile, ...supporting] = validationFiles;
    const supportingFiles = uniqueFiles([...supporting, ...directFiles.filter((file) => file !== primaryFile && file !== '.ai/goals.md')]);
    return {
      primaryFile: primaryFile ?? null,
      supportingFiles,
      source: primaryFile ? (directFiles.includes(primaryFile) ? 'direct' : 'inferred') : 'missing',
      note: primaryFile ? 'Primary file is validation guidance: project/workspace files and validation artifacts are preferred for validation experiments; canonical owner-intent files are not primary unless this is a manual/product-decision package.' : 'No existing validation command target, project/workspace, or validation artifact file could be identified from deterministic repository-local evidence.',
      validationCommands: validationCommandsFor(primaryFile ?? null, supportingFiles),
    };
  }

  const codeFixable = isCodeFixable(recommendation, candidate);
  if (!codeFixable) {
    const canonical = preferredExistingCanonicalFiles(existingFiles, directFiles);
    const primaryFile = directFiles.find((file) => classifyRepositoryFile(file) === 'manual') ?? canonical[0] ?? directFiles[0] ?? null;
    return { primaryFile, supportingFiles: uniqueFiles(directFiles.filter((file) => file !== primaryFile)), source: primaryFile ? 'direct' : 'missing', note: primaryFile ? 'Primary file is directly evidenced by the selected manual/product-decision package and exists in the connected repository.' : 'No existing primary file is named by repository intelligence.' };
  }

  const implementationOrTest = directFiles.filter((file) => ['implementation', 'test'].includes(classifyRepositoryFile(file))).sort((a, b) => (classifyRepositoryFile(a) === 'implementation' ? 0 : 1) - (classifyRepositoryFile(b) === 'implementation' ? 0 : 1));
  if (implementationOrTest.length) {
    const [primaryFile, ...supporting] = implementationOrTest;
    return { primaryFile, supportingFiles: uniqueFiles([...supporting, ...directFiles.filter((file) => file !== primaryFile)]), source: 'direct', note: 'Primary file is directly evidenced by likely files, package text, or decision-ranking evidence and exists in the connected repository.' };
  }

  if (isCanonicalOrContradictionTask(candidate, recommendation)) {
    const canonical = preferredExistingCanonicalFiles(existingFiles, directFiles);
    if (canonical.length) {
      const [primaryFile, ...supporting] = canonical;
      return { primaryFile, supportingFiles: uniqueFiles([...supporting, ...directFiles.filter((file) => file !== primaryFile)]), source: 'direct', note: 'Primary file uses existing target-repository intelligence because the selected recommendation concerns canonical/manual intelligence.' };
    }
  }

  const inferred = filterExistingFiles(inferredFilesForTask(candidate, recommendation), existingFiles);
  if (inferred.length) {
    const [primaryFile, ...supporting] = inferred;
    return { primaryFile, supportingFiles: supporting, source: 'inferred', note: 'Primary file is inferred from recommendation category, package type, and existing target-repository files.' };
  }

  const nonManual = directFiles.filter((file) => classifyRepositoryFile(file) !== 'manual');
  return { primaryFile: null, supportingFiles: nonManual, source: 'missing', note: 'No existing implementation or test file could be identified from deterministic repository-local evidence.' };
}

export function filePathForTask(candidate: any, recommendation: any, options?: PrimaryFileSelectionOptions) {
  return selectPrimaryFiles(candidate, recommendation, options).primaryFile;
}
