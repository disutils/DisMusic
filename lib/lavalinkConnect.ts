import { lavalinkConfig } from './lavalinkConfig';
import { Shoukaku } from 'shoukaku';

const nodes = [
    {
        name: 'main',
        url: `${lavalinkConfig.host}:${lavalinkConfig.port}`,
        auth: lavalinkConfig.password,
        secure: lavalinkConfig.port === 443
    }
];

// Dummy connector for standalone usage
class DummyConnector {
    on() {}
    once() {}
    emit() {}
    removeListener() {}
}

let shoukaku: Shoukaku | null = null;

export function getLavalinkClient() {
    if (!shoukaku) {
        shoukaku = new Shoukaku(new DummyConnector() as any, nodes);

        shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] Node "${name}" connected.`);
        });

        shoukaku.on('disconnect', (name, reason) => {
            console.log(`[Lavalink] Node "${name}" disconnected. Reason:`, reason);
        });

        shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] Node "${name}" error:`, error);
        });
    }
    return shoukaku;
}