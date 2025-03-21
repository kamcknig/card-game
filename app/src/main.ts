import {createApp} from "./core/create-app";
import {createSocket, socket} from "./client-socket";

await createApp().then(() => {
    createSocket();
    socket.on('connect', async () => {
        console.log("Connected!");
    });

    socket.connect();
});
