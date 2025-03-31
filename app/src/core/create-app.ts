import {Application, TexturePool} from 'pixi.js';

export let app: Application;

export const
    createApp = async () => {
    console.log("Creating app...");
    // Create a new application
    app = new Application();

    (globalThis as any).__PIXI_APP__ = app;

    // Initialize the application
    await app.init({
        antialias: true,
        background: "#1099bb",
        resizeTo: document.getElementById("pixi-container")!
    });
    TexturePool.textureOptions.scaleMode = 'nearest';
    TexturePool.textureOptions.antialias = true;

    app.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Append the application canvas to the document body
    document.getElementById("pixi-container")!.appendChild(app.canvas);
};
