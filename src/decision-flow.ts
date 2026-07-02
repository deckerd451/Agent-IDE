export type DecisionPackageType = 'implementation' | 'validation-experiment' | 'product-decision' | 'investigation' | 'documentation';
export type RequiredOwnerAction = 'Review decision' | 'Choose execution agent' | 'Perform external work' | 'Record outcome evidence' | 'Approve canonical intent' | 'Refresh repository intelligence';
export type ExecutionReadiness = 'ready' | 'external-work-pending' | 'outcome-needed' | 'refresh-ready' | 'refresh-running' | 'blocked';
export type ExecutionAgent = 'Claude' | 'Codex' | 'ChatGPT' | 'Gemini' | 'Generic';

export type ExecutionPackage = {
  packageType: DecisionPackageType;
  executionAgent: ExecutionAgent;
  packageBody: string;
  packageSections: Array<{ title: string; body: string }>;
  validationRequired: boolean;
  implementationRequired: boolean;
  packageVersion: string;
};

export type ExecutionPackageInput = {
  packageType: DecisionPackageType;
  executionAgent: ExecutionAgent;
  repositoryMetadata?: Record<string, string | undefined>;
  repositoryContextPackage?: string;
  understandingPrompt?: string;
  implementationPrompt?: string;
  decisionTitle?: string;
  decisionReason?: string;
};

export type DecisionFlowRecommendation = {
  title?: string;
  displayTitle?: string;
  explanation?: string;
  whyItMatters?: string;
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment' | 'task-clarification' | 'terminal' | string;
  evidenceSource?: string;
  canonicalIntelligenceState?: 'existing' | 'missing';
};

export type DecisionFlowCandidate = {
  title?: string;
  category?: string;
  reason?: string;
  ownerAction?: string;
  source?: string;
};

export type DecisionFlowStatus = {
  repositoryName?: string;
  overallHealth?: string;
  repositoryHandoffReadiness?: string;
  currentConfidence?: string;
  lastRefresh?: string;
};

export type DecisionFlowInput = {
  status?: DecisionFlowStatus;
  recommendation?: DecisionFlowRecommendation | null;
  selectedCandidate?: DecisionFlowCandidate | null;
  workflow?: { type?: string; repositoryState?: string; completionState?: string; currentStep?: { id?: string } } | null;
  isRefreshing?: boolean;
  hasOutcomeEvidenceForCurrentDecision?: boolean;
  debugReferences?: string[];
};

export type DecisionFlow = {
  repositoryStatus: string;
  selectedDecisionTitle: string;
  whyThisDecisionExists: string;
  currentRequiredOwnerAction: RequiredOwnerAction;
  executionReadiness: ExecutionReadiness;
  availableExecutionAgents: ExecutionAgent[];
  executionPackages?: ExecutionPackage[];
  packageType: DecisionPackageType;
  outcomeRecordingNeeded: boolean;
  refresh: { ready: boolean; running: boolean };
  advancedDebugDataReferences: string[];
};

export const defaultExecutionAgents: ExecutionAgent[] = ['Claude', 'ChatGPT', 'Codex', 'Gemini', 'Generic'];
export const executionPackageVersion = 'execution-package/v1';

export function decisionPackageType(input: Pick<DecisionFlowInput, 'recommendation' | 'selectedCandidate' | 'workflow'>): DecisionPackageType {
  if (input.recommendation?.packageType === 'product-decision') return 'product-decision';
  if (input.recommendation?.packageType === 'validation-experiment') return 'validation-experiment';
  if (input.recommendation?.packageType === 'implementation') return 'implementation';
  if (input.recommendation?.packageType === 'terminal') return 'investigation';
  const text = `${input.selectedCandidate?.category ?? ''} ${input.selectedCandidate?.title ?? ''} ${input.selectedCandidate?.ownerAction ?? ''} ${input.recommendation?.title ?? ''} ${input.workflow?.type ?? ''}`;
  if (/documentation|docs/i.test(text)) return 'documentation';
  if (/investigat|unknown|risk|explain/i.test(text)) return 'investigation';
  return 'implementation';
}


