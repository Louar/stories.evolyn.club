import { spawn } from 'node:child_process';
import { withTestSchema } from './database.ts';

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

try {
	await withTestSchema(
		process.env,
		() =>
			new Promise<void>((resolve, reject) => {
				if (shutdown.signal.aborted) return resolve();
				const url = new URL(process.env.E2E_BASE_URL!);
				const child = spawn(
					process.execPath,
					[
						'node_modules/vite/bin/vite.js',
						'dev',
						'--mode',
						'test',
						'--host',
						url.hostname.replace(/^\[|\]$/g, ''),
						'--port',
						url.port || '80',
						'--strictPort'
					],
					{ stdio: 'inherit', env: process.env }
				);
				const terminate = () => child.kill('SIGTERM');
				shutdown.signal.addEventListener('abort', terminate, { once: true });
				child.once('error', reject);
				child.once('exit', (code, signal) => {
					shutdown.signal.removeEventListener('abort', terminate);
					if (shutdown.signal.aborted || code === 0) resolve();
					else reject(new Error(`E2E server exited with ${signal ?? code}.`));
				});
			})
	);
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	process.off('SIGTERM', stop);
	process.off('SIGINT', stop);
}
