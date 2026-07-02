export function detectRepositoryProfile({ files = [], packageJson = null, validationMarkdown = '' } = {}) {
  const normalizedFiles = files.map((file) => String(file).replaceAll('\\\\', '/'));
  const hasXcode = normalizedFiles.some((file) => /\.(?:xcodeproj|xcworkspace)(?:\/|$)/.test(file)) || /Xcode Project Validation|\.xcodeproj|\.xcworkspace|xcodebuild\s+-list/i.test(validationMarkdown);
  const hasSwiftPackage = normalizedFiles.some((file) => /(^|\/)Package\.swift$/.test(file)) || /Package\.swift|swift\s+test/i.test(validationMarkdown);
  const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const hasPackageJson = Boolean(packageJson) || normalizedFiles.some((file) => /(^|\/)package\.json$/.test(file));
  const hasNpmScripts = Object.keys(scripts).length > 0 || /npm\s+(?:run\s+)?(?:build|test|lint)/i.test(validationMarkdown);
  const packagePrimaryEvidence = /Primary build system:\s*(?:npm|Node|package\.json)|Repository type:\s*(?:Node|JavaScript|TypeScript)/i.test(validationMarkdown);
  const xcodePrimaryEvidence = /Primary build system:\s*(?:Xcode|Swift Package Manager|SwiftPM)|Repository type:\s*(?:Xcode\/iOS|iOS|Swift)/i.test(validationMarkdown);

  if (hasXcode || xcodePrimaryEvidence) {
    return {
      repositoryType: hasSwiftPackage ? 'Xcode/iOS + Swift Package' : 'Xcode/iOS',
      primaryBuildSystem: hasSwiftPackage && !hasXcode ? 'Swift Package Manager' : 'Xcode',
      packageJsonIsPrimary: packagePrimaryEvidence && !hasXcode,
      hasXcode,
      hasSwiftPackage,
      hasPackageJson,
      hasNpmScripts,
    };
  }
  if (hasPackageJson || hasNpmScripts) {
    return { repositoryType: 'Node/JavaScript', primaryBuildSystem: 'npm/package.json', packageJsonIsPrimary: true, hasXcode, hasSwiftPackage, hasPackageJson, hasNpmScripts };
  }
  if (hasSwiftPackage) {
    return { repositoryType: 'Swift Package', primaryBuildSystem: 'Swift Package Manager', packageJsonIsPrimary: false, hasXcode, hasSwiftPackage, hasPackageJson, hasNpmScripts };
  }
  return { repositoryType: 'Unknown', primaryBuildSystem: 'Not detected', packageJsonIsPrimary: false, hasXcode, hasSwiftPackage, hasPackageJson, hasNpmScripts };
}

export function isNpmValidationCandidate(text = '') {
  return /npm\s+(?:run\s+)?(?:build|test|lint|typecheck|check)|package scripts?|package\.json/i.test(text);
}

export function isXcodeValidationCandidate(text = '') {
  return /xcodebuild|Xcode|\.xcodeproj|\.xcworkspace|SwiftLint|swift\s+test|Swift Package|simulator|device build/i.test(text);
}