function isExternalWorkStep(step: { id?: string } | null | undefined) {
  return Boolean(step?.id && ['open-codex', 'run-implementation', 'open-chatgpt', 'paste-response', 'edit-documentation'].includes(step.id));
}

function ownerActionFor(input: DecisionFlowInput, packageType: DecisionPackageType): RequiredOwnerAction {
  if (input.isRefreshing) return 'Refresh repository intelligence';
  const workflow = input.workflow;
  if (!workflow) return 'Refresh repository intelligence';
  if (workflow.repositoryState === 'Refresh Repository' || workflow.completionState === 'Ready To Refresh') return 'Refresh repository intelligence';
  if (isExternalWorkStep(workflow.currentStep)) return input.hasOutcomeEvidenceForCurrentDecision ? 'Perform external work' : 'Record outcome evidence';
  if (packageType === 'product-decision') return 'Approve canonical intent';
  return 'Choose execution agent';
}

function readinessFor(input: DecisionFlowInput, ownerAction: RequiredOwnerAction): ExecutionReadiness {
  if (input.isRefreshing) return 'refresh-running';
  if (ownerAction === 'Refresh repository intelligence') return 'refresh-ready';
  if (ownerAction === 'Perform external work') return 'external-work-pending';
  if (ownerAction === 'Record outcome evidence') return 'outcome-needed';
  return input.recommendation ? 'ready' : 'blocked';
}

export function createDecisionFlow(input: DecisionFlowInput): DecisionFlow {
  const status = input.status ?? {};
  const recommendation = input.recommendation;
  const selectedCandidate = input.selectedCandidate;
  const packageType = decisionPackageType(input);
  const currentRequiredOwnerAction = ownerActionFor(input, packageType);
  const executionReadiness = readinessFor(input, currentRequiredOwnerAction);
  const repositoryStatus = [status.repositoryName, status.overallHealth, status.repositoryHandoffReadiness, status.currentConfidence].filter(Boolean).join(' · ') || 'Repository intelligence not loaded';
  const selectedDecisionTitle = selectedCandidate?.title ?? recommendation?.displayTitle ?? recommendation?.title ?? 'Refresh repository intelligence';
  const whyThisDecisionExists = selectedCandidate?.reason ?? recommendation?.explanation ?? recommendation?.whyItMatters ?? 'Repository intelligence needs to be generated before a decision can be selected.';
  const outcomeRecordingNeeded = executionReadiness === 'outcome-needed' || executionReadiness === 'external-work-pending';
  return {
    repositoryStatus,
    selectedDecisionTitle,
    whyThisDecisionExists,
    currentRequiredOwnerAction,
    executionReadiness,
    availableExecutionAgents: defaultExecutionAgents,
    executionPackages: [],
    packageType,
    outcomeRecordingNeeded,
    refresh: { ready: currentRequiredOwnerAction === 'Refresh repository intelligence', running: Boolean(input.isRefreshing) },
    advancedDebugDataReferences: input.debugReferences ?? ['workflow', 'decisionRanking', 'repositoryJudgment', 'productJudgment', 'generatedArtifacts', 'promptPackages'],
  };
}


function removeEmbeddedContextPackage(prompt: string, contextPackage: string) {
  const trimmedContext = contextPackage.trim();
  if (!trimmedContext) return prompt.trim();
  return prompt.replace(trimmedContext, '').replace(/\n?---\s*$/m, '').trim();
}


function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()).filter(Boolean))];
}

