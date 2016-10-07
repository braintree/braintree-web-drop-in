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
└── web
  └── dropin
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
