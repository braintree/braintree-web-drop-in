# Development Notes

This document outlines development practices that we follow internally while developing Drop-in.

## Building

```
nvm use
npm install
npm run build
```

This creates the following `dist` structure:

```
dist
├── npm/
└── web/
    └── dropin/
        ├── 1.0.0/
        │   ├── css/
        │   └── js/
        └── dev -> 1.0.0/
```

`dist/npm` contains the pre-processed source files that are published to npm.

`dist/web/` mirrors the structure of Drop-in assets available at https://assets.braintreegateway.com.

`dist/web/dropin/dev` assets are available only in development and are never deployed.

**Note:** If you are developing on a Windows machine, you will need to run your command prompt as an administrator so the symlinking step succeeds.

## Testing

```
npm test
```

## Linting

```
npm run lint
```
