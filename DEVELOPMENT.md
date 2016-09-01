# Development Notes

This document outlines development practices that we follow internally why developing Drop-in.

## Building

```
nvm use
npm install
npm run build
```

This creates the following `dist` structure:

```
dist
└── web
    ├── 1.0.0
    │   ├── css
    │   └── js
    └── dev -> 1.0.0
```

## Testing

```
npm test
```

## Linting

```
npm run lint
```

## Integration app

For internal development, the asset server included in the `js-sdk-integration` app is required.

At the moment, there is no externally available development merchant server set up with this project.
