import {MatchConfigurationScene} from "./view/match-configuration-scene";
import {MatchScene} from "./view/match-scene";
import {registerScenes} from "./core/scene/scene";
import {createCardChoiceModal} from "./view/modal/card-choice-modal";
import {createReactModal} from "./view/modal/react-modal";

export const scenes = registerScenes({
    matchConfiguration: MatchConfigurationScene, // a constructor or instance
    match: (stage): MatchScene => {
        const scene = new MatchScene(stage);
        createCardChoiceModal();
        createReactModal();
        /*new CardEffectController(effectHandlerMapFactory);*/
        return scene;
    },
});
