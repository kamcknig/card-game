import {MatchConfigurationScene} from "../view/scenes/match-configuration-scene";
import {MatchScene} from "../view/scenes/match-scene";
import {registerScenes} from "./scene/scene";
import { GameOverScene } from '../view/scenes/game-over-scene';

export const scenes = registerScenes({
    matchConfiguration: MatchConfigurationScene, // a constructor or instance
    match: (stage): MatchScene => {
        return new MatchScene(stage);
    },
    gameOver: GameOverScene
});
