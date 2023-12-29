# WebGL particle life

This project aims to run particle life (many implementations exist, https://ventrella.com/Clusters/ appears to be the first) in the browser by doing as much as possible on the GPU. In practice, this means that all computations are done in fragment shaders, and that all state for the simulation is kept in textures. This means we can have way more particles!

Demo: https://webgl-particle-life.netlify.app/

Note: this project uses some less supported webgl features, so it may not work for you. If that's the case, feel free to open an issue on github with any errors you're seeing.

Here's a screen recording:

https://github.com/ath92/particle-life/assets/1820506/bc94c452-ba87-444b-9eef-0d750d66d574

