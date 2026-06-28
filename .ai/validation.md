# Validation

## Last Validation
- 2026-06-28T00:07:46.993Z

## Confidence
- Medium

## Overall Status: Passing

## Commands Run
- `npm run build`
- `npm run test`

## Results
### npm run build
- Status: PASS
- Exit code: 0
- Duration: 5.0s
- Output summary:
```text
  npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
  > agent-ide@0.1.0 build
  > tsc -b && vite build
  vite v8.1.0 building client environment for production...
  transforming...✓ 18 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.39 kB │ gzip:  0.26 kB
  dist/assets/index-o4m7tovk.css   16.49 kB │ gzip:  3.81 kB
  dist/assets/index-B6IAqu8G.js   267.02 kB │ gzip: 76.96 kB
  ✓ built in 310ms
```

### npm run test
- Status: PASS
- Exit code: 0
- Duration: 8.2s
- Output summary:
```text
    ---
    duration_ms: 0.541843
    ...
  1..189
  # tests 189
  # suites 0
  # pass 189
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 7704.204593
```

## Xcode Project Validation
- No Xcode project or workspace metadata detected.

## Xcode List Results
- No `xcodebuild -list` commands were run.

## Known Gaps
- No `npm run lint` script was detected; style/static lint coverage is unknown.
- No standalone typecheck script was detected; type validation is covered only insofar as the build runs it.

## Manual Validation Notes
