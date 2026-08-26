<script lang="ts">
	import {
		Body,
		Button,
		Container,
		Head,
		Heading,
		Hr,
		Html,
		Img,
		Link,
		Preview,
		Section,
		Text
	} from '@better-svelte-email/components';

	interface Props {
		clientName: string;
		administrationEmail: string;
		resetUrl: string;
		name?: string | null;
		logoUrl?: string;
		preview?: string;
	}

	let {
		clientName,
		administrationEmail,
		resetUrl,
		name,
		logoUrl,
		preview = `Reset your ${clientName} password`
	}: Props = $props();

	const greeting = $derived(name?.trim() || 'there');
</script>

<Html>
	<Head />
	<Body class="m-0 bg-muted px-4 py-10 font-sans text-foreground">
		<Preview {preview} />

		<Container
			class="mx-auto w-full max-w-130 overflow-hidden rounded-2xl border border-border bg-background"
		>
			<Section class="bg-primary px-8 py-7 text-primary-foreground">
				{#if logoUrl}
					<Img
						src={logoUrl}
						width="48"
						height="48"
						alt={`${clientName} logo`}
						class="mb-4 rounded-lg"
					/>
				{/if}
				<Text class="m-0 text-xs font-semibold tracking-widest text-primary-foreground uppercase">
					{clientName}
				</Text>
				<Heading as="h1" class="mt-3 mb-0 text-3xl leading-9 font-semibold text-primary-foreground">
					Reset your password
				</Heading>
			</Section>

			<Section class="px-8 py-8">
				<Text class="mt-0 mb-4 text-base leading-7 text-foreground">Hello {greeting},</Text>
				<Text class="m-0 text-sm leading-6 text-muted-foreground">
					An administrator for {clientName} requested a password reset for your account. Use the secure
					link below to choose a new password.
				</Text>

				<Section class="my-8 text-center">
					<Button
						href={resetUrl}
						pX={24}
						pY={14}
						class="rounded-lg bg-primary text-center text-sm font-semibold text-primary-foreground no-underline"
					>
						Choose a new password
					</Button>
				</Section>

				<Text class="m-0 text-xs leading-5 text-muted-foreground">
					This link expires in one hour. If you did not expect this email, you can safely ignore it;
					your current password will remain unchanged.
				</Text>

				<Hr class="mx-0 my-6 border-border" />

				<Text class="m-0 text-xs leading-5 text-muted-foreground">
					If the button does not work, copy this address into your browser:<br />
					<Link href={resetUrl} class="break-all text-primary underline">{resetUrl}</Link>
				</Text>
				<Text class="mt-5 mb-0 text-xs leading-5 text-muted-foreground">
					Need help? Contact
					<Link href={`mailto:${administrationEmail}`} class="text-primary underline">
						{administrationEmail}
					</Link>.
				</Text>
			</Section>
		</Container>
	</Body>
</Html>
