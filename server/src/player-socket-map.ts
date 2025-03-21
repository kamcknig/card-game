import { Socket } from 'socket.io';

export let playerSocketMap: Map<number, Socket> = new Map();