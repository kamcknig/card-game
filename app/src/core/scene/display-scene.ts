import { isSceneCtor, Scene, SceneData, SceneFactory, SceneNames } from "./scene";
import {scenes} from "../../scenes";
import {app} from "../create-app";

let scene: Scene;

export async function displayScene<K extends SceneNames>(
    sceneName: K,
    sceneConfig?: SceneData<K>
) {
    console.log('display scene', sceneName, sceneConfig);
    if (scene) {
        app.stage.removeChild(scene).destroy();
    }

    const sceneValue = scenes[sceneName];

    // 1) If it's a function that returns a scene-or-constructor, call it first
    if (typeof sceneValue === 'function' && !isSceneCtor(sceneValue)) {
        const result = (sceneValue as SceneFactory<Scene<any>>)(app.stage);
        if (isSceneCtor(result)) {
            scene = new result(app.stage, sceneConfig);
        } else {
            scene = result; // if it's already a Scene instance
        }
    }
    // 2) If it's a constructor, instantiate it
    else if (isSceneCtor(sceneValue)) {
        scene = new sceneValue(app.stage);
    }
    // 3) Otherwise, it must be an existing Scene
    else {
        scene = sceneValue;
    }

    await scene.initialize(sceneConfig);
    app.stage.addChild(scene);
}