import {MatchConfigurationScene} from "./view/scenes/match-configuration-scene";
import {MatchScene} from "./view/scenes/match-scene";
import {registerScenes} from "./core/scene/scene";
import {createReactModal} from "./view/modal/react-modal";
import { GameOverScene } from './view/scenes/game-over-scene';
import { MatchSummary } from 'shared/types';

export const scenes = registerScenes({
    matchConfiguration: MatchConfigurationScene, // a constructor or instance
    match: (stage): MatchScene => {
        const scene = new MatchScene(stage);
        createReactModal();
        return scene;
    },
    gameOver: GameOverScene
});