function detectXcodeContainers(text: string) {
  const workspaceMatches = [...text.matchAll(/(?:^|[`\s(,])([^`\s)'",;]+\.xcworkspace)/g)].map((match) => match[1]);
  const projectMatches = [...text.matchAll(/(?:^|[`\s(,])([^`\s)'",;]+\.xcodeproj)/g)].map((match) => match[1]);
  return { workspaces: uniqueStrings(workspaceMatches), projects: uniqueStrings(projectMatches) };
}

function detectedXcodeSchemes(text: string) {
  const schemes: string[] = [];
  const addScheme = (value?: string) => {
    const scheme = value?.trim().replace(/^[`'"-]+/, '').replace(/[`'".,;:]+$/g, '').trim();
    if (scheme && !/[<>]/.test(scheme) && /^[A-Za-z0-9_. -]{1,80}$/.test(scheme)) schemes.push(scheme);
  };
  for (const match of text.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:shared\s+)?schemes?\s*[:=]\s*([^\n]+)/gi)) {
    for (const value of match[1].split(/,|\s{2,}/)) addScheme(value);
  }
  for (const match of text.matchAll(/-scheme\s+['"]?([^'"\n\s]+)/gi)) addScheme(match[1]);
  for (const match of text.matchAll(/(?:schemes?|targets?)\s+(?:include|detected|available|named)\s+`?([A-Za-z0-9_. -]+?)`?(?:[.;\n]|$)/gi)) addScheme(match[1]);
  return uniqueStrings(schemes).sort((a, b) => a.localeCompare(b));
}

function detectXcodeScheme(text: string) {
  return detectedXcodeSchemes(text)[0] ?? '<Scheme>';
}

function detectedValidationCommands(text: string) {
  const backticked = [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
  return uniqueStrings(backticked.filter((command) => /^(?:npm\s+(?:run\s+)?(?:test|build|lint|typecheck)|pnpm\s+(?:run\s+)?(?:test|build|lint|typecheck)|yarn\s+(?:test|build|lint|typecheck)|bun\s+(?:test|run\s+(?:build|lint|typecheck))|cargo\s+(?:test|build|check)|go\s+test|swift\s+(?:test|build)|xcodebuild\s+)/i.test(command))).slice(0, 8);
}

function validationCommandActionFor(input: ExecutionPackageInput) {
  const selectedCandidateText = [input.decisionTitle, input.decisionReason, input.implementationPrompt].filter(Boolean).join('\n');
  if (/xcodebuild\s+test|run and document [`']?xcodebuild test/i.test(selectedCandidateText)) return 'test';
  if (/xcodebuild\s+build|simulator\/device build|full [`']?xcodebuild/i.test(selectedCandidateText)) return 'build';
  return 'build';
}

function validationActionSections(input: ExecutionPackageInput, understandingPrompt?: string) {
  const evidenceText = [input.decisionTitle, input.decisionReason, input.implementationPrompt, understandingPrompt, input.repositoryContextPackage].filter(Boolean).join('\n');
  const { workspaces, projects } = detectXcodeContainers(evidenceText);
  const schemes = detectedXcodeSchemes(evidenceText);
  const scheme = schemes[0] ?? '<Scheme>';
  const simulator = '<Installed Simulator Name>';
  const listCommands = [
    ...projects.map((project) => `xcodebuild -list -project ${project}`),
    ...workspaces.map((workspace) => `xcodebuild -list -workspace ${workspace}`),
  ];
  const buildContainer = workspaces[0] ? { flag: '-workspace', path: workspaces[0] } : projects[0] ? { flag: '-project', path: projects[0] } : null;
  const xcodebuildAction = validationCommandActionFor(input);
  const finalXcodeCommand = buildContainer ? `xcodebuild ${xcodebuildAction} ${buildContainer.flag} ${buildContainer.path} -scheme ${scheme} -destination 'platform=iOS Simulator,name=${simulator}'` : null;
  const suggestedCommands = buildContainer
    ? [...listCommands, finalXcodeCommand]
    : detectedValidationCommands(evidenceText);
  const xcodeValidationDescription = xcodebuildAction === 'test' ? 'validation command' : 'simulator/device build';
  const actionBody = buildContainer
    ? [
      'This is a validation experiment, not an implementation task. Make the validation command actionable before reading broad repository context.',
      '1. Run Xcode metadata discovery first using the commands in Suggested Commands.',
      schemes.length > 1 ? `2. Use shared scheme ${scheme}; multiple schemes were detected, so this package chose the first scheme by stable alphabetical sort. If that is not the intended validation target, report the local metadata evidence before changing it.` : schemes.length === 1 ? `2. Use shared scheme ${scheme} from repository-local validation evidence.` : '2. Select an available shared scheme from the local project/workspace metadata. Because no deterministic scheme was detected, replace `<Scheme>` with a scheme reported by `xcodebuild -list`.',
      `3. Run the xcodebuild ${xcodebuildAction} ${xcodeValidationDescription} if possible. If the package uses \`<Installed Simulator Name>\`, replace it with an installed simulator name from the local machine.`,
      '4. Do not modify source code unless a minimal local change is required to make the validation command runnable.',
      '5. Stop after validation evidence is collected; do not broaden into unrelated repository changes.',
    ].join('\n')
    : [
      'This is a validation experiment, not an implementation task. Make the validation command actionable before reading broad repository context.',
      suggestedCommands.length ? 'Run the detected deterministic package validation command(s) first.' : 'No deterministic validation command was detected from repository intelligence. Inspect local package metadata (for example package.json scripts, Makefile targets, Cargo/Go/Swift manifests, or CI files) and report that no deterministic command was pre-detected if none exists.',
      'Do not modify source code unless a minimal local change is required to make the validation command runnable.',
      'Stop after validation evidence is collected; do not broaden into unrelated repository changes.',
    ].join('\n');
  const commandsBody = suggestedCommands.length
    ? suggestedCommands.map((command) => `- \`${command}\``).join('\n')
    : '- No deterministic validation command detected in this package; inspect local repository metadata and report what was found.';
  const reportBody = [
    '- Commands run, in order.',
    '- Whether each command succeeded or failed.',
    '- Exact terminal errors, exit codes, missing scheme/simulator names, or unavailable tooling.',
    '- The final validation conclusion and whether repository intelligence should be refreshed afterward.',
  ].join('\n');
  return [
    { title: 'Validation Task', body: actionBody },
    { title: 'Suggested Commands', body: commandsBody },
    { title: 'What To Report Back', body: reportBody },
  ];
}

export function createExecutionPackage(input: ExecutionPackageInput): ExecutionPackage {
  const repositoryContextPackage = input.repositoryContextPackage?.trim() ?? '';
  const understandingPrompt = input.understandingPrompt?.trim() && repositoryContextPackage ? removeEmbeddedContextPackage(input.understandingPrompt, repositoryContextPackage) : input.understandingPrompt?.trim();
  const validationRequired = input.packageType === 'validation-experiment' || Boolean(understandingPrompt);
  const implementationRequired = input.packageType !== 'validation-experiment' && Boolean(input.implementationPrompt?.trim());
  const sections: Array<{ title: string; body: string }> = [];
  if (input.decisionTitle || input.decisionReason) sections.push({ title: 'Task', body: [input.decisionTitle, input.decisionReason].filter(Boolean).join('\n\n') });
  sections.push({ title: 'Required Execution Instructions', body: 'Use this single execution package as the complete repository-local artifact. Do not ask the repository owner for a second clipboard package before responding. Return your result so the owner can record the outcome in Agent IDE and refresh Repository Intelligence.' });
  if (input.packageType === 'validation-experiment') sections.push(...validationActionSections(input, understandingPrompt));
  if (implementationRequired && input.implementationPrompt?.trim()) sections.push({ title: 'Implementation Instructions', body: input.implementationPrompt.trim() });
  if (validationRequired && understandingPrompt) sections.push({ title: 'Understanding Check', body: understandingPrompt });
  if (repositoryContextPackage) sections.push({ title: 'Context Package', body: repositoryContextPackage });
  sections.push({ title: 'Execution Agent', body: input.executionAgent });
  sections.push({ title: 'Package Metadata', body: [`Package Type: ${input.packageType}`, `Package Version: ${executionPackageVersion}`, ...Object.entries(input.repositoryMetadata ?? {}).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}: ${value}`)].join('\n') });
  return {
    packageType: input.packageType,
    executionAgent: input.executionAgent,
    packageBody: sections.map((section) => `## ${section.title}\n${section.body}`).join('\n\n'),
    packageSections: sections,
    validationRequired,
    implementationRequired,
    packageVersion: executionPackageVersion,
  };
}
