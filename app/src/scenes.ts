import {MatchConfigurationScene} from "./view/match-configuration-scene";
import {MatchScene} from "./view/match-scene";
import {registerScenes} from "./core/scene/scene";
import {createReactModal} from "./view/modal/react-modal";

export const scenes = registerScenes({
    matchConfiguration: MatchConfigurationScene, // a constructor or instance
    match: (stage): MatchScene => {
        const scene = new MatchScene(stage);
        createReactModal();
        return scene;
    },
});
