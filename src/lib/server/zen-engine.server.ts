import { ZenEngine } from '@gorules/zen-engine';

type ZenDecisionInput = Parameters<ZenEngine['createDecision']>[0];

export const evaluateZenDecision = async <TResult = unknown>(
	decisionContent: ZenDecisionInput,
	input: Record<string, unknown>
): Promise<TResult> => {
	const engine = new ZenEngine();

	try {
		const decision = engine.createDecision(decisionContent);
		return (await decision.evaluate(input)) as TResult;
	} finally {
		engine.dispose();
	}
};
