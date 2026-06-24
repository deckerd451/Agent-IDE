import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalCwd = process.cwd();
const fixtureRoot = await mkdtemp(join(tmpdir(), 'agent-ide-xcode-'));

try {
  process.chdir(fixtureRoot);
  await mkdir('Beacon.xcodeproj');
  await mkdir('Beacon.xcworkspace');
  await mkdir('Nested');
  await mkdir(join('Nested', 'Nearify.xcodeproj'));
  await mkdir('node_modules');
  await mkdir(join('node_modules', 'Ignored.xcodeproj'));

  const {
    detectXcodeCommands,
    detectXcodeProjects,
    formatXcodeMetadata,
    formatXcodeResults,
    parseXcodeSchemes,
  } = await import(`../scripts/validate-intel.mjs?fixture=${Date.now()}`);

  const xcodeProjects = await detectXcodeProjects();
  assert.deepEqual(xcodeProjects.projects, ['Beacon.xcodeproj', 'Nested/Nearify.xcodeproj']);
  assert.deepEqual(xcodeProjects.workspaces, ['Beacon.xcworkspace']);

  const commands = detectXcodeCommands(xcodeProjects);
  assert.deepEqual(commands.map(({ command }) => command), [
    'xcodebuild -list -project "Beacon.xcodeproj"',
    'xcodebuild -list -project "Nested/Nearify.xcodeproj"',
  ]);

  const schemes = parseXcodeSchemes(`Information about project "Beacon":\n    Targets:\n        Beacon\n\n    Schemes:\n        Beacon\n        BeaconTests\n`);
  assert.deepEqual(schemes, ['Beacon', 'BeaconTests']);

  const metadata = formatXcodeMetadata(xcodeProjects, commands.map(({ command }) => ({ command })));
  assert.match(metadata, /Xcode project validation metadata detected/);
  assert.match(metadata, /Full simulator\/device build: Not run by default/);

  const results = formatXcodeResults([
    {
      command: commands[0].command,
      exitCode: 0,
      durationMs: 25,
      output: '    Schemes:\n        Beacon\n        BeaconTests',
    },
  ]);
  assert.match(results, /Schemes detected: `Beacon`, `BeaconTests`/);
} finally {
  process.chdir(originalCwd);
  await rm(fixtureRoot, { recursive: true, force: true });
}
