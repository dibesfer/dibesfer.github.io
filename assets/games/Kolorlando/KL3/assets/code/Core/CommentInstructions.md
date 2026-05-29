# Core Comment Instructions

Core files may use numbered uppercase block comments to explain execution order.

Use this style only in:

- `App.js`
- `Loop.js`
- `Events.js`

Example:

```js
/*
1. THREED
Create renderer, scene and camera.
This is the visual root of KL3.
*/
```

Rules:

- Comments must be numbered by execution order.
- Titles must be uppercase.
- Text must explain purpose, not obvious syntax.
- Do not use numbered orchestration comments outside `Core/`.
- Do not spam comments inside systems; systems should explain themselves by clean code.
