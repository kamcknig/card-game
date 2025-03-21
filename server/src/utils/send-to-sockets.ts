import {Socket} from "socket.io";
import { ServerEmitEventNames, ServerEmitEvents } from "shared/types.ts";

export const sendToSockets = <T extends ServerEmitEventNames>(sockets: Iterator<Socket>, event: T, ...args: Parameters<ServerEmitEvents[T]>) => {
    let result = sockets.next();

    while(!result.done) {
        const socket = result.value;
        socket.emit(event, ...args);
        result = sockets.next()
    }
}
