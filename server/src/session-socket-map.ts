import { Socket } from 'socket.io';

export let sessionSocketMap: Map<string, Socket> = new Map();