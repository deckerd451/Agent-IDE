# Validation

## Last Validation
- 2026-06-26T13:41:12.880Z

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
- Duration: 4.3s
- Output summary:
```text
  npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
  > agent-ide@0.1.0 build
  > tsc -b && vite build
  vite v8.1.0 building client environment for production...
  transforming...✓ 17 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.39 kB │ gzip:  0.26 kB
  dist/assets/index-BxozVQHe.css   11.97 kB │ gzip:  2.92 kB
  dist/assets/index-CrJ36JFK.js   222.33 kB │ gzip: 67.63 kB
  ✓ built in 313ms
```

### npm run test
- Status: PASS
- Exit code: 0
- Duration: 4.3s
- Output summary:
```text
    ---
    duration_ms: 205.601984
    ...
  1..85
  # tests 85
  # suites 0
  # pass 85
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 3770.824618
```

## Xcode Project Validation
- No Xcode project or workspace metadata detected.

## Xcode List Results
- No `xcodebuild -list` commands were run.

## Known Gaps
- No `npm run lint` script was detected; style/static lint coverage is unknown.
- No standalone typecheck script was detected; type validation is covered only insofar as the build runs it.

## Manual Validation Notes
