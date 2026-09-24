export type PolicyAcceptance = {
	license: {
		id: string;
		name: string | null;
		version: string;
		updatedAt: string;
	};
	agreement: {
		id: string;
		licenseId: string;
		userId: string;
		isAccepted: boolean;
		acceptedAt: string;
	};
};

export const acceptLatestPolicy = async (): Promise<PolicyAcceptance> => {
	const response = await fetch('/api/me/policies', { method: 'PUT' });
	const result = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(result?.message ?? 'Het accepteren van het beleid is mislukt.');
	}

	return result;
};
